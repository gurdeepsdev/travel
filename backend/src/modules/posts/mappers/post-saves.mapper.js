class PostSavesMapper {
  static toResponse({
    postId,
    state,
  }) {
    const viewerHasSaved =
      state?.is_active === true;

    return {
      postId,
      viewerHasSaved,

      savedItem: viewerHasSaved
        ? {
            id: state.id,

            savedAt:
              state.created_at,
          }
        : null,
    };
  }
}

export default PostSavesMapper;