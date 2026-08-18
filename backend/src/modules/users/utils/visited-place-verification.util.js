const EARTH_RADIUS_METERS =
  6371008.8;

const DEFAULT_PLACE_VERIFICATION_RADIUS_METERS =
  500;

const MAX_FUTURE_CAPTURE_SKEW_MILLISECONDS =
  5 * 60 * 1000;

function degreesToRadians(
  degrees,
) {
  return (
    degrees *
    Math.PI /
    180
  );
}

function calculateDistanceMeters({
  firstLatitude,
  firstLongitude,
  secondLatitude,
  secondLongitude,
}) {
  const firstLatitudeRadians =
    degreesToRadians(
      firstLatitude,
    );

  const secondLatitudeRadians =
    degreesToRadians(
      secondLatitude,
    );

  const latitudeDifference =
    degreesToRadians(
      secondLatitude -
        firstLatitude,
    );

  const longitudeDifference =
    degreesToRadians(
      secondLongitude -
        firstLongitude,
    );

  const haversine =
    Math.sin(
      latitudeDifference / 2,
    ) ** 2 +
    Math.cos(
      firstLatitudeRadians,
    ) *
    Math.cos(
      secondLatitudeRadians,
    ) *
    Math.sin(
      longitudeDifference / 2,
    ) ** 2;

  const angularDistance =
    2 *
    Math.atan2(
      Math.sqrt(
        haversine,
      ),
      Math.sqrt(
        1 - haversine,
      ),
    );

  return (
    EARTH_RADIUS_METERS *
    angularDistance
  );
}

function createRejectedDecision({
  reason,
  distanceMeters = null,
  radiusMeters,
}) {
  return {
    status:
      "REJECTED",

    verified:
      false,

    reason,

    confidence:
      "NONE",

    distanceMeters,

    radiusMeters,
  };
}

function evaluateVisitedPlaceEvidence({
  metadata,
  place,
  radiusMeters =
    DEFAULT_PLACE_VERIFICATION_RADIUS_METERS,
  now =
    new Date(),
}) {
  const placeLatitude =
    Number(
      place?.latitude,
    );

  const placeLongitude =
    Number(
      place?.longitude,
    );

  if (
    !Number.isFinite(
      placeLatitude,
    ) ||
    !Number.isFinite(
      placeLongitude,
    )
  ) {
    return createRejectedDecision({
      reason:
        "PLACE_COORDINATES_UNAVAILABLE",

      radiusMeters,
    });
  }

  if (
    metadata?.metadataRead !==
      true
  ) {
    return createRejectedDecision({
      reason:
        "METADATA_UNREADABLE",

      radiusMeters,
    });
  }

  if (
    metadata.hasGps !== true
  ) {
    return createRejectedDecision({
      reason:
        "EXIF_GPS_REQUIRED",

      radiusMeters,
    });
  }

  const distanceMeters =
    calculateDistanceMeters({
      firstLatitude:
        metadata.latitude,

      firstLongitude:
        metadata.longitude,

      secondLatitude:
        placeLatitude,

      secondLongitude:
        placeLongitude,
    });

  const roundedDistanceMeters =
    Math.round(
      distanceMeters * 100,
    ) / 100;

  if (
    distanceMeters >
      radiusMeters
  ) {
    return createRejectedDecision({
      reason:
        "EXIF_LOCATION_OUTSIDE_RADIUS",

      distanceMeters:
        roundedDistanceMeters,

      radiusMeters,
    });
  }

  if (
    metadata.hasCaptureTime !==
      true ||
    !metadata.capturedAt
  ) {
    return createRejectedDecision({
      reason:
        "EXIF_CAPTURE_TIME_REQUIRED",

      distanceMeters:
        roundedDistanceMeters,

      radiusMeters,
    });
  }

  const capturedAt =
    new Date(
      metadata.capturedAt,
    );

  const currentTime =
    now instanceof Date
      ? now
      : new Date(now);

  if (
    Number.isNaN(
      capturedAt.getTime(),
    ) ||
    Number.isNaN(
      currentTime.getTime(),
    )
  ) {
    return createRejectedDecision({
      reason:
        "EXIF_CAPTURE_TIME_INVALID",

      distanceMeters:
        roundedDistanceMeters,

      radiusMeters,
    });
  }

  if (
    capturedAt.getTime() >
      currentTime.getTime() +
        MAX_FUTURE_CAPTURE_SKEW_MILLISECONDS
  ) {
    return createRejectedDecision({
      reason:
        "EXIF_CAPTURE_TIME_IN_FUTURE",

      distanceMeters:
        roundedDistanceMeters,

      radiusMeters,
    });
  }

  return {
    status:
      "VERIFIED",

    verified:
      true,

    reason:
      null,

    confidence:
      "MEDIUM",

    distanceMeters:
      roundedDistanceMeters,

    radiusMeters,

    verificationMethod:
      "EXIF_GPS_AND_CAPTURE_TIME",
  };
}

export {
  DEFAULT_PLACE_VERIFICATION_RADIUS_METERS,
  MAX_FUTURE_CAPTURE_SKEW_MILLISECONDS,
  calculateDistanceMeters,
  evaluateVisitedPlaceEvidence,
};

