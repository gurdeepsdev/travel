import { jest } from "@jest/globals";

const repositoryMock = {
  getByPostIds: jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/posts/repositories/post-engagement.repository.js",
  () => ({ default: repositoryMock }),
);

const { default: PostEngagementService } = await import(
  "../../../src/modules/posts/services/post-engagement.service.js"
);

describe("PostEngagementService", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns authoritative aggregate and viewer state in request order", async () => {
    repositoryMock.getByPostIds.mockResolvedValue([
      {
        post_id: "550e8400-e29b-41d4-a716-446655440000",
        reaction_count: "7",
        reaction_summary: { LIKE: 5, LOVE: 2 },
        comment_count: "3",
        been_there_count: "4",
        viewer_reaction: "LOVE",
        viewer_been_there: true,
      },
    ]);

    const result = await PostEngagementService.getBatch({
      postIds: [
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440000",
      ],
      viewerUserId: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
    });

    expect(repositoryMock.getByPostIds).toHaveBeenCalledWith({
      postIds: ["550e8400-e29b-41d4-a716-446655440000"],
      viewerUserId: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
    });
    expect(result.posts[0]).toMatchObject({
      engagement: {
        reactions: 7,
        comments: 3,
        beenThere: 4,
        reactionSummary: { LIKE: 5, LOVE: 2 },
      },
      viewerState: {
        reactionType: "LOVE",
        beenThere: true,
      },
    });
  });
});
