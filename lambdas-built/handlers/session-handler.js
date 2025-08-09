"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const joi_1 = __importDefault(require("joi"));
const session_service_1 = require("../services/session-service");
const response_builder_1 = require("../shared/response-builder");
const sessionService = new session_service_1.SessionService();
const sessionCreateSchema = joi_1.default.object({
    provider: joi_1.default.string().required(),
    exam: joi_1.default.string().required(),
    questionCount: joi_1.default.number().integer().min(1).max(100).required(),
});
const answerSchema = joi_1.default.object({
    questionId: joi_1.default.string().required(),
    answer: joi_1.default.string().required(),
});
const handler = async (event) => {
    try {
        const { httpMethod, resource, pathParameters } = event;
        const userId = event.requestContext.authorizer?.userId;
        if (!userId) {
            return response_builder_1.ResponseBuilder.unauthorized('User not authenticated');
        }
        // Handle OPTIONS request for CORS
        if (httpMethod === 'OPTIONS') {
            return response_builder_1.ResponseBuilder.success('', 200);
        }
        switch (`${httpMethod} ${resource}`) {
            case 'POST /api/v1/sessions':
                return await handleCreateSession(event, userId);
            case 'GET /api/v1/sessions':
                return await handleGetUserSessions(event, userId);
            case 'GET /api/v1/sessions/{sessionId}':
                return await handleGetSession(event, userId);
            case 'PUT /api/v1/sessions/{sessionId}':
                return await handleUpdateSession(event, userId);
            case 'DELETE /api/v1/sessions/{sessionId}':
                return await handleDeleteSession(event, userId);
            case 'POST /api/v1/sessions/{sessionId}/answers':
                return await handleSubmitAnswer(event, userId);
            case 'POST /api/v1/sessions/adaptive':
                return await handleCreateAdaptiveSession(event, userId);
            case 'POST /api/v1/sessions/{sessionId}/complete':
                return await handleCompleteSession(event, userId);
            default:
                return response_builder_1.ResponseBuilder.notFound('Route not found');
        }
    }
    catch (error) {
        console.error('Session handler error:', error);
        return response_builder_1.ResponseBuilder.error(error instanceof Error ? error.message : 'Internal server error');
    }
};
exports.handler = handler;
async function handleCreateSession(event, userId) {
    try {
        if (!event.body) {
            return response_builder_1.ResponseBuilder.validation('Request body is required');
        }
        const body = JSON.parse(event.body);
        const { error, value } = sessionCreateSchema.validate(body);
        if (error) {
            return response_builder_1.ResponseBuilder.validation(error.details[0].message);
        }
        const session = await sessionService.createSession(userId, value);
        return response_builder_1.ResponseBuilder.success({ session });
    }
    catch (error) {
        throw error;
    }
}
async function handleGetUserSessions(event, userId) {
    try {
        const queryParams = event.queryStringParameters || {};
        const limit = parseInt(queryParams.limit || '10');
        const sessions = await sessionService.getUserSessions(userId, limit);
        return response_builder_1.ResponseBuilder.success({ sessions, total: sessions.length });
    }
    catch (error) {
        throw error;
    }
}
async function handleGetSession(event, userId) {
    try {
        const sessionId = event.pathParameters?.sessionId;
        if (!sessionId) {
            return response_builder_1.ResponseBuilder.validation('Session ID is required');
        }
        const session = await sessionService.getSession(sessionId, userId);
        if (!session) {
            return response_builder_1.ResponseBuilder.notFound('Session not found');
        }
        return response_builder_1.ResponseBuilder.success({ session });
    }
    catch (error) {
        throw error;
    }
}
async function handleUpdateSession(event, userId) {
    try {
        const sessionId = event.pathParameters?.sessionId;
        if (!sessionId) {
            return response_builder_1.ResponseBuilder.validation('Session ID is required');
        }
        if (!event.body) {
            return response_builder_1.ResponseBuilder.validation('Request body is required');
        }
        const updates = JSON.parse(event.body);
        const updatedSession = await sessionService.updateSession(sessionId, userId, updates);
        if (!updatedSession) {
            return response_builder_1.ResponseBuilder.notFound('Session not found');
        }
        return response_builder_1.ResponseBuilder.success({ session: updatedSession });
    }
    catch (error) {
        throw error;
    }
}
async function handleDeleteSession(event, userId) {
    try {
        const sessionId = event.pathParameters?.sessionId;
        if (!sessionId) {
            return response_builder_1.ResponseBuilder.validation('Session ID is required');
        }
        const deleted = await sessionService.deleteSession(sessionId, userId);
        if (!deleted) {
            return response_builder_1.ResponseBuilder.notFound('Session not found');
        }
        return response_builder_1.ResponseBuilder.success({ message: 'Session deleted successfully' });
    }
    catch (error) {
        throw error;
    }
}
async function handleSubmitAnswer(event, userId) {
    try {
        const sessionId = event.pathParameters?.sessionId;
        if (!sessionId) {
            return response_builder_1.ResponseBuilder.validation('Session ID is required');
        }
        if (!event.body) {
            return response_builder_1.ResponseBuilder.validation('Request body is required');
        }
        const body = JSON.parse(event.body);
        const { error, value } = answerSchema.validate(body);
        if (error) {
            return response_builder_1.ResponseBuilder.validation(error.details[0].message);
        }
        const result = await sessionService.submitAnswer(sessionId, userId, value);
        return response_builder_1.ResponseBuilder.success(result);
    }
    catch (error) {
        if (error instanceof Error &&
            (error.message === 'Session not found' || error.message === 'Session is already completed')) {
            return response_builder_1.ResponseBuilder.validation(error.message);
        }
        throw error;
    }
}
async function handleCreateAdaptiveSession(event, userId) {
    try {
        if (!event.body) {
            return response_builder_1.ResponseBuilder.validation('Request body is required');
        }
        const body = JSON.parse(event.body);
        const { error, value } = sessionCreateSchema.validate(body);
        if (error) {
            return response_builder_1.ResponseBuilder.validation(error.details[0].message);
        }
        const result = await sessionService.createAdaptiveSession(userId, value);
        return response_builder_1.ResponseBuilder.success(result);
    }
    catch (error) {
        throw error;
    }
}
async function handleCompleteSession(event, userId) {
    try {
        const sessionId = event.pathParameters?.sessionId;
        if (!sessionId) {
            return response_builder_1.ResponseBuilder.validation('Session ID is required');
        }
        const completedSession = await sessionService.completeSession(sessionId, userId);
        if (!completedSession) {
            return response_builder_1.ResponseBuilder.notFound('Session not found');
        }
        // Get session statistics for the response
        const stats = await sessionService.getSessionStats(sessionId, userId);
        return response_builder_1.ResponseBuilder.success({
            session: completedSession,
            statistics: stats,
        });
    }
    catch (error) {
        throw error;
    }
}
//# sourceMappingURL=session-handler.js.map