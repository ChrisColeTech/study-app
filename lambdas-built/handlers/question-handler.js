"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const joi_1 = __importDefault(require("joi"));
const question_service_1 = require("../services/question-service");
const response_builder_1 = require("../shared/response-builder");
const auth_middleware_1 = require("../shared/auth-middleware");
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
// Core question handler - focused on business logic only
const questionHandler = async (event, userId) => {
    const { route } = (0, auth_middleware_1.extractRequestInfo)(event);
    console.log(`[QUESTION] Handling ${route} for user ${userId}`);
    switch (route) {
        case 'GET /api/v1/questions':
            return await handleGetQuestions(event, userId);
        case 'POST /api/v1/questions/search':
            return await handleSearchQuestions(event, userId);
        case 'GET /api/v1/questions/{questionId}':
            return await handleGetQuestion(event, userId);
        default:
            return response_builder_1.ResponseBuilder.notFound('Route not found');
    }
};
// Export the handler wrapped with authentication middleware
exports.handler = (0, auth_middleware_1.withAuth)(questionHandler);
async function handleGetQuestions(event, userId) {
    const { queryStringParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    console.log(`[QUESTION] Getting questions for user ${userId}`);
    const queryParams = queryStringParameters;
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
async function handleSearchQuestions(event, userId) {
    const { body } = (0, auth_middleware_1.extractRequestInfo)(event);
    console.log(`[QUESTION] Searching questions for user ${userId}`);
    if (!body) {
        return response_builder_1.ResponseBuilder.validation('Request body is required');
    }
    const { error, value } = searchSchema.validate(body);
    if (error) {
        return response_builder_1.ResponseBuilder.validation(error.details[0].message);
    }
    const result = await questionService.searchQuestions(value);
    return response_builder_1.ResponseBuilder.success(result);
}
async function handleGetQuestion(event, userId) {
    const { pathParameters, queryStringParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    const questionId = pathParameters.questionId;
    if (!questionId) {
        return response_builder_1.ResponseBuilder.validation('Question ID is required');
    }
    const provider = queryStringParameters.provider || 'aws';
    const exam = queryStringParameters.exam || 'saa-c03';
    console.log(`[QUESTION] Getting question ${questionId} (${provider}/${exam}) for user ${userId}`);
    const question = await questionService.getQuestionById(provider, exam, questionId);
    if (!question) {
        return response_builder_1.ResponseBuilder.notFound('Question not found');
    }
    return response_builder_1.ResponseBuilder.success({ question });
}
//# sourceMappingURL=question-handler.js.map