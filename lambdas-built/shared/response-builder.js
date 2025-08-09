"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseBuilder = void 0;
class ResponseBuilder {
    static success(data, statusCode = 200) {
        return {
            statusCode,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            },
            body: JSON.stringify({
                success: true,
                data,
            }),
        };
    }
    static error(message, statusCode = 500) {
        return {
            statusCode,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            },
            body: JSON.stringify({
                success: false,
                error: message,
            }),
        };
    }
    static validation(message) {
        return this.error(message, 400);
    }
    static unauthorized(message = 'Unauthorized') {
        return this.error(message, 401);
    }
    static forbidden(message = 'Forbidden') {
        return this.error(message, 403);
    }
    static notFound(message = 'Not Found') {
        return this.error(message, 404);
    }
}
exports.ResponseBuilder = ResponseBuilder;
//# sourceMappingURL=response-builder.js.map