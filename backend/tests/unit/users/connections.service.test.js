import {
  jest,
} from "@jest/globals";

import {
  decodeCursor,
} from "../../../src/shared/utils/cursor.js";

import {
  decodeConnectionSuggestionCursor,
} from "../../../src/modules/users/utils/connection-suggestions-cursor.util.js";

const SENDER_USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const RECEIVER_USER_ID =
  "a4bfc312-1065-4377-adf7-98792cd212a3";

const REQUEST_ID =
  "c1000000-0000-4000-8000-000000000001";

const INCOMING_REQUEST_ID =
  "c1000000-0000-4000-8000-000000000002";

const repositoryMock = {
  sendRequest:
    jest.fn(),

  listIncoming:
    jest.fn(),

  listOutgoing:
    jest.fn(),

  respondToRequest:
    jest.fn(),

    cancelRequest:
    jest.fn(),

      listConnections:
    jest.fn(),

      findConnectionsTarget:
    jest.fn(),

      removeConnection:
    jest.fn(),

     listConnectionSuggestions:
    jest.fn(),
    
};

jest.unstable_mockModule(
  "../../../src/modules/users/repositories/connections.repository.js",
  () => ({
    default:
      repositoryMock,
  }),
);

const {
  default: ConnectionsService,
} = await import(
  "../../../src/modules/users/services/connections.service.js"
);

function createContext(
  overrides = {},
) {
  return {
    target_available:
      true,

    already_connected:
      false,

    incoming_request_id:
      null,

    id:
      REQUEST_ID,

    sender_user_id:
      SENDER_USER_ID,

    receiver_user_id:
      RECEIVER_USER_ID,

    status:
      "PENDING",

    created_at:
      new Date(
        "2026-08-06T10:00:00Z",
      ),

    updated_at:
      new Date(
        "2026-08-06T10:00:00Z",
      ),

    resolved_at:
      null,

    request_created:
      true,

    target_user_id:
      RECEIVER_USER_ID,

    target_username:
      "user_8199818957",

    target_display_name:
      "Test User",

    target_is_verified:
      false,

    target_is_private:
      true,

    target_profile_photo_id:
      null,

    target_profile_photo_storage_provider:
      null,

    target_profile_photo_bucket:
      null,

    target_profile_photo_storage_key:
      null,

    target_profile_photo_mime_type:
      null,

    target_profile_photo_is_public:
      false,

    ...overrides,
  };

}
  function createIncomingRow(
  overrides = {},
) {
  return {
    id:
      REQUEST_ID,

    request_sender_user_id:
      SENDER_USER_ID,

    receiver_user_id:
      RECEIVER_USER_ID,

    status:
      "PENDING",

    created_at:
      new Date(
        "2026-08-06T10:00:00Z",
      ),

    cursor_created_at:
      "2026-08-06 10:00:00.123456",

    updated_at:
      new Date(
        "2026-08-06T10:00:00Z",
      ),

    resolved_at:
      null,

    sender_user_id:
      SENDER_USER_ID,

    sender_username:
      "user_94567b08",

    sender_display_name:
      null,

    sender_is_verified:
      false,

    sender_is_private:
      false,

    sender_profile_photo_id:
      null,

    sender_profile_photo_storage_provider:
      null,

    sender_profile_photo_bucket:
      null,

    sender_profile_photo_storage_key:
      null,

    sender_profile_photo_mime_type:
      null,

    sender_profile_photo_is_public:
      false,

    ...overrides,
  };
}

function createOutgoingRow(
  overrides = {},
) {
  return {
    id:
      REQUEST_ID,

    sender_user_id:
      SENDER_USER_ID,

    request_receiver_user_id:
      RECEIVER_USER_ID,

    status:
      "PENDING",

    created_at:
      new Date(
        "2026-08-06T10:00:00Z",
      ),

    cursor_created_at:
      "2026-08-06 10:00:00.123456",

    updated_at:
      new Date(
        "2026-08-06T10:00:00Z",
      ),

    resolved_at:
      null,

    recipient_user_id:
      RECEIVER_USER_ID,

    recipient_username:
      "user_8199818957",

    recipient_display_name:
      null,

    recipient_is_verified:
      false,

    recipient_is_private:
      false,

    recipient_profile_photo_id:
      null,

    recipient_profile_photo_storage_provider:
      null,

    recipient_profile_photo_bucket:
      null,

    recipient_profile_photo_storage_key:
      null,

    recipient_profile_photo_mime_type:
      null,

    recipient_profile_photo_is_public:
      false,

    ...overrides,
  };
}


function createRespondRow(
  overrides = {},
) {
  return {
    id:
      REQUEST_ID,

    sender_user_id:
      SENDER_USER_ID,

    receiver_user_id:
      RECEIVER_USER_ID,

    status:
      "ACCEPTED",

    created_at:
      new Date(
        "2026-08-06T10:00:00Z",
      ),

    updated_at:
      new Date(
        "2026-08-06T11:00:00Z",
      ),

    resolved_at:
      new Date(
        "2026-08-06T11:00:00Z",
      ),

    action_applied:
      true,

    connection_id:
      "c2000000-0000-4000-8000-000000000001",

    user_low_id:
      SENDER_USER_ID,

    user_high_id:
      RECEIVER_USER_ID,

    connected_at:
      new Date(
        "2026-08-06T11:00:00Z",
      ),

    sender_username:
      "user_94567b08",

    sender_display_name:
      null,

    sender_is_verified:
      false,

    sender_is_private:
      false,

    sender_profile_photo_id:
      null,

    sender_profile_photo_storage_provider:
      null,

    sender_profile_photo_bucket:
      null,

    sender_profile_photo_storage_key:
      null,

    sender_profile_photo_mime_type:
      null,

    sender_profile_photo_is_public:
      false,

    ...overrides,
  };
}

function createCancelRow(
  overrides = {},
) {
  return {
    id:
      REQUEST_ID,

    sender_user_id:
      SENDER_USER_ID,

    receiver_user_id:
      RECEIVER_USER_ID,

    status:
      "CANCELLED",

    created_at:
      new Date(
        "2026-08-06T10:00:00Z",
      ),

    updated_at:
      new Date(
        "2026-08-06T11:00:00Z",
      ),

    resolved_at:
      new Date(
        "2026-08-06T11:00:00Z",
      ),

    action_applied:
      true,

    recipient_user_id:
      RECEIVER_USER_ID,

    recipient_username:
      "user_8199818957",

    recipient_display_name:
      null,

    recipient_is_verified:
      false,

    recipient_is_private:
      false,

    recipient_profile_photo_id:
      null,

    recipient_profile_photo_storage_provider:
      null,

    recipient_profile_photo_bucket:
      null,

    recipient_profile_photo_storage_key:
      null,

    recipient_profile_photo_mime_type:
      null,

    recipient_profile_photo_is_public:
      false,

    ...overrides,
  };
}


function createConnectionRow(
  overrides = {},
) {
  return {
    id:
      "c2000000-0000-4000-8000-000000000001",

    user_low_id:
      SENDER_USER_ID,

    user_high_id:
      RECEIVER_USER_ID,

    connected_at:
      new Date(
        "2026-08-06T11:00:00Z",
      ),

    cursor_connected_at:
      "2026-08-06 11:00:00.123456",

    connection_user_id:
      RECEIVER_USER_ID,

    connection_username:
      "user_8199818957",

    connection_display_name:
      null,

    connection_is_verified:
      false,

    connection_is_private:
      false,

    connection_profile_photo_id:
      null,

    connection_profile_photo_storage_provider:
      null,

    connection_profile_photo_bucket:
      null,

    connection_profile_photo_storage_key:
      null,

    connection_profile_photo_mime_type:
      null,

    connection_profile_photo_is_public:
      false,

    ...overrides,
  };
}


function createSuggestionRow(
  overrides = {},
) {
  return {
    suggestion_user_id:
      RECEIVER_USER_ID,

    suggestion_username:
      "user_8199818957",

    suggestion_display_name:
      null,

    suggestion_is_verified:
      false,

    suggestion_is_private:
      false,

    suggestion_profile_photo_id:
      null,

    suggestion_profile_photo_storage_provider:
      null,

    suggestion_profile_photo_bucket:
      null,

    suggestion_profile_photo_storage_key:
      null,

    suggestion_profile_photo_mime_type:
      null,

    suggestion_profile_photo_is_public:
      false,

    outgoing_reaction_count:
      2,

    incoming_reaction_count:
      1,

    mutual_connection_count:
      3,

    shared_city_count:
      1,

    suggestion_score:
      "17",

    ...overrides,
  };
}

describe(
  "ConnectionsService",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe(
      "sendConnectionRequest",
      () => {
        test(
          "creates a new pending request",
          async () => {
            repositoryMock
              .sendRequest
              .mockResolvedValue(
                createContext(),
              );

            const result =
              await ConnectionsService
                .sendConnectionRequest({
                  senderUserId:
                    SENDER_USER_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,
                });

            expect(
              repositoryMock.sendRequest,
            ).toHaveBeenCalledWith({
              senderUserId:
                SENDER_USER_ID,

              receiverUserId:
                RECEIVER_USER_ID,
            });

            expect(result)
              .toMatchObject({
                requestCreated:
                  true,

                connectionRequest: {
                  id:
                    REQUEST_ID,

                  senderUserId:
                    SENDER_USER_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,

                  status:
                    "PENDING",

                  recipient: {
                    id:
                      RECEIVER_USER_ID,

                    username:
                      "user_8199818957",
                  },
                },
              });
          },
        );

        test(
          "returns the existing outgoing request idempotently",
          async () => {
            repositoryMock
              .sendRequest
              .mockResolvedValue(
                createContext({
                  request_created:
                    false,
                }),
              );

            const result =
              await ConnectionsService
                .sendConnectionRequest({
                  senderUserId:
                    SENDER_USER_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,
                });

            expect(
              result.requestCreated,
            ).toBe(false);

            expect(
              result.connectionRequest.id,
            ).toBe(REQUEST_ID);
          },
        );

        test(
          "rejects a request to self before querying",
          async () => {
            await expect(
              ConnectionsService
                .sendConnectionRequest({
                  senderUserId:
                    SENDER_USER_ID,

                  receiverUserId:
                    SENDER_USER_ID
                      .toUpperCase(),
                }),
            ).rejects.toMatchObject({
              code:
                "CONNECTION.SELF_REQUEST_NOT_ALLOWED",

              statusCode:
                400,
            });

            expect(
              repositoryMock.sendRequest,
            ).not.toHaveBeenCalled();
          },
        );

        test.each([
          [
            "missing context",
            null,
          ],
          [
            "unavailable target",
            createContext({
              target_available:
                false,

              id:
                null,
            }),
          ],
        ])(
          "hides a %s",
          async (
            _name,
            context,
          ) => {
            repositoryMock
              .sendRequest
              .mockResolvedValue(
                context,
              );

            await expect(
              ConnectionsService
                .sendConnectionRequest({
                  senderUserId:
                    SENDER_USER_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,
                }),
            ).rejects.toMatchObject({
              code:
                "CONNECTION.TARGET_NOT_AVAILABLE",

              statusCode:
                404,
            });
          },
        );

        test(
          "rejects an existing connection",
          async () => {
            repositoryMock
              .sendRequest
              .mockResolvedValue(
                createContext({
                  already_connected:
                    true,

                  id:
                    null,
                }),
              );

            await expect(
              ConnectionsService
                .sendConnectionRequest({
                  senderUserId:
                    SENDER_USER_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,
                }),
            ).rejects.toMatchObject({
              code:
                "CONNECTION.ALREADY_CONNECTED",

              statusCode:
                409,
            });
          },
        );

        test(
          "returns the reverse incoming request ID",
          async () => {
            repositoryMock
              .sendRequest
              .mockResolvedValue(
                createContext({
                  incoming_request_id:
                    INCOMING_REQUEST_ID,

                  id:
                    null,
                }),
              );

            await expect(
              ConnectionsService
                .sendConnectionRequest({
                  senderUserId:
                    SENDER_USER_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,
                }),
            ).rejects.toMatchObject({
              code:
                "CONNECTION.REQUEST_ALREADY_RECEIVED",

              statusCode:
                409,

              details: {
                connectionRequestId:
                  INCOMING_REQUEST_ID,
              },
            });
          },
        );

        test(
          "recovers from a unique-constraint race",
          async () => {
            repositoryMock
              .sendRequest
              .mockRejectedValueOnce({
                code:
                  "23505",
              })
              .mockResolvedValueOnce(
                createContext({
                  request_created:
                    false,
                }),
              );

            const result =
              await ConnectionsService
                .sendConnectionRequest({
                  senderUserId:
                    SENDER_USER_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,
                });

            expect(
              repositoryMock.sendRequest,
            ).toHaveBeenCalledTimes(2);

            expect(
              result.requestCreated,
            ).toBe(false);

            expect(
              result.connectionRequest.id,
            ).toBe(REQUEST_ID);
          },
        );

        test(
          "does not hide unrelated database errors",
          async () => {
            const databaseError =
              new Error(
                "Database unavailable",
              );

            repositoryMock
              .sendRequest
              .mockRejectedValue(
                databaseError,
              );

            await expect(
              ConnectionsService
                .sendConnectionRequest({
                  senderUserId:
                    SENDER_USER_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,
                }),
            ).rejects.toBe(
              databaseError,
            );

            expect(
              repositoryMock.sendRequest,
            ).toHaveBeenCalledTimes(1);
          },
        );

        test(
          "rejects an unexpected empty repository result",
          async () => {
            repositoryMock
              .sendRequest
              .mockResolvedValue(
                createContext({
                  id:
                    null,
                }),
              );

            await expect(
              ConnectionsService
                .sendConnectionRequest({
                  senderUserId:
                    SENDER_USER_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,
                }),
            ).rejects.toMatchObject({
              code:
                "COMMON.INTERNAL_SERVER_ERROR",

              statusCode:
                500,
            });
          },
        );
      },
    );

        describe(
      "getUserConnections",
      () => {
        test(
          "returns connections for a public profile to an anonymous viewer",
          async () => {
            const row =
              createConnectionRow();

            repositoryMock
              .findConnectionsTarget
              .mockResolvedValue({
                user_id:
                  SENDER_USER_ID,

                is_private:
                  false,

                is_blocked:
                  false,

                is_connected:
                  false,
              });

            repositoryMock
              .listConnections
              .mockResolvedValue({
                rows: [row],
                hasMore: false,
                lastRow: row,
              });

            const result =
              await ConnectionsService
                .getUserConnections({
                  username:
                    "public_user",

                  viewerUserId:
                    null,

                  limit:
                    20,
                });

            expect(
              repositoryMock.listConnections,
            ).toHaveBeenCalledWith({
              userId:
                SENDER_USER_ID,

              viewerUserId:
                null,

              limit:
                20,

              cursor:
                null,
            });

            expect(result.connections)
              .toHaveLength(1);
          },
        );

        test.each([
          [
            "missing profile",
            null,
            null,
          ],
          [
            "blocked profile",
            {
              user_id:
                SENDER_USER_ID,

              is_private:
                false,

              is_blocked:
                true,

              is_connected:
                false,
            },
            RECEIVER_USER_ID,
          ],
          [
            "private unconnected profile",
            {
              user_id:
                SENDER_USER_ID,

              is_private:
                true,

              is_blocked:
                false,

              is_connected:
                false,
            },
            RECEIVER_USER_ID,
          ],
        ])(
          "hides a %s",
          async (
            _label,
            target,
            viewerUserId,
          ) => {
            repositoryMock
              .findConnectionsTarget
              .mockResolvedValue(
                target,
              );

            await expect(
              ConnectionsService
                .getUserConnections({
                  username:
                    "hidden_user",

                  viewerUserId,
                }),
            ).rejects.toMatchObject({
              code:
                "USER.NOT_FOUND",

              statusCode:
                404,
            });

            expect(
              repositoryMock.listConnections,
            ).not.toHaveBeenCalled();
          },
        );

        test(
          "allows an accepted connection to view a private profile",
          async () => {
            repositoryMock
              .findConnectionsTarget
              .mockResolvedValue({
                user_id:
                  SENDER_USER_ID,

                is_private:
                  true,

                is_blocked:
                  false,

                is_connected:
                  true,
              });

            repositoryMock
              .listConnections
              .mockResolvedValue({
                rows: [],
                hasMore: false,
                lastRow: null,
              });

            await expect(
              ConnectionsService
                .getUserConnections({
                  username:
                    "private_user",

                  viewerUserId:
                    RECEIVER_USER_ID,
                }),
            ).resolves.toMatchObject({
              connections: [],
            });
          },
        );
      },
    );


        describe(
      "getIncomingConnectionRequests",
      () => {
        test(
          "returns pending incoming requests",
          async () => {
            repositoryMock
              .listIncoming
              .mockResolvedValue({
                rows: [
                  createIncomingRow(),
                ],

                hasMore:
                  false,

                lastRow:
                  createIncomingRow(),
              });

            const result =
              await ConnectionsService
                .getIncomingConnectionRequests({
                  userId:
                    RECEIVER_USER_ID,

                  limit:
                    20,

                  cursor:
                    null,
                });

            expect(
              repositoryMock.listIncoming,
            ).toHaveBeenCalledWith({
              userId:
                RECEIVER_USER_ID,

              limit:
                20,

              cursor:
                null,
            });

            expect(result)
              .toMatchObject({
                connectionRequests: [
                  {
                    id:
                      REQUEST_ID,

                    senderUserId:
                      SENDER_USER_ID,

                    receiverUserId:
                      RECEIVER_USER_ID,

                    status:
                      "PENDING",

                    sender: {
                      id:
                        SENDER_USER_ID,

                      username:
                        "user_94567b08",
                    },
                  },
                ],

                pagination: {
                  hasMore:
                    false,

                  nextCursor:
                    null,
                },
              });
          },
        );

        test(
          "creates a timestamp-safe next cursor",
          async () => {
            const lastRow =
              createIncomingRow({
                id:
                  INCOMING_REQUEST_ID,

                cursor_created_at:
                  "2026-08-06 10:00:00.654321",
              });

            repositoryMock
              .listIncoming
              .mockResolvedValue({
                rows: [
                  createIncomingRow(),
                ],

                hasMore:
                  true,

                lastRow,
              });

            const result =
              await ConnectionsService
                .getIncomingConnectionRequests({
                  userId:
                    RECEIVER_USER_ID,

                  limit:
                    1,

                  cursor:
                    null,
                });

            expect(
              result.pagination.hasMore,
            ).toBe(true);

            const decodedCursor =
              decodeCursor(
                result.pagination
                  .nextCursor,
              );

            expect(decodedCursor)
              .toEqual({
                createdAt:
                  "2026-08-06 10:00:00.654321",

                id:
                  INCOMING_REQUEST_ID,
              });
          },
        );

        test(
          "returns an empty incoming list",
          async () => {
            repositoryMock
              .listIncoming
              .mockResolvedValue({
                rows: [],

                hasMore:
                  false,

                lastRow:
                  null,
              });

            const result =
              await ConnectionsService
                .getIncomingConnectionRequests({
                  userId:
                    RECEIVER_USER_ID,
                });

            expect(result)
              .toEqual({
                connectionRequests: [],

                pagination: {
                  hasMore:
                    false,

                  nextCursor:
                    null,
                },
              });
          },
        );

        test(
          "rejects an invalid cursor before querying",
          async () => {
            await expect(
              ConnectionsService
                .getIncomingConnectionRequests({
                  userId:
                    RECEIVER_USER_ID,

                  cursor:
                    "invalid",
                }),
            ).rejects.toMatchObject({
              code:
                "COMMON.INVALID_CURSOR",

              statusCode:
                400,
            });

            expect(
              repositoryMock.listIncoming,
            ).not.toHaveBeenCalled();
          },
        );
      },
    );

        describe(
      "getOutgoingConnectionRequests",
      () => {
        test(
          "returns pending outgoing requests",
          async () => {
            repositoryMock
              .listOutgoing
              .mockResolvedValue({
                rows: [
                  createOutgoingRow(),
                ],

                hasMore:
                  false,

                lastRow:
                  createOutgoingRow(),
              });

            const result =
              await ConnectionsService
                .getOutgoingConnectionRequests({
                  userId:
                    SENDER_USER_ID,

                  limit:
                    20,

                  cursor:
                    null,
                });

            expect(
              repositoryMock.listOutgoing,
            ).toHaveBeenCalledWith({
              userId:
                SENDER_USER_ID,

              limit:
                20,

              cursor:
                null,
            });

            expect(result)
              .toMatchObject({
                connectionRequests: [
                  {
                    id:
                      REQUEST_ID,

                    senderUserId:
                      SENDER_USER_ID,

                    receiverUserId:
                      RECEIVER_USER_ID,

                    status:
                      "PENDING",

                    recipient: {
                      id:
                        RECEIVER_USER_ID,

                      username:
                        "user_8199818957",
                    },
                  },
                ],

                pagination: {
                  hasMore:
                    false,

                  nextCursor:
                    null,
                },
              });
          },
        );

        test(
          "creates an outgoing timestamp-safe cursor",
          async () => {
            const lastRow =
              createOutgoingRow({
                id:
                  INCOMING_REQUEST_ID,

                cursor_created_at:
                  "2026-08-06 10:00:00.987654",
              });

            repositoryMock
              .listOutgoing
              .mockResolvedValue({
                rows: [
                  createOutgoingRow(),
                ],

                hasMore:
                  true,

                lastRow,
              });

            const result =
              await ConnectionsService
                .getOutgoingConnectionRequests({
                  userId:
                    SENDER_USER_ID,

                  limit:
                    1,

                  cursor:
                    null,
                });

            expect(
              result.pagination.hasMore,
            ).toBe(true);

            expect(
              decodeCursor(
                result.pagination
                  .nextCursor,
              ),
            ).toEqual({
              createdAt:
                "2026-08-06 10:00:00.987654",

              id:
                INCOMING_REQUEST_ID,
            });
          },
        );

        test(
          "returns an empty outgoing list",
          async () => {
            repositoryMock
              .listOutgoing
              .mockResolvedValue({
                rows: [],

                hasMore:
                  false,

                lastRow:
                  null,
              });

            const result =
              await ConnectionsService
                .getOutgoingConnectionRequests({
                  userId:
                    SENDER_USER_ID,
                });

            expect(result)
              .toEqual({
                connectionRequests: [],

                pagination: {
                  hasMore:
                    false,

                  nextCursor:
                    null,
                },
              });
          },
        );

        test(
          "rejects an invalid outgoing cursor before querying",
          async () => {
            await expect(
              ConnectionsService
                .getOutgoingConnectionRequests({
                  userId:
                    SENDER_USER_ID,

                  cursor:
                    "invalid",
                }),
            ).rejects.toMatchObject({
              code:
                "COMMON.INVALID_CURSOR",

              statusCode:
                400,
            });

            expect(
              repositoryMock.listOutgoing,
            ).not.toHaveBeenCalled();
          },
        );
      },
    );


        describe(
      "getMyConnections",
      () => {
        test(
          "returns accepted connections",
          async () => {
            const row =
              createConnectionRow();

            repositoryMock
              .listConnections
              .mockResolvedValue({
                rows: [
                  row,
                ],

                hasMore:
                  false,

                lastRow:
                  row,
              });

            const result =
              await ConnectionsService
                .getMyConnections({
                  userId:
                    SENDER_USER_ID,

                  limit:
                    20,

                  cursor:
                    null,
                });

            expect(
              repositoryMock.listConnections,
            ).toHaveBeenCalledWith({
              userId:
                SENDER_USER_ID,

              limit:
                20,

              cursor:
                null,
            });

            expect(result)
              .toMatchObject({
                connections: [
                  {
                    id:
                      "c2000000-0000-4000-8000-000000000001",

                    user: {
                      id:
                        RECEIVER_USER_ID,

                      username:
                        "user_8199818957",
                    },
                  },
                ],

                pagination: {
                  hasMore:
                    false,

                  nextCursor:
                    null,
                },
              });

            expect(
              result.connections[0],
            ).not.toHaveProperty(
              "userLowId",
            );

            expect(
              result.connections[0],
            ).not.toHaveProperty(
              "userHighId",
            );
          },
        );

        test(
          "creates a connection timestamp-safe cursor",
          async () => {
            const lastRow =
              createConnectionRow({
                id:
                  "c2000000-0000-4000-8000-000000000002",

                cursor_connected_at:
                  "2026-08-06 11:00:00.654321",
              });

            repositoryMock
              .listConnections
              .mockResolvedValue({
                rows: [
                  createConnectionRow(),
                ],

                hasMore:
                  true,

                lastRow,
              });

            const result =
              await ConnectionsService
                .getMyConnections({
                  userId:
                    SENDER_USER_ID,

                  limit:
                    1,

                  cursor:
                    null,
                });

            expect(
              result.pagination.hasMore,
            ).toBe(true);

            const decoded =
              decodeCursor(
                result.pagination
                  .nextCursor,
              );

            expect(decoded)
              .toEqual({
                createdAt:
                  "2026-08-06 11:00:00.654321",

                id:
                  "c2000000-0000-4000-8000-000000000002",
              });
          },
        );

        test(
          "returns an empty connection list",
          async () => {
            repositoryMock
              .listConnections
              .mockResolvedValue({
                rows: [],

                hasMore:
                  false,

                lastRow:
                  null,
              });

            const result =
              await ConnectionsService
                .getMyConnections({
                  userId:
                    SENDER_USER_ID,

                  limit:
                    20,

                  cursor:
                    null,
                });

            expect(result)
              .toEqual({
                connections: [],

                pagination: {
                  hasMore:
                    false,

                  nextCursor:
                    null,
                },
              });
          },
        );

        test(
          "rejects an invalid connection cursor before querying",
          async () => {
            await expect(
              ConnectionsService
                .getMyConnections({
                  userId:
                    SENDER_USER_ID,

                  cursor:
                    "invalid",
                }),
            ).rejects.toMatchObject({
              code:
                "COMMON.INVALID_CURSOR",

              statusCode:
                400,
            });

            expect(
              repositoryMock.listConnections,
            ).not.toHaveBeenCalled();
          },
        );
      },
    );


        describe(
      "removeConnection",
      () => {
        test(
          "removes an accepted connection",
          async () => {
            repositoryMock
              .removeConnection
              .mockResolvedValue({
                id:
                  "c2000000-0000-4000-8000-000000000001",

                user_low_id:
                  SENDER_USER_ID,

                user_high_id:
                  RECEIVER_USER_ID,

                connected_at:
                  new Date(
                    "2026-08-06T11:00:00Z",
                  ),
              });

            const result =
              await ConnectionsService
                .removeConnection({
                  userId:
                    SENDER_USER_ID,

                  connectedUserId:
                    RECEIVER_USER_ID,
                });

            expect(
              repositoryMock.removeConnection,
            ).toHaveBeenCalledWith({
              userId:
                SENDER_USER_ID,

              connectedUserId:
                RECEIVER_USER_ID,
            });

            expect(result)
              .toMatchObject({
                removed:
                  true,

                connection: {
                  id:
                    "c2000000-0000-4000-8000-000000000001",

                  userId:
                    RECEIVER_USER_ID,
                },
              });

            expect(
              result.connection,
            ).not.toHaveProperty(
              "userLowId",
            );

            expect(
              result.connection,
            ).not.toHaveProperty(
              "userHighId",
            );
          },
        );

        test(
          "rejects self-removal before querying",
          async () => {
            await expect(
              ConnectionsService
                .removeConnection({
                  userId:
                    SENDER_USER_ID,

                  connectedUserId:
                    SENDER_USER_ID,
                }),
            ).rejects.toMatchObject({
              code:
                "CONNECTION.NOT_FOUND",

              statusCode:
                404,
            });

            expect(
              repositoryMock.removeConnection,
            ).not.toHaveBeenCalled();
          },
        );

        test(
          "hides a missing connection",
          async () => {
            repositoryMock
              .removeConnection
              .mockResolvedValue(
                null,
              );

            await expect(
              ConnectionsService
                .removeConnection({
                  userId:
                    SENDER_USER_ID,

                  connectedUserId:
                    RECEIVER_USER_ID,
                }),
            ).rejects.toMatchObject({
              code:
                "CONNECTION.NOT_FOUND",

              statusCode:
                404,
            });
          },
        );

        test(
          "does not hide removal database errors",
          async () => {
            const databaseError =
              new Error(
                "Database unavailable",
              );

            repositoryMock
              .removeConnection
              .mockRejectedValue(
                databaseError,
              );

            await expect(
              ConnectionsService
                .removeConnection({
                  userId:
                    SENDER_USER_ID,

                  connectedUserId:
                    RECEIVER_USER_ID,
                }),
            ).rejects.toBe(
              databaseError,
            );
          },
        );
      },
    );

        describe(
      "cancelConnectionRequest",
      () => {
        test(
          "cancels a pending outgoing request",
          async () => {
            repositoryMock
              .cancelRequest
              .mockResolvedValue(
                createCancelRow(),
              );

            const result =
              await ConnectionsService
                .cancelConnectionRequest({
                  requestId:
                    REQUEST_ID,

                  senderUserId:
                    SENDER_USER_ID,
                });

            expect(
              repositoryMock.cancelRequest,
            ).toHaveBeenCalledWith({
              requestId:
                REQUEST_ID,

              senderUserId:
                SENDER_USER_ID,
            });

            expect(result)
              .toMatchObject({
                actionApplied:
                  true,

                connectionRequest: {
                  id:
                    REQUEST_ID,

                  senderUserId:
                    SENDER_USER_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,

                  status:
                    "CANCELLED",

                  recipient: {
                    id:
                      RECEIVER_USER_ID,

                    username:
                      "user_8199818957",
                  },
                },
              });
          },
        );

        test(
          "returns repeated cancellation idempotently",
          async () => {
            repositoryMock
              .cancelRequest
              .mockResolvedValue(
                createCancelRow({
                  action_applied:
                    false,
                }),
              );

            const result =
              await ConnectionsService
                .cancelConnectionRequest({
                  requestId:
                    REQUEST_ID,

                  senderUserId:
                    SENDER_USER_ID,
                });

            expect(
              result.actionApplied,
            ).toBe(false);

            expect(
              result.connectionRequest
                .status,
            ).toBe("CANCELLED");
          },
        );

        test(
          "hides a missing or unauthorized request",
          async () => {
            repositoryMock
              .cancelRequest
              .mockResolvedValue(
                null,
              );

            await expect(
              ConnectionsService
                .cancelConnectionRequest({
                  requestId:
                    REQUEST_ID,

                  senderUserId:
                    SENDER_USER_ID,
                }),
            ).rejects.toMatchObject({
              code:
                "CONNECTION.REQUEST_NOT_FOUND",

              statusCode:
                404,
            });
          },
        );

        test(
          "does not hide cancellation database errors",
          async () => {
            const databaseError =
              new Error(
                "Database unavailable",
              );

            repositoryMock
              .cancelRequest
              .mockRejectedValue(
                databaseError,
              );

            await expect(
              ConnectionsService
                .cancelConnectionRequest({
                  requestId:
                    REQUEST_ID,

                  senderUserId:
                    SENDER_USER_ID,
                }),
            ).rejects.toBe(
              databaseError,
            );
          },
        );
      },
    );

        describe(
      "respondToConnectionRequest",
      () => {
        test(
          "accepts a pending request and returns the connection",
          async () => {
            repositoryMock
              .respondToRequest
              .mockResolvedValue(
                createRespondRow(),
              );

            const result =
              await ConnectionsService
                .respondToConnectionRequest({
                  requestId:
                    REQUEST_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,

                  action:
                    "ACCEPT",
                });

            expect(
              repositoryMock.respondToRequest,
            ).toHaveBeenCalledWith({
              requestId:
                REQUEST_ID,

              receiverUserId:
                RECEIVER_USER_ID,

              action:
                "ACCEPT",
            });

            expect(result)
              .toMatchObject({
                actionApplied:
                  true,

                connectionRequest: {
                  id:
                    REQUEST_ID,

                  status:
                    "ACCEPTED",
                },

                connection: {
                  id:
                    "c2000000-0000-4000-8000-000000000001",

                  userLowId:
                    SENDER_USER_ID,

                  userHighId:
                    RECEIVER_USER_ID,
                },
              });
          },
        );

        test(
          "returns a repeated acceptance idempotently",
          async () => {
            repositoryMock
              .respondToRequest
              .mockResolvedValue(
                createRespondRow({
                  action_applied:
                    false,
                }),
              );

            const result =
              await ConnectionsService
                .respondToConnectionRequest({
                  requestId:
                    REQUEST_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,

                  action:
                    "ACCEPT",
                });

            expect(
              result.actionApplied,
            ).toBe(false);

            expect(
              result.connectionRequest
                .status,
            ).toBe("ACCEPTED");

            expect(
              result.connection,
            ).not.toBeNull();
          },
        );

        test(
          "rejects a pending request without creating a connection",
          async () => {
            repositoryMock
              .respondToRequest
              .mockResolvedValue(
                createRespondRow({
                  status:
                    "REJECTED",

                  connection_id:
                    null,

                  user_low_id:
                    null,

                  user_high_id:
                    null,

                  connected_at:
                    null,
                }),
              );

            const result =
              await ConnectionsService
                .respondToConnectionRequest({
                  requestId:
                    REQUEST_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,

                  action:
                    "REJECT",
                });

            expect(
              result.actionApplied,
            ).toBe(true);

            expect(
              result.connectionRequest
                .status,
            ).toBe("REJECTED");

            expect(
              result.connection,
            ).toBeNull();
          },
        );

        test(
          "returns a repeated rejection idempotently",
          async () => {
            repositoryMock
              .respondToRequest
              .mockResolvedValue(
                createRespondRow({
                  status:
                    "REJECTED",

                  action_applied:
                    false,

                  connection_id:
                    null,

                  user_low_id:
                    null,

                  user_high_id:
                    null,

                  connected_at:
                    null,
                }),
              );

            const result =
              await ConnectionsService
                .respondToConnectionRequest({
                  requestId:
                    REQUEST_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,

                  action:
                    "REJECT",
                });

            expect(
              result.actionApplied,
            ).toBe(false);

            expect(
              result.connection,
            ).toBeNull();
          },
        );

        test(
          "hides a missing or unauthorized request",
          async () => {
            repositoryMock
              .respondToRequest
              .mockResolvedValue(
                null,
              );

            await expect(
              ConnectionsService
                .respondToConnectionRequest({
                  requestId:
                    REQUEST_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,

                  action:
                    "ACCEPT",
                }),
            ).rejects.toMatchObject({
              code:
                "CONNECTION.REQUEST_NOT_FOUND",

              statusCode:
                404,
            });
          },
        );

        test(
          "maps a foreign-key race to request not found",
          async () => {
            repositoryMock
              .respondToRequest
              .mockRejectedValue({
                code:
                  "23503",
              });

            await expect(
              ConnectionsService
                .respondToConnectionRequest({
                  requestId:
                    REQUEST_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,

                  action:
                    "ACCEPT",
                }),
            ).rejects.toMatchObject({
              code:
                "CONNECTION.REQUEST_NOT_FOUND",

              statusCode:
                404,
            });
          },
        );

        test(
          "does not hide unrelated response errors",
          async () => {
            const databaseError =
              new Error(
                "Database unavailable",
              );

            repositoryMock
              .respondToRequest
              .mockRejectedValue(
                databaseError,
              );

            await expect(
              ConnectionsService
                .respondToConnectionRequest({
                  requestId:
                    REQUEST_ID,

                  receiverUserId:
                    RECEIVER_USER_ID,

                  action:
                    "REJECT",
                }),
            ).rejects.toBe(
              databaseError,
            );
          },
        );
      },
    );

    describe(
      "getConnectionSuggestions",
      () => {
        test(
          "returns ranked connection suggestions",
          async () => {
            const row =
              createSuggestionRow();

            repositoryMock
              .listConnectionSuggestions
              .mockResolvedValue({
                rows: [
                  row,
                ],

                hasMore:
                  false,

                lastRow:
                  row,
              });

            const result =
              await ConnectionsService
                .getConnectionSuggestions({
                  userId:
                    SENDER_USER_ID,

                  limit:
                    20,

                  cursor:
                    null,
                });

            expect(
              repositoryMock
                .listConnectionSuggestions,
            ).toHaveBeenCalledWith({
              userId:
                SENDER_USER_ID,

              limit:
                20,

              cursor:
                null,
            });

            expect(result)
              .toMatchObject({
                suggestions: [
                  {
                    user: {
                      id:
                        RECEIVER_USER_ID,

                      username:
                        "user_8199818957",
                    },

                    reason: {
                      type:
                        "CONTENT_INTERACTION",
                    },

                    signals: {
                      contentInteractions:
                        2,

                      receivedContentInteractions:
                        1,

                      mutualConnections:
                        3,

                      sharedVerifiedCities:
                        1,
                    },
                  },
                ],

                pagination: {
                  hasMore:
                    false,

                  nextCursor:
                    null,
                },
              });

            expect(
              result.suggestions[0],
            ).not.toHaveProperty(
              "score",
            );

            expect(
              JSON.stringify(
                result,
              ),
            ).not.toContain(
              "suggestion_score",
            );
          },
        );

        test(
          "creates a score-safe suggestion cursor",
          async () => {
            const lastRow =
              createSuggestionRow({
                suggestion_score:
                  "17",
              });

            repositoryMock
              .listConnectionSuggestions
              .mockResolvedValue({
                rows: [
                  createSuggestionRow(),
                ],

                hasMore:
                  true,

                lastRow,
              });

            const result =
              await ConnectionsService
                .getConnectionSuggestions({
                  userId:
                    SENDER_USER_ID,

                  limit:
                    1,

                  cursor:
                    null,
                });

            expect(
              result.pagination.hasMore,
            ).toBe(true);

            const decoded =
              decodeConnectionSuggestionCursor(
                result.pagination
                  .nextCursor,
              );

            expect(decoded)
              .toEqual({
                score:
                  17,

                userId:
                  RECEIVER_USER_ID,
              });
          },
        );

        test(
          "returns an empty suggestion list",
          async () => {
            repositoryMock
              .listConnectionSuggestions
              .mockResolvedValue({
                rows: [],

                hasMore:
                  false,

                lastRow:
                  null,
              });

            const result =
              await ConnectionsService
                .getConnectionSuggestions({
                  userId:
                    SENDER_USER_ID,

                  limit:
                    20,

                  cursor:
                    null,
                });

            expect(result)
              .toEqual({
                suggestions: [],

                pagination: {
                  hasMore:
                    false,

                  nextCursor:
                    null,
                },
              });
          },
        );

        test(
          "rejects an invalid suggestion cursor before querying",
          async () => {
            await expect(
              ConnectionsService
                .getConnectionSuggestions({
                  userId:
                    SENDER_USER_ID,

                  cursor:
                    "invalid",
                }),
            ).rejects.toMatchObject({
              code:
                "COMMON.INVALID_CURSOR",

              statusCode:
                400,
            });

            expect(
              repositoryMock
                .listConnectionSuggestions,
            ).not.toHaveBeenCalled();
          },
        );

        test(
          "does not hide suggestion database errors",
          async () => {
            const databaseError =
              new Error(
                "Database unavailable",
              );

            repositoryMock
              .listConnectionSuggestions
              .mockRejectedValue(
                databaseError,
              );

            await expect(
              ConnectionsService
                .getConnectionSuggestions({
                  userId:
                    SENDER_USER_ID,
                }),
            ).rejects.toBe(
              databaseError,
            );
          },
        );
      },
    );
    
  },
);

