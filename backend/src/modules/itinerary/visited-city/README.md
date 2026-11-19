# Historical visited-city itineraries

All endpoints use the current user's Bearer token. Prefix:
`/api/v1/users/me/visited-cities/{cityId}/itinerary-draft`

- `GET /`: read draft; returns `data.draft: null` before the first write.
- `PATCH /`: upsert optional `title`, `year`, `month`, `tripType` metadata. At least one field is required.
- `POST /attractions`: append `{placeId: "<VPS POI UUID>"}` or `{name: "Taj Mahal", description: "..."}`.
- `PATCH /attractions/{attractionId}`: edit fields, replace with another city POI, or reorder with one-based `position`.
- `DELETE /attractions/{attractionId}`: delete only this user's draft attraction.
- `POST /complete`: generate once; optional metadata body merges with saved metadata.

Example completion body:

```json
{"year":2020,"month":5,"tripType":"FAMILY","title":"My Agra trip"}
```

`tripType`: `FAMILY`, `FRIENDS`, `SOLO`, `COUPLE`, `OTHER`.
Year (1900 onward), month (1–12), and type are required by completion;
future visits are rejected. No exact start/end dates are invented from month/year.
Draft writes never create itineraries. Metadata and attractions persist across devices.
Each user/city has one draft. Completed drafts cannot be edited or completed again
into a second itinerary; retries return the existing itinerary with `created: false`.
Existing itinerary APIs remain available for the generated itinerary.

City must be active and verified in this user's collection on every request.
Only the city is verified: manually entered attractions are self-reported, not
evidence-backed visits. POI UUIDs must reference active places in that city.
No Google ID resolution or writes to global POIs are performed by these endpoints.
POI details are copied when added/replaced; no travel/photo proof is fabricated.

Attractions accept `placeId`, `name`, `description` (max 1000), `address` (max 500),
and paired `latitude`/`longitude`. `placeId: null` converts a POI snapshot into a
manual attraction. Updating a non-null placeId reloads its canonical details.
Manual names are max 255 characters. Draft max 200 attractions. Duplicate non-null
place IDs are rejected. Returned attraction IDs differ from POI IDs.

Completion groups saved-order attractions into at most four per day. Five becomes
4+1. Uses the existing `itineraryJson` shape (`summary`, `days[].day/items[]`),
private visibility, `aiGenerated: false`, and personal state `COMPLETED`.
Creation, personal state and draft finalization commit in one transaction. Row
locking serializes concurrent edits/completion. Deleted generated itineraries are
not silently regenerated; retry returns `VISITED_ITINERARY.ITINERARY_UNAVAILABLE`.
No groups, notifications, profile preferences, verification state or other user
itineraries are changed.

Requires migration `096_visited_city_itinerary_drafts.sql`. No deployment performed.
Integration tests: set `RUN_VISITED_ITINERARY_DB_TESTS=1`; the suite starts an isolated
temporary PostgreSQL cluster using `initdb` and `pg_ctl`. Authentication is mocked;
database transactions, migration, HTTP validation and itinerary access are real.
