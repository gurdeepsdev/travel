# Notifications — step 1

Migration: `093_notification_foundation.sql`, before starting the updated backend. No new environment variables or Firebase credentials are needed for this stage.

All public endpoints require the existing Bearer access token:

| Method | Path under `/api/v1` | Result inside standard `data` envelope |
| --- | --- | --- |
| GET | `/notifications?limit=20&cursor=...&unreadOnly=true` | `notifications`, `pagination` |
| GET | `/notifications/unread-count` | `unreadCount` |
| PUT | `/notifications/{notificationId}/read` | `notification`, `updated` |
| PUT | `/notifications/read-all` | `updatedCount` |
| GET | `/notifications/preferences` | `preferences` |
| PATCH | `/notifications/preferences` | full effective `preferences` |

Preference body: `{ "preferences": [{ "category": "EXPLORE", "push": false }] }`. Categories are CONNECTIONS, CHAT, GROUPS, TRIPS, TRAVEL, EXPLORE, VERIFICATION, EXPENSES, MODERATION and DOCUMENTS. Omitted flags remain unchanged. Defaults are true, constrained by the event's allowed delivery channels. Existing history is retained when opting out. These new preferences do not change chat mute settings in step 1.

Notification shape: `{ id, type, category, priority, actorId, title, body, target: { type, id }, readAt, createdAt }`. Timestamps are UTC date-times. Pagination is descending by `(created_at,id)` and preserves microseconds in the cursor. Hidden delivery flags, event deduplication keys and recipient IDs are not exposed. No public notification creation endpoint exists.

Server producers must call `NotificationRepository.createInTransaction(client, input)` inside the business transaction. `input` contains `userId`, optional `actorId`, stable `eventKey`, registered `type`, `title`, `body`, and a structured `target`. Generate the key from the persisted business event, not a new random value on each retry. One event per recipient is enforced by the database; self-actions and inactive recipients are suppressed. Never put credentials or private content in notification text. Domain producers must authorize recipients and targets before creating an event; clients must recheck target access through the destination API when navigating.

The 26 updated Final-tab event identities are registered, but **none of their domain triggers are connected in step 1**. Custom document reminders remain disabled pending requirements. Mandatory app-update UI is not an inbox or push event and is disabled here. Place-photo verification events are push-only and never appear in the in-app inbox.

Realtime uses the existing authenticated Socket.IO user rooms:

- `notification.created`: `{ eventId, notification }`
- `notification.read`: `{ eventId, all: false, notificationId, readAt }` or `{ eventId, all: true, updatedCount }`

`eventId` is a string. Delivery is best-effort to connected devices with at-least-once retry semantics on transport failure: deduplicate by eventId/notification.id, refresh unread totals, and fetch the first page on reconnect. This stage has no event replay endpoint. Marking read is idempotent and synchronized across a user's devices. Read-all covers rows visible to its update statement; subsequent notifications stay unread. The worker skips inactive accounts, retries failures with bounded backoff and removes completed outbox records after seven days; inbox history is not purged.

**Not implemented in this stage:** generic FCM dispatch, business-event hooks, trip/reminder scheduling, device-signal ingestion, or required-version policy. The existing chat FCM worker and chat message unread counts are unchanged. Stored `push` intent is reserved for later dispatch implementation; no generic push is sent by this release. When adding dispatch, recheck preferences, sessions, target access and relevant read state before delivery, and avoid duplicating the existing chat push pipeline.

Tests: `RUN_NOTIFICATION_DB_TESTS=1 npm test -- --runInBand --watchman=false --coverage=false --reporters=default --testPathPatterns=notification-foundation.test.js`. Uses a temporary isolated PostgreSQL cluster, never the UAT database.
