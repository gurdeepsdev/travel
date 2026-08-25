class PostRepostsMapper {
  static toSetResponse({
    originalPostId,
    post,
  }) {
    return {
      reposted: true,
      originalPostId,
      post,
    };
  }

  static toRemoveResponse({
    originalPostId,
  }) {
    return {
      reposted: false,
      originalPostId,
      post: null,
    };
  }
}

export default PostRepostsMapper;
