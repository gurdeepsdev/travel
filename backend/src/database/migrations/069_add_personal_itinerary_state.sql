BEGIN;

CREATE TABLE itinerary.user_itinerary_states (
  itinerary_id uuid NOT NULL REFERENCES itinerary.itineraries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED','UPCOMING','LIVE','COMPLETED','CANCELLED')),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (itinerary_id,user_id)
);
CREATE INDEX idx_user_itinerary_states_user_status ON itinerary.user_itinerary_states(user_id,status,itinerary_id);

INSERT INTO itinerary.user_itinerary_states(itinerary_id,user_id,status,started_at,completed_at)
SELECT i.id,i.created_by,
  CASE WHEN t.status='ONGOING' THEN 'LIVE' ELSE COALESCE(t.status,'PLANNED') END,
  t.started_at AT TIME ZONE 'UTC',t.completed_at AT TIME ZONE 'UTC'
FROM itinerary.itineraries i LEFT JOIN trip.trips t ON t.itinerary_id=i.id;

CREATE FUNCTION itinerary.initialize_owner_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO itinerary.user_itinerary_states(itinerary_id,user_id) VALUES (NEW.id,NEW.created_by)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_itinerary_owner_state AFTER INSERT ON itinerary.itineraries
FOR EACH ROW EXECUTE FUNCTION itinerary.initialize_owner_state();

CREATE FUNCTION itinerary.sync_group_personal_states(target_group uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE linked uuid; owner_user uuid;
BEGIN
  SELECT itinerary_id,owner_id INTO linked,owner_user FROM groups.groups
  WHERE id=target_group AND status='ACTIVE' AND deleted_at IS NULL;
  IF linked IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(linked::text,0));
  INSERT INTO trip.trips(itinerary_id,user_id,status)
  VALUES (linked,owner_user,'PLANNED') ON CONFLICT (itinerary_id) DO NOTHING;
  INSERT INTO itinerary.user_itinerary_states(itinerary_id,user_id)
  SELECT linked,user_id FROM groups.group_members WHERE group_id=target_group AND status='ACTIVE'
  ON CONFLICT DO NOTHING;
  INSERT INTO trip.trip_participants(trip_id,user_id,added_by)
  SELECT t.id,m.user_id,m.added_by FROM trip.trips t
  JOIN groups.group_members m ON m.group_id=target_group AND m.status='ACTIVE'
  WHERE t.itinerary_id=linked
  ON CONFLICT (trip_id,user_id) DO UPDATE SET status='ACTIVE',removed_at=NULL,updated_at=CURRENT_TIMESTAMP;
END;
$$;
CREATE FUNCTION itinerary.sync_group_state_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='groups' THEN
    PERFORM itinerary.sync_group_personal_states(NEW.id);
  ELSE
    PERFORM itinerary.sync_group_personal_states(NEW.group_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_group_personal_states AFTER INSERT OR UPDATE OF itinerary_id ON groups.groups
FOR EACH ROW EXECUTE FUNCTION itinerary.sync_group_state_trigger();
CREATE TRIGGER trg_member_personal_state AFTER INSERT OR UPDATE OF status ON groups.group_members
FOR EACH ROW WHEN (NEW.status='ACTIVE') EXECUTE FUNCTION itinerary.sync_group_state_trigger();

SELECT itinerary.sync_group_personal_states(id) FROM groups.groups
WHERE itinerary_id IS NOT NULL AND status='ACTIVE' AND deleted_at IS NULL;
COMMIT;
