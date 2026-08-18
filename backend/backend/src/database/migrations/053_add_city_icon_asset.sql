BEGIN;

ALTER TABLE poi.cities
  ADD COLUMN icon_asset_id UUID;

ALTER TABLE poi.cities
  ADD CONSTRAINT
    fk_cities_icon_asset
  FOREIGN KEY (
    icon_asset_id
  )
  REFERENCES media.assets(id)
  ON DELETE SET NULL;

CREATE INDEX
  idx_cities_icon_asset
ON poi.cities (
  icon_asset_id
)
WHERE icon_asset_id IS NOT NULL;

COMMENT ON COLUMN
  poi.cities.icon_asset_id
IS
  'Canonical icon displayed for this city in verified-city collections and profile preferences.';

COMMIT;
