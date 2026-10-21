# Targeted POI reviews

Requires migration `089_targeted_itinerary_place_reviews.sql`. Existing accepted/stale requests and itinerary data are not repaired automatically.

POST `/api/v1/itineraries/{itineraryId}/change-requests` (active non-owner group member):

```json
{"changes":[{"day":1,"originalPlaceId":"ORIGINAL_GOOGLE_PLACE_ID","replacement":{"item_type":"poi","place_id":"NEW_GOOGLE_PLACE_ID","name":"New place"}}],"message":"Suggested replacement"}
```

Send one entry per original POI. `originalPlaceId` must match an existing item in that day. Unprovided start/end times are retained. New POI metadata should describe the replacement, not the old place.

Read `data.changeRequest.changes[].id` from creation, list or details. Each has `PENDING`, `ACCEPTED`, `REJECTED` or `STALE` status. Display STALE as “Outdated — this place was already changed.” It is automatic invalidation, not an owner rejection.

PATCH `/api/v1/itineraries/{itineraryId}/change-requests/{requestId}/review` (itinerary owner only):

```json
{"decision":"ACCEPTED","changeIds":["CHANGE_UUID"]}
```

Use another PATCH with `REJECTED` and different IDs to reject other changes. Omit `changeIds` to decide all remaining pending changes. Acceptance automatically marks competing pending entries for the same original POI and day in other requests STALE. Other days, places and previously decided entries are preserved. A mixed request stays PENDING while any pending entries remain; when none remain its status is ACCEPTED if any entry was accepted, otherwise REJECTED if any was rejected, otherwise STALE. Each successful review and automatic invalidation publishes a chat notice and realtime outbox event in the same transaction. Refresh request details when receiving the existing chat.updated event.

409 means a selected original POI changed, is missing/ambiguous, or the chosen change IDs were already decided. No partial writes are committed; pending decisions remain pending. Fetch current state and submit a revised proposal. Authorization, active membership and lifecycle checks still apply to acceptance.

Legacy `days` snapshots support replacements when each supplied day includes its complete original item list, with stable item positions. Omitted days are untouched. Adding/removing days/items or ambiguous single-item fragments is rejected; use explicit replacements. Legacy requests without a stored baseline cannot be safely accepted and must be resubmitted; whole-request rejection remains available. Reordering is not a replacement.
