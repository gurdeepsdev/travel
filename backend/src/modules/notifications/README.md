# Notifications — step 1

Migrations: `093_notification_foundation.sql` (foundation), then `094_notification_push_delivery.sql` (generic FCM dispatch), before starting the updated backend. Generic push is disabled by default.

All public endpoints require the existing Bearer access token:

| Method | Path under `/api/v1` | Result inside standard `data` envelope |
| --- | --- | --- |
| GET | `/notifications?limit=20&cursor=...&unreadOnly=true` | `notifications`, `pagination` |
| GET | `/notifications/unread-count` | `unreadCount` |
| PUT | `/notifications/{notificationId}/read` | `notification`, `updated` |
| PUT | `/notifications/read-all` | `updatedCount` |
| GET | `/notifications/preferences` | `preferences` |
| PATCH | `/notifications/preferences` | full effective `preferences` |
| PUT | `/notifications/push-devices` | `deviceId`, `registered` |
| DELETE | `/notifications/push-devices/{deviceId}` | `deviceId`, `registered` |

Preference body: `{ "preferences": [{ "category": "EXPLORE", "push": false }] }`. Categories are CONNECTIONS, CHAT, GROUPS, TRIPS, TRAVEL, EXPLORE, VERIFICATION, EXPENSES, MODERATION and DOCUMENTS. Omitted flags remain unchanged. Defaults are true, constrained by the event's allowed delivery channels. Existing history is retained when opting out. These new preferences do not change chat mute settings in step 1.

Notification shape: `{ id, type, category, priority, actorId, title, body, target: { type, id }, readAt, createdAt }`. Timestamps are UTC date-times. Pagination is descending by `(created_at,id)` and preserves microseconds in the cursor. Hidden delivery flags, event deduplication keys and recipient IDs are not exposed. No public notification creation endpoint exists.

Server producers must call `NotificationRepository.createInTransaction(client, input)` inside the business transaction. `input` contains `userId`, optional `actorId`, stable `eventKey`, registered `type`, `title`, `body`, and a structured `target`. Generate the key from the persisted business event, not a new random value on each retry. One event per recipient is enforced by the database; self-actions and inactive recipients are suppressed. Never put credentials or private content in notification text. Domain producers must authorize recipients and targets before creating an event; clients must recheck target access through the destination API when navigating.

The 26 updated Final-tab event identities are registered, but **none of their domain triggers are connected in step 1**. Custom document reminders remain disabled pending requirements. Mandatory app-update UI is not an inbox or push event and is disabled here. Place-photo verification events are push-only and never appear in the in-app inbox.

Realtime uses the existing authenticated Socket.IO user rooms:

- `notification.created`: `{ eventId, notification }`
- `notification.read`: `{ eventId, all: false, notificationId, readAt }` or `{ eventId, all: true, updatedCount }`

`eventId` is a string. Delivery is best-effort to connected devices with at-least-once retry semantics on transport failure: deduplicate by eventId/notification.id, refresh unread totals, and fetch the first page on reconnect. This stage has no event replay endpoint. Marking read is idempotent and synchronized across a user's devices. Read-all covers rows visible to its update statement; subsequent notifications stay unread. The worker skips inactive accounts, retries failures with bounded backoff and removes completed outbox records after seven days; inbox history is not purged.

**Not implemented yet:** business-event hooks, trip/reminder scheduling, device-signal ingestion, required-version policy, or live-device verification. Domain producers and their target-authorization rules must be connected before enabling actual business notifications. Chat eligibility and unread behavior are unchanged; its sender now optionally supports the same keyless relay. CHAT-category pushes are deliberately excluded from the generic worker to prevent duplicates.

## Generic FCM delivery — step 2

Keyless VPS deployment: set `NOTIFICATION_RELAY_URL` to the approved HTTPS `/send`
endpoint and `NOTIFICATION_RELAY_SECRET` to its server-only HMAC secret (at least
64 characters). Chat shares these settings, or overrides them with `CHAT_RELAY_URL`
and `CHAT_RELAY_SECRET`. Deploy the updated relay before enabling chat payloads.
No Firebase credentials load on the VPS in relay mode. See the relay README for
the approval-gated deployment plan. Business triggers are not added here. Keep
both push flags disabled until a separate controlled delivery test is approved.

UAT configuration (example only; never commit real credentials):

```dotenv
NOTIFICATION_PUSH_ENABLED=false
CHAT_PUSH_ENABLED=false
NOTIFICATION_RELAY_URL=https://<actual-cloud-run-host>/send
NOTIFICATION_RELAY_SECRET=<securely-provisioned-HMAC-secret>
```

Cloud Run uses its attached messaging service account and ADC; no service-account
JSON is needed on the VPS. Direct mode is preserved when relay URL is absent,
using the existing project/credential-file settings and a private read-only mount.
An invalid configured relay fails closed without fallback. Credentials, OAuth,
HMAC and FCM tokens must never be logged or returned to Flutter.

The generic registration endpoint aliases the existing authenticated chat device registry, not a second registry. Register `{ "deviceId": "<installation UUID>", "platform": "android", "token": "<FCM registration token>" }`; platform also permits `ios`. Token length 20–4096. Register again on token refresh; delete before logout/account switch. The registry prevents one account claiming another account's device/token. Existing `/chat/push-devices` clients remain supported; do not register twice under different IDs. The current authenticated session is bound server-side, never supplied by the client.

Producers enqueue generic pushes in the same transaction as notification creation only while the push feature is enabled and the recipient has an enabled device with a valid session. No historical backfill occurs when enabling. One job per notification/device; pushes expire after 24 hours. Dispatch rechecks active account, same session, token/device state, preference changes, notification read state and actor blocks. Session replacement cannot deliver old queued work to a new login. Logout/device deletion cascades pending jobs. Push-only notifications remain absent from the inbox.

Workers claim short batches using expiring leases and release DB transactions before OAuth/network calls. Failed sends retry with exponential backoff, jitter, Retry-After and at most five send attempts. Only an explicit FCM UNREGISTERED result disables a token, guarded against concurrent token rotation. Permanent payload errors complete that job without disabling the device. A crash or uncertain HTTP outcome can cause duplicate delivery: frontend must deduplicate by `notificationId`.

FCM uses generic lock-screen text (`Artictern` / `Open Artictern to view your update.`) and string data `{ notificationId, type, targetType, targetId }`. Android tag and APNs collapse ID are the notification UUID to reduce retry duplicates. Tap handling must navigate using these structured IDs and call the destination's authorized API; no private notification text is embedded. In-app notifications should be marked read through the existing read endpoints. FCM acceptance is not proof that an OS displayed a notification; verify foreground/background/terminated behavior on real Android/iOS devices separately.

Tests: `RUN_NOTIFICATION_DB_TESTS=1 npm test -- --runInBand --watchman=false --coverage=false --reporters=default --testPathPatterns=notification-foundation.test.js`. Uses a temporary isolated PostgreSQL cluster, never the UAT database.
