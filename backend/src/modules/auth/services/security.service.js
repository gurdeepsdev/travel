import LoginHistoryRepository from "../repositories/login-history.repository.js";
import SecurityEventsRepository from "../repositories/security-events.repository.js";

class SecurityService {

    async loginSuccess({

        user,

        provider,

        identifier,

        ipAddress = null,

        userAgent = null

    }) {

        await LoginHistoryRepository.create({

            userId: user.id,

            identifier,

            provider,

            ipAddress,

            userAgent,

            status: "SUCCESS"

        });

        await SecurityEventsRepository.create({

            userId: user.id,

            eventType: "LOGIN_SUCCESS",

            ipAddress,

            userAgent,

            metadata: {
                provider,
                identifier
            }

        });

    }

    async loginFailure({

        provider,

        identifier,

        ipAddress = null,

        userAgent = null,

        reason

    }) {

        await LoginHistoryRepository.create({

            identifier,

            provider,

            ipAddress,

            userAgent,

            status: "FAILED",

            failureReason: reason

        });

        await SecurityEventsRepository.create({

            eventType: "LOGIN_FAILED",

            ipAddress,

            userAgent,

            metadata: {
                provider,
                identifier,
                reason
            }

        });

    }

}

export default new SecurityService();