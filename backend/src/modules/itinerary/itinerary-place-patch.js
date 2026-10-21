import { randomUUID } from "node:crypto";
import AppError from "../../core/errors/app-error.js";

export const placeId = (item) =>
  item?.place_id ??
  item?.poi_id ??
  item?.providerId ??
  item?.place?.id ??
  item?.poi?.id ??
  item?.id;
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const same = (left, right) =>
  JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
export function placePatchError(message, statusCode = 422) {
  throw new AppError({
    code: "ITINERARY.CHANGE_REQUEST_CONFLICT",
    message,
    statusCode,
  });
}

function uniqueItem(days, day, id) {
  const matches = (days.find((d) => d.day === day)?.items ?? []).filter(
    (item) => placeId(item) === id,
  );
  if (matches.length !== 1)
    placePatchError(
      "The original place is missing or ambiguous in the selected day.",
      409,
    );
  return matches[0];
}

export function normalizePlaceChanges(baseDays, proposedData) {
  if (!Array.isArray(baseDays))
    placePatchError(
      "This legacy request has no reliable baseline. Resubmit it with explicit place changes.",
      409,
    );
  let requested = proposedData?.changes;
  if (!requested) {
    requested = [];
    if (!Array.isArray(proposedData?.days))
      placePatchError("Provide explicit place changes.");
    for (const day of proposedData.days) {
      const original = baseDays.find((d) => d.day === day.day);
      if (
        !original ||
        !Array.isArray(day.items) ||
        day.items.length !== original.items.length
      ) {
        placePatchError(
          "Partial day lists cannot identify a replacement. Send changes with day, originalPlaceId and replacement.",
        );
      }
      // Legacy full-day snapshots remain supported. Omitted days are never removed.
      for (let index = 0; index < day.items.length; index++) {
        const before = original.items[index],
          after = day.items[index];
        if (!same(before, after)) {
          if (!placeId(before) || !placeId(after))
            placePatchError("Only identified POI replacements are supported.");
          if (
            placeId(before) !== placeId(after) &&
            original.items.some((item) => placeId(item) === placeId(after))
          ) {
            placePatchError(
              "Reordering places is not a replacement. Send explicit place changes.",
            );
          }
          requested.push({
            day: day.day,
            originalPlaceId: placeId(before),
            replacement: after,
          });
        }
      }
    }
  }
  if (!requested.length || requested.length > 100)
    placePatchError("Provide between 1 and 100 place changes.");
  const targets = new Set();
  return requested.map((change) => {
    const key = JSON.stringify([change.day, change.originalPlaceId]);
    if (targets.has(key))
      placePatchError("A place can be changed only once in each request.");
    targets.add(key);
    const before = uniqueItem(baseDays, change.day, change.originalPlaceId);
    if (
      typeof placeId(change.replacement) !== "string" ||
      !placeId(change.replacement).trim()
    )
      placePatchError("Each replacement must identify its POI.");
    const after = structuredClone(change.replacement);
    for (const field of ["start_time", "end_time"])
      if (after[field] === undefined && before[field] !== undefined)
        after[field] = before[field];
    if (same(before, after))
      placePatchError("The replacement does not change the original place.");
    return {
      id: randomUUID(),
      day: change.day,
      before: structuredClone(before),
      after,
      status: "PENDING",
    };
  });
}

export function applyPlaceChanges(currentDays, changes) {
  const days = structuredClone(currentDays);
  const replacements = changes.map((change) => {
    const current = uniqueItem(days, change.day, placeId(change.before));
    if (!same(current, change.before))
      placePatchError(
        "A selected place has changed since this proposal. Other requests are unaffected.",
        409,
      );
    const day = days.find((d) => d.day === change.day);
    return { day, index: day.items.indexOf(current), after: change.after };
  });
  for (const { day, index, after } of replacements)
    day.items[index] = structuredClone(after);
  return days;
}

export function selectPendingChanges(changes, changeIds) {
  const selected = changeIds
    ? changes.filter((c) => changeIds.includes(c.id))
    : changes.filter((c) => c.status === "PENDING");
  if (
    !selected.length ||
    (changeIds && selected.length !== changeIds.length) ||
    selected.some((c) => c.status !== "PENDING")
  ) {
    placePatchError("Select pending change IDs from this request.", 409);
  }
  return selected;
}
