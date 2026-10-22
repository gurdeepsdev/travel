# Private chat media

Requires migration `090_isolate_private_chat_assets.sql` and rebuilt backend + video worker. Stop both backend and video worker, apply the migration, then start both rebuilt services together; do not mix old workers with the new chat job type. No new environment variables. Do not enable public CDN delivery for chat media.

New uploads use the private chat deduplication scope. Identical public-post media remains untouched; chat receives its own private local original. Existing legacy attachments are not migrated or optimized by this release. Re-uploading creates an isolated chat asset. PDFs remain original-only.

Video upload containers: MP4 (video/mp4), MOV (video/quicktime), WebM (video/webm), MKV (detected as video/matroska; video/x-matroska alias also allowed), AVI (video/vnd.avi), M4V (video/x-m4v). Actual file signatures decide acceptance, not the supplied extension or Content-Type. The 50 MiB maximum and one attachment per upload are unchanged. Original bytes/container are retained for download; the worker generates H.264/AAC MP4 and HLS playback. Unsupported/corrupt codecs can fail optimization while leaving the original available. Frontend should use optimized playback URLs when READY instead of assuming every original container plays natively.

Upload and send contracts are unchanged:

1. POST `/api/v1/chat/conversations/{conversationId}/attachments`, multipart `attachment`.
2. POST `/api/v1/chat/conversations/{conversationId}/messages`, JSON `{"clientMessageId":"UUID","assetIds":["UUID"]}`. Omit `text` for attachment-only messages.
3. Read `data.messages[].assets[]` in the existing history endpoint. `url` is always the original download. New image/video assets additionally expose `optimization`:

```json
{"status":"PENDING","width":null,"height":null,"imageVariants":[],"thumbnailUrl":null,"streamUrl":null,"playbackUrl":null}
```

When ready, imageVariants contains size/width/height/fileSize/mimeType/url for 320/640/1080/1600 bounding boxes (no upscaling). Videos expose a thumbnail, adaptive HLS master and optimized MP4 fallback. Renditions follow the existing post transcoder's source-size rules up to 1080p. Animated images retain the original rather than becoming still images; previews may remain empty.

Use image variants for display, thumbnail before video playback, and streamUrl for adaptive playback; retain the original as fallback while PENDING/FAILED. All URLs are API-relative. Resolve against the API origin, not an already `/api/v1`-suffixed base. Attach Bearer authentication to every preview request, including HLS master, child playlists and segments. Do not put access tokens in URLs or log headers. Playback clients must propagate authorization to HLS subrequests. Range delivery remains supported for optimized MP4.

Optimization emits the existing `chat.updated` flow through the transactional message outbox (`message.updated`). Refresh history on that event and reconnect replay. No new socket event is required. Existing message IDs, asset IDs, originals and pagination are preserved. Leaving a conversation, hiding/deleting a message or removing an asset blocks its preview through the same authorization checks as original attachments.

Jobs run serially on the existing video worker with three attempts. PENDING metadata is recovered at worker startup and every 60 seconds if enqueue failed. Final failure becomes FAILED; originals remain available. No retroactive backfill is performed.
