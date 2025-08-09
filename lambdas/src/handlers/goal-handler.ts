import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Joi from 'joi';
import { GoalService } from '../services/goal-service';
import { ResponseBuilder } from '../shared/response-builder';

const goalService = new GoalService();

const goalCreateSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).required(),
  targetDate: Joi.string().isoDate().required(),
  provider: Joi.string().required(),
  exam: Joi.string().required(),
  targetScore: Joi.number().integer().min(1).max(100).required(),
});

const goalUpdateSchema = Joi.object({
  title: Joi.string().min(3).max(100).optional(),
  description: Joi.string().max(500).optional(),
  targetDate: Joi.string().isoDate().optional(),
  provider: Joi.string().optional(),
  exam: Joi.string().optional(),
  targetScore: Joi.number().integer().min(1).max(100).optional(),
  currentScore: Joi.number().integer().min(0).max(100).optional(),
  isCompleted: Joi.boolean().optional(),
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { httpMethod, resource, pathParameters } = event;
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return ResponseBuilder.unauthorized('User not authenticated');
    }

    // Handle OPTIONS request for CORS
    if (httpMethod === 'OPTIONS') {
      return ResponseBuilder.success('', 200);
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
        return ResponseBuilder.notFound('Route not found');
    }
  } catch (error) {
    console.error('Goal handler error:', error);
    return ResponseBuilder.error(
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};

async function handleCreateGoal(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return ResponseBuilder.validation('Request body is required');
    }

    const body = JSON.parse(event.body);
    const { error, value } = goalCreateSchema.validate(body);

    if (error) {
      return ResponseBuilder.validation(error.details[0].message);
    }

    // Validate target date is in the future
    const targetDate = new Date(value.targetDate);
    if (targetDate <= new Date()) {
      return ResponseBuilder.validation('Target date must be in the future');
    }

    const goal = await goalService.createGoal(userId, value);
    return ResponseBuilder.success({ goal }, 201);
  } catch (error) {
    throw error;
  }
}

async function handleGetUserGoals(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit || '20');

    const result = await goalService.getUserGoals(userId, limit);
    return ResponseBuilder.success(result);
  } catch (error) {
    throw error;
  }
}

async function handleGetGoal(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    const goalId = event.pathParameters?.goalId;
    if (!goalId) {
      return ResponseBuilder.validation('Goal ID is required');
    }

    const goal = await goalService.getGoal(goalId, userId);
    
    if (!goal) {
      return ResponseBuilder.notFound('Goal not found');
    }

    return ResponseBuilder.success({ goal });
  } catch (error) {
    throw error;
  }
}

async function handleUpdateGoal(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    const goalId = event.pathParameters?.goalId;
    if (!goalId) {
      return ResponseBuilder.validation('Goal ID is required');
    }

    if (!event.body) {
      return ResponseBuilder.validation('Request body is required');
    }

    const body = JSON.parse(event.body);
    const { error, value } = goalUpdateSchema.validate(body);

    if (error) {
      return ResponseBuilder.validation(error.details[0].message);
    }

    // Validate target date is in the future if provided
    if (value.targetDate) {
      const targetDate = new Date(value.targetDate);
      if (targetDate <= new Date()) {
        return ResponseBuilder.validation('Target date must be in the future');
      }
    }

    const updatedGoal = await goalService.updateGoal(goalId, userId, value);
    
    if (!updatedGoal) {
      return ResponseBuilder.notFound('Goal not found');
    }

    return ResponseBuilder.success({ goal: updatedGoal });
  } catch (error) {
    throw error;
  }
}

async function handleDeleteGoal(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    const goalId = event.pathParameters?.goalId;
    if (!goalId) {
      return ResponseBuilder.validation('Goal ID is required');
    }

    const deleted = await goalService.deleteGoal(goalId, userId);
    
    if (!deleted) {
      return ResponseBuilder.notFound('Goal not found');
    }

    return ResponseBuilder.success({ message: 'Goal deleted successfully' });
  } catch (error) {
    throw error;
  }
}

async function handleGetGoalProgress(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    const goalId = event.pathParameters?.goalId;
    if (!goalId) {
      return ResponseBuilder.validation('Goal ID is required');
    }

    const result = await goalService.getGoalProgress(goalId, userId);
    
    if (!result) {
      return ResponseBuilder.notFound('Goal not found');
    }

    return ResponseBuilder.success(result);
  } catch (error) {
    throw error;
  }
}