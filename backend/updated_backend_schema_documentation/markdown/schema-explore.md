# Explore schema

## explore.posts

Stores user-created explore/feed content and its visibility and place context.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| caption | varchar(250) | no | api | - | Provides the human-readable caption needed to explain this posts to users or moderators. | Variable-length Unicode text with a hard maximum of 250 characters. Nullable Trim surrounding whitespace where appropriate; reject values longer than 250 characters. Example: <caption> |
| post_type | varchar(50) | default | api | - | Selects the supported post variant and determines how downstream code interprets the record. | Variable-length Unicode text with a hard maximum of 50 characters. Default-backed; clarify NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 50 characters. Example: <post type> |
| visibility | varchar(50) | default | api | - | Defines which audience is permitted to discover or view this record. | Variable-length Unicode text with a hard maximum of 50 characters. Default-backed; clarify NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 50 characters. Example: <visibility> |
| place_id | uuid | yes | api | - | Links the record to a canonical place/POI supplied by the place-data subsystem. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| comment_count | bigint | default | api | - | Cached aggregate used to render feed engagement without recounting comments on every request. | Signed 64-bit integer for counters or identifiers that may exceed 32-bit range. Default-backed; clarify NOT NULL Apply non-negative CHECK for aggregate counters. Example: 0 |
| share_count | bigint | default | api | - | Cached aggregate used to show how often the post has been shared. | Signed 64-bit integer for counters or identifiers that may exceed 32-bit range. Default-backed; clarify NOT NULL Apply non-negative CHECK for aggregate counters. Example: 0 |
| view_count | bigint | default | api | - | Cached aggregate used for reach and ranking metrics. | Signed 64-bit integer for counters or identifiers that may exceed 32-bit range. Default-backed; clarify NOT NULL Apply non-negative CHECK for aggregate counters. Example: 0 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| updated_at | timestamp | no | auto | - | Audit timestamp used for freshness checks, synchronization, and optimistic update decisions. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. Nullable Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## explore.post_assets

Orders media assets attached to an explore post.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| post_id | uuid | yes | api | explore.posts.id | Links the post_assets record to explore.posts.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| asset_id | uuid | yes | api | media.assets.id | Attaches the reusable media asset represented by media.assets. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| display_order | bigint | yes/default | api/auto | - | Determines deterministic presentation order when multiple child records belong to the same parent. | Signed 64-bit integer for counters or identifiers that may exceed 32-bit range. NOT NULL with default Apply non-negative CHECK for aggregate counters. Example: 0 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## explore.post_itineraries

Attaches reusable itineraries to an explore post.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| post_id | uuid | yes | api | explore.posts.id | Links the post_itineraries record to explore.posts.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| itinerary_id | uuid | yes | api | itinerary.itineraries.id | Attaches the reusable itinerary represented by itinerary.itineraries. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## explore.comments

Stores threaded discussion beneath an explore post.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| post_id | uuid | yes | api | explore.posts.id | Links the comments record to explore.posts.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| comment | varchar(250) | yes | api | - | Captures the comment attribute required by the stores threaded discussion beneath an explore post. | Variable-length Unicode text with a hard maximum of 250 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 250 characters. Example: <comment> |
| parent_comment_id | uuid | yes | api | explore.comments.id | Links the comments record to explore.comments.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| like_count | bigint | default | api | - | Caches the number of like items for fast API responses and ranking. | Signed 64-bit integer for counters or identifiers that may exceed 32-bit range. Default-backed; clarify NOT NULL Apply non-negative CHECK for aggregate counters. Example: 0 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| updated_at | timestamp | no | auto | - | Audit timestamp used for freshness checks, synchronization, and optimistic update decisions. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. Nullable Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## explore.post_likes

Records which user liked which explore post.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| post_id | uuid | yes | api | explore.posts.id | Links the post_likes record to explore.posts.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## explore.post_reshare

Records a user's reshare of an existing post.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| post_id | uuid | yes | api | explore.posts.id | Links the post_reshare record to explore.posts.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| shared_post_id | uuid | yes | api | explore.posts.id | Links the post_reshare record to explore.posts.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| caption | varchar(250) | no | api | - | Provides the human-readable caption needed to explain this post reshare to users or moderators. | Variable-length Unicode text with a hard maximum of 250 characters. Nullable Trim surrounding whitespace where appropriate; reject values longer than 250 characters. Example: <caption> |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## explore.post_been_there

Records that a user identifies with having visited the place represented by a post.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| post_id | uuid | yes | api | explore.posts.id | Links the post_been_there record to explore.posts.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
