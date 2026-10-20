const text = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const place = (item) => {
  const id =
    text(item?.place_id) ??
    text(item?.poi_id) ??
    text(item?.providerId) ??
    text(item?.place?.id) ??
    text(item?.poi?.id) ??
    text(item?.id);
  const name =
    text(item?.name) ??
    text(item?.title) ??
    text(item?.place_name) ??
    text(item?.place?.name) ??
    text(item?.poi?.name);
  return id || name ? { id, name: name?.slice(0, 250) ?? null } : null;
};
const key = (p) => p.id ?? `name:${p.name}`;

// Only unmatched entries at the same position are labelled replacements. Insertions,
// removals and unchanged POIs shifting position must not invent replacement pairs.
export function compareItineraryPlaces(baseDays, proposedDays) {
  if (!Array.isArray(baseDays) || !Array.isArray(proposedDays)) return null;
  const changes = [];
  for (const day of new Set([...baseDays, ...proposedDays].map((d) => d.day))) {
    const entries = (days) =>
      (days.find((d) => d.day === day)?.items ?? [])
        .map((item, index) => ({ place: place(item), index }))
        .filter((e) => e.place);
    const before = entries(baseDays),
      after = entries(proposedDays);
    const remaining = [...after];
    const removed = [];
    for (const entry of before) {
      const match = remaining.findIndex(
        (e) => key(e.place) === key(entry.place),
      );
      if (match >= 0) remaining.splice(match, 1);
      else removed.push(entry);
    }
    for (const entry of removed) {
      const replacement = remaining.findIndex((e) => e.index === entry.index);
      if (replacement >= 0) {
        changes.push({
          type: "REPLACED",
          day,
          before: entry.place,
          after: remaining.splice(replacement, 1)[0].place,
        });
      } else
        changes.push({
          type: "REMOVED",
          day,
          before: entry.place,
          after: null,
        });
    }
    for (const entry of remaining)
      changes.push({ type: "ADDED", day, before: null, after: entry.place });
  }
  return changes;
}

export async function describeItineraryChanges(client, baseDays, proposedDays) {
  const changes = compareItineraryPlaces(baseDays, proposedDays);
  if (!changes) return null;
  const ids = [
    ...new Set(
      changes
        .flatMap((c) => [c.before, c.after])
        .filter((p) => p?.id && !p.name)
        .map((p) => p.id),
    ),
  ];
  if (ids.length) {
    const { rows } = await client.query(
      "SELECT id::text,provider_id,name FROM poi.places WHERE id::text=ANY($1::text[]) OR provider_id=ANY($1::text[]) ORDER BY id",
      [ids],
    );
    const names = new Map();
    for (const row of rows) {
      if (!names.has(row.id)) names.set(row.id, row.name);
      if (row.provider_id && !names.has(row.provider_id))
        names.set(row.provider_id, row.name);
    }
    for (const change of changes)
      for (const p of [change.before, change.after])
        if (p && !p.name) p.name = names.get(p.id)?.slice(0, 250) ?? null;
  }
  return changes;
}

export function requestNoticeText(actor, status, changes) {
  const verb = status === "ACCEPTED" ? "accepted" : "rejected";
  if (!changes?.length) return `${actor} ${verb} an itinerary change request.`;
  const name = (p) => p.name ?? p.id ?? "a place";
  const summary = changes
    .slice(0, 3)
    .map((c) =>
      c.type === "REPLACED"
        ? `replacing ${name(c.before)} with ${name(c.after)}`
        : c.type === "ADDED"
          ? `adding ${name(c.after)}`
          : `removing ${name(c.before)}`,
    )
    .join("; ");
  const message = `${actor} ${verb} ${summary}${changes.length > 3 ? `; and ${changes.length - 3} more changes` : ""}.`;
  return message.length <= 512 ? message : `${message.slice(0, 511)}…`;
}
