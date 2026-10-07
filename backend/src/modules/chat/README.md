# Chat implementation checkpoints

## Implemented: conversation foundation

All routes require Bearer authentication and use the existing success/error envelope.

- `POST /api/v1/chat/conversations`
  - Direct: `{ "type": "direct", "userId": "<UUID>" }`
  - Group: `{ "type": "group", "groupId": "<UUID>" }`
  - Community: `{ "type": "community", "communityId": "<UUID>" }`
  - Existing conversations are returned, not duplicated. Non-connections start PENDING; accepted connections start ACCEPTED.
- `GET /api/v1/chat/conversations/{conversationId}`
  - Returns conversation metadata and `canSend`. Pending requests cannot send normal messages.
- `PATCH /api/v1/chat/conversations/{conversationId}/request`
  - `{ "status": "ACCEPTED" }` or `{ "status": "REJECTED" }`
  - Only the recipient can decide a pending direct request; repeated identical decisions are idempotent. Opposite decisions return 409.

Group/community authorization checks current membership, not cached conversation participants. Community posting permission is limited to owner/admin. Blocking removes direct conversation access in either direction; community bans remove access.

Migration: `075_chat_conversation_access.sql`. Apply before enabling these routes. Existing chat tables must be present; no automatic database mutation at startup. Existing duplicate group conversations cause migration failure rather than destructive deduplication.

## Implemented: message lifecycle

Base: `/api/v1/chat/conversations/{conversationId}`.

- `POST /messages`: `{clientMessageId: UUID, text?: string, replyToMessageId?: UUID, itineraryId?: UUID, assetIds?: UUID[]}`. At least one content field is required. Do not combine itineraryId and assetIds. Text maximum 512 characters; maximum 10 unique attachment IDs. Sending requires ACCEPTED and canSend. Retries with the same immutable payload are idempotent even after edits/deletion; different content using the same client ID returns 409.
- `GET /messages?limit=30&cursor=...`: newest-first tuple cursor pagination; maximum 100. Returns tombstones, replies, reactions, receipt state, and attachment URLs. Cursor follows the database timestamp without millisecond truncation.
- `PATCH /messages/{messageId}`: `{text}`. Sender-only, text-only; deleted messages cannot be edited.
- `DELETE /messages/{messageId}?scope=me|everyone`: personal hiding does not affect other viewers. Sender-only everyone deletion within 48 hours leaves `deleted:true,text:null,assets:[],itineraryId:null`. Repeated deletion is idempotent. Existing message content remains server-side; this is not physical data erasure.
- `PUT` or `DELETE /messages/{messageId}/reactions`: `{reaction}` from 👍 ❤️ 😂 😮 😢 🙏. Community members may react without admin posting rights.
- `PUT /messages/{messageId}/receipt`: `{status: DELIVERED|READ}`. Explicit client acknowledgment; READ never regresses. Socket emission does not constitute delivery/read.
- `POST /attachments`: multipart field `attachment`, one file up to 50 MiB; JPEG, PNG, WebP, MP4, PDF validated by signature. Returns an owned asset ID to include in a message. Original MP4 delivery only, not the post HLS workflow. Existing non-local duplicate assets are rejected rather than exposed publicly.
- `GET /messages/{messageId}/attachments/{assetId}`: authenticated private/no-store download. No public delivery URL or storage key is exposed. Deletion/hiding/loss of membership prevents delivery through this route.
- `GET /messages/{messageId}/itinerary`: reads the current referenced itinerary and returns `readOnly:true`. Sharing requires itinerary ownership or active linked-group membership. Conversation access grants no generic itinerary editing, status changes, expenses or vault access; use this dedicated endpoint to render a shared itinerary. Deleted messages and membership removal revoke this route's grant.

Migration: `076_chat_message_lifecycle.sql`, after 075. Message mutations and event-outbox insertion commit together. The backend emits Socket.IO `chat.updated` to existing authenticated user rooms with `{eventId,conversationId,messageId,type}` only. Fetch authorized REST content on notification. Emission is at-least-once: deduplicate eventId. On reconnect refetch history; realtime is not a replacement for persisted history. Worker checks current recipients/access before notification.

## Inbox, typing and optional push

Migration `077_chat_inbox_notifications.sql` follows 076.

- `GET /chat/conversations?limit=30&cursor=...&archived=false&requests=true`: current-access inbox, last-message preview and unread counts. Omit requests to include all request states.
- `GET /chat/unread-count`: total unread messages and conversations, including muted/archived conversations.
- `PATCH /chat/conversations/{id}/settings`: `{muted?:boolean,archived?:boolean}`; omitted preferences remain unchanged.
- `PUT /chat/conversations/{id}/read`: `{messageId}`; monotonic read-through marker. Per-message receipt endpoint remains available for detailed receipts.
- `POST /chat/conversations/{id}/messages/{messageId}/reports`: `{reasonCode,description?}`; repeated open reports are idempotent, own messages cannot be reported. Reports persist for moderation; this does not implement an admin moderation UI.
- Socket `chat:typing` input `{conversationId,isTyping}`; recipients receive `chat.typing` with userId and expiresAt. Authentication and membership are rechecked, one event per user per second; clients clear typing at expiry.
- `PUT /chat/push-devices`: `{deviceId:UUID,platform:android|ios,token}`; session-bound registration, token never returned. `DELETE /chat/push-devices/{deviceId}` unregisters an owned installation.

FCM delivery is disabled by default. Enable only after configuring `CHAT_PUSH_ENABLED=true`, `CHAT_FCM_PROJECT_ID`, and `CHAT_FCM_CREDENTIALS_FILE` pointing to a privately mounted service-account file readable by the backend. Never commit the credentials file. The app must obtain/refresh FCM tokens, register authenticated devices, unregister before account switching, and handle navigation/permission prompts. Push carries generic notification text and IDs, not message content. Dispatch rechecks access, read state, mute/archive and session expiry; failures retry with bounded backoff, invalid tokens disable the device. At-least-once delivery requires client deduplication.

No Firebase project/credentials or app build/device were supplied; actual push delivery and device verification remain pending.

## Initial request text and reconnect replay

Migration `078_chat_event_replay.sql` follows 077.

- `POST /chat/conversations/{id}/request-message`: `{clientMessageId:UUID,text:string}`. Only the original requester may send one pending direct-request introduction, maximum 512 characters. No attachments, replies or itineraries. Repeated identical client IDs return the original message, including after a decision; another introduction or changed payload returns 409. Hiding/deleting it does not permit a second introduction. The recipient uses the existing accept/reject endpoint before ordinary messaging.
- `GET /chat/events?after=<cursor>&limit=100`: seven-day account-specific metadata replay, ordered by replayCursor. Response `{events,nextCursor,hasMore,resyncRequired}`. Each event has `{eventId,replayCursor,conversationId,messageId,type}`; messageId can be null for request decisions. Current access and hidden-message checks apply to replay, not just original delivery.
- Socket `chat.updated` now includes replayCursor. It remains at-least-once. The worker commits its journal before emission; transient emission failure retries with the same eventId/cursor. Request decisions emit `request.responded`.

Frontend reconnect protocol:

1. Keep the authenticated socket connected and buffer incoming chat events while syncing.
2. On first login, call events without after, save nextCursor and refetch inbox/history. Repeat full resync when resyncRequired is true.
3. On reconnect, replay from the last **fully applied replay response nextCursor**; follow hasMore pages before ending sync. Fetch affected authorized REST resources, then persist the response cursor. Retry a failed page without advancing the cursor.
4. Deduplicate by eventId, scoped to the logged-in account. Live events may arrive out of order: do not replace the replay checkpoint with the highest live cursor. If a live cursor indicates a gap, run replay. Refetch inbox/history on login/reconnect even after replay to cover changes occurring during disconnection.
5. Treat cursors as decimal strings/BigInt, never JavaScript Number. Clear stored cursor/dedup state on account switch. Typing is transient and is not replayed.

Replay is for recovery, not read/delivery receipts. Journal counters serialize per account; no raw outbox ID is used as a replay watermark. A short database advisory lock serializes journal batches across backend instances, with current recipient access checked again before live emission.

## Per-conversation event sequence

Migration `079_chat_conversation_event_sequence.sql` follows 078. Apply before running the updated backend. It briefly locks the three chat tables while backfilling retained events.

- Conversation metadata adds `eventSequence`, a decimal string with the latest committed event number.
- Live `chat.updated` and replay events add `conversationSequence`, a decimal string. Legacy journal events whose outbox entry was already pruned return null; refetch state rather than treating null as zero.
- Assignment occurs on outbox insertion in the same mutation transaction. The conversation row lock serializes writers; rollback restores the counter. Retry of an existing event preserves the sequence, and outbox retention never resets the counter.
- Frontend tracks numbers per conversation using BigInt/string. Ignore duplicate/older updates; on a gap, replay using the **personal replay cursor**, then refetch authorized conversation/history state. These sequence numbers are not replay cursors and must not replace them.
- Gaps can also result from personal hiding or membership changes, not only network loss. Refetch authoritative state rather than waiting indefinitely for every intervening number. New members establish a baseline by fetching current conversation state. Socket delivery can still arrive out of order; sequencing detects order, it does not promise ordered network delivery.
- Read markers and request decisions also generate numbered events. Typing remains transient and unnumbered. Message ordering continues to use existing history timestamps/IDs.

## Chat attachment malware scanning

New chat uploads are streamed to ClamAV before durable storage/persistence. Existing owned asset IDs are also scanned before attaching them to a new message, preventing bypass through another upload API. An idempotent retry of an already-created message does not rescan it. Existing message downloads are not retroactively scanned.

Configuration: `CHAT_CLAMD_HOST` (required private daemon hostname), `CHAT_CLAMD_PORT=3310`. No scanner bypass flag. Upload scan deadline is 30 seconds; sending multiple attachments shares a 30-second scan budget. Missing configuration, connection failure, timeout, truncated response, scanner errors or scan-limit errors return 503 `CHAT.MALWARE_SCAN_UNAVAILABLE`. A FOUND result returns 422 `CHAT.ATTACHMENT_MALWARE_DETECTED`; signature names and daemon details are not returned. Normal successful response fields are unchanged.

Provision ClamAV separately before deployment, reachable only over the backend's private network. Do not expose port 3310 publicly. Keep signatures updated with freshclam; configure `StreamMaxLength` and `MaxFileSize` at least 50M, `MaxScanSize` above the accepted size, and `AlertExceedsMax yes` so engine limits do not silently accept incompletely scanned files. Enable document/PDF scanning and reject encrypted PDFs using `AlertEncryptedDoc yes`. INSTREAM framing follows the [ClamAV protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html).

Protocol tests use a local simulated daemon. Real ClamAV signature detection, signature freshness and UAT connectivity require verification after provisioning; they are not established by these tests. No cleanup, database migration, post-media scanning, or deployment is included.

## Batched fan-out

The outbox worker resolves authorized recipients in a single set-based query, then journals in batches of at most 500 users. Each journal batch uses three database statements, not one transaction/query set per recipient. Sorted cursor locks and the existing journal-worker advisory lock preserve retry stability and cursor ordering.

After journal commit, current access is checked again in batches before live delivery. Removed/banned/blocked/inactive recipients are excluded. Socket payloads, replay cursors, conversation sequences and frontend integration are unchanged; no new migration or frontend change is required for this optimization.

Validation includes 1,001 local PostgreSQL recipients, nine journal statements and stable retry cursors. This is database-only, rollback-only validation, not a VPS/socket/device throughput benchmark. Total work/storage and socket emissions still scale with recipient count; the existing global journal lock and in-memory event batches remain limits for very large communities. Queue partitioning and deployment-scale testing remain required before claiming massive fan-out capacity.

## Remaining checkpoints

1. Live FCM delivery, production load/concurrency testing, and real-device verification.
3. Attachment garbage collection (deferred), live scanner verification, and deployment-scale fan-out validation. Do not claim full production readiness before these checks.

Do not treat `canSend` as frontend-only authorization: subsequent message handlers must revalidate it transactionally. Do not create persistent socket conversation subscriptions without membership-revocation handling.

No UAT deployment has occurred. Unit tests do not prove device delivery. Database integration tests apply migration/fixtures inside one transaction and roll everything back.
