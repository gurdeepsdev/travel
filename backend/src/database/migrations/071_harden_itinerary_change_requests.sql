BEGIN;

ALTER TABLE itinerary.itinerary_change_requests
  ADD COLUMN IF NOT EXISTS base_itinerary_updated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS review_message TEXT;

UPDATE itinerary.itinerary_change_requests request
SET base_itinerary_updated_at = itinerary_record.updated_at
FROM itinerary.itineraries itinerary_record
WHERE request.itinerary_id = itinerary_record.id
  AND request.base_itinerary_updated_at IS NULL;

ALTER TABLE itinerary.itinerary_change_requests
  ALTER COLUMN base_itinerary_updated_at SET NOT NULL;

ALTER TABLE itinerary.itinerary_change_requests
  DROP CONSTRAINT IF EXISTS chk_request_status;

ALTER TABLE itinerary.itinerary_change_requests
  ADD CONSTRAINT chk_request_status
  CHECK (
    status IN (
      'PENDING',
      'ACCEPTED',
      'REJECTED',
      'CANCELLED',
      'STALE'
    )
  );

CREATE INDEX IF NOT EXISTS idx_change_requests_itinerary_status_created
ON itinerary.itinerary_change_requests(
  itinerary_id,
  status,
  created_at DESC,
  id DESC
);

COMMIT;
