BEGIN;

CREATE TABLE itinerary.itinerary_change_requests
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    itinerary_id UUID NOT NULL,

    itinerary_item_id UUID,

    requested_by UUID NOT NULL,

    request_type VARCHAR(30) NOT NULL,

    proposed_data JSONB NOT NULL,

    message TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    reviewed_by UUID,

    reviewed_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_change_request_itinerary
        FOREIGN KEY (itinerary_id)
        REFERENCES itinerary.itineraries(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_change_request_item
        FOREIGN KEY (itinerary_item_id)
        REFERENCES itinerary.itinerary_items(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_change_request_requested_by
        FOREIGN KEY (requested_by)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_change_request_reviewed_by
        FOREIGN KEY (reviewed_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_request_type
        CHECK
        (
            request_type IN
            (
                'ADD_ITEM',
                'UPDATE_ITEM',
                'DELETE_ITEM',
                'UPDATE_ITINERARY'
            )
        ),

    CONSTRAINT chk_request_status
        CHECK
        (
            status IN
            (
                'PENDING',
                'ACCEPTED',
                'REJECTED'
            )
        )
);

CREATE INDEX idx_change_requests_itinerary
ON itinerary.itinerary_change_requests(itinerary_id);

CREATE INDEX idx_change_requests_item
ON itinerary.itinerary_change_requests(itinerary_item_id);

CREATE INDEX idx_change_requests_requested_by
ON itinerary.itinerary_change_requests(requested_by);

CREATE INDEX idx_change_requests_status
ON itinerary.itinerary_change_requests(status);

CREATE INDEX idx_change_requests_created_at
ON itinerary.itinerary_change_requests(created_at);

COMMIT;
