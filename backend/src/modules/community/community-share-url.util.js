export function buildCommunityShareUrl(communityId) {
  if (!communityId) return null;
  const baseUrl = (process.env.PUBLIC_WEB_URL ?? 'https://artictern.com')
    .trim().replace(/\/+$/, '');
  return `${baseUrl}/c/${encodeURIComponent(communityId)}`;
}
