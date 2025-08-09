import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Joi from 'joi';
import { GoalService } from '../services/goal-service';
import { ResponseBuilder } from '../shared/response-builder';
import { withAuth, extractRequestInfo } from '../shared/auth-middleware';

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

// Core goal handler - focused on business logic only
const goalHandler = async (
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> => {
  const { route } = extractRequestInfo(event);
  
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
      return ResponseBuilder.notFound('Route not found');
  }
};

// Export the handler wrapped with authentication middleware
export const handler = withAuth(goalHandler);

async function handleCreateGoal(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { body } = extractRequestInfo(event);
  console.log(`[GOAL] Creating goal for user ${userId}`);
  
  if (!body) {
    return ResponseBuilder.validation('Request body is required');
  }

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
}

async function handleGetUserGoals(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { queryStringParameters } = extractRequestInfo(event);
  const limit = parseInt(queryStringParameters.limit || '20');
  
  console.log(`[GOAL] Getting goals for user ${userId} (limit: ${limit})`);

  const result = await goalService.getUserGoals(userId, limit);
  return ResponseBuilder.success(result);
}

async function handleGetGoal(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters } = extractRequestInfo(event);
  const goalId = pathParameters.goalId;
  
  if (!goalId) {
    return ResponseBuilder.validation('Goal ID is required');
  }

  console.log(`[GOAL] Getting goal ${goalId} for user ${userId}`);

  const goal = await goalService.getGoal(goalId, userId);
  
  if (!goal) {
    return ResponseBuilder.notFound('Goal not found');
  }

  return ResponseBuilder.success({ goal });
}

async function handleUpdateGoal(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters, body } = extractRequestInfo(event);
  const goalId = pathParameters.goalId;
  
  if (!goalId) {
    return ResponseBuilder.validation('Goal ID is required');
  }

  if (!body) {
    return ResponseBuilder.validation('Request body is required');
  }

  console.log(`[GOAL] Updating goal ${goalId} for user ${userId}`);

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
}

async function handleDeleteGoal(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters } = extractRequestInfo(event);
  const goalId = pathParameters.goalId;
  
  if (!goalId) {
    return ResponseBuilder.validation('Goal ID is required');
  }

  console.log(`[GOAL] Deleting goal ${goalId} for user ${userId}`);

  const deleted = await goalService.deleteGoal(goalId, userId);
  
  if (!deleted) {
    return ResponseBuilder.notFound('Goal not found');
  }

  return ResponseBuilder.success({ message: 'Goal deleted successfully' });
}

async function handleGetGoalProgress(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters } = extractRequestInfo(event);
  const goalId = pathParameters.goalId;
  
  if (!goalId) {
    return ResponseBuilder.validation('Goal ID is required');
  }

  console.log(`[GOAL] Getting progress for goal ${goalId} for user ${userId}`);

  const result = await goalService.getGoalProgress(goalId, userId);
  
  if (!result) {
    return ResponseBuilder.notFound('Goal not found');
  }

  return ResponseBuilder.success(result);
}