import { listing,notificationInput,preferenceUpdate } from '../../../src/modules/notifications/notification.validation.js';
import { notificationTypes } from '../../../src/modules/notifications/notification.types.js';
const empty={params:{},query:{}};
test('registers exactly the 26 Final-tab events with conditional and UI-only types disabled',()=>{
  expect(Object.keys(notificationTypes)).toHaveLength(26);
  expect(notificationTypes.CUSTOM_DOCUMENT_REMINDER.enabled).toBe(false);
  expect(notificationTypes.APP_UPDATE_REQUIRED).toMatchObject({enabled:false,channels:['UI']});
  expect(notificationTypes.PLACE_PHOTO_VERIFIED.channels).toEqual(['PUSH']);
  expect(notificationTypes.PLACE_PHOTO_REJECTED.channels).toEqual(['PUSH']);
});
test('list defaults and unread query booleans are explicit',()=>{
  expect(listing.parse(empty).query).toEqual({limit:20,unreadOnly:false});
  expect(listing.parse({...empty,query:{unreadOnly:'true'}}).query.unreadOnly).toBe(true);
  expect(listing.parse({...empty,query:{unreadOnly:'false'}}).query.unreadOnly).toBe(false);
});
test.each([{limit:0},{limit:51},{unreadOnly:'1'},{userId:'another-user'}])('rejects unsupported list query %j',query=>{
  expect(listing.safeParse({...empty,query}).success).toBe(false);
});
test('preferences require unique known categories and at least one boolean setting',()=>{
  expect(preferenceUpdate.safeParse({...empty,body:{preferences:[{category:'EXPLORE',push:false}]}}).success).toBe(true);
  for(const preferences of [[],[{category:'EXPLORE'}],[{category:'UNKNOWN',push:false}],[{category:'EXPLORE',push:true},{category:'EXPLORE',inApp:false}]])
    expect(preferenceUpdate.safeParse({...empty,body:{preferences}}).success).toBe(false);
});
test('internal producer requires a known type and structured target, never a raw navigation URL',()=>{
  const value={userId:'11111111-1111-4111-8111-111111111111',eventKey:'comment:event-1',type:'POST_COMMENT_RECEIVED',title:'Comment',body:'New comment',target:{type:'POST',id:'22222222-2222-4222-8222-222222222222'}};
  expect(notificationInput.safeParse(value).success).toBe(true);
  expect(notificationInput.safeParse({...value,type:'UNKNOWN'}).success).toBe(false);
  expect(notificationInput.safeParse({...value,target:{url:'https://example.com'}}).success).toBe(false);
  expect(notificationInput.safeParse({...value,token:'secret'}).success).toBe(false);
});
