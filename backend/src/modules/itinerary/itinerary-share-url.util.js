export const buildItineraryShareUrl = (
  shareToken,
) => {
  if (!shareToken) {
    return null;
  }

  const baseUrl = (
    process.env.PUBLIC_WEB_URL ??
    "https://artictern.com"
  )
    .trim()
    .replace(/\/+$/, "");

  return `${baseUrl}/i/${encodeURIComponent(
    shareToken,
  )}`;
};
