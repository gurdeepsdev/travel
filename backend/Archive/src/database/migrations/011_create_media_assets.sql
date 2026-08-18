BEGIN;

----------------------------------------------------------
-- Schema
----------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS media;

----------------------------------------------------------
-- Table: media.assets
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS media.assets (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    storage_provider VARCHAR(30) NOT NULL,

    bucket VARCHAR(255) NOT NULL,

    storage_key TEXT NOT NULL,

    original_filename VARCHAR(255) NOT NULL,

    mime_type VARCHAR(100) NOT NULL,

    extension VARCHAR(20),

    file_size BIGINT NOT NULL,

    checksum VARCHAR(64) NOT NULL,

    original_width INTEGER,

    original_height INTEGER,

    duration_seconds INTEGER,

    uploaded_by UUID NOT NULL,

    is_public BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    ------------------------------------------------------
    -- Constraints
    ------------------------------------------------------

    CONSTRAINT chk_storage_provider
    CHECK (
        storage_provider IN (
            'local',
            's3',
            'r2',
            'azure',
            'cloudinary'
        )
    ),

    CONSTRAINT chk_file_size
    CHECK (file_size >= 0),

    CONSTRAINT chk_dimensions
    CHECK (
        (
            original_width IS NULL
            AND original_height IS NULL
        )
        OR
        (
            original_width > 0
            AND original_height > 0
        )
    ),

    CONSTRAINT chk_duration
    CHECK (
        duration_seconds IS NULL
        OR duration_seconds >= 0
    ),

    CONSTRAINT uq_assets_checksum
    UNIQUE(checksum),

    CONSTRAINT fk_assets_uploaded_by
    FOREIGN KEY(uploaded_by)
    REFERENCES auth.users(id)
    ON DELETE CASCADE

);

----------------------------------------------------------
-- Indexes
----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_assets_uploaded_by
ON media.assets(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_assets_storage_provider
ON media.assets(storage_provider);

CREATE INDEX IF NOT EXISTS idx_assets_created_at
ON media.assets(created_at);

CREATE INDEX IF NOT EXISTS idx_assets_public
ON media.assets(is_public);

CREATE INDEX IF NOT EXISTS idx_assets_mime_type
ON media.assets(mime_type);

COMMIT;
