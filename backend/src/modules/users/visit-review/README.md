# Manual visit verification review

Not deployed. Apply migration `095_visit_verification_reviews.sql` once after backup before starting this version. No changes to camera validation or its automatic verification. Use existing authenticated VPS user sessions; AWS dashboard user IDs/tokens are NOT interchangeable with VPS auth.users IDs.

Set server-only `VISIT_REVIEW_ADMIN_USER_IDS` to comma-separated existing VPS user UUIDs authorized to review. Empty or malformed configuration denies every request. It is never read from client input; no grant/role-management API is added. Users cannot review their own submissions, even if allowlisted.

All routes use `/api/v1/admin/visit-verifications` and require Bearer auth plus allowlisting:

* GET `?status=PENDING&limit=20&cursor=...`: combined city/place review queue, excluding city rows created solely as containers for the same place evidence. Filters PENDING/VERIFIED/REJECTED, stable microsecond cursor.
* GET `/{targetType}/{verificationId}`: detail. targetType is CITY or PLACE.
* GET `/{targetType}/{verificationId}/evidence`: private image bytes after review authorization; no public URL/signature or storage key exposed. Existing storage delivery is used as the evidence owner only after admin permission is confirmed. Cache-Control private,no-store. Evidence stays private.
* POST `/{targetType}/{verificationId}/review`: `{"decision":"VERIFIED","evidenceAssetId":"<currently displayed evidence UUID>"}` or `{"decision":"REJECTED","evidenceAssetId":"...","reason":"..."}`. Reason is required on rejection, up to 1000 characters. Reject unknown fields. Evidence ID is mandatory optimistic concurrency protection.

Approval requires an existing active public city/collection icon. If missing, optional `iconAssetId` must identify an active public image owned by the reviewer; it sets this user's collection icon only, not the global city icon. Evidence is never reused as a badge implicitly. Otherwise approval returns 409 VISIT_REVIEW.ICON_REQUIRED and no changes. Set up the city's icon through city data management for reusable defaults; no image generation or AWS synchronization is added here.

Updates lock the collection before the submission, validate evidence ownership, append a review audit row, update the submission and (on approval) verify its city collection atomically. Repeated same decision/evidence is idempotent; opposite final decision or changed evidence returns 409. Audit records remain across resubmission; a new city evidence asset resets rejection to PENDING. Automatic camera-verified rows cannot be manually overridden. Rejection never revokes another verified visit/city badge.

User list/detail now includes REJECTED visits; city review status distinguishes rejected from pending while preserving the existing boolean collection verification field. A reviewed record adds `review:{decision,reason,reviewedAt}`; non-reviewed response fields are unchanged. Select a verified city using the existing preference API to display it on profile. Approval does NOT auto-select badges; the existing five-city limit is preserved. No realtime/push notification or dashboard frontend is introduced.

Deployment requires explicit approval, migration backup, allowlist configuration and backend restart. No credentials belong in Swagger/frontend.

Tests: `RUN_VISIT_REVIEW_DB_TESTS=1 npm test -- --runInBand --watchman=false --coverage=false --reporters=default --testPathPatterns=visit-review.test.js`. The suite starts a temporary local PostgreSQL cluster and applies migration 095; it exercises real review transactions, user status queries, profile collection SQL and preference-limit trigger. Auth and file delivery are mocked: actual login, storage bytes and panel UI still require a separately approved UAT end-to-end test. No dashboard UI is included.
