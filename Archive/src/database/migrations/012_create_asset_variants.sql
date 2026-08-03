BEGIN;

----------------------------------------------------------
-- Table: media.asset_variants
----------------------------------------------------------
-- Stores all generated versions of an uploaded asset.
--
-- Example:
--
-- Original
--    ├── Thumbnail (400x300)
--    ├── Medium (800x600)
--    ├── Large (1920x1080)
--    ├── WebP
--    └── AVIF
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS media.asset_variants (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    asset_id UUID NOT NULL,

    variant_name VARCHAR(50) NOT NULL,

    format VARCHAR(20) NOT NULL,

    quality SMALLINT,

    width INTEGER NOT NULL,

    height INTEGER NOT NULL,

    storage_key TEXT NOT NULL,

    file_size BIGINT NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    ------------------------------------------------------
    -- Constraints
    ------------------------------------------------------

    CONSTRAINT fk_asset_variants_asset
        FOREIGN KEY (asset_id)
        REFERENCES media.assets(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_variant_dimensions
        CHECK (
            width > 0
            AND height > 0
        ),

    CONSTRAINT chk_variant_file_size
        CHECK (
            file_size >= 0
        ),

    CONSTRAINT chk_variant_quality
        CHECK (
            quality IS NULL
            OR (
                quality >= 1
                AND quality <= 100
            )
        ),

    CONSTRAINT chk_variant_name
        CHECK (
            variant_name IN (
                'original',
                'thumbnail',
                'small',
                'medium',
                'large',
                'custom'
            )
        ),

    CONSTRAINT chk_variant_format
        CHECK (
            format IN (
                'jpg',
                'jpeg',
                'png',
                'webp',
                'avif',
                'gif',
                'mp4',
                'webm'
            )
        ),

    CONSTRAINT uq_asset_variant
        UNIQUE (
            asset_id,
            variant_name,
            format,
            quality
        )

);

----------------------------------------------------------
-- Indexes
----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_asset_variants_asset
ON media.asset_variants(asset_id);

CREATE INDEX IF NOT EXISTS idx_asset_variants_name
ON media.asset_variants(variant_name);

CREATE INDEX IF NOT EXISTS idx_asset_variants_format
ON media.asset_variants(format);

CREATE INDEX IF NOT EXISTS idx_asset_variants_quality
ON media.asset_variants(quality);

CREATE INDEX IF NOT EXISTS idx_asset_variants_dimensions
ON media.asset_variants(width, height);

COMMIT;
