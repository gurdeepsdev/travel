-- =====================================================
-- USER PROFILES
-- =====================================================

CREATE TABLE users.profiles (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

```
user_id UUID NOT NULL UNIQUE,

username VARCHAR(50) NOT NULL UNIQUE,

display_name VARCHAR(150) NOT NULL,

bio TEXT,

profile_photo_url TEXT,

country_code VARCHAR(10),

created_at TIMESTAMP NOT NULL DEFAULT NOW(),
updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

CONSTRAINT fk_profile_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
```

);

CREATE INDEX idx_profiles_username
ON users.profiles(username);

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON users.profiles
FOR EACH ROW
EXECUTE FUNCTION system.update_updated_at_column();

