/**
 * OTP Provider Interface
 *
 * Every OTP provider MUST implement this contract.
 *
 * Methods:
 *
 *  name()    -> Returns provider name
 *  health()  -> Returns provider health
 *  send()    -> Sends OTP
 *  verify()  -> Optional provider-side verification
 *
 */

export default class OtpProvider {

    name() {

        throw new Error("name() not implemented");

    }

    async health() {

        throw new Error("health() not implemented");

    }

    async send() {

        throw new Error("send() not implemented");

    }

    async verify() {

        throw new Error("verify() not implemented");

    }

}