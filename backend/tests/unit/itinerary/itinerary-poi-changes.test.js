import { jest } from "@jest/globals";
import {
  compareItineraryPlaces,
  describeItineraryChanges,
  requestNoticeText,
} from "../../../src/modules/itinerary/itinerary-poi-changes.js";
import { publishRequestNotice } from "../../../src/modules/itinerary/itinerary-request-chat.service.js";

const days = (...names) => [
  {
    day: 1,
    items: names.map((name) => ({ item_type: "POI", place_id: name, name })),
  },
];
test("replacement identifies both POIs without treating shifted entries as replacements", () => {
  expect(compareItineraryPlaces(days("A", "B"), days("C", "B"))).toEqual([
    {
      type: "REPLACED",
      day: 1,
      before: { id: "A", name: "A" },
      after: { id: "C", name: "C" },
    },
  ]);
  expect(compareItineraryPlaces(days("A", "B"), days("B"))).toMatchObject([
    { type: "REMOVED", before: { id: "A" } },
  ]);
  expect(compareItineraryPlaces(days("A"), days("B", "A"))).toMatchObject([
    { type: "ADDED", after: { id: "B" } },
  ]);
  expect(compareItineraryPlaces(days("A", "B"), days("B", "A"))).toEqual([]);
});
test("duplicates, empty lists and unknown legacy baseline are handled", () => {
  expect(compareItineraryPlaces(days("A", "A"), days("A"))).toHaveLength(1);
  expect(compareItineraryPlaces([], [])).toEqual([]);
  expect(compareItineraryPlaces(null, days("A"))).toBeNull();
});
test("missing names use one batch lookup without mutating request snapshots", async () => {
  const before = [{ day: 1, items: [{ place_id: "a" }] }],
    after = [{ day: 1, items: [{ place_id: "b" }] }];
  const client = {
    query: jest.fn().mockResolvedValue({
      rows: [
        { id: "a", name: "Lotus Temple" },
        { id: "b", name: "India Gate" },
      ],
    }),
  };
  const changes = await describeItineraryChanges(client, before, after);
  expect(client.query).toHaveBeenCalledTimes(1);
  expect(client.query.mock.calls[0][1]).toEqual([["a", "b"]]);
  expect(changes[0]).toMatchObject({
    before: { name: "Lotus Temple" },
    after: { name: "India Gate" },
  });
  expect(before[0].items[0].name).toBeUndefined();
});
test.each(["ACCEPTED", "REJECTED"])(
  "%s notice persists details and emits the existing event",
  async (status) => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: "conversation" }] })
        .mockResolvedValueOnce({ rows: [{ name: "Owner" }] })
        .mockResolvedValueOnce({ rows: [{ id: "message" }] })
        .mockResolvedValue({ rows: [] }),
    };
    await publishRequestNotice(
      client,
      {
        id: "request",
        itinerary_id: "trip",
        status,
        base_days: days("Lotus Temple"),
        proposed_data: { days: days("India Gate") },
      },
      "owner",
    );
    const params = client.query.mock.calls[2][1];
    expect(params[2]).toContain(
      `${status.toLowerCase()} replacing Lotus Temple with India Gate`,
    );
    expect(JSON.parse(params[6])[0].type).toBe("REPLACED");
    expect(client.query.mock.calls[4][0]).toContain("message.created");
  },
);
test("legacy baseline retains generic wording and deduplicated notice emits nothing", async () => {
  const client = {
    query: jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "conversation" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }),
  };
  await publishRequestNotice(
    client,
    {
      id: "request",
      itinerary_id: "trip",
      status: "REJECTED",
      proposed_data: { days: days("A") },
    },
    "owner",
  );
  expect(client.query.mock.calls[2][1][2]).toBe(
    "A member rejected an itinerary change request.",
  );
  expect(client.query.mock.calls[2][1][6]).toBeNull();
  expect(client.query).toHaveBeenCalledTimes(3);
});
test("notice text stays within message storage limit", () => {
  const changes = compareItineraryPlaces(
    days("A".repeat(250), "B".repeat(250)),
    days("C".repeat(250), "D".repeat(250)),
  );
  expect(
    requestNoticeText("Owner", "ACCEPTED", changes).length,
  ).toBeLessThanOrEqual(512);
});
