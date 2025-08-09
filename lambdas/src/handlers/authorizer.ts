import { APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';
import { AuthService } from '../services/auth-service';

const authService = new AuthService();

export const handler = async (
  event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new Error('No token provided');
    }

    const payload = await authService.verifyToken(token);
    
    const policy = generatePolicy(payload.userId, 'Allow', event.methodArn);
    
    // Add context information
    policy.context = {
      userId: payload.userId,
      email: payload.email,
    };

    return policy;
  } catch (error) {
    console.error('Authorization error:', error);
    throw new Error('Unauthorized');
  }
};

function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}