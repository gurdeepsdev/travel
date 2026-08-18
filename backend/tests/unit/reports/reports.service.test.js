import { jest } from "@jest/globals";

const REPORTER_USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const REPORTED_USER_ID =
  "b3fe5214-e569-4300-8509-589785ad86f2";

const POST_ID =
  "2cbc0cee-4d0a-43e1-ae93-ab4a66211100";

const REPORT_ID =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

const repositoryMock = {
  findReportableUser:
    jest.fn(),

  saveUserReport:
    jest.fn(),

  savePostReport:
    jest.fn(),
};

const postAccessServiceMock = {
  assertCanInteract:
    jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/reports/repositories/reports.repository.js",
  () => ({
    default:
      repositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/posts/services/post-access.service.js",
  () => ({
    default:
      postAccessServiceMock,
  }),
);

const { default: ReportsService } =
  await import(
    "../../../src/modules/reports/services/reports.service.js"
  );

function createReportRow(
  overrides = {},
) {
  return {
    id:
      REPORT_ID,

    reporter_user_id:
      REPORTER_USER_ID,

    reported_user_id:
      REPORTED_USER_ID,

    reported_post_id:
      null,

    reason_code:
      "SPAM",

    description:
      "Controlled report.",

    status:
      "PENDING",

    created_at:
      new Date(
        "2026-08-18T10:00:00.000Z",
      ),

    updated_at:
      new Date(
        "2026-08-18T10:00:00.000Z",
      ),

    ...overrides,
  };
}

describe("ReportsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("reportUser", () => {
    test(
      "submits a report against an active user",
      async () => {
        repositoryMock
          .findReportableUser
          .mockResolvedValue({
            id:
              REPORTED_USER_ID,

            username:
              "reported_user",
          });

        repositoryMock
          .saveUserReport
          .mockResolvedValue(
            createReportRow(),
          );

        const result =
          await ReportsService
            .reportUser({
              reporterUserId:
                REPORTER_USER_ID,

              reportedUserId:
                REPORTED_USER_ID,

              reasonCode:
                "SPAM",

              description:
                "Controlled report.",
            });

        expect(
          repositoryMock
            .saveUserReport,
        ).toHaveBeenCalledWith({
          reporterUserId:
            REPORTER_USER_ID,

          reportedUserId:
            REPORTED_USER_ID,

          reasonCode:
            "SPAM",

          description:
            "Controlled report.",
        });

        expect(result).toMatchObject({
          report: {
            id:
              REPORT_ID,

            target: {
              type:
                "USER",

              userId:
                REPORTED_USER_ID,
            },

            status:
              "PENDING",
          },
        });
      },
    );

    test(
      "rejects reporting your own profile before querying",
      async () => {
        await expect(
          ReportsService.reportUser({
            reporterUserId:
              REPORTER_USER_ID,

            reportedUserId:
              REPORTER_USER_ID,

            reasonCode:
              "SPAM",
          }),
        ).rejects.toMatchObject({
          code:
            "REPORT.SELF_REPORT_NOT_ALLOWED",

          statusCode:
            400,
        });

        expect(
          repositoryMock
            .findReportableUser,
        ).not.toHaveBeenCalled();

        expect(
          repositoryMock
            .saveUserReport,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "hides a missing or inactive user",
      async () => {
        repositoryMock
          .findReportableUser
          .mockResolvedValue(
            null,
          );

        await expect(
          ReportsService.reportUser({
            reporterUserId:
              REPORTER_USER_ID,

            reportedUserId:
              REPORTED_USER_ID,

            reasonCode:
              "IMPERSONATION",
          }),
        ).rejects.toMatchObject({
          code:
            "REPORT.TARGET_NOT_AVAILABLE",

          statusCode:
            404,
        });

        expect(
          repositoryMock
            .saveUserReport,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "maps a target deletion race to not available",
      async () => {
        repositoryMock
          .findReportableUser
          .mockResolvedValue({
            id:
              REPORTED_USER_ID,
          });

        repositoryMock
          .saveUserReport
          .mockRejectedValue({
            code:
              "23503",
          });

        await expect(
          ReportsService.reportUser({
            reporterUserId:
              REPORTER_USER_ID,

            reportedUserId:
              REPORTED_USER_ID,

            reasonCode:
              "SPAM",
          }),
        ).rejects.toMatchObject({
          code:
            "REPORT.TARGET_NOT_AVAILABLE",

          statusCode:
            404,
        });
      },
    );
  });

  describe("reportPost", () => {
    test(
      "submits a report against an accessible post",
      async () => {
        postAccessServiceMock
          .assertCanInteract
          .mockResolvedValue({
            id:
              POST_ID,

            user_id:
              REPORTED_USER_ID,
          });

        repositoryMock
          .savePostReport
          .mockResolvedValue(
            createReportRow({
              reported_user_id:
                null,

              reported_post_id:
                POST_ID,

              reason_code:
                "VIOLENCE",
            }),
          );

        const result =
          await ReportsService
            .reportPost({
              reporterUserId:
                REPORTER_USER_ID,

              reportedPostId:
                POST_ID,

              reasonCode:
                "VIOLENCE",

              description:
                null,
            });

        expect(
          postAccessServiceMock
            .assertCanInteract,
        ).toHaveBeenCalledWith({
          postId:
            POST_ID,

          userId:
            REPORTER_USER_ID,
        });

        expect(
          repositoryMock
            .savePostReport,
        ).toHaveBeenCalledWith({
          reporterUserId:
            REPORTER_USER_ID,

          reportedPostId:
            POST_ID,

          reasonCode:
            "VIOLENCE",

          description:
            null,
        });

        expect(result).toMatchObject({
          report: {
            target: {
              type:
                "POST",

              postId:
                POST_ID,
            },
          },
        });
      },
    );

    test(
      "hides an inaccessible post",
      async () => {
        postAccessServiceMock
          .assertCanInteract
          .mockRejectedValue({
            code:
              "POST.NOT_FOUND",
          });

        await expect(
          ReportsService.reportPost({
            reporterUserId:
              REPORTER_USER_ID,

            reportedPostId:
              POST_ID,

            reasonCode:
              "SPAM",
          }),
        ).rejects.toMatchObject({
          code:
            "REPORT.TARGET_NOT_AVAILABLE",

          statusCode:
            404,
        });

        expect(
          repositoryMock
            .savePostReport,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects reporting your own post",
      async () => {
        postAccessServiceMock
          .assertCanInteract
          .mockResolvedValue({
            id:
              POST_ID,

            user_id:
              REPORTER_USER_ID,
          });

        await expect(
          ReportsService.reportPost({
            reporterUserId:
              REPORTER_USER_ID,

            reportedPostId:
              POST_ID,

            reasonCode:
              "SPAM",
          }),
        ).rejects.toMatchObject({
          code:
            "REPORT.SELF_REPORT_NOT_ALLOWED",

          statusCode:
            400,
        });

        expect(
          repositoryMock
            .savePostReport,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "does not hide unrelated database errors",
      async () => {
        const databaseError =
          new Error(
            "database unavailable",
          );

        postAccessServiceMock
          .assertCanInteract
          .mockResolvedValue({
            id:
              POST_ID,

            user_id:
              REPORTED_USER_ID,
          });

        repositoryMock
          .savePostReport
          .mockRejectedValue(
            databaseError,
          );

        await expect(
          ReportsService.reportPost({
            reporterUserId:
              REPORTER_USER_ID,

            reportedPostId:
              POST_ID,

            reasonCode:
              "SPAM",
          }),
        ).rejects.toBe(
          databaseError,
        );
      },
    );
  });
});
