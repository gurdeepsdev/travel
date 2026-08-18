# Auth schema

## auth.users

Creates the stable account identity used by every user-owned domain.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| status | varchar(50) | default | api | - | Controls the record's current workflow/lifecycle state and therefore which actions are allowed. Source constraint: [specific values to be decided] | Variable-length Unicode text with a hard maximum of 50 characters. Default-backed; clarify NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 50 characters. Example: <defined status enum> |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| updated_at | timestamp | no | auto | - | Audit timestamp used for freshness checks, synchronization, and optimistic update decisions. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. Nullable Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| deleted_at | timestamp | no | auto | - | Soft-delete marker; a populated value removes the record from normal active queries without erasing history. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. Nullable Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## auth.identities

Maps an account to login identifiers such as email, phone number, or device identity.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| provider | varchar(50) | yes | api | - | Selects the identity or authentication channel used to interpret the provider identifier. Source constraint: [phone_no, email, unique_id(device_id)] same as auth.otp_requests.provider | Variable-length Unicode text with a hard maximum of 50 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 50 characters. Example: email |
| provider_identifier | varchar(100) | yes | api | - | Stores the channel-specific login address, such as a normalized email, phone number, or device identifier. Source constraint: actual number/email id or unique device id same as auth.otp_requests.provider_identifier | Variable-length Unicode text with a hard maximum of 100 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 100 characters. Example: user@example.com |
| is_verified | bool | default | api | - | Records whether ownership/control of the supplied identity has been successfully proven. Source constraint: [specific values to be decided] | Boolean with only TRUE or FALSE states. Default-backed; clarify NOT NULL Do not encode states as 0/1 or strings; define a default when business logic needs one. Example: true |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| updated_at | timestamp | no | auto | - | Audit timestamp used for freshness checks, synchronization, and optimistic update decisions. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. Nullable Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## auth.sessions

Tracks refreshable login sessions and the device/network context in which they were issued.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| refresh_token_hash | varchar(120) | yes | api | - | Stores only the non-reversible digest used to validate or revoke a refresh token. | Variable-length Unicode text with a hard maximum of 120 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 120 characters. Example: <opaque server-generated value> |
| device_name | varchar(50) | yes | api | - | Provides the human-readable label shown when presenting this sessions. | Variable-length Unicode text with a hard maximum of 50 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 50 characters. Example: <device name> |
| device_type | varchar(100) | yes | api | - | Selects the supported device variant and determines how downstream code interprets the record. | Variable-length Unicode text with a hard maximum of 100 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 100 characters. Example: <device type> |
| ip_address | varchar(50) | yes | api | - | Captures the originating network address for security review, anomaly detection, and audit. | Variable-length Unicode text with a hard maximum of 50 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 50 characters. Example: 203.0.113.42 |
| user_agent | varchar(100) | yes | api | - | Captures client/browser identity for device recognition and security investigation. | Variable-length Unicode text with a hard maximum of 100 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 100 characters. Example: <user agent> |
| expiry_at | timestamp | yes | auto | - | Defines the exact cutoff after which the token, request, invitation, or session must be rejected. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## auth.otp_requests

Controls OTP challenges, retry limits, verification state, and expiry.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| provider | varchar(100) | yes | api | - | Selects the identity or authentication channel used to interpret the provider identifier. | Variable-length Unicode text with a hard maximum of 100 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 100 characters. Example: email |
| provider_identifier | varchar(100) | yes | api | - | Stores the channel-specific login address, such as a normalized email, phone number, or device identifier. | Variable-length Unicode text with a hard maximum of 100 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 100 characters. Example: user@example.com |
| otp_hash | varchar(120) | yes | api | - | Stores only the non-reversible digest of the OTP so the original code is never persisted. | Variable-length Unicode text with a hard maximum of 120 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 120 characters. Example: <opaque server-generated value> |
| attempt_count | int | default | api | - | Limits repeated verification attempts and supports abuse/rate-limit controls. | Signed 32-bit integer, normally −2,147,483,648 to 2,147,483,647. Default-backed; clarify NOT NULL Apply a domain CHECK such as >= 0 for counters, order, or attempts. Example: 0 |
| expiry_at | timestamp | yes | auto | - | Defines the exact cutoff after which the token, request, invitation, or session must be rejected. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| verified_at | timestamp | no | api | - | Records when the OTP challenge was successfully completed; null means not verified. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. Nullable Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |

## auth.login_history

Provides a security audit trail for successful and failed login attempts.

| Column | Type | Required | Filled by | Key / relation | Purpose | Datatype specification |
|---|---|---|---|---|---|---|
| id | uuid | yes | auto-inc | - | Primary identifier used to address this record and support references from other tables. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| user_id | uuid | yes | api | auth.users.id | Links this record to the user who owns, performs, or receives the represented action. | PostgreSQL native 128-bit UUID; API text must use canonical 36-character 8-4-4-4-12 form. NOT NULL Generate with UUIDv4/UUIDv7 server-side; reject malformed strings. Example: 550e8400-e29b-41d4-a716-446655440000 |
| provider | varchar(100) | yes | api | - | Selects the identity or authentication channel used to interpret the provider identifier. Source constraint: same as auth.otp_requests.provider | Variable-length Unicode text with a hard maximum of 100 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 100 characters. Example: email |
| provider_identifier | varchar(100) | yes | api | - | Stores the channel-specific login address, such as a normalized email, phone number, or device identifier. Source constraint: same as auth.otp_requests.provider_identifier | Variable-length Unicode text with a hard maximum of 100 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 100 characters. Example: user@example.com |
| ip_address | varchar(50) | yes | api | - | Captures the originating network address for security review, anomaly detection, and audit. | Variable-length Unicode text with a hard maximum of 50 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 50 characters. Example: 203.0.113.42 |
| user_agent | varchar(200) | yes | api | - | Captures client/browser identity for device recognition and security investigation. | Variable-length Unicode text with a hard maximum of 200 characters. NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 200 characters. Example: <user agent> |
| status | varchar(100) | default | api | - | Controls the record's current workflow/lifecycle state and therefore which actions are allowed. Source constraint: [specefic values to be decided] | Variable-length Unicode text with a hard maximum of 100 characters. Default-backed; clarify NOT NULL Trim surrounding whitespace where appropriate; reject values longer than 100 characters. Example: <defined status enum> |
| failure_reason | varchar(250) | no | api | - | Explains why an operation failed so security and support teams can distinguish expected rejection from system error. | Variable-length Unicode text with a hard maximum of 250 characters. Nullable Trim surrounding whitespace where appropriate; reject values longer than 250 characters. Example: <failure reason> |
| created_at | timestamp | yes | auto | - | Audit timestamp used to order records and determine when the record first existed. | Date and time value. Prefer TIMESTAMPTZ so the stored instant is unambiguous across locations. NOT NULL Accept ISO-8601 with timezone; store in UTC and render in the user's timezone. Example: 2026-07-24T10:30:00+05:30 |
