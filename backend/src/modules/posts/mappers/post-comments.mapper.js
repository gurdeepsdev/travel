import {
    buildProfilePhotoUrl,
  } from "./profile-photo-url.mapper.js";
  
  class PostCommentsMapper {
    static toComment(row) {
      if (!row) {
        return null;
      }
  
      const profilePhoto =
        row.profile_photo_id
          ? {
              id: row.profile_photo_id,
  
              storageProvider:
                row.profile_photo_storage_provider ??
                null,
  
              bucket:
                row.profile_photo_bucket ??
                null,
  
              storageKey:
                row.profile_photo_storage_key ??
                null,
  
              url: buildProfilePhotoUrl({
                assetId:
                  row.profile_photo_id,
                storageProvider:
                  row.profile_photo_storage_provider,
                storageKey:
                  row.profile_photo_storage_key,
              }),
  
              mimeType:
                row.profile_photo_mime_type ??
                null,
            }
          : null;
  
      return {
        id: row.id,
        postId: row.post_id,
        comment: row.comment,
  
        parentCommentId:
          row.parent_comment_id ?? null,
  
        isReply:
          row.parent_comment_id !== null &&
          row.parent_comment_id !== undefined,
  
        likeCount: Number(
          row.like_count ?? 0,
        ),

        viewerHasLiked:
          row.viewer_has_liked === true,

        createdAt: row.created_at,
        updatedAt: row.updated_at,
  
        author: {
          id: row.user_id,
  
          username:
            row.username ?? null,
  
          displayName:
            row.display_name ?? null,
  
          isVerified:
            row.is_verified === true,
  
          profilePhoto,
        },
      };
    }
  

    static toListComment(row) {
      const comment =
        this.toComment(row);

      if (!comment) {
        return null;
      }

      return {
        ...comment,

        author: {
          ...comment.author,

          relationship: {
            status:
              row.relationship_status ??
              "NONE",

            connectionId:
              row.relationship_status ===
              "CONNECTED"
                ? row.relationship_connection_id ??
                  null
                : null,

            requestId:
              row.relationship_status ===
                "OUTGOING_PENDING" ||
              row.relationship_status ===
                "INCOMING_PENDING"
                ? row.relationship_request_id ??
                  null
                : null,
          },
        },

        replyCount: Number(
          row.reply_count ?? 0,
        ),

        viewerIsAuthor:
          row.viewer_is_author === true,
      };
    }

    static toListResponse({
      postId,
      rows,
      commentCount,
      hasMore,
      nextCursor,
    }) {
      return {
        postId,

        commentCount: Number(
          commentCount ?? 0,
        ),

        comments: (rows ?? [])
          .map((row) =>
            this.toListComment(row),
          )
          .filter(Boolean),

        pagination: {
          hasMore: hasMore === true,

          nextCursor:
            nextCursor ?? null,
        },
      };
    }


    static toCreateResponse({
      comment,
      commentCount,
    }) {
      return {
        comment: this.toComment(comment),
  
        commentCount: Number(
          commentCount ?? 0,
        ),
      };
    }


    static toDeleteResponse({
  deletedComment,
  commentCount,
}) {
  return {
    commentId:
      deletedComment.id,

    postId:
      deletedComment.post_id,

    deleted: true,

    commentCount: Number(
      commentCount ?? 0,
    ),
  };
}

  }
  
  export default PostCommentsMapper;
