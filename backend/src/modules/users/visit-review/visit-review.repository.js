import Database from '../../../database/database-manager.js';
import AppError from '../../../core/errors/app-error.js';
const failure=(code,message,statusCode=409)=>new AppError({code:`VISIT_REVIEW.${code}`,message,statusCode});
const submissions=`WITH submissions AS (
  SELECT 'CITY'::text AS target_type,c.id,c.user_id,c.city_id,c.verification_asset_id,
    CASE WHEN c.verification_status THEN 'VERIFIED' ELSE c.review_status END::text AS status,
    c.created_at,c.updated_at,c.review_details AS details,NULL::uuid AS place_id
  FROM users.collection c WHERE c.verification_asset_id IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM users.visited_places v WHERE v.collections_id=c.id AND v.verification_asset_id=c.verification_asset_id)
  UNION ALL
  SELECT 'PLACE',v.id,v.user_id,c.city_id,v.verification_asset_id,v.verification_status,
    v.created_at,v.updated_at,v.verification_details,v.place_id
  FROM users.visited_places v JOIN users.collection c ON c.id=v.collections_id
  WHERE v.verification_asset_id IS NOT NULL
)`;
const projection=`SELECT s.*,to_char(s.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at,
  p.username,p.display_name,c.name AS city_name,c.icon_asset_id AS city_icon_asset_id,
  pl.name AS place_name,a.mime_type,a.deleted_at AS asset_deleted_at
  FROM submissions s JOIN poi.cities c ON c.id=s.city_id
  LEFT JOIN users.profiles p ON p.user_id=s.user_id
  LEFT JOIN poi.places pl ON pl.id=s.place_id
  LEFT JOIN media.assets a ON a.id=s.verification_asset_id`;
class VisitReviewRepository {
  async list({status,limit,cursor}){
    const {rows}=await Database.query(`${submissions} ${projection} WHERE s.status=$1
      AND ($2::timestamptz IS NULL OR (s.created_at,s.id,s.target_type)<($2::timestamptz,$3::uuid,$4::text))
      ORDER BY s.created_at DESC,s.id DESC,s.target_type DESC LIMIT $5`,[status,cursor?.createdAt??null,cursor?.id??null,cursor?.targetType??null,limit+1]);
    return rows;
  }
  async detail(targetType,id){return (await Database.query(`${submissions} ${projection} WHERE s.target_type=$1 AND s.id=$2`,[targetType,id])).rows[0]??null;}
  async review({targetType,id,reviewerId,input}){
    return Database.transaction(async client=>{
      const table=targetType==='CITY'?'users.collection':'users.visited_places';
      // Serialize all city/place decisions for the same collection, including competing approvals.
      const location=targetType==='CITY'?(await client.query('SELECT id AS collection_id FROM users.collection WHERE id=$1',[id])).rows[0]
        :(await client.query('SELECT collections_id AS collection_id FROM users.visited_places WHERE id=$1',[id])).rows[0];
      if(!location)throw failure('NOT_FOUND','Visit submission not found.',404);
      await client.query('SELECT id FROM users.collection WHERE id=$1 FOR UPDATE',[location.collection_id]);
      const row=(await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[id])).rows[0];
      if(!row||!row.verification_asset_id)throw failure('NOT_FOUND','Visit submission not found.',404);
      if(targetType==='CITY'&&(await client.query('SELECT 1 FROM users.visited_places WHERE collections_id=$1 AND verification_asset_id=$2 LIMIT 1',[id,row.verification_asset_id])).rows.length)throw failure('NOT_FOUND','Review the place submission rather than its city container.',404);
      if(row.user_id===reviewerId)throw failure('SELF_REVIEW_FORBIDDEN','Reviewing your own visit submission is not allowed.',403);
      if(row.verification_asset_id!==input.evidenceAssetId)throw failure('STALE_EVIDENCE','Evidence changed. Reload before reviewing.');
      const prior=(await client.query('SELECT * FROM users.visit_verification_reviews WHERE target_type=$1 AND submission_id=$2 AND evidence_asset_id=$3',[targetType,id,input.evidenceAssetId])).rows[0];
      if(prior){
        if(prior.decision!==input.decision)throw failure('ALREADY_REVIEWED','Submission already has a different decision.');
        return {updated:false,decision:prior.decision,reviewId:prior.id};
      }
      const status=targetType==='CITY'?(row.verification_status?'VERIFIED':row.review_status):row.verification_status;
      if(status!=='PENDING')throw failure('ALREADY_REVIEWED','Only pending submissions can be reviewed.');
      const collection=(await client.query('SELECT * FROM users.collection WHERE id=$1',[location.collection_id])).rows[0];
      const city=(await client.query('SELECT id,icon_asset_id,is_active FROM poi.cities WHERE id=$1',[collection.city_id])).rows[0];
      const evidence=(await client.query('SELECT id,mime_type,deleted_at,uploaded_by FROM media.assets WHERE id=$1',[input.evidenceAssetId])).rows[0];
      if(!city?.is_active||!evidence||evidence.deleted_at||!evidence.mime_type?.startsWith('image/')||evidence.uploaded_by!==row.user_id)throw failure('EVIDENCE_UNAVAILABLE','Active owned image evidence and city are required.');
      let icon;
      if(input.decision==='VERIFIED'){
        const iconId=input.iconAssetId??collection.review_details?.review?.iconAssetId??city.icon_asset_id;
        icon=(await client.query('SELECT id,mime_type,is_public,deleted_at,uploaded_by FROM media.assets WHERE id=$1',[iconId??null])).rows[0];
        if(!icon||icon.deleted_at||!icon.is_public||!icon.mime_type?.startsWith('image/')||(input.iconAssetId&&icon.uploaded_by!==reviewerId))throw failure('ICON_REQUIRED','Configure an active public city icon, or supply a public image asset owned by the reviewer.');
      }
      const audit=(await client.query(`INSERT INTO users.visit_verification_reviews(target_type,submission_id,evidence_asset_id,user_id,reviewer_id,decision,reason)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,created_at`,[targetType,id,input.evidenceAssetId,row.user_id,reviewerId,input.decision,input.reason??null])).rows[0];
      const review={decision:input.decision,reason:input.reason??null,reviewedAt:audit.created_at,
        ...(input.decision==='VERIFIED'&&(input.iconAssetId||collection.review_details?.review?.iconAssetId)?{iconAssetId:icon.id}:{})};
      if(targetType==='PLACE')await client.query(`UPDATE users.visited_places SET verification_status=$2,
        verification_details=verification_details||jsonb_build_object('review',$3::jsonb),updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[id,input.decision,JSON.stringify(review)]);
      if(input.decision==='VERIFIED')await client.query(`UPDATE users.collection SET verification_status=true,review_status='VERIFIED',
        icon_asset_id=$2,review_details=review_details||jsonb_build_object('review',$3::jsonb),updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[collection.id,icon.id,JSON.stringify(review)]);
      else if(targetType==='CITY')await client.query(`UPDATE users.collection SET review_status='REJECTED',
        review_details=review_details||jsonb_build_object('review',$2::jsonb),updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[id,JSON.stringify(review)]);
      return {updated:true,decision:input.decision,reviewId:audit.id};
    });
  }
}
export default new VisitReviewRepository();
