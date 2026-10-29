BEGIN;
CREATE SCHEMA IF NOT EXISTS notification;
CREATE TABLE notification.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_key VARCHAR(200) NOT NULL,
  type VARCHAR(80) NOT NULL,
  category VARCHAR(40) NOT NULL,
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  title VARCHAR(120) NOT NULL,
  body VARCHAR(500) NOT NULL,
  target JSONB NOT NULL,
  in_app BOOLEAN NOT NULL,
  push BOOLEAN NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(user_id,event_key)
);
CREATE INDEX idx_notification_inbox ON notification.notifications(user_id,created_at DESC,id DESC) WHERE in_app;
CREATE INDEX idx_notification_unread ON notification.notifications(user_id) WHERE in_app AND read_at IS NULL;
CREATE TABLE notification.preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category VARCHAR(40) NOT NULL CHECK (category IN ('CONNECTIONS','CHAT','GROUPS','TRIPS','TRAVEL','EXPLORE','VERIFICATION','EXPENSES','MODERATION','DOCUMENTS')),
  in_app BOOLEAN NOT NULL DEFAULT TRUE,
  push BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,category)
);
CREATE TABLE notification.event_outbox (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notification.notifications(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL CHECK (event_type IN ('notification.created','notification.read')),
  payload JSONB NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_notification_outbox_due ON notification.event_outbox(next_attempt_at,id) WHERE completed_at IS NULL;
COMMIT;
