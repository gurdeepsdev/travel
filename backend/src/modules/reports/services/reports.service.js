import AppError from "../../../core/errors/app-error.js";
import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

import PostAccessService from "../../posts/services/post-access.service.js";

import ReportsMapper from "../mappers/reports.mapper.js";
import ReportsRepository from "../repositories/reports.repository.js";

class ReportsService {
  async reportUser({
    reporterUserId,
    reportedUserId,
    reasonCode,
    description = null,
  }) {
    if (
      String(reporterUserId) ===
      String(reportedUserId)
    ) {
      throw this.createSelfReportError();
    }

    const target =
      await ReportsRepository
        .findReportableUser({
          reportedUserId,
        });

    if (!target) {
      throw this
        .createTargetNotAvailableError();
    }

    let report;

    try {
      report =
        await ReportsRepository
          .saveUserReport({
            reporterUserId,
            reportedUserId,
            reasonCode,
            description,
          });
    } catch (error) {
      if (
        error?.code ===
        "23503"
      ) {
        throw this
          .createTargetNotAvailableError();
      }

      throw error;
    }

    return ReportsMapper
      .toResponse(report);
  }

  async reportPost({
    reporterUserId,
    reportedPostId,
    reasonCode,
    description = null,
  }) {
    let post;

    try {
      post =
        await PostAccessService
          .assertCanInteract({
            postId:
              reportedPostId,

            userId:
              reporterUserId,
          });
    } catch (error) {
      if (
        error?.code ===
        ErrorCodes.POST.NOT_FOUND
      ) {
        throw this
          .createTargetNotAvailableError();
      }

      throw error;
    }

    if (
      String(post.user_id) ===
      String(reporterUserId)
    ) {
      throw this.createSelfReportError();
    }

    let report;

    try {
      report =
        await ReportsRepository
          .savePostReport({
            reporterUserId,
            reportedPostId,
            reasonCode,
            description,
          });
    } catch (error) {
      if (
        error?.code ===
        "23503"
      ) {
        throw this
          .createTargetNotAvailableError();
      }

      throw error;
    }

    return ReportsMapper
      .toResponse(report);
  }

  createTargetNotAvailableError() {
    return new AppError({
      code:
        ErrorCodes.REPORT
          .TARGET_NOT_AVAILABLE,

      message:
        "The report target was not found or is not available.",

      statusCode:
        HttpStatus.NOT_FOUND,
    });
  }

  createSelfReportError() {
    return new AppError({
      code:
        ErrorCodes.REPORT
          .SELF_REPORT_NOT_ALLOWED,

      message:
        "You cannot report your own profile or post.",

      statusCode:
        HttpStatus.BAD_REQUEST,
    });
  }
}

export default new ReportsService();
