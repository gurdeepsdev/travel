BEGIN;

CREATE TABLE trip.trip_documents
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    trip_id UUID NOT NULL,

    owner_id UUID NOT NULL,

    document_type VARCHAR(30) NOT NULL,

    title VARCHAR(255) NOT NULL,

    asset_id UUID NOT NULL,

    document_number VARCHAR(100),

    issue_date DATE,

    expiry_date DATE,

    issuing_country_id UUID,

    visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',

    notes TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    deleted_at TIMESTAMP,

    CONSTRAINT fk_trip_documents_trip
        FOREIGN KEY (trip_id)
        REFERENCES trip.trips(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_trip_documents_owner
        FOREIGN KEY (owner_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_trip_documents_asset
        FOREIGN KEY (asset_id)
        REFERENCES media.assets(id)
        ON DELETE CASCADE,

   
    CONSTRAINT chk_trip_document_type
        CHECK
        (
            document_type IN
            (
                'PASSPORT',
                'VISA',
                'INSURANCE',
                'FLIGHT_TICKET',
                'TRAIN_TICKET',
                'BUS_TICKET',
                'HOTEL_BOOKING',
                'DRIVING_LICENSE',
                'ID_CARD',
                'OTHER'
            )
        ),

    CONSTRAINT chk_trip_document_visibility
        CHECK
        (
            visibility IN
            (
                'PRIVATE',
                'GROUP'
            )
        ),

    CONSTRAINT chk_trip_document_dates
        CHECK
        (
            expiry_date IS NULL
            OR
            issue_date IS NULL
            OR
            expiry_date >= issue_date
        )
);

CREATE INDEX idx_trip_documents_trip
ON trip.trip_documents(trip_id);

CREATE INDEX idx_trip_documents_owner
ON trip.trip_documents(owner_id);

CREATE INDEX idx_trip_documents_document_type
ON trip.trip_documents(document_type);

CREATE INDEX idx_trip_documents_visibility
ON trip.trip_documents(visibility);

CREATE INDEX idx_trip_documents_asset
ON trip.trip_documents(asset_id);

CREATE INDEX idx_trip_documents_expiry
ON trip.trip_documents(expiry_date);

CREATE INDEX idx_trip_documents_deleted
ON trip.trip_documents(deleted_at);

COMMIT;
