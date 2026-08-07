import { z } from "zod";

const DEFAULT_CONNECTION_REQUESTS_LIMIT =
  20;

const MAX_CONNECTION_REQUESTS_LIMIT =
  50;

const MAX_CURSOR_LENGTH =
  1024;

const connectionCursorSchema = z
  .string({
    error:
      "Cursor must be a string.",
  })
  .trim()
  .min(
    1,
    "Cursor cannot be empty.",
  )
  .max(
    MAX_CURSOR_LENGTH,
    `Cursor cannot exceed ${MAX_CURSOR_LENGTH} characters.`,
  )
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Cursor must be a valid Base64 URL-safe value.",
  );

const sendConnectionRequestSchema =
  z.object({
    params: z
      .object({
        userId: z
          .string({
            error:
              "User ID must be a string.",
          })
          .trim()
          .uuid(
            "User ID must be a valid UUID.",
          ),
      })
      .strict(),

    body: z
      .object({})
      .strict()
      .optional(),

    query: z
      .object({})
      .strict(),
  });

const getIncomingConnectionRequestsSchema =
  z.object({
    params: z
      .object({})
      .strict(),

    body: z
      .unknown()
      .optional(),

    query: z
      .object({
        limit: z.coerce
          .number({
            error:
              "Limit must be a number.",
          })
          .int(
            "Limit must be an integer.",
          )
          .min(
            1,
            "Limit must be at least 1.",
          )
          .max(
            MAX_CONNECTION_REQUESTS_LIMIT,
            `Limit cannot exceed ${MAX_CONNECTION_REQUESTS_LIMIT}.`,
          )
          .default(
            DEFAULT_CONNECTION_REQUESTS_LIMIT,
          ),

        cursor:
          connectionCursorSchema
            .optional(),
      })
      .strict(),
  });

  /*
 * Incoming and outgoing request lists use the
 * same pagination contract.
 */
const getOutgoingConnectionRequestsSchema =
  getIncomingConnectionRequestsSchema;

/*
 * Accepted connections use the same stable
 * pagination contract as request lists.
 */
const getMyConnectionsSchema =
  getIncomingConnectionRequestsSchema;

  const respondToConnectionRequestSchema =
  z.object({
    params: z
      .object({
        requestId: z
          .string({
            error:
              "Connection request ID must be a string.",
          })
          .trim()
          .uuid(
            "Connection request ID must be a valid UUID.",
          ),
      })
      .strict(),

    body: z
      .object({
        action: z.enum(
          [
            "ACCEPT",
            "REJECT",
          ],
          {
            error:
              "Action must be ACCEPT or REJECT.",
          },
        ),
      })
      .strict(),

    query: z
      .object({})
      .strict(),
  });

  const cancelConnectionRequestSchema =
  z.object({
    params: z
      .object({
        requestId: z
          .string({
            error:
              "Connection request ID must be a string.",
          })
          .trim()
          .uuid(
            "Connection request ID must be a valid UUID.",
          ),
      })
      .strict(),

    body: z
      .object({})
      .strict()
      .optional(),

    query: z
      .object({})
      .strict(),
  });


const removeConnectionSchema =
  z.object({
    params: z
      .object({
        userId: z
          .string({
            error:
              "User ID must be a string.",
          })
          .trim()
          .uuid(
            "User ID must be a valid UUID.",
          ),
      })
      .strict(),

    body: z
      .object({})
      .strict()
      .optional(),

    query: z
      .object({})
      .strict(),
  });

export {
  DEFAULT_CONNECTION_REQUESTS_LIMIT,
  MAX_CONNECTION_REQUESTS_LIMIT,
  sendConnectionRequestSchema,
  getIncomingConnectionRequestsSchema,
  getOutgoingConnectionRequestsSchema,
    getMyConnectionsSchema,
  respondToConnectionRequestSchema,
    cancelConnectionRequestSchema,
      removeConnectionSchema,


};