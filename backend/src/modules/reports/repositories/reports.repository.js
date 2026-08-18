import Database from "../../../database/database-manager.js";

class ReportsRepository {
  async findReportableUser({
    reportedUserId,
  }) {
    const sql = `
      SELECT
        auth_user.id,
        profile.username

      FROM auth.users auth_user

      INNER JOIN users.profiles profile
        ON profile.user_id =
          auth_user.id

      WHERE auth_user.id =
          $1::uuid

        AND auth_user.status =
          'ACTIVE'

        AND profile.deleted_at
          IS NULL

      LIMIT 1
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          reportedUserId,
        ],
      );

    return rows[0] ?? null;
  }

  async saveUserReport({
    reporterUserId,
    reportedUserId,
    reasonCode,
    description = null,
  }) {
    const sql = `
      INSERT INTO users.users_reports
        AS report (
          reporter_user_id,
          reported_user_id,
          reason_code,
          description
        )

      VALUES (
        $1::uuid,
        $2::uuid,
        $3::varchar,
        $4::varchar
      )

      ON CONFLICT (
        reporter_user_id,
        reported_user_id
      )

      WHERE reported_user_id
          IS NOT NULL

        AND status IN (
          'PENDING',
          'UNDER_REVIEW'
        )

      DO UPDATE SET
        updated_at =
          report.updated_at

      RETURNING
        report.id,
        report.reporter_user_id,
        report.reported_user_id,
        report.reported_post_id,
        report.reason_code,
        report.description,
        report.status,
        report.created_at,
        report.updated_at
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          reporterUserId,
          reportedUserId,
          reasonCode,
          description,
        ],
      );

    return rows[0] ?? null;
  }

  async savePostReport({
    reporterUserId,
    reportedPostId,
    reasonCode,
    description = null,
  }) {
    const sql = `
      INSERT INTO users.users_reports
        AS report (
          reporter_user_id,
          reported_post_id,
          reason_code,
          description
        )

      VALUES (
        $1::uuid,
        $2::uuid,
        $3::varchar,
        $4::varchar
      )

      ON CONFLICT (
        reporter_user_id,
        reported_post_id
      )

      WHERE reported_post_id
          IS NOT NULL

        AND status IN (
          'PENDING',
          'UNDER_REVIEW'
        )

      DO UPDATE SET
        updated_at =
          report.updated_at

      RETURNING
        report.id,
        report.reporter_user_id,
        report.reported_user_id,
        report.reported_post_id,
        report.reason_code,
        report.description,
        report.status,
        report.created_at,
        report.updated_at
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          reporterUserId,
          reportedPostId,
          reasonCode,
          description,
        ],
      );

    return rows[0] ?? null;
  }
}

export default new ReportsRepository();
