import { Router } from "express";

import AuthMiddleware from "../../middleware/auth.middleware.js";
import validate from "../../middleware/validate.middleware.js";
import Controller from "./groups.controller.js";
import {
  getItineraryGroupSchema,
  getGroupSchema,
  listMyGroupsSchema,
  createStandaloneGroupSchema,
  linkGroupItinerarySchema,
  removeGroupMemberSchema,
  leaveGroupSchema,
  listGroupInvitationsSchema,
  respondToGroupInvitationSchema,
  createGroupInvitationSchema,
  createLinkedGroupSchema,
  listLinkedGroupMembersSchema,
} from "./groups.validation.js";

const router = Router();

router.get('/itineraries/:itineraryId/group', AuthMiddleware.authenticate,
  validate(getItineraryGroupSchema), Controller.getItineraryGroup);

router.get('/groups/:groupId', AuthMiddleware.authenticate,
  validate(getGroupSchema), Controller.getGroup);

router.get('/users/me/groups', AuthMiddleware.authenticate,
  validate(listMyGroupsSchema), Controller.listMyGroups);

router.post('/groups', AuthMiddleware.authenticate,
  validate(createStandaloneGroupSchema), Controller.createStandaloneGroup);
router.put('/groups/:groupId/itinerary', AuthMiddleware.authenticate,
  validate(linkGroupItinerarySchema), Controller.linkItinerary);

router.delete('/itineraries/:itineraryId/group/members/:userId', AuthMiddleware.authenticate,
  validate(removeGroupMemberSchema), Controller.removeMember);
router.post('/itineraries/:itineraryId/group/leave', AuthMiddleware.authenticate,
  validate(leaveGroupSchema), Controller.leaveGroup);

router.get('/users/me/group-invitations', AuthMiddleware.authenticate,
  validate(listGroupInvitationsSchema), Controller.listInvitations);
router.patch('/users/me/group-invitations/:invitationId', AuthMiddleware.authenticate,
  validate(respondToGroupInvitationSchema), Controller.respondToInvitation);

router.post(
  "/itineraries/:itineraryId/group/invitations",
  AuthMiddleware.authenticate,
  validate(createGroupInvitationSchema),
  Controller.createInvitation,
);

router.post(
  "/itineraries/:itineraryId/group",
  AuthMiddleware.authenticate,
  validate(createLinkedGroupSchema),
  Controller.createLinkedGroup,
);

router.get(
  "/itineraries/:itineraryId/group/members",
  AuthMiddleware.authenticate,
  validate(listLinkedGroupMembersSchema),
  Controller.listLinkedGroupMembers,
);

export default router;
