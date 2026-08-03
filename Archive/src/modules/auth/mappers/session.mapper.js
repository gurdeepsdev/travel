class SessionMapper {

    toResponse(session, currentSessionId) {

        return {

            id: session.id,

            current: session.id === currentSessionId,

            deviceName: session.device_name,

            deviceType: session.device_type,

            ipAddress: session.ip_address,

            userAgent: session.user_agent,

            createdAt: session.created_at,

            expiresAt: session.expires_at

        };

    }

    toCollection(sessions, currentSessionId) {

        return sessions.map(
            (session) =>
                this.toResponse(
                    session,
                    currentSessionId
                )
        );

    }

}

export default new SessionMapper();