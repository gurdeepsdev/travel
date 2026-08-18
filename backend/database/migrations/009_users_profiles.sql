BEGIN;

CREATE TABLE IF NOT EXISTS users.profiles
(
    user_id UUID PRIMARY KEY,

    username VARCHAR(100) NOT NULL,

    display_name VARCHAR(255),

    bio TEXT,

    avatar_url TEXT,

    country_code VARCHAR(10),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_profiles_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_profiles_username
ON users.profiles(username);

COMMENT ON TABLE users.profiles
IS 'Stores public user profile information.';

COMMENT ON COLUMN users.profiles.user_id
IS 'Reference to auth.users.';

COMMENT ON COLUMN users.profiles.username
IS 'Unique public username.';

COMMENT ON COLUMN users.profiles.display_name
IS 'Display name shown publicly.';

COMMENT ON COLUMN users.profiles.bio
IS 'User biography.';

COMMENT ON COLUMN users.profiles.avatar_url
IS 'Profile image URL.';

COMMENT ON COLUMN users.profiles.country_code
IS 'Country code.';

COMMENT ON COLUMN users.profiles.created_at
IS 'Creation timestamp.';

COMMENT ON COLUMN users.profiles.updated_at
IS 'Last update timestamp.';

COMMIT;