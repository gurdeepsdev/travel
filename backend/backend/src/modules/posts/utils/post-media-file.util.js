import {
    createHash,
} from "node:crypto";

import {
    createReadStream,
} from "node:fs";

import {
    stat,
} from "node:fs/promises";

import {
    basename,
} from "node:path";

import {
    fileTypeFromFile,
} from "file-type";

import AppError from "../../../core/errors/app-error.js";
import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

import {
    ALLOWED_POST_MEDIA_MIME_TYPES,
    MAX_POST_IMAGE_BYTES,
    MAX_POST_VIDEO_BYTES,
} from "../middleware/post-media-upload.middleware.js";

const COMPATIBLE_HEIF_MIME_TYPES =
    new Set([
        "image/heic",
        "image/heif",
    ]);

function createInvalidMediaError({
    declaredMimeType = null,
    detectedMimeType = null,
    reason,
}) {
    return new AppError({
        code:
            ErrorCodes.POST
                .MEDIA_INVALID_TYPE,

        message:
            "Post media type is not supported.",

        statusCode:
            HttpStatus
                .UNSUPPORTED_MEDIA_TYPE,

        details: {
            declaredMimeType,
            detectedMimeType,
            reason,
        },
    });
}

function normalizeOriginalFilename({
    originalname,
    fallbackExtension,
}) {
    const normalized =
        basename(
            String(
                originalname ?? "",
            ),
        )
            .replaceAll(
                "\0",
                "",
            )
            .trim();

    if (normalized) {
        return normalized.slice(
            0,
            255,
        );
    }

    return (
        `upload.${fallbackExtension}`
    );
}

function mimeTypesAreCompatible({
    declaredMimeType,
    detectedMimeType,
}) {
    if (
        declaredMimeType ===
        detectedMimeType
    ) {
        return true;
    }

    return (
        COMPATIBLE_HEIF_MIME_TYPES
            .has(declaredMimeType) &&
        COMPATIBLE_HEIF_MIME_TYPES
            .has(detectedMimeType)
    );
}

async function calculateChecksum(
    filePath,
) {
    const hash =
        createHash("sha256");

    const stream =
        createReadStream(filePath);

    for await (
        const chunk of stream
    ) {
        hash.update(chunk);
    }

    return hash.digest("hex");
}

async function inspectPostMediaFile({
    file,
    fileIndex,
}) {
    if (!file?.path) {
        throw new AppError({
            code:
                ErrorCodes.POST
                    .MEDIA_UPLOAD_FAILED,

            message:
                "Post media temporary file is unavailable.",

            statusCode:
                HttpStatus
                    .INTERNAL_SERVER_ERROR,

            details: null,
        });
    }

    const fileStats =
        await stat(file.path);

    const detectedType =
        await fileTypeFromFile(
            file.path,
        );

    if (!detectedType) {
        throw createInvalidMediaError({
            declaredMimeType:
                file.mimetype ?? null,

            reason:
                "FILE_SIGNATURE_NOT_RECOGNIZED",
        });
    }

    if (
        !ALLOWED_POST_MEDIA_MIME_TYPES
            .has(detectedType.mime)
    ) {
        throw createInvalidMediaError({
            declaredMimeType:
                file.mimetype ?? null,

            detectedMimeType:
                detectedType.mime,

            reason:
                "DETECTED_TYPE_NOT_ALLOWED",
        });
    }

    if (
        !mimeTypesAreCompatible({
            declaredMimeType:
                file.mimetype,

            detectedMimeType:
                detectedType.mime,
        })
    ) {
        throw createInvalidMediaError({
            declaredMimeType:
                file.mimetype ?? null,

            detectedMimeType:
                detectedType.mime,

            reason:
                "DECLARED_TYPE_DOES_NOT_MATCH_FILE_SIGNATURE",
        });
    }

    const mediaType =
        detectedType.mime
            .startsWith("image/")
            ? "IMAGE"
            : "VIDEO";

    const maximumBytes =
        mediaType === "IMAGE"
            ? MAX_POST_IMAGE_BYTES
            : MAX_POST_VIDEO_BYTES;

    if (
        fileStats.size >
        maximumBytes
    ) {
        throw new AppError({
            code:
                ErrorCodes.POST
                    .MEDIA_TOO_LARGE,

            message:
                `Post ${mediaType.toLowerCase()} is too large.`,

            statusCode:
                HttpStatus
                    .PAYLOAD_TOO_LARGE,

            details: {
                fileIndex,
                actualBytes:
                    fileStats.size,

                maximumBytes,
            },
        });
    }

    const checksum =
        await calculateChecksum(
            file.path,
        );

    return {
        fileIndex,

        temporaryPath:
            file.path,

        originalFilename:
            normalizeOriginalFilename({
                originalname:
                    file.originalname,

                fallbackExtension:
                    detectedType.ext,
            }),

        mimeType:
            detectedType.mime,

        extension:
            detectedType.ext,

        fileSize:
            fileStats.size,

        checksum,

        mediaType,
    };
}

async function inspectPostMediaFiles(
    files,
) {
    const normalizedFiles =
        Array.isArray(files)
            ? files
            : [];

    const inspectedFiles = [];

    // Process sequentially to avoid reading multiple
    // large video files from disk simultaneously.
    for (
        let fileIndex = 0;
        fileIndex <
        normalizedFiles.length;
        fileIndex += 1
    ) {
        inspectedFiles.push(
            await inspectPostMediaFile({
                file:
                    normalizedFiles[
                    fileIndex
                    ],

                fileIndex,
            }),
        );
    }

    return inspectedFiles;
}

export {
    calculateChecksum,
    inspectPostMediaFile,
    inspectPostMediaFiles,
};