BEGIN;

ALTER TABLE trip.trip_expenses
ADD COLUMN created_by UUID,
ADD COLUMN split_type VARCHAR(20);

UPDATE trip.trip_expenses
SET
    created_by = paid_by,
    split_type = 'EXACT'
WHERE created_by IS NULL
   OR split_type IS NULL;

ALTER TABLE trip.trip_expenses
ALTER COLUMN created_by SET NOT NULL,
ALTER COLUMN split_type SET NOT NULL;

ALTER TABLE trip.trip_expenses
ADD CONSTRAINT fk_trip_expenses_created_by
    FOREIGN KEY (created_by)
    REFERENCES auth.users(id)
    ON DELETE RESTRICT,
ADD CONSTRAINT chk_trip_expense_split_type
    CHECK (split_type IN ('EQUAL', 'EXACT', 'PERCENTAGE'));

CREATE INDEX idx_trip_expenses_created_by
ON trip.trip_expenses(created_by);

COMMIT;
