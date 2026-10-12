import { updateGroupMemberRoleSchema, updateLinkedGroupMemberRoleSchema } from '../../../src/modules/groups/groups.validation.js';

const id = '11111111-1111-4111-8111-111111111111';
test.each([
  [updateGroupMemberRoleSchema, { groupId: id, userId: id }],
  [updateLinkedGroupMemberRoleSchema, { itineraryId: id, userId: id }],
])('role endpoint validates strict ADMIN/MEMBER payloads', (schema, params) => {
  for (const role of ['ADMIN', 'MEMBER']) {
    expect(schema.safeParse({ params, query: {}, body: { role } }).success).toBe(true);
  }
  for (const body of [{ role: 'OWNER' }, { role: 'admin' }, {}, { role: 'ADMIN', ownerId: id }]) {
    expect(schema.safeParse({ params, query: {}, body }).success).toBe(false);
  }
  expect(schema.safeParse({ params: { ...params, userId: 'invalid' }, query: {}, body: { role: 'ADMIN' } }).success).toBe(false);
});
