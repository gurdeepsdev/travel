# Communities

All routes require Bearer authentication. Upload an image with `POST /api/v1/communities/images`, multipart field `image`, maximum 10 MiB, then use `data.asset.id` as `iconAssetId` in `POST /api/v1/communities` with `{name,description?,iconAssetId,joinType:OPEN|APPROVAL}`. Images are public, validated by file signature and must belong to the creating/updating user. Creation returns `data.community` with its `conversationId` and automatically adds the creator as ADMIN.

`GET /communities` discovers communities; `GET /users/me/communities` lists active memberships. Both accept search, limit (1–50) and cursor. Details: `GET /communities/{communityId}`. Any active admin can PATCH details or DELETE the community. `ownerId` tracks the original creator only and confers no additional access. Existing chat endpoints allow only active admins to send; members read/react. Deletion is soft and revokes chat access.

`POST /communities/{communityId}/join` activates OPEN memberships or returns `{status:PENDING,requestId}` for APPROVAL communities. Repeating a pending join returns the same request ID. Admins list requests with `GET /communities/{communityId}/join-requests?status=PENDING` and PATCH `.../{requestId}` with `{status:ACCEPTED|REJECTED}`. Requesters DELETE their own pending request to cancel. Rejected/cancelled users can request again. All admins can review regardless of the original request target.

`GET /communities/{communityId}/members` returns paginated users and profile images to active members. Admins PATCH `.../members/{userId}/role` with `{role:ADMIN|MEMBER}` or DELETE `.../members/{userId}`. Users POST `.../leave`. The last admin cannot demote themselves until another admin exists. If the last admin leaves/is removed, the earliest active member becomes admin; an empty community is archived. Leaving/removal revokes all chat history access.

Admins PUT `.../bans/{userId}` with optional `{reason}` to ban and revoke membership, GET `.../bans` to list, and DELETE `.../bans/{userId}` to unban. Unbanning does not restore membership; normal join rules apply. Admins cannot ban themselves. Banned users cannot discover, join or read the community/chat.

Community updates use the existing `chat.updated` event with type `conversation.updated`; refetch community/members/requests when relevant. Existing access checks suppress notifications after membership is revoked. These are metadata refresh notifications, not chat messages. Migration `086_community_management.sql` backfills missing legacy creator memberships and normalizes roles, retaining already-removed members as removed. Apply before deploying this code. Chat direct/group authorization is preserved.
# Multipart creation

`POST /api/v1/communities` also accepts authenticated `multipart/form-data`: required `name` and `image` (one supported image up to 10 MiB), optional `description` and `joinType` (`OPEN` default or `APPROVAL`). Do not send `iconAssetId` with multipart. Let the HTTP client generate the multipart boundary.

Existing JSON creation with `iconAssetId` and the separate `/communities/images` upload remain supported. Multipart persists the image asset, community, admin membership and conversation in one database transaction; the response envelope is unchanged.
