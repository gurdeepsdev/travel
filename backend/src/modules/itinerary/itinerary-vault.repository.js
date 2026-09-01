import Database from "../../database/database-manager.js";

class ItineraryVaultRepository {
  async findOwnedItineraryTrip({
    client = Database,
    itineraryId,
    userId,
  }) {
    const { rows } = await client.query(
      `
        SELECT
          itinerary.id AS itinerary_id,
          trip_record.id AS trip_id
        FROM itinerary.itineraries itinerary
        LEFT JOIN trip.trips trip_record
          ON trip_record.itinerary_id = itinerary.id
          AND trip_record.user_id = $2::uuid
        WHERE itinerary.id = $1::uuid
          AND itinerary.created_by = $2::uuid
          AND itinerary.deleted_at IS NULL
        LIMIT 1
      `,
      [itineraryId, userId],
    );
    return rows[0] ?? null;
  }

  async create({
    client,
    tripId,
    userId,
    assetId,
    input,
  }) {
    const { rows } = await client.query(
      `
        INSERT INTO trip.trip_documents (
          trip_id, owner_id, document_type,
          title, asset_id, document_number,
          issue_date, expiry_date,
          issuing_country_id, visibility,
          notes
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4,
          $5::uuid, $6, $7::date, $8::date,
          $9::uuid, 'PRIVATE', $10
        )
        RETURNING *
      `,
      [
        tripId,
        userId,
        input.documentType,
        input.title,
        assetId,
        input.documentNumber ?? null,
        input.issueDate ?? null,
        input.expiryDate ?? null,
        input.issuingCountryId ?? null,
        input.notes ?? null,
      ],
    );
    return rows[0];
  }

  async listOwned({
    itineraryId,
    userId,
    documentType = null,
  }) {
    const { rows } = await Database.query(
      `
        SELECT
          document.*,
          asset.original_filename,
          asset.mime_type,
          asset.extension,
          asset.file_size
        FROM trip.trip_documents document
        INNER JOIN trip.trips trip_record
          ON trip_record.id = document.trip_id
        INNER JOIN itinerary.itineraries itinerary
          ON itinerary.id = trip_record.itinerary_id
        INNER JOIN media.assets asset
          ON asset.id = document.asset_id
          AND asset.deleted_at IS NULL
        WHERE itinerary.id = $1::uuid
          AND itinerary.created_by = $2::uuid
          AND itinerary.deleted_at IS NULL
          AND document.owner_id = $2::uuid
          AND document.deleted_at IS NULL
          AND (
            $3::varchar IS NULL OR
            document.document_type = $3
          )
        ORDER BY document.created_at DESC,
          document.id DESC
      `,
      [itineraryId, userId, documentType],
    );
    return rows;
  }

  async deleteOwned({
    itineraryId,
    documentId,
    userId,
  }) {
    const { rows } =
      await Database.query(
        `
          UPDATE trip.trip_documents document
          SET
            deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          FROM trip.trips trip_record,
            itinerary.itineraries itinerary
          WHERE document.id = $2::uuid
            AND document.owner_id = $3::uuid
            AND document.deleted_at IS NULL
            AND trip_record.id = document.trip_id
            AND trip_record.user_id = $3::uuid
            AND itinerary.id = $1::uuid
            AND itinerary.id =
              trip_record.itinerary_id
            AND itinerary.created_by = $3::uuid
            AND itinerary.deleted_at IS NULL
          RETURNING
            document.id,
            itinerary.id AS itinerary_id,
            document.deleted_at
        `,
        [
          itineraryId,
          documentId,
          userId,
        ],
      );

    return rows[0] ?? null;
  }
}

export default new ItineraryVaultRepository();
