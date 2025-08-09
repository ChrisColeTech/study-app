"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const joi_1 = __importDefault(require("joi"));
const question_service_1 = require("../services/question-service");
const response_builder_1 = require("../shared/response-builder");
const questionService = new question_service_1.QuestionService();
const questionsQuerySchema = joi_1.default.object({
    provider: joi_1.default.string().optional(),
    exam: joi_1.default.string().optional(),
    topics: joi_1.default.alternatives().try(joi_1.default.array().items(joi_1.default.string()), joi_1.default.string()).optional(),
    difficulty: joi_1.default.string().valid('easy', 'medium', 'hard').optional(),
    limit: joi_1.default.number().integer().min(1).max(100).optional(),
    offset: joi_1.default.number().integer().min(0).optional(),
});
const searchSchema = joi_1.default.object({
    query: joi_1.default.string().min(1).required(),
    provider: joi_1.default.string().optional(),
    exam: joi_1.default.string().optional(),
    limit: joi_1.default.number().integer().min(1).max(50).optional(),
});
const handler = async (event) => {
    try {
        const { httpMethod, resource, pathParameters } = event;
        // Handle OPTIONS request for CORS
        if (httpMethod === 'OPTIONS') {
            return response_builder_1.ResponseBuilder.success('', 200);
        }
        // Debug: Log request context to see what authorizer data is available
        console.log('Question handler - Request context:', JSON.stringify(event.requestContext, null, 2));
        console.log('Question handler - Authorizer data:', JSON.stringify(event.requestContext.authorizer, null, 2));
        // Check authorization
        const userId = event.requestContext.authorizer?.userId;
        console.log('Question handler - Extracted userId:', userId);
        if (!userId) {
            return response_builder_1.ResponseBuilder.unauthorized('User not authenticated');
        }
        switch (`${httpMethod} ${resource}`) {
            case 'GET /api/v1/questions':
                return await handleGetQuestions(event);
            case 'POST /api/v1/questions/search':
                return await handleSearchQuestions(event);
            case 'GET /api/v1/questions/{questionId}':
                return await handleGetQuestion(event);
            default:
                return response_builder_1.ResponseBuilder.notFound('Route not found');
        }
    }
    catch (error) {
        console.error('Question handler error:', error);
        return response_builder_1.ResponseBuilder.error(error instanceof Error ? error.message : 'Internal server error');
    }
};
exports.handler = handler;
async function handleGetQuestions(event) {
    try {
        const queryParams = event.queryStringParameters || {};
        // Parse topics if it's a comma-separated string
        if (queryParams.topics && typeof queryParams.topics === 'string') {
            queryParams.topics = queryParams.topics.split(',');
        }
        // Convert numeric strings
        if (queryParams.limit)
            queryParams.limit = parseInt(queryParams.limit);
        if (queryParams.offset)
            queryParams.offset = parseInt(queryParams.offset);
        const { error, value } = questionsQuerySchema.validate(queryParams);
        if (error) {
            return response_builder_1.ResponseBuilder.validation(error.details[0].message);
        }
        const result = await questionService.getQuestions(value);
        return response_builder_1.ResponseBuilder.success(result);
    }
    catch (error) {
        throw error;
    }
}
async function handleSearchQuestions(event) {
    try {
        if (!event.body) {
            return response_builder_1.ResponseBuilder.validation('Request body is required');
        }
        const body = JSON.parse(event.body);
        const { error, value } = searchSchema.validate(body);
        if (error) {
            return response_builder_1.ResponseBuilder.validation(error.details[0].message);
        }
        const result = await questionService.searchQuestions(value);
        return response_builder_1.ResponseBuilder.success(result);
    }
    catch (error) {
        throw error;
    }
}
async function handleGetQuestion(event) {
    try {
        const questionId = event.pathParameters?.questionId;
        if (!questionId) {
            return response_builder_1.ResponseBuilder.validation('Question ID is required');
        }
        const queryParams = event.queryStringParameters || {};
        const provider = queryParams.provider || 'aws';
        const exam = queryParams.exam || 'saa-c03';
        const question = await questionService.getQuestionById(provider, exam, questionId);
        if (!question) {
            return response_builder_1.ResponseBuilder.notFound('Question not found');
        }
        return response_builder_1.ResponseBuilder.success({ question });
    }
    catch (error) {
        throw error;
    }
}
//# sourceMappingURL=question-handler.js.map