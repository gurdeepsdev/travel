import exifr
  from "exifr";

function normalizeCoordinate({
  value,
  minimum,
  maximum,
}) {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue,
    ) ||
    numericValue < minimum ||
    numericValue > maximum
  ) {
    return null;
  }

  return numericValue;
}

function normalizeDate(
  value,
) {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function normalizeText(
  value,
) {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized
    ? normalized.slice(
        0,
        255,
      )
    : null;
}

async function extractVisitedPlaceEvidenceMetadata(
  filePath,
) {
  try {
    const metadata =
      await exifr.parse(
        filePath,
        {
          ifd0:
            true,

          exif:
            true,

          gps:
            true,

          xmp:
            true,

          iptc:
            false,

          icc:
            false,

          jfif:
            false,

          ihdr:
            false,

          makerNote:
            false,

          userComment:
            false,

          reviveValues:
            true,

          translateValues:
            true,

          mergeOutput:
            true,
        },
      );

    const latitude =
      normalizeCoordinate({
        value:
          metadata?.latitude,

        minimum:
          -90,

        maximum:
          90,
      });

    const longitude =
      normalizeCoordinate({
        value:
          metadata?.longitude,

        minimum:
          -180,

        maximum:
          180,
      });

    const capturedAt =
      normalizeDate(
        metadata
          ?.DateTimeOriginal ??
        metadata
          ?.CreateDate ??
        metadata
          ?.DateCreated ??
        null,
      );

    const make =
      normalizeText(
        metadata?.Make,
      );

    const model =
      normalizeText(
        metadata?.Model,
      );

    const software =
      normalizeText(
        metadata?.Software,
      );

    const offsetTimeOriginal =
      normalizeText(
        metadata
          ?.OffsetTimeOriginal,
      );

    const hasGps =
      latitude !== null &&
      longitude !== null;

    const hasCaptureTime =
      capturedAt !== null;

    const metadataPresent =
      hasGps ||
      hasCaptureTime ||
      make !== null ||
      model !== null ||
      software !== null;

    return {
      metadataRead:
        true,

      metadataPresent,

      hasGps,

      latitude,

      longitude,

      hasCaptureTime,

      capturedAt,

      offsetTimeOriginal,

      camera: {
        make,
        model,
      },

      software,
    };
  } catch {
    /*
     * Missing, damaged, or unsupported metadata is
     * inconclusive evidence, not an upload failure.
     */
    return {
      metadataRead:
        false,

      metadataPresent:
        false,

      hasGps:
        false,

      latitude:
        null,

      longitude:
        null,

      hasCaptureTime:
        false,

      capturedAt:
        null,

      offsetTimeOriginal:
        null,

      camera: {
        make:
          null,

        model:
          null,
      },

      software:
        null,
    };
  }
}

export {
  extractVisitedPlaceEvidenceMetadata,
};
