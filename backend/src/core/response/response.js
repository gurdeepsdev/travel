class Response {

    static success(res, data = null, message = "Success") {

        return res.status(200).json({

            success: true,

            message,

            data,

            requestId: res.req.context?.requestId ?? null,

            timestamp: new Date().toISOString()

        });

    }

    static created(res, data = null, message = "Created successfully") {

        return res.status(201).json({

            success: true,

            message,

            data,

            requestId: res.req.context?.requestId ?? null,

            timestamp: new Date().toISOString()

        });

    }

    static noContent(res) {

        return res.status(204).send();

    }

    static error(res, {

        statusCode,

        code,

        message,

        details = null

    }) {

        return res.status(statusCode).json({

            success: false,

            code,

            message,

            details,

            requestId: res.req.context?.requestId ?? null,

            timestamp: new Date().toISOString()

        });

    }

}

export default Response;