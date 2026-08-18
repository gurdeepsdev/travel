import AppError
  from "../../../core/errors/app-error.js";

import ErrorCodes
  from "../../../shared/constants/error-codes.js";

import HttpStatus
  from "../../../shared/constants/http-status.js";

import ConnectionsMapper
  from "../mappers/connections.mapper.js";

import ConnectionsRepository
  from "../repositories/connections.repository.js";

  import {
  decodeCursor,
  encodeCursor,
} from "../../../shared/utils/cursor.js";

import {
  decodeConnectionSuggestionCursor,
  encodeConnectionSuggestionCursor,
} from "../utils/connection-suggestions-cursor.util.js";

class ConnectionsService {
  /**
   * Sends a connection request.
   *
   * Repeating the same outgoing request is
   * idempotent and returns the existing request.
   */
  async sendConnectionRequest({
    senderUserId,
    receiverUserId,
  }) {
    if (
      senderUserId.toLowerCase() ===
      receiverUserId.toLowerCase()
    ) {
      throw this
        .createSelfRequestError();
    }

    let context;

    try {
      context =
        await ConnectionsRepository
          .sendRequest({
            senderUserId,
            receiverUserId,
          });
    } catch (error) {
      /*
       * The advisory lock prevents normal same-pair
       * races. This retry also protects against a
       * request inserted outside this repository.
       */
      if (error.code === "23505") {
        context =
          await ConnectionsRepository
            .sendRequest({
              senderUserId,
              receiverUserId,
            });
      } else {
        throw error;
      }
    }

    /*
     * Missing, inactive, deleted-profile and blocked
     * targets deliberately share one response.
     */
    if (
      !context ||
      context.target_available !== true
    ) {
      throw this
        .createTargetNotAvailableError();
    }

    if (
      context.already_connected === true
    ) {
      throw this
        .createAlreadyConnectedError();
    }

    /*
     * The authenticated user is the recipient of
     * this existing reverse request, so returning
     * its ID does not expose another user's data.
     */
    if (context.incoming_request_id) {
      throw this
        .createRequestAlreadyReceivedError(
          context.incoming_request_id,
        );
    }

    /*
     * At this point the repository must return either
     * the newly inserted request or the existing
     * outgoing pending request.
     */
    if (!context.id) {
      throw this
        .createUnexpectedStateError();
    }

    return ConnectionsMapper
      .toSendResponse(context);
  }

  createSelfRequestError() {
    return new AppError({
      code:
        ErrorCodes.CONNECTION
          .SELF_REQUEST_NOT_ALLOWED,

      message:
        "You cannot send a connection request to yourself.",

      statusCode:
        HttpStatus.BAD_REQUEST,
    });
  }

  createTargetNotAvailableError() {
    return new AppError({
      code:
        ErrorCodes.CONNECTION
          .TARGET_NOT_AVAILABLE,

      message:
        "The requested user was not found or is not available.",

      statusCode:
        HttpStatus.NOT_FOUND,
    });
  }

  createAlreadyConnectedError() {
    return new AppError({
      code:
        ErrorCodes.CONNECTION
          .ALREADY_CONNECTED,

      message:
        "You are already connected with this user.",

      statusCode:
        HttpStatus.CONFLICT,
    });
  }

  createRequestAlreadyReceivedError(
    connectionRequestId,
  ) {
    return new AppError({
      code:
        ErrorCodes.CONNECTION
          .REQUEST_ALREADY_RECEIVED,

      message:
        "This user has already sent you a connection request.",

      statusCode:
        HttpStatus.CONFLICT,

      details: {
        connectionRequestId,
      },
    });
  }

  createUnexpectedStateError() {
    return new AppError({
      code:
        ErrorCodes.COMMON
          .INTERNAL_SERVER_ERROR,

      message:
        "The connection request could not be created.",

      statusCode:
        HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }


    /**
   * Returns pending connection requests received
   * by the authenticated user.
   */
  async getIncomingConnectionRequests({
    userId,
    limit = 20,
    cursor = null,
  }) {
    const decodedCursor =
      decodeCursor(cursor);

    const listResult =
      await ConnectionsRepository
        .listIncoming({
          userId,
          limit,

          cursor:
            decodedCursor,
        });

    const nextCursor =
      listResult.hasMore &&
      listResult.lastRow
        ? encodeCursor({
            createdAt:
              listResult.lastRow
                .cursor_created_at ??
              listResult.lastRow
                .created_at,

            id:
              listResult.lastRow.id,
          })
        : null;

    return ConnectionsMapper
      .toIncomingListResponse({
        rows:
          listResult.rows,

        hasMore:
          listResult.hasMore,

        nextCursor,
      });
  }


    /**
   * Returns pending connection requests sent
   * by the authenticated user.
   */
  async getOutgoingConnectionRequests({
    userId,
    limit = 20,
    cursor = null,
  }) {
    const decodedCursor =
      decodeCursor(cursor);

    const listResult =
      await ConnectionsRepository
        .listOutgoing({
          userId,
          limit,

          cursor:
            decodedCursor,
        });

    const nextCursor =
      listResult.hasMore &&
      listResult.lastRow
        ? encodeCursor({
            createdAt:
              listResult.lastRow
                .cursor_created_at ??
              listResult.lastRow
                .created_at,

            id:
              listResult.lastRow.id,
          })
        : null;

    return ConnectionsMapper
      .toOutgoingListResponse({
        rows:
          listResult.rows,

        hasMore:
          listResult.hasMore,

        nextCursor,
      });
  }


    /**
   * Returns accepted connections belonging to the
   * authenticated user.
   */
  async getMyConnections({
    userId,
    limit = 20,
    cursor = null,
  }) {
    const decodedCursor =
      decodeCursor(cursor);

    const listResult =
      await ConnectionsRepository
        .listConnections({
          userId,
          limit,

          cursor:
            decodedCursor,
        });

    const nextCursor =
      listResult.hasMore &&
      listResult.lastRow
        ? encodeCursor({
            createdAt:
              listResult.lastRow
                .cursor_connected_at ??
              listResult.lastRow
                .connected_at,

            id:
              listResult.lastRow.id,
          })
        : null;

    return ConnectionsMapper
      .toConnectionsListResponse({
        rows:
          listResult.rows,

        hasMore:
          listResult.hasMore,

        nextCursor,
      });
  }


  /**
   * Returns ranked connection suggestions for the
   * authenticated user.
   */
  async getConnectionSuggestions({
    userId,
    limit = 20,
    cursor = null,
  }) {
    const decodedCursor =
      decodeConnectionSuggestionCursor(
        cursor,
      );

    const listResult =
      await ConnectionsRepository
        .listConnectionSuggestions({
          userId,
          limit,

          cursor:
            decodedCursor,
        });

    const nextCursor =
      listResult.hasMore &&
      listResult.lastRow
        ? encodeConnectionSuggestionCursor({
            score:
              Number(
                listResult.lastRow
                  .suggestion_score,
              ),

            userId:
              listResult.lastRow
                .suggestion_user_id,
          })
        : null;

    return ConnectionsMapper
      .toSuggestionsListResponse({
        rows:
          listResult.rows,

        hasMore:
          listResult.hasMore,

        nextCursor,
      });
  }

    /**
   * Removes an accepted connection belonging to
   * the authenticated user.
   */
  async removeConnection({
    userId,
    connectedUserId,
  }) {
    if (
      userId.toLowerCase() ===
      connectedUserId.toLowerCase()
    ) {
      throw this
        .createConnectionNotFoundError();
    }

    const result =
      await ConnectionsRepository
        .removeConnection({
          userId,
          connectedUserId,
        });

    if (!result) {
      throw this
        .createConnectionNotFoundError();
    }

    return ConnectionsMapper
      .toRemoveResponse({
        row:
          result,

        connectedUserId,
      });
  }

    /**
   * Accepts or rejects a request received by the
   * authenticated user.
   *
   * Repeating the same action is idempotent.
   */
  async respondToConnectionRequest({
    requestId,
    receiverUserId,
    action,
  }) {
    let result;

    try {
      result =
        await ConnectionsRepository
          .respondToRequest({
            requestId,
            receiverUserId,
            action,
          });
    } catch (error) {
      /*
       * Hide a user/request deleted concurrently
       * while the response was being applied.
       */
      if (error.code === "23503") {
        throw this
          .createRequestNotFoundError();
      }
      

      throw error;
    }

    /*
     * Null deliberately hides:
     *  missing request;
     * wrong recipient;
     *  blocked relationship;
     * opposite action after resolution;
     * unavailable sender during acceptance;
     * accepted request whose connection was removed.
     */
    if (!result) {
      throw this
        .createRequestNotFoundError();
    }

    return ConnectionsMapper
      .toRespondResponse(
        result,
      );
  }



    /**
   * Cancels a pending request sent by the
   * authenticated user.
   *
   * Repeating cancellation is idempotent.
   */
  async cancelConnectionRequest({
    requestId,
    senderUserId,
  }) {
    const result =
      await ConnectionsRepository
        .cancelRequest({
          requestId,
          senderUserId,
        });

    /*
     * Null deliberately hides:
     * - a missing request;
     * - a request owned by another sender;
     * - an accepted or rejected request.
     */
    if (!result) {
      throw this
        .createRequestNotFoundError();
    }

    return ConnectionsMapper
      .toCancelResponse(
        result,
      );
  }

  createRequestNotFoundError() {
    return new AppError({
      code:
        ErrorCodes.CONNECTION
          .REQUEST_NOT_FOUND,

      message:
        "Connection request not found.",

      statusCode:
        HttpStatus.NOT_FOUND,
    });
  }
  createConnectionNotFoundError() {
    return new AppError({
      code:
        ErrorCodes.CONNECTION
          .CONNECTION_NOT_FOUND,

      message:
        "Connection not found.",

      statusCode:
        HttpStatus.NOT_FOUND,
    });
  }

}

export default new ConnectionsService();