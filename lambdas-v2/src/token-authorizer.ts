import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda';
import { JwtService } from './services/jwt-service';
import { Logger } from './shared/logger';

/**
 * V2 Token Authorizer - FIXES the REQUEST authorizer issues from V1
 * 
 * This authorizer:
 * 1. Uses TOKEN type instead of problematic REQUEST type
 * 2. Validates JWT tokens properly
 * 3. Returns proper authorization context
 * 4. Has comprehensive logging for debugging
 */
export class TokenAuthorizer {
  private jwtService: JwtService;
  private logger: Logger;

  constructor() {
    this.jwtService = new JwtService();
    this.logger = new Logger('TokenAuthorizer');
  }

  public async authorize(event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
    const requestId = (event as any).requestId || 'unknown';
    const token = event.authorizationToken;

    this.logger.info(`[${requestId}] Authorizer invoked`, {
      methodArn: event.methodArn,
      tokenLength: token ? token.length : 0,
      tokenPrefix: token ? token.substring(0, 10) + '...' : 'null'
    });

    try {
      // Validate token
      if (!token) {
        this.logger.warn(`[${requestId}] No authorization token provided`);
        throw new Error('Unauthorized');
      }

      // Validate JWT token
      const validation = this.jwtService.validateToken(token);
      
      if (!validation.isValid) {
        this.logger.warn(`[${requestId}] Token validation failed`, {
          error: validation.error
        });
        throw new Error('Unauthorized');
      }

      const { payload } = validation;
      if (!payload) {
        this.logger.error(`[${requestId}] Token validation succeeded but no payload returned`);
        throw new Error('Unauthorized');
      }

      this.logger.info(`[${requestId}] Token validated successfully`, {
        userId: payload.userId,
        email: payload.email
      });

      // Generate policy - Allow access
      const policy = this.generatePolicy(payload.userId, 'Allow', event.methodArn);
      
      // Add user context for Lambda functions
      policy.context = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role || 'user'
      };

      this.logger.info(`[${requestId}] Authorization successful`, {
        principalId: policy.principalId,
        effect: 'Allow'
      });

      return policy;

    } catch (error) {
      this.logger.error(`[${requestId}] Authorization failed`, {
        error: error instanceof Error ? error.message : error
      });

      // For TOKEN authorizers, we must return a policy even for failures
      // Return Deny policy instead of throwing
      return this.generatePolicy('anonymous', 'Deny', event.methodArn);
    }
  }

  /**
   * Generate IAM policy for API Gateway
   */
  private generatePolicy(principalId: string, effect: 'Allow' | 'Deny', resource: string): APIGatewayAuthorizerResult {
    // Extract resource ARN components
    const arnParts = resource.split(':');
    const apiGatewayArnTmp = arnParts[5]?.split('/') || [];
    const restApiId = apiGatewayArnTmp[0] || '*';
    const stage = apiGatewayArnTmp[1] || '*';
    
    // Create more inclusive resource ARN pattern to handle sub-routes
    // Use wildcard at the end to match all paths including path parameters
    const resourceArn = `arn:aws:execute-api:${arnParts[3]}:${arnParts[4]}:${restApiId}/${stage}/*`;

    return {
      principalId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: effect,
            Resource: resourceArn
          }
        ]
      }
    };
  }
}

// Lambda handler function
const authorizer = new TokenAuthorizer();

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent,
  context: Context
): Promise<APIGatewayAuthorizerResult> => {
  return await authorizer.authorize(event);
};