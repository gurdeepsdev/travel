const normalizePath = (storageKey) =>
    String(storageKey)
      .split("/")
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join("/");
  
  /**
   * Builds a public Cloudflare R2 URL.
   *
   * The URL domain is intentionally controlled through an
   * environment variable so storage metadata remains portable.
   */
  export const buildAssetUrl = (storageKey) => {
    if (!storageKey) {
      return null;
    }
  
    const baseUrl =
      process.env.R2_PUBLIC_BASE_URL?.trim();
  
    if (!baseUrl) {
      return null;
    }
  
    const normalizedBaseUrl =
      baseUrl.replace(/\/+$/, "");
  
    const normalizedStorageKey =
      normalizePath(storageKey);
  
    return normalizedStorageKey
      ? `${normalizedBaseUrl}/${normalizedStorageKey}`
      : null;
  };