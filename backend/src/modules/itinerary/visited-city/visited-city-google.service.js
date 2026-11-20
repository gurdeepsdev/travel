import axios from 'axios';
import AppError from '../../../core/errors/app-error.js';

function fail(code,message,statusCode){throw new AppError({code:`VISITED_ITINERARY.${code}`,message,statusCode});}
const normalize=value=>value?.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g,' ');
export async function resolveGoogleAttraction(client,cityId,placeId){
  const city=(await client.query(`SELECT c.name,c.official_name,n.code AS country_code
    FROM poi.cities c JOIN poi.countries n ON n.id=c.country_id WHERE c.id=$1`,[cityId])).rows[0];
  const key=process.env.GOOGLE_PLACES_API_KEY?.trim();
  if(!key)fail('LOCATION_LOOKUP_UNAVAILABLE','Google location lookup is not configured.',503);
  let data;
  try{
    ({data}=await axios.get(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,{
      params:{languageCode:'en'},
      headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':'id,types,displayName,formattedAddress,addressComponents,location,businessStatus'},
      timeout:5000,maxRedirects:0,maxContentLength:256*1024,
    }));
  }catch(error){
    // Provider errors include credential-bearing request configuration.
    if([400,404].includes(error.response?.status))fail('PLACE_NOT_FOUND','Google attraction was not found.',404);
    fail('LOCATION_LOOKUP_UNAVAILABLE','Google location lookup is temporarily unavailable.',503);
  }
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{19,254}$/.test(data?.id??'')||typeof data.displayName?.text!=='string'||!data.displayName.text.trim()||data.businessStatus==='CLOSED_PERMANENTLY'||
    !Array.isArray(data.types)||!data.types.some(type=>['point_of_interest','establishment','tourist_attraction'].includes(type))||
    !Number.isFinite(data.location?.latitude)||!Number.isFinite(data.location?.longitude)||
    Math.abs(data.location.latitude)>90||Math.abs(data.location.longitude)>180)
    fail('PLACE_NOT_FOUND','Select a valid Google attraction.',404);
  const components=Array.isArray(data.addressComponents)?data.addressComponents:[];
  const country=components.find(c=>c.types?.includes('country'));
  const names=new Set([normalize(city?.name),normalize(city?.official_name)].filter(Boolean));
  const cityTypes=['locality','postal_town','administrative_area_level_3','administrative_area_level_2','administrative_area_level_1'];
  const matches=components.some(c=>c.types?.some(t=>cityTypes.includes(t))&&
    [c.longText,c.shortText].some(text=>names.has(normalize(text))));
  if(!city||country?.shortText!==city.country_code||!matches)
    fail('PLACE_CITY_MISMATCH','Selected Google attraction does not match this approved city.',422);
  return {placeId:data.id,name:data.displayName.text.trim(),description:null,address:data.formattedAddress??null,
    latitude:data.location.latitude,longitude:data.location.longitude};
}
