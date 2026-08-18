BEGIN;

----------------------------------------------------------
-- Table: media.asset_usage
----------------------------------------------------------
-- Tracks where every media asset is used throughout
-- the platform.
--
-- Examples:
--
-- user_profile   -> avatar
-- user_profile   -> cover
-- page           -> logo
-- page           -> cover
-- itinerary      -> gallery
-- poi            -> hero
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS media.asset_usage (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    asset_id UUID NOT NULL,

    entity_type VARCHAR(50) NOT NULL,

    entity_id UUID NOT NULL,

    asset_role VARCHAR(50) NOT NULL,

    display_order SMALLINT NOT NULL DEFAULT 1,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    ------------------------------------------------------
    -- Constraints
    ------------------------------------------------------

    CONSTRAINT fk_asset_usage_asset
        FOREIGN KEY (asset_id)
        REFERENCES media.assets(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_display_order
        CHECK (display_order >= 1),

    CONSTRAINT chk_entity_type
        CHECK (
            entity_type IN (
                'user_profile',
                'page',
                'itinerary',
                'poi',
                'community_post',
                'community_comment',
                'message',
                'review',
                'album'
            )
        ),

    CONSTRAINT chk_asset_role
        CHECK (
            asset_role IN (
                'avatar',
                'cover',
                'hero',
                'gallery',
                'attachment',
                'logo',
                'banner',
                'thumbnail'
            )
        )

);

----------------------------------------------------------
-- Indexes
----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_asset_usage_asset
ON media.asset_usage(asset_id);

CREATE INDEX IF NOT EXISTS idx_asset_usage_entity
ON media.asset_usage(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_asset_usage_role
ON media.asset_usage(asset_role);

CREATE INDEX IF NOT EXISTS idx_asset_usage_display_order
ON media.asset_usage(display_order);

CREATE INDEX IF NOT EXISTS idx_asset_usage_created_at
ON media.asset_usage(created_at);

COMMIT;
