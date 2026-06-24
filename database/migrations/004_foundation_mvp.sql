CREATE TABLE auth.users (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id UUID NOT NULL DEFAULT gen_random_uuid(),
status VARCHAR(20) NOT NULL DEFAULT 'active',
created_at TIMESTAMP NOT NULL DEFAULT NOW(),
updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMP NULL
);

CREATE TABLE auth.identities (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
provider VARCHAR(50) NOT NULL,
provider_identifier VARCHAR(255) NOT NULL,
is_verified BOOLEAN NOT NULL DEFAULT FALSE,
is_primary BOOLEAN NOT NULL DEFAULT FALSE,
created_at TIMESTAMP NOT NULL DEFAULT NOW(),
updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_identity
ON auth.identities(provider, provider_identifier);

CREATE TABLE auth.sessions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
refresh_token_hash TEXT NOT NULL,
device_name VARCHAR(255),
device_type VARCHAR(50),
expires_at TIMESTAMP NOT NULL,
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE users.profiles (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
username VARCHAR(100) UNIQUE,
display_name VARCHAR(255),
bio TEXT,
profile_photo_url TEXT,
created_at TIMESTAMP NOT NULL DEFAULT NOW(),
updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE users.connection_requests (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
sender_id UUID NOT NULL REFERENCES auth.users(id),
receiver_id UUID NOT NULL REFERENCES auth.users(id),
status VARCHAR(20) NOT NULL DEFAULT 'pending',
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE users.connections (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_a_id UUID NOT NULL REFERENCES auth.users(id),
user_b_id UUID NOT NULL REFERENCES auth.users(id),
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE poi.countries (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name VARCHAR(255) NOT NULL,
iso_code VARCHAR(10),
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE poi.regions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
country_id UUID NOT NULL REFERENCES poi.countries(id),
name VARCHAR(255) NOT NULL,
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE poi.cities (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
region_id UUID NOT NULL REFERENCES poi.regions(id),
name VARCHAR(255) NOT NULL,
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE poi.poi (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
city_id UUID NOT NULL REFERENCES poi.cities(id),
name VARCHAR(500) NOT NULL,
latitude NUMERIC(10,7),
longitude NUMERIC(10,7),
metadata JSONB,
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE itinerary.itineraries (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
owner_id UUID NOT NULL REFERENCES auth.users(id),
title VARCHAR(500),
status VARCHAR(20) DEFAULT 'active',
visibility VARCHAR(20) DEFAULT 'private',
current_version_id UUID,
created_at TIMESTAMP NOT NULL DEFAULT NOW(),
updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE itinerary.itinerary_versions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
itinerary_id UUID NOT NULL REFERENCES itinerary.itineraries(id) ON DELETE CASCADE,
version_no INTEGER NOT NULL,
data JSONB NOT NULL,
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE itinerary.itinerary_collaborators (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
itinerary_id UUID NOT NULL REFERENCES itinerary.itineraries(id) ON DELETE CASCADE,
user_id UUID NOT NULL REFERENCES auth.users(id),
role VARCHAR(20) NOT NULL DEFAULT 'editor',
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE itinerary.itinerary_shares (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
itinerary_id UUID NOT NULL REFERENCES itinerary.itineraries(id) ON DELETE CASCADE,
share_token UUID NOT NULL DEFAULT gen_random_uuid(),
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE itinerary.itinerary_forks (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
source_itinerary_id UUID NOT NULL REFERENCES itinerary.itineraries(id),
forked_itinerary_id UUID NOT NULL REFERENCES itinerary.itineraries(id),
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE community.groups (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
owner_id UUID NOT NULL REFERENCES auth.users(id),
title VARCHAR(255) NOT NULL,
description TEXT,
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE community.group_members (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
group_id UUID NOT NULL REFERENCES community.groups(id) ON DELETE CASCADE,
user_id UUID NOT NULL REFERENCES auth.users(id),
role VARCHAR(20) DEFAULT 'member',
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE community.group_invitations (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
group_id UUID NOT NULL REFERENCES community.groups(id) ON DELETE CASCADE,
invited_user_id UUID NOT NULL REFERENCES auth.users(id),
status VARCHAR(20) DEFAULT 'pending',
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE media.assets (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
owner_id UUID NOT NULL REFERENCES auth.users(id),
asset_type VARCHAR(20),
storage_url TEXT NOT NULL,
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
