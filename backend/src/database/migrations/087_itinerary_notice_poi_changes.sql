BEGIN;
ALTER TABLE itinerary.itinerary_change_requests ADD COLUMN IF NOT EXISTS base_days JSONB;
-- A legacy request can be snapshotted safely only while its original version still exists.
UPDATE itinerary.itinerary_change_requests r SET base_days=i.itinerary_json->'days'
FROM itinerary.itineraries i WHERE r.itinerary_id=i.id AND r.base_days IS NULL
  AND r.status='PENDING' AND r.base_itinerary_updated_at=i.updated_at;
ALTER TABLE chat.chat_messages ADD COLUMN IF NOT EXISTS change_request_changes JSONB;
COMMIT;
