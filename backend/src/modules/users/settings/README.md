# Personal app settings

Authenticated `GET` and `PATCH /api/v1/users/me/settings`. PATCH body:

```json
{"settings":[{"key":"theme","type":"string","value":"dark"},{"key":"autoplayVideos","type":"boolean","value":false}]}
```

Both return the usual success envelope with `data.settings`, an array sorted by key. GET returns an empty array for a new user. Types: string (up to 2048 characters), finite number, boolean. Keys are case-sensitive, up to 64 ASCII characters, starting with a letter; remaining characters may be letters, digits, dot, underscore or hyphen. Duplicate keys, unknown request fields, null/array/object values and type mismatches are rejected. PATCH accepts 1–50 entries; each account may hold 100 keys. Updating a key may change its type, provided its submitted value matches that type.

Unknown keys are accepted ONLY when validated server `NODE_ENV` equals `uat`. Every other environment is fail-closed: only keys and values explicitly registered in `approvedSettings` are accepted and returned. That production registry is deliberately empty until requirements are approved. Moving a UAT database to production does not expose previously unapproved keys. Frontend never controls environment mode.

Storage reuses `users.user_settings.settings_json` under `appSettingsV1`; no migration is required. Existing JSON fields are preserved. Transactions and per-user row locks prevent lost updates and serialize the total-key quota. No other module reads these values: they are opaque UI preferences, NOT authority to change account privacy, notification delivery, permissions or authentication. Those features retain their existing dedicated APIs.

Flutter calls GET after successful login/signup and on refresh/resume as appropriate. Login/signup response structures remain unchanged. Clear local cached settings on logout/account switch. Persist UI defaults only if desired; no server defaults or delete operation are introduced. No realtime event is added.
