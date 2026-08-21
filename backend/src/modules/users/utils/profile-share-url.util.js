export const buildProfileShareUrl = (
  username,
) => {
  if (!username) {
    return null;
  }

  const baseUrl =
    (
      process.env.PUBLIC_WEB_URL ??
      "https://artictern.com"
    )
      .trim()
      .replace(
        /\/+$/,
        "",
      );

  return `${baseUrl}/u/${encodeURIComponent(
    username,
  )}`;
};
