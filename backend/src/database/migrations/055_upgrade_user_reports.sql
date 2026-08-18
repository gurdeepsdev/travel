BEGIN;

DROP INDEX IF EXISTS
  users.idx_users_reports_item;

DROP INDEX IF EXISTS
  users.idx_users_reports_user_id;

DROP INDEX IF EXISTS
  users.uq_users_reports_pending_item;

ALTER TABLE users.users_reports
  DROP CONSTRAINT
    chk_users_reports_item_type_not_empty,

  DROP CONSTRAINT
    chk_users_reports_status;

ALTER TABLE users.users_reports
  RENAME COLUMN
    user_id TO reporter_user_id;

ALTER TABLE users.users_reports
  RENAME CONSTRAINT
    fk_users_reports_user
  TO
    fk_users_reports_reporter;

ALTER TABLE users.users_reports
  ADD COLUMN reported_user_id uuid,

  ADD COLUMN reported_post_id uuid,

  ADD COLUMN reason_code
    varchar(50) NOT NULL,

  ADD COLUMN description
    varchar(500),

  ADD COLUMN reviewed_by uuid,

  ADD COLUMN reviewed_at timestamptz,

  ADD COLUMN resolution_note
    varchar(500),

  ADD COLUMN updated_at
    timestamptz NOT NULL
    DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE users.users_reports
  DROP COLUMN item_type,

  DROP COLUMN item_id;

ALTER TABLE users.users_reports
  ADD CONSTRAINT
    fk_users_reports_reported_user
    FOREIGN KEY (
      reported_user_id
    )
    REFERENCES auth.users(id)
    ON DELETE RESTRICT,

  ADD CONSTRAINT
    fk_users_reports_reported_post
    FOREIGN KEY (
      reported_post_id
    )
    REFERENCES explore.posts(id)
    ON DELETE RESTRICT,

  ADD CONSTRAINT
    fk_users_reports_reviewer
    FOREIGN KEY (
      reviewed_by
    )
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  ADD CONSTRAINT
    chk_users_reports_target
    CHECK (
      (
        reported_user_id
          IS NOT NULL
      )::integer
      +
      (
        reported_post_id
          IS NOT NULL
      )::integer
      = 1
    ),

  ADD CONSTRAINT
    chk_users_reports_not_self
    CHECK (
      reported_user_id
        IS NULL
      OR reported_user_id
        <> reporter_user_id
    ),

  ADD CONSTRAINT
    chk_users_reports_reason
    CHECK (
      reason_code IN (
        'SPAM',
        'HARASSMENT',
        'HATE_SPEECH',
        'NUDITY_OR_SEXUAL_CONTENT',
        'VIOLENCE',
        'MISINFORMATION',
        'IMPERSONATION',
        'INTELLECTUAL_PROPERTY',
        'OTHER'
      )
    ),

  ADD CONSTRAINT
    chk_users_reports_status
    CHECK (
      status IN (
        'PENDING',
        'UNDER_REVIEW',
        'RESOLVED',
        'REJECTED'
      )
    );

CREATE INDEX
  idx_users_reports_reporter
ON users.users_reports (
  reporter_user_id,
  created_at DESC
);

CREATE INDEX
  idx_users_reports_reported_user
ON users.users_reports (
  reported_user_id,
  created_at DESC
)
WHERE reported_user_id
  IS NOT NULL;

CREATE INDEX
  idx_users_reports_reported_post
ON users.users_reports (
  reported_post_id,
  created_at DESC
)
WHERE reported_post_id
  IS NOT NULL;

CREATE UNIQUE INDEX
  uq_users_reports_active_user
ON users.users_reports (
  reporter_user_id,
  reported_user_id
)
WHERE reported_user_id
    IS NOT NULL
  AND status IN (
    'PENDING',
    'UNDER_REVIEW'
  );

CREATE UNIQUE INDEX
  uq_users_reports_active_post
ON users.users_reports (
  reporter_user_id,
  reported_post_id
)
WHERE reported_post_id
    IS NOT NULL
  AND status IN (
    'PENDING',
    'UNDER_REVIEW'
  );

COMMENT ON TABLE
  users.users_reports
IS
  'Reports submitted against user profiles or posts for moderation.';

COMMENT ON COLUMN
  users.users_reports.reported_user_id
IS
  'Reported profile. Mutually exclusive with reported_post_id.';

COMMENT ON COLUMN
  users.users_reports.reported_post_id
IS
  'Reported post. Mutually exclusive with reported_user_id.';

COMMIT;
