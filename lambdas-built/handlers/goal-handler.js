"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const joi_1 = __importDefault(require("joi"));
const goal_service_1 = require("../services/goal-service");
const response_builder_1 = require("../shared/response-builder");
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
    }
    catch (error) {
        console.error('Goal handler error:', error);
        return response_builder_1.ResponseBuilder.error(error instanceof Error ? error.message : 'Internal server error');
    }
};
exports.handler = handler;
async function handleCreateGoal(event, userId) {
    try {
        if (!event.body) {
            return response_builder_1.ResponseBuilder.validation('Request body is required');
        }
        const body = JSON.parse(event.body);
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
    catch (error) {
        throw error;
    }
}
async function handleGetUserGoals(event, userId) {
    try {
        const queryParams = event.queryStringParameters || {};
        const limit = parseInt(queryParams.limit || '20');
        const result = await goalService.getUserGoals(userId, limit);
        return response_builder_1.ResponseBuilder.success(result);
    }
    catch (error) {
        throw error;
    }
}
async function handleGetGoal(event, userId) {
    try {
        const goalId = event.pathParameters?.goalId;
        if (!goalId) {
            return response_builder_1.ResponseBuilder.validation('Goal ID is required');
        }
        const goal = await goalService.getGoal(goalId, userId);
        if (!goal) {
            return response_builder_1.ResponseBuilder.notFound('Goal not found');
        }
        return response_builder_1.ResponseBuilder.success({ goal });
    }
    catch (error) {
        throw error;
    }
}
async function handleUpdateGoal(event, userId) {
    try {
        const goalId = event.pathParameters?.goalId;
        if (!goalId) {
            return response_builder_1.ResponseBuilder.validation('Goal ID is required');
        }
        if (!event.body) {
            return response_builder_1.ResponseBuilder.validation('Request body is required');
        }
        const body = JSON.parse(event.body);
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
    catch (error) {
        throw error;
    }
}
async function handleDeleteGoal(event, userId) {
    try {
        const goalId = event.pathParameters?.goalId;
        if (!goalId) {
            return response_builder_1.ResponseBuilder.validation('Goal ID is required');
        }
        const deleted = await goalService.deleteGoal(goalId, userId);
        if (!deleted) {
            return response_builder_1.ResponseBuilder.notFound('Goal not found');
        }
        return response_builder_1.ResponseBuilder.success({ message: 'Goal deleted successfully' });
    }
    catch (error) {
        throw error;
    }
}
async function handleGetGoalProgress(event, userId) {
    try {
        const goalId = event.pathParameters?.goalId;
        if (!goalId) {
            return response_builder_1.ResponseBuilder.validation('Goal ID is required');
        }
        const result = await goalService.getGoalProgress(goalId, userId);
        if (!result) {
            return response_builder_1.ResponseBuilder.notFound('Goal not found');
        }
        return response_builder_1.ResponseBuilder.success(result);
    }
    catch (error) {
        throw error;
    }
}
//# sourceMappingURL=goal-handler.js.map