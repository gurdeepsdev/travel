# Profile schema

## profile.profiles

Stores the public and preference-facing representation of an authenticated user.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_name | varchar(100) | yes | api | - | Provides the human-readable label shown when presenting this profiles. | Variable-length Unicode text with a hard maximum of 100 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 100 characters. Example: <user name> |
| display_name | varchar(100) | default | api | - | Provides the human-readable label shown when presenting this profiles. | Variable-length Unicode text with a hard maximum of 100 characters. Default-backed; clarify NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 100 characters. Example: <display name> |
| bio | varchar(250) | no | api | - | Captures the bio attribute required by the stores the public and preference-facing representation of an authenticated user. | Variable-length Unicode text with a hard maximum of 250 characters. Nullable Trim surrounding whitespace where appropriate; reject values longer than 250 characters. Example: <bio> |
| profile_photo_asset_id | uuid | yes | api | media.assets.id | Links the profiles record to media.assets.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| country_id | uuid | yes | api | - | Links the profiles record to country, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| city_id | uuid | yes | api | - | Links the profiles record to city, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| is_private | bool | default | api | - | Controls whether the record currently satisfies 'private' behavior. Source constraint: [specific values to be decided] | Boolean with only TRUE or FALSE states. Default-backed; clarify NOT NULL Do not encode states as 0/1 or strings; define a default when business logic needs one. Example: true |
| is_verified | bool | default | api | - | Records whether ownership/control of the supplied identity has been successfully proven. Source constraint: [specific values to be decided] | Boolean with only TRUE or FALSE states. Default-backed; clarify NOT NULL Do not encode states as 0/1 or strings; define a default when business logic needs one. Example: true |
| profile_completed_at | timestamp | no | api | - | Records the business event time for 'profile completed' so its lifecycle can be audited. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. Nullable Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| deleted_at | timestamp | no | auto | - | Soft-delete marker; a populated value removes the record from normal active queries without erasing history. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. Nullable Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| updated_at | timestamp | no | auto | - | Audit timestamp used for freshness checks, synchronization, and optimistic update decisions. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. Nullable Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## profile.saved_items

Records items bookmarked by a user for later access.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| item_type | varchar(50) | yes | api | - | Selects the supported item variant and determines how downstream code interprets the record. Source constraint: [specific values to be decided] | Variable-length Unicode text with a hard maximum of 50 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 50 characters. Example: <item type> |
| item_id | uuid | yes | api | - | Links the saved_items record to item, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| is_active | bool | default | api | - | Controls whether the record currently satisfies 'active' behavior. Source constraint: [specific values to be decided] | Boolean with only TRUE or FALSE states. Default-backed; clarify NOT NULL Do not encode states as 0/1 or strings; define a default when business logic needs one. Example: true |

## profile.visited_places

Captures places a user reports or is recorded as having visited.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| place_id | uuid | yes | api | - | Links the record to a canonical place/POI supplied by the place-data subsystem. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| collection_id | uuid | yes | api | profile.collection.id | Links the visited_places record to profile.collection.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## profile.collection

Groups saved content into a user-managed collection.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| collection_name | varchar(50) | yes | api | - | Provides the human-readable label shown when presenting this collection. | Variable-length Unicode text with a hard maximum of 50 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 50 characters. Example: <collection name> |
| icon_asset_id | uuid | yes | api | media.assets.id | Links the collection record to media.assets.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| verification_asset_id | uuid | yes | api | media.assets.id | Links the collection record to media.assets.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| verification_status | bool | default | api | - | Captures the verification status attribute required by the groups saved content into a user-managed collection. Source constraint: [specific values to be decided] | Boolean with only TRUE or FALSE states. Default-backed; clarify NOT NULL Do not encode states as 0/1 or strings; define a default when business logic needs one. Example: true |
| visited_at | timestamp | yes | api | - | Records the business event time for 'visited' so its lifecycle can be audited. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| is_preference | bool | default | api | - | Controls whether the record currently satisfies 'preference' behavior. Source constraint: [specific values to be decided] | Boolean with only TRUE or FALSE states. Default-backed; clarify NOT NULL Do not encode states as 0/1 or strings; define a default when business logic needs one. Example: true |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| updated_at | timestamp | no | auto | - | Audit timestamp used for freshness checks, synchronization, and optimistic update decisions. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. Nullable Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## profile.blocked_users

Enforces one-way user blocking relationships.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| blocked_user_id | uuid | yes | api | auth.users.id | Links the blocked_users record to auth.users.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| reason | varchar(250) | no | api | - | Provides the human-readable reason needed to explain this blocked users to users or moderators. | Variable-length Unicode text with a hard maximum of 250 characters. Nullable Trim surrounding whitespace where appropriate; reject values longer than 250 characters. Example: <reason> |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## profile.user_settings

Stores account-level product, privacy, and notification preferences.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| settings_json | jsonb | default | api | - | Captures the settings json attribute required by the stores account-level product, privacy, and notification preferences. | Validated JSON document stored in binary form and queryable by PostgreSQL operators. Default-backed; clarify NOT NULL Define a JSON schema/version, constrain required keys, and add GIN indexes only for queried paths. Example: {"key":"value"} |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| updated_at | timestamp | no | auto | - | Audit timestamp used for freshness checks, synchronization, and optimistic update decisions. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. Nullable Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## profile.users_reports

Records moderation reports submitted by one user about another user or content.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| item_type | varchar(50) | yes | api | - | Selects the supported item variant and determines how downstream code interprets the record. Source constraint: [specefic values to be decided] | Variable-length Unicode text with a hard maximum of 50 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 50 characters. Example: <item type> |
| item_id | uuid | yes | api | [media.assets.id, itinerary.itineraries.id] | Links the users_reports record to [media.assets.id, itinerary.itineraries.id], enabling ownership, lookup, or workflow traversal. Source constraint: relation will depend on item_type | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| status | varchar(50) | default | api | - | Controls the record's current workflow/lifecycle state and therefore which actions are allowed. Source constraint: [specific actions and values to be decided] | Variable-length Unicode text with a hard maximum of 50 characters. Default-backed; clarify NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 50 characters. Example: <defined status enum> |
