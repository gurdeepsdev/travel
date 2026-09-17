import {
  jest,
} from "@jest/globals";

const databaseMock = {
  query:
    jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/database/database-manager.js",
  () => ({
    default:
      databaseMock,
  }),
);

const {
  default: SavedContentRepository,
} = await import(
  "../../../src/modules/users/repositories/saved-content.repository.js"
);

const USER_ID =
  "11111111-1111-4111-8111-111111111111";

function expectConnectionAwareAccess(
  sql,
) {
  expect(sql).toContain(
    "FROM users.connections connection",
  );
  expect(sql).toContain(
    "LEAST($1::uuid, post.user_id)",
  );
  expect(sql).toContain(
    "GREATEST($1::uuid, post.user_id)",
  );
  expect(sql).toContain(
    "FROM users.blocked_users blocked",
  );
  expect(sql).not.toContain(
    "owner_profile.is_private",
  );
}

describe(
  "SavedContentRepository post access",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      databaseMock.query
        .mockResolvedValue({
          rows: [],
        });
    });

    test(
      "uses connection-aware access for saved post references",
      async () => {
        await SavedContentRepository
          .listMySavedPostReferences({
            userId:
              USER_ID,
          });

        expectConnectionAwareAccess(
          databaseMock.query
            .mock.calls[0][0],
        );
      },
    );

    test(
      "uses connection-aware access for saved post groups",
      async () => {
        await SavedContentRepository
          .listMySavedPostGroups({
            userId:
              USER_ID,
            groupBy:
              "city",
          });

        expectConnectionAwareAccess(
          databaseMock.query
            .mock.calls[0][0],
        );
      },
    );
  },
);
