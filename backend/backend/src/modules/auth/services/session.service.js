// import crypto from "crypto";
import IdService from "../../../core/security/id.js";
import JwtService from "../../../core/security/jwt.js";
import HashService from "../../../core/security/hash.js";

import SessionsRepository from "../repositories/sessions.repository.js";

import InvalidRefreshTokenError
from "../../../core/errors/auth/invalid-refresh-token.error.js";

import SessionExpiredError
from "../../../core/errors/auth/session-expired.error.js";

class SessionService {

    async create({

        user,

        deviceName = null,

        deviceType = null,

        ipAddress = null,

        userAgent = null

    }) {

        // const sessionId = crypto.randomUUID();
        const sessionId = IdService.uuid();
        const accessToken = JwtService.generateAccessToken({

            sub: user.id,

            sid: sessionId,

            ver: 1

        });

        const refreshToken = JwtService.generateRefreshToken({

            sub: user.id,

            sid: sessionId,

            ver: 1

        });

        const refreshTokenHash =
            await HashService.hash(refreshToken);

        const expiresAt = new Date(

            Date.now() + (30 * 24 * 60 * 60 * 1000)

        );

        const session = await SessionsRepository.create({

            id: sessionId,
        
            userId: user.id,
        
            refreshTokenHash,
        
            deviceName,
        
            deviceType,
        
            ipAddress,
        
            userAgent,
        
            expiresAt
        
        });

        return {

            session,

            accessToken,

            refreshToken

        };

    }
 
    async refresh({

        refreshToken
    
    }) {
    
        const payload = JwtService.verifyRefreshToken(

            refreshToken
        
        );
    
        const session = await SessionsRepository.findBySessionId(
    
            payload.sid
    
        );
        if (!session) {

            throw new SessionExpiredError();
        
        }
    
        const isValid = await HashService.compare(
    
            refreshToken,
    
            session.refresh_token_hash
    
        );
    
        if (!isValid) {

            throw new InvalidRefreshTokenError();
        
        }
    
        const accessToken = JwtService.generateAccessToken({
    
            sub: session.user_id,
    
            sid: session.id,
    
            ver: 1
    
        });
    
        const newRefreshToken = JwtService.generateRefreshToken({
    
            sub: session.user_id,
    
            sid: session.id,
    
            ver: 1
    
        });
    
        const refreshTokenHash = await HashService.hash(
    
            newRefreshToken
    
        );
    
        const expiresAt = new Date(
    
            Date.now() + (30 * 24 * 60 * 60 * 1000)
    
        );
    
        await SessionsRepository.updateRefreshToken({
    
            id: session.id,
    
            refreshTokenHash,
    
            expiresAt
    
        });
    
        return {
    
            session,
    
            accessToken,
    
            refreshToken: newRefreshToken
    
        };
    
    }


    async logout({

        sessionId
    
    }) {
    
        await SessionsRepository.deleteBySessionId(
    
            sessionId
    
        );
    
    }

    async logoutAll({

        userId
    
    }) {
    
        await SessionsRepository.deleteAllByUserId(
    
            userId
    
        );
    
    }

    async getSessions({

        userId
    
    }) {
    
        return SessionsRepository.findByUserId(
    
            userId
    
        );
    
    }
    
    async revokeSession({
    
        sessionId,
    
        userId
    
    }) {
    
        await SessionsRepository.deleteUserSession({
    
            sessionId,
    
            userId
    
        });
    
    }

}

export default new SessionService();