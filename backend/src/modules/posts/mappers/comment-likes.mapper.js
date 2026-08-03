class CommentLikesMapper {
  static toResponse({
    commentId,
    state,
  }) {
    return {
      commentId,

      viewerHasLiked:
        state?.viewer_has_liked === true,

      likeCount: Number(
        state?.like_count ?? 0,
      ),
    };
  }
}

export default CommentLikesMapper;