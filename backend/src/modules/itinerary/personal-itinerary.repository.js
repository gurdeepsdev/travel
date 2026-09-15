import Database from '../../database/database-manager.js';

class PersonalItineraryRepository {
  async updateStatus({itineraryId,userId,status}) {
    return Database.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',[itineraryId]);
      const {rows:[itinerary]}=await client.query(`
        SELECT i.id,i.created_by FROM itinerary.itineraries i
        WHERE i.id=$1::uuid AND i.deleted_at IS NULL AND (i.created_by=$2::uuid OR EXISTS (
          SELECT 1 FROM groups.groups g JOIN groups.group_members m ON m.group_id=g.id
          WHERE g.itinerary_id=i.id AND g.status='ACTIVE' AND g.deleted_at IS NULL
            AND m.user_id=$2::uuid AND m.status='ACTIVE'
        ))
      `,[itineraryId,userId]);
      if(!itinerary) {return null;}
      await client.query(`INSERT INTO itinerary.user_itinerary_states(itinerary_id,user_id)
        VALUES ($1,$2) ON CONFLICT DO NOTHING`,[itineraryId,userId]);
      const {rows:[state]}=await client.query(`SELECT * FROM itinerary.user_itinerary_states
        WHERE itinerary_id=$1 AND user_id=$2 FOR UPDATE`,[itineraryId,userId]);
      const {rows:[trip]}=await client.query('SELECT id FROM trip.trips WHERE itinerary_id=$1',[itineraryId]);
      if(state.status===status) {return {id:itineraryId,trip_id:trip?.id ?? null,
        current_status:status,previous_status:status,updated:false,...{
          started_at:state.started_at,completed_at:state.completed_at,updated_at:state.updated_at}};}
      if({PLANNED:'UPCOMING',UPCOMING:'LIVE',LIVE:'COMPLETED'}[state.status]!==status &&
        !(state.status==='UPCOMING' && status==='PLANNED')) {
        return {invalid_transition:true,current_status:state.status};
      }
      const {rows:[sharedTrip]}=await client.query(`INSERT INTO trip.trips(itinerary_id,user_id,status)
        VALUES ($1,$2,'PLANNED') ON CONFLICT (itinerary_id) DO UPDATE
        SET itinerary_id=EXCLUDED.itinerary_id RETURNING id`,[itineraryId,itinerary.created_by]);
      const {rows:[updated]}=await client.query(`UPDATE itinerary.user_itinerary_states
        SET status=$3::varchar,updated_at=CURRENT_TIMESTAMP,
          started_at=CASE WHEN $3::varchar='LIVE' THEN COALESCE(started_at,CURRENT_TIMESTAMP) ELSE started_at END,
          completed_at=CASE WHEN $3::varchar='COMPLETED' THEN CURRENT_TIMESTAMP ELSE completed_at END
        WHERE itinerary_id=$1 AND user_id=$2 RETURNING *`,[itineraryId,userId,status]);
      return {id:itineraryId,trip_id:sharedTrip.id,current_status:status,previous_status:state.status,
        updated:true,started_at:updated.started_at,completed_at:updated.completed_at,updated_at:updated.updated_at};
    });
  }
}
export default new PersonalItineraryRepository();
