import {jest} from '@jest/globals';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import yaml from 'js-yaml';
jest.unstable_mockModule('../../../src/database/database-manager.js',()=>({default:{}}));
const {buildPayload}=await import('../../../src/modules/itinerary/visited-city/visited-city.repository.js');
const {saveItinerarySchema}=await import('../../../src/modules/itinerary/itinerary.validation.js');
const {addSchema,updateSchema,metadataSchema,completeSchema}=await import('../../../src/modules/itinerary/visited-city/visited-city.validation.js');
const cityId=randomUUID();
test.each([1,3,4,5,8,200])('generated %i-attraction payload meets the existing save-itinerary contract',count=>{
  const payload=buildPayload({id:randomUUID(),visit_year:2020,visit_month:6,trip_type:'SOLO',attractions:Array.from({length:count},(_,i)=>({id:randomUUID(),name:'Place '+i}))},{id:cityId,name:'Agra'});
  expect(saveItinerarySchema.safeParse({body:payload,params:{},query:{}}).success).toBe(true);
  expect(payload.days.flatMap(d=>d.items)).toHaveLength(count);
  expect(payload.days.every(d=>d.items.length>=1&&d.items.length<=4)).toBe(true);
});
test('validation rejects injected ownership and malformed field types',()=>{
  const params={cityId,attractionId:randomUUID()};
  for(const schema of [addSchema,updateSchema,metadataSchema,completeSchema])expect(schema.safeParse({params,body:{userId:randomUUID()}}).success).toBe(false);
  expect(metadataSchema.safeParse({params,body:{year:'2020'}}).success).toBe(false);
  expect(completeSchema.safeParse({params}).success).toBe(true);
});
test.each(['today-apis.yaml','today-apis.bundle.yaml'])('%s documents all six operations and resolves their schema refs',file=>{
  const doc=yaml.load(readFileSync(new URL('../../../'+file,import.meta.url),'utf8'));
  const paths=Object.entries(doc.paths).filter(([path])=>path.includes('/visited-cities/'));
  expect(paths).toHaveLength(4);
  expect(paths.flatMap(([,value])=>Object.keys(value).filter(x=>['get','post','patch','delete'].includes(x)))).toHaveLength(6);
  const inspect=value=>{if(!value||typeof value!=='object')return;if(value.$ref){const ref=value.$ref.split('/').slice(1);expect(ref.reduce((node,key)=>node?.[key],doc)).toBeDefined();}for(const child of Object.values(value))inspect(child);};
  inspect(paths);for(const [key,schema] of Object.entries(doc.components.schemas))if(key.startsWith('VisitedCity'))inspect(schema);
});
