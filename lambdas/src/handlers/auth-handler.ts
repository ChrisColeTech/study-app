import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Joi from 'joi';
import { AuthService } from '../services/auth-service';
import { ResponseBuilder } from '../shared/response-builder';

const authService = new AuthService();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(50).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { httpMethod, resource, pathParameters } = event;

    // Handle OPTIONS request for CORS
    if (httpMethod === 'OPTIONS') {
      return ResponseBuilder.success('', 200);
    }

    switch (`${httpMethod} ${resource}`) {
      case 'POST /api/v1/auth/register':
        return await handleRegister(event);
      
      case 'POST /api/v1/auth/login':
        return await handleLogin(event);
      
      case 'POST /api/v1/auth/refresh':
        return await handleRefresh(event);
      
      case 'POST /api/v1/auth/logout':
        return await handleLogout(event);
      
      default:
        return ResponseBuilder.notFound('Route not found');
    }
  } catch (error) {
    console.error('Auth handler error:', error);
    return ResponseBuilder.error(
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};

async function handleRegister(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return ResponseBuilder.validation('Request body is required');
    }

    const body = JSON.parse(event.body);
    const { error, value } = registerSchema.validate(body);

    if (error) {
      return ResponseBuilder.validation(error.details[0].message);
    }

    const { email, password, name } = value;
    const result = await authService.register(email, password, name);

    return ResponseBuilder.success(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'User already exists') {
      return ResponseBuilder.validation('User already exists');
    }
    throw error;
  }
}

async function handleLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return ResponseBuilder.validation('Request body is required');
    }

    const body = JSON.parse(event.body);
    const { error, value } = loginSchema.validate(body);

    if (error) {
      return ResponseBuilder.validation(error.details[0].message);
    }

    const { email, password } = value;
    const result = await authService.login(email, password);

    return ResponseBuilder.success(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid credentials') {
      return ResponseBuilder.unauthorized('Invalid credentials');
    }
    throw error;
  }
}

async function handleRefresh(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // For now, just return the current token validation
  // In a full implementation, you'd implement refresh token logic
  return ResponseBuilder.success({ message: 'Token refresh not implemented yet' });
}

async function handleLogout(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // For JWT tokens, logout is typically handled client-side
  // In a full implementation, you might maintain a blacklist
  return ResponseBuilder.success({ message: 'Logged out successfully' });
}