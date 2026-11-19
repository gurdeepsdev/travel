import {jest} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import errorMiddleware from '../../../src/middleware/error.middleware.js';
import validate from '../../../src/middleware/validate.middleware.js';
import {createEssentialSchema} from '../../../src/modules/itinerary/itinerary.validation.js';

const limit=1024*1024;
const path='/api/v1/itineraries/11111111-1111-4111-8111-111111111111/essentials';
const handler=jest.fn((req,res)=>res.status(201).json({title:req.validated.body.title}));
const rawHandler=jest.fn((_req,res)=>res.sendStatus(200));
const app=express();
app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:true}));
app.post('/api/v1/itineraries/:itineraryId/essentials',validate(createEssentialSchema),handler);
app.post('/raw',rawHandler);
app.get('/unrelated',(_req,_res,next)=>next(new Error('internal-only')));
app.get('/unrelated-413',(_req,_res,next)=>next(Object.assign(new Error('internal-only'),{status:413,type:'other.failure'})));
app.use(errorMiddleware);
beforeEach(()=>{handler.mockClear();rawHandler.mockClear();});

test('valid JSON over 1 MiB returns sanitized 413 before validation or business handler',async()=>{
  const response=await request(app).post(path).send({title:'private-value'.repeat(90000),category:'OTHER'});
  expect(response.status).toBe(413);
  expect(response.body).toMatchObject({success:false,code:'COMMON.PAYLOAD_TOO_LARGE',message:'Request body exceeds the allowed size limit.',details:null,requestId:null});
  expect(response.body.timestamp).toEqual(expect.any(String));
  expect(JSON.stringify(response.body)).not.toMatch(/private-value|stack|entity.too.large/);
  expect(handler).not.toHaveBeenCalled();
});
test('JSON byte limit is unchanged: exact limit succeeds, one byte over returns 413',async()=>{
  const body=JSON.stringify({value:''});
  const exact=JSON.stringify({value:'x'.repeat(limit-Buffer.byteLength(body))});
  expect(Buffer.byteLength(exact)).toBe(limit);
  expect((await request(app).post('/raw').set('Content-Type','application/json').send(exact)).status).toBe(200);
  expect((await request(app).post('/raw').set('Content-Type','application/json').send(exact+' ')).status).toBe(413);
  expect(rawHandler).toHaveBeenCalledTimes(1);
});
test.each([256,10000])('valid JSON with %i-character title still returns field validation 400',async length=>{
  const response=await request(app).post(path).send({title:'x'.repeat(length),category:'OTHER'});
  expect(response.status).toBe(400);expect(response.body.code).toBe('COMMON.VALIDATION_FAILED');
  expect(response.body.details.fieldErrors.body.join(' ')).toContain('255');
  expect(response.body.message).not.toContain('JSON');expect(handler).not.toHaveBeenCalled();
});
test('255-character essential title still reaches the business handler',async()=>{
  const response=await request(app).post(path).send({title:'x'.repeat(255),category:'OTHER'});
  expect(response.status).toBe(201);expect(response.body.title).toHaveLength(255);expect(handler).toHaveBeenCalledTimes(1);
});
test('malformed JSON keeps its existing 400 parsing response',async()=>{
  const response=await request(app).post(path).set('Content-Type','application/json').send('{"title":');
  expect(response.status).toBe(400);expect(response.body).toMatchObject({code:'COMMON.VALIDATION_FAILED',message:'Request body must contain valid JSON.'});expect(handler).not.toHaveBeenCalled();
});
test('oversized URL-encoded bodies also receive parser-specific 413',async()=>{
  const response=await request(app).post('/raw').set('Content-Type','application/x-www-form-urlencoded').send('value='+'x'.repeat(110000));
  expect(response.status).toBe(413);expect(response.body.code).toBe('COMMON.PAYLOAD_TOO_LARGE');expect(rawHandler).not.toHaveBeenCalled();
});
test.each(['/unrelated','/unrelated-413'])('unrelated errors retain existing 500 behavior: %s',async url=>{
  const response=await request(app).get(url);expect(response.status).toBe(500);expect(response.body.code).toBe('COMMON.INTERNAL_SERVER_ERROR');expect(JSON.stringify(response.body)).not.toContain('internal-only');
});
test('headers already sent still delegate without writing a second response',()=>{
  const error=Object.assign(new Error('large'),{type:'entity.too.large',status:413});const next=jest.fn();
  errorMiddleware(error,{}, {headersSent:true},next);expect(next).toHaveBeenCalledWith(error);
});
