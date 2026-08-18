class ReportsMapper {
  toResponse(row) {
    if (!row) {
      return null;
    }

    const isUserReport =
      Boolean(
        row.reported_user_id,
      );

    return {
      report: {
        id:
          row.id,

        target: isUserReport
          ? {
              type:
                "USER",
              userId:
                row.reported_user_id,
            }
          : {
              type:
                "POST",
              postId:
                row.reported_post_id,
            },

        reasonCode:
          row.reason_code,

        description:
          row.description ?? null,

        status:
          row.status,

        createdAt:
          row.created_at,

        updatedAt:
          row.updated_at,
      },
    };
  }
}

export default new ReportsMapper();
