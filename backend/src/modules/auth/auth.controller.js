import AuthService from "./auth.service.js";
import Response from "../../core/response/index.js";

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

}

export default new AuthController();