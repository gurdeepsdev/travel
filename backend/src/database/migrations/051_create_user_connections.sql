BEGIN;

-- =====================================================
-- Connection request lifecycle
-- =====================================================

CREATE TABLE users.connection_requests (
  id UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),

  sender_user_id UUID NOT NULL,
  receiver_user_id UUID NOT NULL,

  status VARCHAR(20) NOT NULL
    DEFAULT 'PENDING',

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  resolved_at TIMESTAMP,

  CONSTRAINT chk_connection_requests_not_self
    CHECK (
      sender_user_id <>
      receiver_user_id
    ),

  CONSTRAINT chk_connection_requests_status
    CHECK (
      status IN (
        'PENDING',
        'ACCEPTED',
        'REJECTED',
        'CANCELLED'
      )
    ),

  CONSTRAINT chk_connection_requests_resolution
    CHECK (
      (
        status = 'PENDING'
        AND resolved_at IS NULL
      )
      OR
      (
        status IN (
          'ACCEPTED',
          'REJECTED',
          'CANCELLED'
        )
        AND resolved_at IS NOT NULL
      )
    ),

  CONSTRAINT fk_connection_requests_sender
    FOREIGN KEY (
      sender_user_id
    )
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_connection_requests_receiver
    FOREIGN KEY (
      receiver_user_id
    )
    REFERENCES auth.users(id)
    ON DELETE CASCADE
);

-- Only one pending request may exist between the same
-- two users, regardless of direction.
CREATE UNIQUE INDEX
  uq_connection_requests_pending_pair
ON users.connection_requests (
  LEAST(
    sender_user_id,
    receiver_user_id
  ),
  GREATEST(
    sender_user_id,
    receiver_user_id
  )
)
WHERE status = 'PENDING';

CREATE INDEX
  idx_connection_requests_incoming
ON users.connection_requests (
  receiver_user_id,
  created_at DESC,
  id DESC
);

CREATE INDEX
  idx_connection_requests_outgoing
ON users.connection_requests (
  sender_user_id,
  created_at DESC,
  id DESC
);

CREATE INDEX
  idx_connection_requests_incoming_pending
ON users.connection_requests (
  receiver_user_id,
  created_at DESC,
  id DESC
)
WHERE status = 'PENDING';

CREATE INDEX
  idx_connection_requests_outgoing_pending
ON users.connection_requests (
  sender_user_id,
  created_at DESC,
  id DESC
)
WHERE status = 'PENDING';

CREATE TRIGGER
  trg_connection_requests_set_updated_at
BEFORE UPDATE
ON users.connection_requests
FOR EACH ROW
EXECUTE FUNCTION
  public.set_updated_at();

-- =====================================================
-- Accepted symmetric connections
-- =====================================================

CREATE TABLE users.connections (
  id UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),

  user_low_id UUID NOT NULL,
  user_high_id UUID NOT NULL,

  connected_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_connections_canonical_pair
    CHECK (
      user_low_id <
      user_high_id
    ),

  CONSTRAINT uq_connections_pair
    UNIQUE (
      user_low_id,
      user_high_id
    ),

  CONSTRAINT fk_connections_user_low
    FOREIGN KEY (
      user_low_id
    )
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_connections_user_high
    FOREIGN KEY (
      user_high_id
    )
    REFERENCES auth.users(id)
    ON DELETE CASCADE
);

CREATE INDEX
  idx_connections_user_low
ON users.connections (
  user_low_id,
  connected_at DESC,
  id DESC
);

CREATE INDEX
  idx_connections_user_high
ON users.connections (
  user_high_id,
  connected_at DESC,
  id DESC
);

-- =====================================================
-- Blocking cleanup
-- =====================================================
-- Creating a block:
-- 1. Cancels any pending request between the users.
-- 2. Removes their accepted connection.
-- Rejected/accepted/cancelled request history remains.
-- =====================================================

CREATE OR REPLACE FUNCTION
  users.cleanup_connections_on_block()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE users.connection_requests
  SET
    status = 'CANCELLED',
    resolved_at = CURRENT_TIMESTAMP
  WHERE status = 'PENDING'
    AND (
      (
        sender_user_id =
          NEW.user_id
        AND receiver_user_id =
          NEW.blocked_user_id
      )
      OR
      (
        sender_user_id =
          NEW.blocked_user_id
        AND receiver_user_id =
          NEW.user_id
      )
    );

  DELETE FROM users.connections
  WHERE
    (
      user_low_id =
        LEAST(
          NEW.user_id,
          NEW.blocked_user_id
        )
      AND user_high_id =
        GREATEST(
          NEW.user_id,
          NEW.blocked_user_id
        )
    );

  RETURN NEW;
END;
$function$;

CREATE TRIGGER
  trg_blocked_users_cleanup_connections
AFTER INSERT
ON users.blocked_users
FOR EACH ROW
EXECUTE FUNCTION
  users.cleanup_connections_on_block();

COMMENT ON TABLE
  users.connection_requests
IS
  'Connection-request lifecycle and history between users.';

COMMENT ON TABLE
  users.connections
IS
  'Accepted symmetric user connections stored as canonical UUID pairs.';

COMMENT ON COLUMN
  users.connection_requests.resolved_at
IS
  'Time at which the request was accepted, rejected, or cancelled.';

COMMENT ON COLUMN
  users.connections.user_low_id
IS
  'Lexicographically smaller UUID in the connected pair.';

COMMENT ON COLUMN
  users.connections.user_high_id
IS
  'Lexicographically larger UUID in the connected pair.';

COMMIT;
