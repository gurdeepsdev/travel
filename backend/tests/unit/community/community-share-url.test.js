import { buildCommunityShareUrl } from '../../../src/modules/community/community-share-url.util.js';

const original = process.env.PUBLIC_WEB_URL;
afterEach(() => {
  if (original === undefined) delete process.env.PUBLIC_WEB_URL;
  else process.env.PUBLIC_WEB_URL = original;
});
test('community share URL defaults to the public website', () => {
  delete process.env.PUBLIC_WEB_URL;
  expect(buildCommunityShareUrl('11111111-1111-4111-8111-111111111111'))
    .toBe('https://artictern.com/c/11111111-1111-4111-8111-111111111111');
});
test('uses the existing PUBLIC_WEB_URL configuration and trims trailing slashes', () => {
  process.env.PUBLIC_WEB_URL = ' https://uat.artictern.com/// ';
  expect(buildCommunityShareUrl('id')).toBe('https://uat.artictern.com/c/id');
});
test('escapes the ID as a single path segment', () => {
  delete process.env.PUBLIC_WEB_URL;
  expect(buildCommunityShareUrl('a/b?#')).toBe('https://artictern.com/c/a%2Fb%3F%23');
});
test.each([null, undefined, ''])('missing ID %s returns null', id => {
  expect(buildCommunityShareUrl(id)).toBeNull();
});
