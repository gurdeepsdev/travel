BEGIN;

CREATE TABLE trip.trip_expenses
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    trip_id UUID NOT NULL,

    paid_by UUID NOT NULL,

    expense_category VARCHAR(30) NOT NULL,

    title VARCHAR(255) NOT NULL,

    description TEXT,

    amount NUMERIC(12,2) NOT NULL,

    currency_code CHAR(3) NOT NULL,

    payment_method VARCHAR(20) NOT NULL,

    expense_date DATE NOT NULL,

    receipt_asset_id UUID,

    location_name VARCHAR(255),

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    deleted_at TIMESTAMP,

    CONSTRAINT fk_trip_expenses_trip
        FOREIGN KEY (trip_id)
        REFERENCES trip.trips(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_trip_expenses_paid_by
        FOREIGN KEY (paid_by)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_trip_expenses_receipt
        FOREIGN KEY (receipt_asset_id)
        REFERENCES media.assets(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_trip_expense_category
        CHECK
        (
            expense_category IN
            (
                'FOOD',
                'TRANSPORT',
                'HOTEL',
                'SHOPPING',
                'ACTIVITY',
                'MEDICAL',
                'ENTERTAINMENT',
                'OTHER'
            )
        ),

    CONSTRAINT chk_trip_payment_method
        CHECK
        (
            payment_method IN
            (
                'CASH',
                'CARD',
                'UPI',
                'BANK_TRANSFER',
                'OTHER'
            )
        ),

    CONSTRAINT chk_trip_expense_amount
        CHECK
        (
            amount >= 0
        )
);

CREATE INDEX idx_trip_expenses_trip
ON trip.trip_expenses(trip_id);

CREATE INDEX idx_trip_expenses_paid_by
ON trip.trip_expenses(paid_by);

CREATE INDEX idx_trip_expenses_category
ON trip.trip_expenses(expense_category);

CREATE INDEX idx_trip_expenses_expense_date
ON trip.trip_expenses(expense_date);

CREATE INDEX idx_trip_expenses_receipt
ON trip.trip_expenses(receipt_asset_id);

CREATE INDEX idx_trip_expenses_deleted
ON trip.trip_expenses(deleted_at);

CREATE INDEX idx_trip_expenses_created_at
ON trip.trip_expenses(created_at);

COMMIT;
