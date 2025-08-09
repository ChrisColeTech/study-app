"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const exam_service_1 = require("../services/exam-service");
const response_builder_1 = require("../shared/response-builder");
const examService = new exam_service_1.ExamService();
const handler = async (event) => {
    try {
        const { httpMethod, resource, pathParameters, queryStringParameters } = event;
        const userId = event.requestContext.authorizer?.userId;
        if (!userId) {
            return response_builder_1.ResponseBuilder.unauthorized('User not authenticated');
        }
        // Handle OPTIONS request for CORS
        if (httpMethod === 'OPTIONS') {
            return response_builder_1.ResponseBuilder.success('', 200);
        }
        switch (`${httpMethod} ${resource}`) {
            case 'GET /api/v1/exams':
                return await handleGetAllExams(event);
            case 'GET /api/v1/exams/{examId}':
                return await handleGetExamById(event);
            case 'GET /api/v1/exams/{examId}/topics':
                return await handleGetExamTopics(event);
            default:
                return response_builder_1.ResponseBuilder.notFound('Route not found');
        }
    }
    catch (error) {
        console.error('Exam handler error:', error);
        return response_builder_1.ResponseBuilder.error(error instanceof Error ? error.message : 'Internal server error');
    }
};
exports.handler = handler;
async function handleGetAllExams(event) {
    try {
        const queryParams = event.queryStringParameters || {};
        const provider = queryParams.provider;
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
    catch (error) {
        throw error;
    }
}
async function handleGetExamById(event) {
    try {
        const examId = event.pathParameters?.examId;
        if (!examId) {
            return response_builder_1.ResponseBuilder.validation('Exam ID is required');
        }
        const queryParams = event.queryStringParameters || {};
        const providerId = queryParams.provider;
        const result = await examService.getExamById(examId, providerId);
        if (!result) {
            return response_builder_1.ResponseBuilder.notFound('Exam not found');
        }
        return response_builder_1.ResponseBuilder.success(result);
    }
    catch (error) {
        throw error;
    }
}
async function handleGetExamTopics(event) {
    try {
        const examId = event.pathParameters?.examId;
        if (!examId) {
            return response_builder_1.ResponseBuilder.validation('Exam ID is required');
        }
        const queryParams = event.queryStringParameters || {};
        const providerId = queryParams.provider;
        const result = await examService.getExamTopics(examId, providerId);
        if (!result) {
            return response_builder_1.ResponseBuilder.notFound('Exam topics not found');
        }
        return response_builder_1.ResponseBuilder.success(result);
    }
    catch (error) {
        throw error;
    }
}
//# sourceMappingURL=exam-handler.js.map