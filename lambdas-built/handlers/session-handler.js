"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const joi_1 = __importDefault(require("joi"));
const session_service_1 = require("../services/session-service");
const response_builder_1 = require("../shared/response-builder");
const auth_middleware_1 = require("../shared/auth-middleware");
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
// Core session handler - focused on business logic only
const sessionHandler = async (event, userId) => {
    const { route } = (0, auth_middleware_1.extractRequestInfo)(event);
    console.log(`[SESSION] Handling ${route} for user ${userId}`);
    switch (route) {
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
};
// Export the handler wrapped with authentication middleware
exports.handler = (0, auth_middleware_1.withAuth)(sessionHandler);
async function handleCreateSession(event, userId) {
    const { body } = (0, auth_middleware_1.extractRequestInfo)(event);
    console.log(`[SESSION] Creating session for user ${userId}`);
    if (!body) {
        return response_builder_1.ResponseBuilder.validation('Request body is required');
    }
    const { error, value } = sessionCreateSchema.validate(body);
    if (error) {
        return response_builder_1.ResponseBuilder.validation(error.details[0].message);
    }
    const session = await sessionService.createSession(userId, value);
    console.log(`[SESSION] Created session ${session.sessionId} for user ${userId}`);
    return response_builder_1.ResponseBuilder.success({ session });
}
async function handleGetUserSessions(event, userId) {
    const { queryStringParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    console.log(`[SESSION] Getting sessions for user ${userId}`);
    const limit = parseInt(queryStringParameters.limit || '10');
    const sessions = await sessionService.getUserSessions(userId, limit);
    console.log(`[SESSION] Retrieved ${sessions.length} sessions for user ${userId}`);
    return response_builder_1.ResponseBuilder.success({ sessions, total: sessions.length });
}
async function handleGetSession(event, userId) {
    const { pathParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    const sessionId = pathParameters.sessionId;
    if (!sessionId) {
        return response_builder_1.ResponseBuilder.validation('Session ID is required');
    }
    console.log(`[SESSION] Getting session ${sessionId} for user ${userId}`);
    const session = await sessionService.getSession(sessionId, userId);
    if (!session) {
        return response_builder_1.ResponseBuilder.notFound('Session not found');
    }
    return response_builder_1.ResponseBuilder.success({ session });
}
async function handleUpdateSession(event, userId) {
    const { pathParameters, body } = (0, auth_middleware_1.extractRequestInfo)(event);
    const sessionId = pathParameters.sessionId;
    if (!sessionId) {
        return response_builder_1.ResponseBuilder.validation('Session ID is required');
    }
    if (!body) {
        return response_builder_1.ResponseBuilder.validation('Request body is required');
    }
    console.log(`[SESSION] Updating session ${sessionId} for user ${userId}`);
    const updatedSession = await sessionService.updateSession(sessionId, userId, body);
    if (!updatedSession) {
        return response_builder_1.ResponseBuilder.notFound('Session not found');
    }
    return response_builder_1.ResponseBuilder.success({ session: updatedSession });
}
async function handleDeleteSession(event, userId) {
    const { pathParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    const sessionId = pathParameters.sessionId;
    if (!sessionId) {
        return response_builder_1.ResponseBuilder.validation('Session ID is required');
    }
    console.log(`[SESSION] Deleting session ${sessionId} for user ${userId}`);
    const deleted = await sessionService.deleteSession(sessionId, userId);
    if (!deleted) {
        return response_builder_1.ResponseBuilder.notFound('Session not found');
    }
    console.log(`[SESSION] Deleted session ${sessionId} for user ${userId}`);
    return response_builder_1.ResponseBuilder.success({ message: 'Session deleted successfully' });
}
async function handleSubmitAnswer(event, userId) {
    const { pathParameters, body } = (0, auth_middleware_1.extractRequestInfo)(event);
    const sessionId = pathParameters.sessionId;
    if (!sessionId) {
        return response_builder_1.ResponseBuilder.validation('Session ID is required');
    }
    if (!body) {
        return response_builder_1.ResponseBuilder.validation('Request body is required');
    }
    const { error, value } = answerSchema.validate(body);
    if (error) {
        return response_builder_1.ResponseBuilder.validation(error.details[0].message);
    }
    console.log(`[SESSION] Submitting answer for session ${sessionId}, question ${value.questionId}, user ${userId}`);
    try {
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
    const { body } = (0, auth_middleware_1.extractRequestInfo)(event);
    console.log(`[SESSION] Creating adaptive session for user ${userId}`);
    if (!body) {
        return response_builder_1.ResponseBuilder.validation('Request body is required');
    }
    const { error, value } = sessionCreateSchema.validate(body);
    if (error) {
        return response_builder_1.ResponseBuilder.validation(error.details[0].message);
    }
    const result = await sessionService.createAdaptiveSession(userId, value);
    console.log(`[SESSION] Created adaptive session for user ${userId}`);
    return response_builder_1.ResponseBuilder.success(result);
}
async function handleCompleteSession(event, userId) {
    const { pathParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    const sessionId = pathParameters.sessionId;
    if (!sessionId) {
        return response_builder_1.ResponseBuilder.validation('Session ID is required');
    }
    console.log(`[SESSION] Completing session ${sessionId} for user ${userId}`);
    const completedSession = await sessionService.completeSession(sessionId, userId);
    if (!completedSession) {
        return response_builder_1.ResponseBuilder.notFound('Session not found');
    }
    // Get session statistics for the response
    const stats = await sessionService.getSessionStats(sessionId, userId);
    console.log(`[SESSION] Completed session ${sessionId} for user ${userId}`);
    return response_builder_1.ResponseBuilder.success({
        session: completedSession,
        statistics: stats,
    });
}
//# sourceMappingURL=session-handler.js.map