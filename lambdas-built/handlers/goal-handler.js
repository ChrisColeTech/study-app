"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const joi_1 = __importDefault(require("joi"));
const goal_service_1 = require("../services/goal-service");
const response_builder_1 = require("../shared/response-builder");
const auth_middleware_1 = require("../shared/auth-middleware");
const goalService = new goal_service_1.GoalService();
const goalCreateSchema = joi_1.default.object({
    title: joi_1.default.string().min(3).max(100).required(),
    description: joi_1.default.string().max(500).required(),
    targetDate: joi_1.default.string().isoDate().required(),
    provider: joi_1.default.string().required(),
    exam: joi_1.default.string().required(),
    targetScore: joi_1.default.number().integer().min(1).max(100).required(),
});
const goalUpdateSchema = joi_1.default.object({
    title: joi_1.default.string().min(3).max(100).optional(),
    description: joi_1.default.string().max(500).optional(),
    targetDate: joi_1.default.string().isoDate().optional(),
    provider: joi_1.default.string().optional(),
    exam: joi_1.default.string().optional(),
    targetScore: joi_1.default.number().integer().min(1).max(100).optional(),
    currentScore: joi_1.default.number().integer().min(0).max(100).optional(),
    isCompleted: joi_1.default.boolean().optional(),
});
// Core goal handler - focused on business logic only
const goalHandler = async (event, userId) => {
    const { route } = (0, auth_middleware_1.extractRequestInfo)(event);
    console.log(`[GOAL] Handling ${route} for user ${userId}`);
    switch (route) {
        case 'POST /api/v1/goals':
            return await handleCreateGoal(event, userId);
        case 'GET /api/v1/goals':
            return await handleGetUserGoals(event, userId);
        case 'GET /api/v1/goals/{goalId}':
            return await handleGetGoal(event, userId);
        case 'PUT /api/v1/goals/{goalId}':
            return await handleUpdateGoal(event, userId);
        case 'DELETE /api/v1/goals/{goalId}':
            return await handleDeleteGoal(event, userId);
        case 'GET /api/v1/goals/{goalId}/progress':
            return await handleGetGoalProgress(event, userId);
        default:
            return response_builder_1.ResponseBuilder.notFound('Route not found');
    }
};
// Export the handler wrapped with authentication middleware
exports.handler = (0, auth_middleware_1.withAuth)(goalHandler);
async function handleCreateGoal(event, userId) {
    const { body } = (0, auth_middleware_1.extractRequestInfo)(event);
    console.log(`[GOAL] Creating goal for user ${userId}`);
    if (!body) {
        return response_builder_1.ResponseBuilder.validation('Request body is required');
    }
    const { error, value } = goalCreateSchema.validate(body);
    if (error) {
        return response_builder_1.ResponseBuilder.validation(error.details[0].message);
    }
    // Validate target date is in the future
    const targetDate = new Date(value.targetDate);
    if (targetDate <= new Date()) {
        return response_builder_1.ResponseBuilder.validation('Target date must be in the future');
    }
    const goal = await goalService.createGoal(userId, value);
    return response_builder_1.ResponseBuilder.success({ goal }, 201);
}
async function handleGetUserGoals(event, userId) {
    const { queryStringParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    const limit = parseInt(queryStringParameters.limit || '20');
    console.log(`[GOAL] Getting goals for user ${userId} (limit: ${limit})`);
    const result = await goalService.getUserGoals(userId, limit);
    return response_builder_1.ResponseBuilder.success(result);
}
async function handleGetGoal(event, userId) {
    const { pathParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    const goalId = pathParameters.goalId;
    if (!goalId) {
        return response_builder_1.ResponseBuilder.validation('Goal ID is required');
    }
    console.log(`[GOAL] Getting goal ${goalId} for user ${userId}`);
    const goal = await goalService.getGoal(goalId, userId);
    if (!goal) {
        return response_builder_1.ResponseBuilder.notFound('Goal not found');
    }
    return response_builder_1.ResponseBuilder.success({ goal });
}
async function handleUpdateGoal(event, userId) {
    const { pathParameters, body } = (0, auth_middleware_1.extractRequestInfo)(event);
    const goalId = pathParameters.goalId;
    if (!goalId) {
        return response_builder_1.ResponseBuilder.validation('Goal ID is required');
    }
    if (!body) {
        return response_builder_1.ResponseBuilder.validation('Request body is required');
    }
    console.log(`[GOAL] Updating goal ${goalId} for user ${userId}`);
    const { error, value } = goalUpdateSchema.validate(body);
    if (error) {
        return response_builder_1.ResponseBuilder.validation(error.details[0].message);
    }
    // Validate target date is in the future if provided
    if (value.targetDate) {
        const targetDate = new Date(value.targetDate);
        if (targetDate <= new Date()) {
            return response_builder_1.ResponseBuilder.validation('Target date must be in the future');
        }
    }
    const updatedGoal = await goalService.updateGoal(goalId, userId, value);
    if (!updatedGoal) {
        return response_builder_1.ResponseBuilder.notFound('Goal not found');
    }
    return response_builder_1.ResponseBuilder.success({ goal: updatedGoal });
}
async function handleDeleteGoal(event, userId) {
    const { pathParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    const goalId = pathParameters.goalId;
    if (!goalId) {
        return response_builder_1.ResponseBuilder.validation('Goal ID is required');
    }
    console.log(`[GOAL] Deleting goal ${goalId} for user ${userId}`);
    const deleted = await goalService.deleteGoal(goalId, userId);
    if (!deleted) {
        return response_builder_1.ResponseBuilder.notFound('Goal not found');
    }
    return response_builder_1.ResponseBuilder.success({ message: 'Goal deleted successfully' });
}
async function handleGetGoalProgress(event, userId) {
    const { pathParameters } = (0, auth_middleware_1.extractRequestInfo)(event);
    const goalId = pathParameters.goalId;
    if (!goalId) {
        return response_builder_1.ResponseBuilder.validation('Goal ID is required');
    }
    console.log(`[GOAL] Getting progress for goal ${goalId} for user ${userId}`);
    const result = await goalService.getGoalProgress(goalId, userId);
    if (!result) {
        return response_builder_1.ResponseBuilder.notFound('Goal not found');
    }
    return response_builder_1.ResponseBuilder.success(result);
}
//# sourceMappingURL=goal-handler.js.map