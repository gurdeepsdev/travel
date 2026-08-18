# Chat schema

## chat.conversations

Represents the message thread associated with a group or collaboration context.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| group_id | uuid | yes | api | group.groups.id | Links the conversations record to group.groups.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| last_message_id | uuid | yes | api | chat.chat_messages.id | Caches the newest message reference so conversation lists can load previews without scanning all messages. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| updated_at | timestamp | no | auto | - | Audit timestamp used for freshness checks, synchronization, and optimistic update decisions. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. Nullable Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## chat.chat_messages

Stores messages, senders, reply chains, edits, and feature attachments.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| conversation_id | uuid | yes | api | chat.conversations.id | Links the chat_messages record to chat.conversations.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| sent_by | uuid | yes | api | auth.users.id | Captures the sent by attribute required by the stores messages, senders, reply chains, edits, and feature attachments. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: <sent by> |
| message_type | varchar(50) | yes | api | - | Selects the supported message variant and determines how downstream code interprets the record. | Variable-length Unicode text with a hard maximum of 50 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 50 characters. Example: <message type> |
| message_content | varchar(512) | yes | api | - | Contains the human-readable body sent in the conversation. | Variable-length Unicode text with a hard maximum of 512 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 512 characters. Example: <message content> |
| asset_id | uuid | yes | api | media.assets.id | Attaches the reusable media asset represented by media.assets. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| itinerary_id | uuid | yes | api | itinerary.itineraries.id | Attaches the reusable itinerary represented by itinerary.itineraries. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| edited_at | timestamp | no | api | - | Records the business event time for 'edited' so its lifecycle can be audited. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. Nullable Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| reply_to_message_id | uuid | yes | api | chat.chat_messages.id | Creates the reply/thread relationship to an earlier message in the same conversation. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |

## chat.message_assets

Connects one chat message to one or more reusable media assets.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| message_id | uuid | yes | api | chat.chat_messages.id | Links the message_assets record to chat.chat_messages.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| asset_id | uuid | yes | api | media.assets.id | Attaches the reusable media asset represented by media.assets. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| display_order | int | default | api | - | Determines deterministic presentation order when multiple child records belong to the same parent. | Signed 32-bit integer, normally −2,147,483,648 to 2,147,483,647. Default-backed; clarify NOT NULL Apply a domain CHECK such as >= 0 for counters, order, or attempts. Example: 0 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## chat.message_reactions

Records a user's reaction to a specific chat message.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| message_id | uuid | yes | api | chat.chat_messages.id | Links the message_reactions record to chat.chat_messages.id, enabling ownership, lookup, or workflow traversal. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| reaction | int | yes | api |  | Captures the reaction attribute required by the records a user's reaction to a specific chat message. | Signed 32-bit integer, normally −2,147,483,648 to 2,147,483,647. NOT NULL Apply a domain CHECK such as >= 0 for counters, order, or attempts. Example: 0 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
