const enabledValue = String(
  process.env
    .MEDIA_X_ACCEL_ENABLED ??
    "false",
).trim().toLowerCase();

if (
  enabledValue !== "true" &&
  enabledValue !== "false"
) {
  throw new Error(
    "MEDIA_X_ACCEL_ENABLED must be true or false.",
  );
}

const configuredPrefix =
  process.env
    .MEDIA_X_ACCEL_INTERNAL_PREFIX ??
  "/_protected_media";

if (
  !/^\/[A-Za-z0-9/_-]*$/
    .test(configuredPrefix)
) {
  throw new Error(
    "MEDIA_X_ACCEL_INTERNAL_PREFIX is invalid.",
  );
}

const internalPrefix =
  `/${configuredPrefix
    .split("/")
    .filter(Boolean)
    .join("/")}`;

const mediaDelivery = Object.freeze({
  xAccelEnabled:
    enabledValue === "true",
  internalPrefix,
});

export default mediaDelivery;
