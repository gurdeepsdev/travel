import {randomUUID} from 'node:crypto';
import Database from '../../../database/database-manager.js';
import Itineraries from '../itinerary.repository.js';
import AppError from '../../../core/errors/app-error.js';
import {resolveGoogleAttraction} from './visited-city-google.service.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(code,message,statusCode=409){throw new AppError({code:`VISITED_ITINERARY.${code}`,message,statusCode});}
const mapItinerary = r => ({id:r.id,ownerId:r.created_by,createdBy:r.created_by,title:r.title,
  durationDays:r.duration_days,visibility:r.visibility,tripStatus:r.trip_status,aiGenerated:r.ai_generated,
  itineraryJson:r.itinerary_json,createdAt:r.created_at,updatedAt:r.updated_at});
export function mapDraft(r){return r?{id:r.id,cityId:r.city_id,status:r.itinerary_id?'COMPLETED':'DRAFT',title:r.title,
  year:r.visit_year,month:r.visit_month,tripType:r.trip_type,attractions:r.attractions.map((a,i)=>({...a,position:i+1})),
  itineraryId:r.itinerary_id,completedAt:r.completed_at,createdAt:r.created_at,updatedAt:r.updated_at}:null;}
export function buildPayload(draft,city){
  const days=[];
  for(let offset=0;offset<draft.attractions.length;offset+=4){
    days.push({day:days.length+1,items:draft.attractions.slice(offset,offset+4).map(a=>({
      item_type:a.placeId?'poi':'custom',place_id:a.placeId??null,name:a.name,
      description:a.description??null,address:a.address??null,latitude:a.latitude??null,longitude:a.longitude??null,
      status:'completed',source_attraction_id:a.id,
    }))});
  }
  return {request_id:draft.id,status:'success',mode:'past',source:'visited_city',city_id:city.id,city_name:city.name,
    title:draft.title??`${city.name} itinerary`,visit_year:draft.visit_year,visit_month:draft.visit_month,trip_type:draft.trip_type,
    summary:{num_days:days.length,total_places:draft.attractions.length,primary_place_name:city.name},days};
}
function applyMetadata(draft,input){
  for(const [key,column] of Object.entries({title:'title',year:'visit_year',month:'visit_month',tripType:'trip_type'}))
    if(Object.hasOwn(input,key))draft[column]=input[key];
  const now=new Date();
  if(draft.visit_year && (draft.visit_year>now.getUTCFullYear() ||
    (draft.visit_year===now.getUTCFullYear()&&draft.visit_month>now.getUTCMonth()+1)))
    fail('FUTURE_VISIT','Visit month and year cannot be in the future.',400);
}
async function resolveAttraction(client,cityId,input,existing={}){
  let data={...existing,...input};delete data.position;
  if(input.placeId){
    if(UUID.test(input.placeId)){
      const place=(await client.query('SELECT id,name,description,address,latitude,longitude FROM poi.places WHERE id=$1 AND city_id=$2 AND is_active=true FOR SHARE',[input.placeId,cityId])).rows[0];
      if(!place)fail('PLACE_NOT_FOUND','Select an active attraction in this city.',404);
      data={...data,placeId:place.id,name:place.name,description:place.description,address:place.address,latitude:place.latitude,longitude:place.longitude};
    }else data={...data,...await resolveGoogleAttraction(client,cityId,input.placeId)};
  }
  if(!data.name)fail('ATTRACTION_INVALID','Attraction name is required.',400);
  if((data.latitude==null)!==(data.longitude==null))fail('ATTRACTION_INVALID','Provide both latitude and longitude.',400);
  return {...data,id:existing.id??randomUUID()};
}
class VisitedCityRepository {
  async execute({userId,cityId,action,input={},attractionId}){
    return Database.transaction(async client=>{
      const city=(await client.query(`SELECT c.id,c.name FROM poi.cities c JOIN users.collection v ON v.city_id=c.id
        WHERE c.id=$1 AND c.is_active=true AND v.user_id=$2 AND v.verification_status=true
        FOR SHARE OF c,v`,[cityId,userId])).rows[0];
      if(!city)fail('CITY_NOT_VERIFIED','This city must be verified for your account.',403);
      if(!['get'].includes(action))await client.query(`INSERT INTO itinerary.visited_city_drafts(user_id,city_id) VALUES($1,$2) ON CONFLICT(user_id,city_id) DO NOTHING`,[userId,cityId]);
      const draft=(await client.query('SELECT * FROM itinerary.visited_city_drafts WHERE user_id=$1 AND city_id=$2 FOR UPDATE',[userId,cityId])).rows[0];
      if(action==='get')return {draft:mapDraft(draft)};
      if(draft.itinerary_id){
        if(action!=='complete')fail('ALREADY_COMPLETED','This draft has already been completed.');
        const itinerary=(await client.query('SELECT * FROM itinerary.itineraries WHERE id=$1 AND created_by=$2 AND deleted_at IS NULL',[draft.itinerary_id,userId])).rows[0];
        if(!itinerary)fail('ITINERARY_UNAVAILABLE','The completed itinerary is no longer available.');
        return {draft:mapDraft(draft),itinerary:mapItinerary(itinerary),created:false};
      }
      if(action==='metadata'||action==='complete')applyMetadata(draft,input);
      if(action==='add'){
        if(draft.attractions.length>=200)fail('ATTRACTION_LIMIT','A draft can contain at most 200 attractions.');
        if(input.placeId&&draft.attractions.some(a=>a.placeId===input.placeId))fail('DUPLICATE_ATTRACTION','This attraction is already in your draft.');
        const attraction=await resolveAttraction(client,cityId,input);
        if(attraction.placeId&&draft.attractions.some(a=>a.placeId===attraction.placeId))fail('DUPLICATE_ATTRACTION','This attraction is already in your draft.');
        draft.attractions.push(attraction);
      }
      if(action==='update'||action==='delete'){
        const index=draft.attractions.findIndex(a=>a.id===attractionId);
        if(index<0)fail('ATTRACTION_NOT_FOUND','Draft attraction not found.',404);
        if(action==='delete')draft.attractions.splice(index,1);
        else{
          if(input.placeId&&draft.attractions.some((a,i)=>i!==index&&a.placeId===input.placeId))fail('DUPLICATE_ATTRACTION','This attraction is already in your draft.');
          const attraction=await resolveAttraction(client,cityId,input,draft.attractions[index]);
          if(attraction.placeId&&draft.attractions.some((a,i)=>i!==index&&a.placeId===attraction.placeId))fail('DUPLICATE_ATTRACTION','This attraction is already in your draft.');
          if(input.position>draft.attractions.length)fail('POSITION_INVALID','Position exceeds the attraction count.',400);
          draft.attractions.splice(index,1);draft.attractions.splice((input.position??index+1)-1,0,attraction);
        }
      }
      let itinerary;
      if(action==='complete'){
        if(!draft.attractions.length)fail('EMPTY_DRAFT','Add at least one attraction before completing.');
        if(!draft.visit_year||!draft.visit_month||!draft.trip_type)fail('METADATA_REQUIRED','Year, month and tripType are required before completing.',400);
        const payload=buildPayload(draft,city);
        const title=await Itineraries.allocateOwnedTitle({client,userId,title:payload.title});
        payload.title=title;
        itinerary=(await client.query(`INSERT INTO itinerary.itineraries(created_by,title,duration_days,visibility,trip_status,ai_generated,itinerary_json)
          VALUES($1,$2,$3,'private','completed',false,$4::jsonb) RETURNING *`,[userId,title,payload.days.length,JSON.stringify(payload)])).rows[0];
        await client.query(`INSERT INTO itinerary.user_itinerary_states(itinerary_id,user_id,status,completed_at)
          VALUES($1,$2,'COMPLETED',clock_timestamp()) ON CONFLICT(itinerary_id,user_id)
          DO UPDATE SET status='COMPLETED',completed_at=EXCLUDED.completed_at,updated_at=clock_timestamp()`,[itinerary.id,userId]);
        draft.itinerary_id=itinerary.id;
      }
      const saved=(await client.query(`UPDATE itinerary.visited_city_drafts SET title=$3,visit_year=$4,visit_month=$5,trip_type=$6,
        attractions=$7::jsonb,itinerary_id=$8,completed_at=CASE WHEN $8::uuid IS NOT NULL THEN clock_timestamp() ELSE NULL END,
        updated_at=clock_timestamp() WHERE user_id=$1 AND city_id=$2 RETURNING *`,
      [userId,cityId,draft.title,draft.visit_year,draft.visit_month,draft.trip_type,JSON.stringify(draft.attractions),draft.itinerary_id])).rows[0];
      return {draft:mapDraft(saved),...(itinerary?{itinerary:mapItinerary(itinerary),created:true}:{})};
    });
  }
}
export default new VisitedCityRepository();
