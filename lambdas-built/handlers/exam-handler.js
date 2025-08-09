"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const exam_service_1 = require("../services/exam-service");
const response_builder_1 = require("../shared/response-builder");
const auth_middleware_1 = require("../shared/auth-middleware");
const examService = new exam_service_1.ExamService();
// Core exam handler - focused on business logic only
const examHandler = async (event, userId) => {
    const { route } = (0, auth_middleware_1.extractRequestInfo)(event);
    console.log(`[EXAM] Handling ${route} for user ${userId}`);
    switch (route) {
        case 'GET /api/v1/exams':
            return await handleGetAllExams(event, userId);
        case 'GET /api/v1/exams/{examId}':
            return await handleGetExamById(event, userId);
        case 'GET /api/v1/exams/{examId}/topics':
            return await handleGetExamTopics(event, userId);
        default:
            return response_builder_1.ResponseBuilder.notFound('Route not found');
    }
};
// Export the handler wrapped with authentication middleware
exports.handler = (0, auth_middleware_1.withAuth)(examHandler);
async function handleGetAllExams(event, userId) {
    const { queryStringParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    console.log(`[EXAM] Getting all exams for user ${userId}`);
    const provider = queryStringParameters.provider;
    if (provider) {
        // Get exams for specific provider
        const result = await examService.getExamsByProvider(provider);
        if (!result) {
            return response_builder_1.ResponseBuilder.notFound('Provider not found');
        }
        return response_builder_1.ResponseBuilder.success(result);
    }
    else {
        // Get all exams across providers
        const result = await examService.getAllExams();
        return response_builder_1.ResponseBuilder.success(result);
    }
}
async function handleGetExamById(event, userId) {
    const { pathParameters, queryStringParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    const examId = pathParameters.examId;
    if (!examId) {
        return response_builder_1.ResponseBuilder.validation('Exam ID is required');
    }
    const providerId = queryStringParameters.provider;
    console.log(`[EXAM] Getting exam ${examId} (provider: ${providerId}) for user ${userId}`);
    const result = await examService.getExamById(examId, providerId);
    if (!result) {
        return response_builder_1.ResponseBuilder.notFound('Exam not found');
    }
    return response_builder_1.ResponseBuilder.success(result);
}
async function handleGetExamTopics(event, userId) {
    const { pathParameters, queryStringParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    const examId = pathParameters.examId;
    if (!examId) {
        return response_builder_1.ResponseBuilder.validation('Exam ID is required');
    }
    const providerId = queryStringParameters.provider;
    console.log(`[EXAM] Getting topics for exam ${examId} (provider: ${providerId}) for user ${userId}`);
    const result = await examService.getExamTopics(examId, providerId);
    if (!result) {
        return response_builder_1.ResponseBuilder.notFound('Exam topics not found');
    }
    return response_builder_1.ResponseBuilder.success(result);
}
//# sourceMappingURL=exam-handler.js.map