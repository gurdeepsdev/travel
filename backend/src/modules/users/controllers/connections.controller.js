import Response
  from "../../../core/response/index.js";

import ConnectionsService
  from "../services/connections.service.js";

class ConnectionsController {
  /**
   * Sends a connection request to another user.
   *
   * Route:
   * POST /api/v1/users/:userId/connection-requests
   */
  async sendConnectionRequest(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await ConnectionsService
          .sendConnectionRequest({
            senderUserId:
              req.user.id,

            receiverUserId:
              req.validated.params
                .userId,
          });

      if (result.requestCreated) {
        return Response.created(
          res,
          result,
          "Connection request sent successfully.",
        );
      }

      return Response.success(
        res,
        result,
        "Connection request already pending.",
      );
    } catch (error) {
      return next(error);
    }
  }

    /**
   * Lists pending requests received by the
   * authenticated user.
   *
   * Route:
   * GET /api/v1/users/me/connection-requests/incoming
   */
  async getIncomingConnectionRequests(
    req,
    res,
    next,
  ) {
    try {
      const {
        limit,
        cursor = null,
      } = req.validated.query;

      const result =
        await ConnectionsService
          .getIncomingConnectionRequests({
            userId:
              req.user.id,

            limit,
            cursor,
          });

      return Response.success(
        res,
        result,
        "Incoming connection requests fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }


    /**
   * Lists pending requests sent by the
   * authenticated user.
   *
   * Route:
   * GET /api/v1/users/me/connection-requests/outgoing
   */
  async getOutgoingConnectionRequests(
    req,
    res,
    next,
  ) {
    try {
      const {
        limit,
        cursor = null,
      } = req.validated.query;

      const result =
        await ConnectionsService
          .getOutgoingConnectionRequests({
            userId:
              req.user.id,

            limit,
            cursor,
          });

      return Response.success(
        res,
        result,
        "Outgoing connection requests fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }


    /**
   * Lists accepted connections belonging to the
   * authenticated user.
   *
   * Route:
   * GET /api/v1/users/me/connections
   */
  async getMyConnections(
    req,
    res,
    next,
  ) {
    try {
      const {
        limit,
        cursor = null,
      } = req.validated.query;

      const result =
        await ConnectionsService
          .getMyConnections({
            userId:
              req.user.id,

            limit,
            cursor,
          });

      return Response.success(
        res,
        result,
        "Connections fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }


  /**
   * Lists ranked connection suggestions for the
   * authenticated user.
   *
   * Route:
   * GET /api/v1/users/me/connection-suggestions
   */
  async getConnectionSuggestions(
    req,
    res,
    next,
  ) {
    try {
      const {
        limit,
        cursor = null,
      } = req.validated.query;

      const result =
        await ConnectionsService
          .getConnectionSuggestions({
            userId:
              req.user.id,

            limit,
            cursor,
          });

      return Response.success(
        res,
        result,
        "Connection suggestions fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Removes an accepted connection belonging to
   * the authenticated user.
   *
   * Route:
   * DELETE /api/v1/users/me/connections/:userId
   */
  async removeConnection(
    req,
    res,
    next,
  ) {
    try {
      const {
        userId,
      } = req.validated.params;

      const result =
        await ConnectionsService
          .removeConnection({
            userId:
              req.user.id,

            connectedUserId:
              userId,
          });

      return Response.success(
        res,
        result,
        "Connection removed successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }


    /**
   * Accepts or rejects a request received by the
   * authenticated user.
   *
   * Route:
   * PATCH /api/v1/users/me/connection-requests/:requestId
   */
  async respondToConnectionRequest(
    req,
    res,
    next,
  ) {
    try {
      const {
        requestId,
      } = req.validated.params;

      const {
        action,
      } = req.validated.body;

      const result =
        await ConnectionsService
          .respondToConnectionRequest({
            requestId,

            receiverUserId:
              req.user.id,

            action,
          });

      const actionLabel =
        action === "ACCEPT"
          ? "accepted"
          : "rejected";

      const message =
        result.actionApplied
          ? `Connection request ${actionLabel} successfully.`
          : `Connection request already ${actionLabel}.`;

      return Response.success(
        res,
        result,
        message,
      );
    } catch (error) {
      return next(error);
    }
  }

    /**
   * Cancels a pending request sent by the
   * authenticated user.
   *
   * Route:
   * DELETE /api/v1/users/me/connection-requests/:requestId
   */
  async cancelConnectionRequest(
    req,
    res,
    next,
  ) {
    try {
      const {
        requestId,
      } = req.validated.params;

      const result =
        await ConnectionsService
          .cancelConnectionRequest({
            requestId,

            senderUserId:
              req.user.id,
          });

      const message =
        result.actionApplied
          ? "Connection request cancelled successfully."
          : "Connection request already cancelled.";

      return Response.success(
        res,
        result,
        message,
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new ConnectionsController();