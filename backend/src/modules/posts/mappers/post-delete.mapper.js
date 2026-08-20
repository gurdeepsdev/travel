class PostDeleteMapper {
  toResponse(
    deletedPost,
  ) {
    return {
      deleted: true,

      post: {
        id:
          deletedPost.id,

        deletedAt:
          deletedPost.deleted_at,
      },
    };
  }
}

export default new PostDeleteMapper();
