import {
  normalizePlaceChanges,
  applyPlaceChanges,
  selectPendingChanges,
} from "../../../src/modules/itinerary/itinerary-place-patch.js";
import {
  createItineraryChangeRequestSchema,
  reviewItineraryChangeRequestSchema,
} from "../../../src/modules/itinerary/itinerary.validation.js";
const item = (id) => ({ item_type: "poi", place_id: id, name: id });
const days = [
  { day: 1, items: [item("a"), item("b")] },
  { day: 2, items: [item("c")] },
];
const change = (id, after, day = 1) => ({
  day,
  originalPlaceId: id,
  replacement: item(after),
});
test("explicit multiple replacements preserve untouched days/items and input snapshots", () => {
  const changes = normalizePlaceChanges(days, { changes: [change("a", "x")] });
  const updated = applyPlaceChanges(days, changes);
  expect(updated[0].items.map((i) => i.place_id)).toEqual(["x", "b"]);
  expect(updated[1]).toEqual(days[1]);
  expect(days[0].items[0].place_id).toBe("a");
});
test("legacy full day works independently of omitted days; ambiguous partial day is rejected", () => {
  expect(
    normalizePlaceChanges(days, {
      days: [{ day: 1, items: [item("x"), item("b")] }],
    }),
  ).toHaveLength(1);
  expect(() =>
    normalizePlaceChanges(days, { days: [{ day: 1, items: [item("x")] }] }),
  ).toThrow("Partial day");
  expect(() => normalizePlaceChanges(null, { days })).toThrow("baseline");
});
test("duplicate/missing targets and invalid/no-op replacements are rejected", () => {
  for (const changes of [
    [change("a", "x"), change("a", "y")],
    [change("missing", "x")],
    [change("a", "a")],
    [{ ...change("a", "x"), replacement: { item_type: "poi" } }],
  ]) {
    expect(() => normalizePlaceChanges(days, { changes })).toThrow();
  }
});
test("selected resolved, unknown and duplicate IDs are rejected", () => {
  const changes = normalizePlaceChanges(days, {
    changes: [change("a", "x"), change("b", "y")],
  });
  expect(selectPendingChanges(changes, [changes[0].id])).toHaveLength(1);
  changes[0].status = "ACCEPTED";
  expect(selectPendingChanges(changes)).toHaveLength(1);
  for (const ids of [
    [changes[0].id],
    ["unknown"],
    [changes[1].id, changes[1].id],
  ])
    expect(() => selectPendingChanges(changes, ids)).toThrow();
});
test("conflicting target is rejected but unrelated modifications and JSON key order are safe", () => {
  const changes = normalizePlaceChanges(days, { changes: [change("a", "x")] });
  const current = JSON.parse(JSON.stringify(days));
  current[1].items[0] = item("other");
  current[0].items[0] = { name: "a", place_id: "a", item_type: "poi" };
  expect(applyPlaceChanges(current, changes)[1].items[0].place_id).toBe(
    "other",
  );
  current[0].items[0].name = "Edited";
  expect(() => applyPlaceChanges(current, changes)).toThrow("changed since");
});
test("explicit swaps validate all original targets before applying any replacement", () => {
  const changes = normalizePlaceChanges(days, {
    changes: [change("a", "b"), change("b", "a")],
  });
  expect(
    applyPlaceChanges(days, changes)[0].items.map((i) => i.place_id),
  ).toEqual(["b", "a"]);
});
const params = { itineraryId: "11111111-1111-4111-8111-111111111111" };
test("API accepts explicit changes and rejects missing/both proposal formats", () => {
  const parse = (body) =>
    createItineraryChangeRequestSchema.safeParse({ params, query: {}, body })
      .success;
  expect(parse({ changes: [change("a", "x")] })).toBe(true);
  expect(parse({})).toBe(false);
  expect(parse({ days, changes: [change("a", "x")] })).toBe(false);
  expect(
    parse({
      changes: [{ ...change("a", "x"), replacement: { item_type: "poi" } }],
    }),
  ).toBe(false);
});
test("review supports optional change IDs and rejects duplicates", () => {
  const id = "22222222-2222-4222-8222-222222222222";
  const parse = (body) =>
    reviewItineraryChangeRequestSchema.safeParse({
      params: { ...params, requestId: id },
      query: {},
      body,
    }).success;
  expect(parse({ decision: "ACCEPTED" })).toBe(true);
  expect(parse({ decision: "REJECTED", changeIds: [id] })).toBe(true);
  expect(parse({ decision: "ACCEPTED", changeIds: [id, id] })).toBe(false);
});
