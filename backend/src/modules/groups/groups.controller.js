import Response from "../../core/response/index.js";
import Service from "./groups.service.js";

class GroupsController {
  async removeMember(req, res, next) {
    try {
      const result = await Service.removeMember({ itineraryId: req.validated.params.itineraryId,
        userId: req.user.id, targetUserId: req.validated.params.userId });
      return Response.success(res, result, "Group member removed successfully.");
    } catch (error) { return next(error); }
  }

  async leaveGroup(req, res, next) {
    try {
      const result = await Service.removeMember({ itineraryId: req.validated.params.itineraryId,
        userId: req.user.id, leave: true });
      return Response.success(res, result, "Group left successfully.");
    } catch (error) { return next(error); }
  }

  async listInvitations(req, res, next) {
    try {
      const result = await Service.listInvitations({ userId: req.user.id, ...req.validated.query });
      return Response.success(res, result, "Group invitations fetched successfully.");
    } catch (error) { return next(error); }
  }

  async respondToInvitation(req, res, next) {
    try {
      const result = await Service.respondToInvitation({ userId: req.user.id,
        invitationId: req.validated.params.invitationId, status: req.validated.body.status });
      return Response.success(res, result, "Group invitation response saved successfully.");
    } catch (error) { return next(error); }
  }

  async createInvitation(req, res, next) {
    try {
      const result = await Service.createInvitation({
        itineraryId: req.validated.params.itineraryId,
        userId: req.user.id,
        input: req.validated.body,
      });
      return Response.success(res, result, result.created
        ? "Group invitation created successfully."
        : "Pending group invitation fetched successfully.");
    } catch (error) {
      return next(error);
    }
  }

  async listLinkedGroupMembers(req, res, next) {
    try {
      const result = await Service.listLinkedGroupMembers({
        itineraryId: req.validated.params.itineraryId,
        userId: req.user.id,
      });

      return Response.success(
        res,
        result,
        "Itinerary group members fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async createLinkedGroup(req, res, next) {
    try {
      const result = await Service.createLinkedGroup({
        itineraryId: req.validated.params.itineraryId,
        userId: req.user.id,
        input: req.validated.body,
      });

      return Response.success(
        res,
        result,
        result.created
          ? "Itinerary group created successfully."
          : "Itinerary group fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new GroupsController();
