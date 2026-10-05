import { jest } from "@jest/globals";

const query = jest.fn();
const transaction = jest.fn((work) => work({ query }));
jest.unstable_mockModule("../../../src/database/database-manager.js", () => ({ default: { transaction } }));
const { default: repository } = await import("../../../src/modules/posts/repositories/posts.repository.js");
const postId = "44444444-4444-4444-8444-444444444444";
const userId = "63aae149-8f8f-4b30-b30d-211da764c080";
const originalPostId = "55555555-5555-4555-8555-555555555555";
const post = { id: postId, user_id: userId, deleted_at: new Date() };
const assets = [{ id: "asset" }];
beforeEach(() => { query.mockReset(); transaction.mockClear(); });

test("deletes repost relationship and decrements original exactly once inside the delete transaction", async () => {
  query.mockResolvedValueOnce({ rows: [{ shared_post_id: originalPostId }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [post] })
    .mockResolvedValueOnce({ rows: [{ shared_post_id: originalPostId }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: assets });
  expect(await repository.softDeleteOwned({ postId, userId })).toEqual({ ...post, storage_sync_assets: assets });
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(query.mock.calls[1][0]).toContain("pg_advisory_xact_lock");
  expect(query.mock.calls[1][1]).toEqual([userId, originalPostId]);
  expect(query.mock.calls[2][0]).toContain("SET deleted_at");
  expect(query.mock.calls[3][0]).toContain("DELETE FROM explore.post_reshare");
  expect(query.mock.calls[3][1]).toEqual([postId, userId, originalPostId]);
  expect(query.mock.calls[4][0]).toContain("GREATEST(COALESCE(share_count, 0) - 1, 0)");
  expect(query.mock.calls[4][1]).toEqual([originalPostId]);
  expect(query.mock.calls[5][0]).toContain("UPDATE media.assets");
});

test("normal post deletion preserves media synchronization and does not modify share counts", async () => {
  query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [post] }).mockResolvedValueOnce({ rows: assets });
  expect(await repository.softDeleteOwned({ postId, userId })).toEqual({ ...post, storage_sync_assets: assets });
  expect(query).toHaveBeenCalledTimes(3);
  expect(query.mock.calls.some(([sql]) => sql.includes("SET share_count"))).toBe(false);
});

test.each(["already deleted", "not owned", "missing"])("%s post performs no cleanup or decrement", async () => {
  query.mockResolvedValue({ rows: [] });
  expect(await repository.softDeleteOwned({ postId, userId })).toBeNull();
  expect(query).toHaveBeenCalledTimes(2);
  expect(query.mock.calls[1][0]).toContain("user_id = $2::uuid");
  expect(query.mock.calls[1][0]).toContain("deleted_at IS NULL");
});

test("concurrent completed deletion after lock lookup does not decrement twice", async () => {
  query.mockResolvedValueOnce({ rows: [{ shared_post_id: originalPostId }] }).mockResolvedValue({ rows: [] });
  expect(await repository.softDeleteOwned({ postId, userId })).toBeNull();
  expect(query).toHaveBeenCalledTimes(3);
});

test("only an actually removed relationship decrements the counter", async () => {
  query.mockResolvedValueOnce({ rows: [{ shared_post_id: originalPostId }] })
    .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [post] })
    .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: assets });
  await repository.softDeleteOwned({ postId, userId });
  expect(query.mock.calls.some(([sql]) => sql.includes("SET share_count"))).toBe(false);
});

test("counter failure rejects the transaction rather than committing partial cleanup", async () => {
  const failure = new Error("database failure");
  query.mockResolvedValueOnce({ rows: [{ shared_post_id: originalPostId }] })
    .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [post] })
    .mockResolvedValueOnce({ rows: [{ shared_post_id: originalPostId }] })
    .mockRejectedValueOnce(failure);
  await expect(repository.softDeleteOwned({ postId, userId })).rejects.toBe(failure);
  expect(query).toHaveBeenCalledTimes(5);
});
