export const buildPostShareUrl = (
  postId,
) => {
  if (!postId) {
    return null;
  }

  const baseUrl = (
    process.env.PUBLIC_WEB_URL ??
    "https://artictern.com"
  )
    .trim()
    .replace(/\/+$/, "");

  return `${baseUrl}/p/${encodeURIComponent(
    postId,
  )}`;
};
