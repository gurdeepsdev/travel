BEGIN;

ALTER TABLE users.saved_items
  DROP CONSTRAINT IF EXISTS
    chk_saved_item_type;

ALTER TABLE users.saved_items
  ADD CONSTRAINT
    chk_saved_item_type
  CHECK (
    item_type IN (
      'PLACE',
      'ITINERARY',
      'MEDIA',
      'POST',
      'CITY'
    )
  );

COMMIT;
