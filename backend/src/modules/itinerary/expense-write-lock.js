import AppError from "../../core/errors/app-error.js";

export async function lockExpenseParticipants(client, tripId, userIds) {
  const { rows: [trip] } = await client.query(
    'SELECT itinerary_id FROM trip.trips WHERE id=$1::uuid', [tripId]);
  if (!trip) {
    throw new AppError({ code: 'ITINERARY.NOT_FOUND', message: 'Trip not found.', statusCode: 404 });
  }
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))', [trip.itinerary_id]);
  const ids = [...new Set(userIds)];
  const { rows } = await client.query(`
    SELECT p.user_id FROM trip.trip_participants p
    JOIN itinerary.itineraries i ON i.id=$3::uuid AND i.deleted_at IS NULL
    WHERE p.trip_id=$1::uuid AND p.user_id=ANY($2::uuid[]) AND p.status='ACTIVE'
    FOR SHARE OF p
  `, [tripId, ids, trip.itinerary_id]);
  if (rows.length !== ids.length) {
    throw new AppError({ code: 'ITINERARY.EXPENSE_PARTICIPANT_INVALID',
      message: 'Expense users must still be active participants.', statusCode: 422 });
  }
}
