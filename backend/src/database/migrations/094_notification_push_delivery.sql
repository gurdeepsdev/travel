BEGIN;
CREATE TABLE notification.push_outbox (
  id BIGSERIAL PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES notification.notifications(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES chat.push_devices(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()+INTERVAL '1 day',
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_code VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(notification_id,device_id)
);
CREATE INDEX idx_notification_push_due ON notification.push_outbox(next_attempt_at,id) WHERE completed_at IS NULL;
COMMIT;
