export default class AppError extends Error {

    constructor({
        code,
        message,
        statusCode,
        details = null,
        cause = null
    }) {

        super(message);

        this.name = this.constructor.name;

        this.code = code;

        this.statusCode = statusCode;

        this.details = details;

        this.cause = cause;

        Error.captureStackTrace?.(
            this,
            this.constructor
        );
    }

    toJSON() {

        return {

            code: this.code,

            message: this.message,

            statusCode: this.statusCode,

            details: this.details
        };

    }

}