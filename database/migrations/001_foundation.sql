-- =====================================================
-- FOUNDATION MIGRATION
-- VERSION: 001
-- =====================================================

-- =====================================================
-- REQUIRED EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- SCHEMAS
-- =====================================================

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS itinerary;
CREATE SCHEMA IF NOT EXISTS poi;
CREATE SCHEMA IF NOT EXISTS community;
CREATE SCHEMA IF NOT EXISTS media;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS system;

-- =====================================================
-- COMMON UPDATED_AT TRIGGER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION system.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON SCHEMA auth IS 'Authentication and identity management';
COMMENT ON SCHEMA users IS 'User profiles and user settings';
COMMENT ON SCHEMA itinerary IS 'Travel itinerary management';
COMMENT ON SCHEMA poi IS 'Points of Interest and destination data';
COMMENT ON SCHEMA community IS 'Groups, memberships and posts';
COMMENT ON SCHEMA media IS 'Photos, videos and media assets';
COMMENT ON SCHEMA ai IS 'Future AI and recommendation data';
COMMENT ON SCHEMA analytics IS 'Analytics and reporting';
COMMENT ON SCHEMA system IS 'Internal database functions and utilities';

