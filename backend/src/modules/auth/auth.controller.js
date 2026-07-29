import AuthService from "./auth.service.js";
import Response from "../../core/response/index.js";
import ViewerMapper from "./mappers/viewer.mapper.js";
import SessionMapper from "./mappers/session.mapper.js";

class AuthController {

    async sendOtp(req, res, next) {

        try {

            const result = await AuthService.sendOtp(req.body);

            return Response.success(

                res,

                result,

                "OTP sent successfully."

            );

        } catch (error) {

            next(error);

        }

    }


 

    async verifyOtp(req, res, next) {

        try {
    
            const result = await AuthService.verifyOtp({
    
                provider: req.body.provider,
    
                identifier: req.body.identifier,
    
                otp: req.body.otp,
    
                deviceName: req.headers["x-device-name"] ?? null,
    
                deviceType: req.headers["x-device-type"] ?? null,
    
                ipAddress: req.ip,
    
                userAgent: req.headers["user-agent"] ?? null
    
            });
    
            return Response.success(
    
                res,
    
                result,
    
                "Login successful."
    
            );
    
        } catch (error) {
    
            next(error);
    
        }
    
    }
    async me(req, res) {

        const viewer = ViewerMapper.toResponse({
    
            user: req.user,
    
            profile: req.profile,
    
            identity: req.identity
    
        });
    
        return Response.success(
    
            res,
    
            {
    
                viewer
    
            },
    
            "Current user fetched successfully."
    
        );
    
    }
    // async refresh(req, res) {
        
    //     const {
    
    //         user,
    
    //         profile,
    
    //         identity,
    
    //         accessToken,
    
    //         refreshToken
    
    //     } = await AuthService.refresh({
    
    //         refreshToken: req.body.refreshToken
    
    //     });
    
    //     const viewer = ViewerMapper.toResponse({
    
    //         user,
    
    //         profile,
    
    //         identity
    
    //     });
    
    //     return Response.success(
    
    //         res,
    
    //         {
    
    //             viewer,
    
    //             tokens: {
    
    //                 accessToken,
    
    //                 refreshToken
    
    //             }
    
    //         },
    
    //         "Token refreshed successfully."
    
    //     );
    
    // }

    async refresh(req, res, next) {

        try {
    
            const {
    
                user,
    
                profile,
    
                identity,
    
                accessToken,
    
                refreshToken
    
            } = await AuthService.refresh({
    
                refreshToken: req.body.refreshToken
    
            });
    
            const viewer = ViewerMapper.toResponse({
    
                user,
    
                profile,
    
                identity
    
            });
    
            return Response.success(
    
                res,
    
                {
    
                    viewer,
    
                    tokens: {
    
                        accessToken,
    
                        refreshToken
    
                    }
    
                },
    
                "Token refreshed successfully."
    
            );
    
        } catch (error) {
    
            next(error);
    
        }
    
    }
    async logout(req, res) {

        await AuthService.logout({
    
            sessionId: req.session.id
    
        });
    
        return Response.success(
    
            res,
    
            null,
    
            "Logout successful."
    
        );
    
    }

    async logoutAll(req, res) {

        await AuthService.logoutAll({
    
            userId: req.user.id
    
        });
    
        return Response.success(
    
            res,
    
            null,
    
            "Logged out from all devices successfully."
    
        );
    
    }

    async getSessions(req, res) {

        const sessions = await AuthService.getSessions({
    
            userId: req.user.id
    
        });
    
        return Response.success(
    
            res,
    
            {
    
                sessions: SessionMapper.toCollection(
    
                    sessions,
    
                    req.session.id
    
                )
    
            },
    
            "Sessions fetched successfully."
    
        );
    
    }

    async revokeSession(req, res) {

        await AuthService.revokeSession({
    
            sessionId: req.params.sessionId,
    
            userId: req.user.id
    
        });
    
        return Response.success(
    
            res,
    
            null,
    
            "Session revoked successfully."
    
        );
    
    }

}

export default new AuthController();