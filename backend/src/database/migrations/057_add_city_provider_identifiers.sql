BEGIN;

ALTER TABLE poi.cities
  ADD COLUMN IF NOT EXISTS
    provider varchar(50),

  ADD COLUMN IF NOT EXISTS
    provider_id varchar(255);

ALTER TABLE poi.cities
  DROP CONSTRAINT IF EXISTS
    chk_cities_provider_identifier_pair;

ALTER TABLE poi.cities
  ADD CONSTRAINT
    chk_cities_provider_identifier_pair
  CHECK (
    (
      provider IS NULL
      AND provider_id IS NULL
    )
    OR (
      provider IS NOT NULL
      AND BTRIM(provider) <> ''
      AND provider_id IS NOT NULL
      AND BTRIM(provider_id) <> ''
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_cities_provider_provider_id
ON poi.cities (
  provider,
  provider_id
)
WHERE provider IS NOT NULL
  AND provider_id IS NOT NULL;

COMMENT ON COLUMN
  poi.cities.provider
IS
  'External catalogue provider, for example GOOGLE_PLACES.';

COMMENT ON COLUMN
  poi.cities.provider_id
IS
  'City identifier assigned by the external catalogue provider.';

COMMIT;
