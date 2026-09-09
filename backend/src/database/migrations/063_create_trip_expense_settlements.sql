BEGIN;

CREATE TABLE trip.trip_expense_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trip.trips(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency_code CHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED')),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_expense_settlement_users CHECK (from_user_id <> to_user_id)
);

CREATE INDEX idx_expense_settlements_trip_created
ON trip.trip_expense_settlements(trip_id, created_at DESC, id DESC);

CREATE INDEX idx_expense_settlements_trip_status
ON trip.trip_expense_settlements(trip_id, status);

CREATE INDEX idx_expense_settlements_users
ON trip.trip_expense_settlements(from_user_id, to_user_id);

CREATE TRIGGER set_trip_expense_settlements_updated_at
BEFORE UPDATE ON trip.trip_expense_settlements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
