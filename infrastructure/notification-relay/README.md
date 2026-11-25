# Keyless notification relay

Status: local chat/general sender integration tested; this revision is not deployed. The earlier general-only relay was deployed separately and its HMAC checks verified. These files and tests do not change Cloud Run or VPS configuration.

The VPS signs `POST /send` with HMAC-SHA256 over `timestamp + "\nPOST\n/send\n" + exact JSON body`. The relay accepts timestamps within 60 seconds, verifies signatures using constant-time comparison, validates a bounded payload, and sends only a fixed private-lock-screen notification. TLS and synchronized clocks are required. Signatures are not durable replay prevention: a captured valid request could be replayed within that window; delivery remains at-least-once and clients deduplicate notification IDs. Never log request bodies or authentication headers. No topic, arbitrary project, URL, or custom notification-text forwarding is supported.

Cloud Run uses a dedicated attached service account and ADC, not a downloaded JSON key. The HMAC secret is still a credential: store it in Secret Manager and the VPS backend environment only, rotate it, never send it to Flutter. The existing direct JSON-key sender remains supported when relay URL is absent. A configured but invalid relay fails closed rather than falling back.

General payload: `{token, notificationId, type, target:{type,id}}` (unchanged).
Chat payload: `{kind:"CHAT", token, conversationId, messageId, eventId}`. The relay
preserves chat's existing fixed text and string navigation fields. Deploy this
updated relay before enabling chat transport; the older relay rejects chat payloads.
Both senders default off. Neither loads Firebase credentials on the VPS in relay mode.

## Deployment plan (approval required before running)

Use project `artictern-7a286`, region `asia-south1`, dedicated service `artictern-notification-relay-uat`. Verify active gcloud account and project first. A billing-enabled project, authorized deployer/build permissions, and FCM HTTP v1 are required.

1. Enable Run, Cloud Build, Artifact Registry, Secret Manager and Firebase Cloud Messaging APIs.
2. Create a dedicated `notification-relay-uat` service account. Grant only `cloudmessaging.messages.create` through a custom project role. Grant Secret Manager Secret Accessor on the relay secret only, not all project secrets.
3. Generate a random 32-byte hex HMAC secret securely (64 characters). Upload it to Secret Manager as `notification-relay-uat-hmac`, without printing it or putting it in command history. Transfer the same secret securely into the VPS backend environment. Do not commit it.
4. Build/deploy only this directory, not the repository root:

```sh
gcloud run deploy artictern-notification-relay-uat \
  --project=artictern-7a286 --region=asia-south1 \
  --source=infrastructure/notification-relay \
  --service-account=notification-relay-uat@artictern-7a286.iam.gserviceaccount.com \
  --set-env-vars=NOTIFICATION_FCM_PROJECT_ID=artictern-7a286 \
  --set-secrets=NOTIFICATION_RELAY_SECRET=notification-relay-uat-hmac:1 \
  --no-invoker-iam-check --min-instances=0 --max-instances=2 \
  --memory=256Mi --cpu=1 --concurrency=10 --timeout=20s
```

`--no-invoker-iam-check` makes only this service publicly reachable; HMAC remains
mandatory on every send. The effective `run.managed.requireInvokerIam` policy must
permit this (verified separately for UAT). Do not weaken organization policy.
Public endpoint/cost exposure remains despite the bounds. Pin the secret version,
use committed package-lock.json, and retain revisions for rollback. Deployment
requires separate approval; these instructions do not authorize deployment now.

5. Set VPS backend configuration with push still disabled:

```dotenv
NOTIFICATION_PUSH_ENABLED=false
CHAT_PUSH_ENABLED=false
NOTIFICATION_RELAY_URL=https://<actual-cloud-run-host>/send
NOTIFICATION_RELAY_SECRET=<securely-transferred-secret>
```

Neither Firebase credential-file variable is needed in relay mode. Chat shares
the two `NOTIFICATION_RELAY_*` settings by default; optional `CHAT_RELAY_URL` and
`CHAT_RELAY_SECRET` override them. Enable flags are independent. Apply migration
094 only after verifying foundation 093 is present, with a validated backup; do
not rerun applied migrations. Migration 094 adds only `notification.push_outbox`
and its due-job index, preserving users, sessions and existing registrations.
Chat continues to use its existing outbox and recipient eligibility rules. The
general worker excludes CHAT notifications to prevent duplicates. Missing business
event hooks remain separate pending work. Merge, deploy and enable only after
explicit approval; preserve queue data during rollback.

6. Confirm unsigned send gets 401 and signed controlled send reaches an authorized test device. Check foreground/background/tap handling on a real device. Only then enable `NOTIFICATION_PUSH_ENABLED=true`. A health check or FCM acceptance alone does not prove device delivery. Rollback: disable push, restore previous backend config/revision; preserve outbox data.

## Local checks

Install backend and relay dependencies in the repository, then run `npm test` in
this directory. This includes backend-to-relay signing tests over real local HTTP
with ADC/FCM mocked. No live credentials or external sends are used. Backend tests
cover both sender modes, disabled flags, queue leases/retries and migration 094.
