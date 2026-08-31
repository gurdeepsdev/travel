import {
  buildAssetUrl,
} from "../../users/utils/asset-url.util.js";

export const buildProfilePhotoUrl = ({
  assetId,
  storageProvider,
  storageKey,
}) => {
  const assetUrl = buildAssetUrl({
    assetId,
    storageProvider,
    storageKey,
    isPublic: true,
  });

  if (
    !assetUrl ||
    /^https?:\/\//i.test(assetUrl)
  ) {
    return assetUrl;
  }

  const baseUrl =
    process.env.API_PUBLIC_BASE_URL
      ?.trim() ||
    `http://localhost:${
      process.env.APP_PORT || 3001
    }`;

  return `${baseUrl.replace(
    /\/+$/,
    "",
  )}/${assetUrl.replace(
    /^\/+/,
    "",
  )}`;
};
