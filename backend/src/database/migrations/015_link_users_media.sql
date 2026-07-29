BEGIN;

----------------------------------------------------------
-- Link Users Profile → Media Assets
----------------------------------------------------------

ALTER TABLE users.profiles

ADD CONSTRAINT fk_profiles_profile_photo
FOREIGN KEY (profile_photo_asset_id)
REFERENCES media.assets(id)
ON DELETE SET NULL;

ALTER TABLE users.profiles

ADD CONSTRAINT fk_profiles_cover_photo
FOREIGN KEY (cover_photo_asset_id)
REFERENCES media.assets(id)
ON DELETE SET NULL;

COMMIT;
