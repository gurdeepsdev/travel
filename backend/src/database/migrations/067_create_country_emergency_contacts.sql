BEGIN;

CREATE TABLE poi.country_emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES poi.countries(id),
  service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('GENERAL','POLICE','AMBULANCE','FIRE')),
  name VARCHAR(150) NOT NULL CHECK (length(trim(name)) > 0),
  phone_number VARCHAR(50) NOT NULL CHECK (length(trim(phone_number)) > 0),
  notes TEXT,
  source_url TEXT NOT NULL CHECK (source_url ~ '^https://'),
  verified_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (country_id, service_type, phone_number)
);
CREATE INDEX idx_country_emergency_contacts_active
  ON poi.country_emergency_contacts(country_id) WHERE is_active;

COMMIT;
