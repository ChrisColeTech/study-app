// Authentication middleware for eliminating repetitive auth checks
// Centralizes JWT validation and user context extraction

import { HandlerContext, ApiResponse } from '../types/api.types';
import { JwtPayload } from '../types/auth.types';
import { ERROR_CODES } from '../constants/error.constants';
import { ServiceFactory } from '../service-factory';
import { createLogger } from '../logger';
import { ErrorHandlingMiddleware } from './error-handling.middleware';

const logger = createLogger({ component: 'AuthMiddleware' });

export interface AuthenticatedContext extends HandlerContext {
  userId: string;
  userEmail: string;
  tokenPayload: JwtPayload;
}

export interface AuthOptions {
  required?: boolean; // Whether auth is required (default: true)
  roles?: string[]; // Required roles (future feature)
  permissions?: string[]; // Required permissions (future feature)
}

export class AuthMiddleware {
  /**
   * Validate JWT token and extract user context
   */
  static async authenticateRequest(
    context: HandlerContext,
    options: AuthOptions = { required: true }
  ): Promise<{
    authenticatedContext?: AuthenticatedContext;
    error?: ApiResponse;
  }> {
    try {
      // Extract token from Authorization header
      const authHeader =
        context.event.headers?.Authorization || context.event.headers?.authorization;

      if (!authHeader) {
        if (options.required) {
          return {
            error: ErrorHandlingMiddleware.createErrorResponse(
              ERROR_CODES.UNAUTHORIZED,
              'Authorization header is required'
            ),
          };
        }
        // Auth not required, return original context
        return { authenticatedContext: context as AuthenticatedContext };
      }

      if (!authHeader.startsWith('Bearer ')) {
        return {
          error: ErrorHandlingMiddleware.createErrorResponse(
            ERROR_CODES.UNAUTHORIZED,
            'Authorization header must use Bearer token format'
          ),
        };
      }

      const token = authHeader.substring(7);

      if (!token || token.trim() === '') {
        return {
          error: ErrorHandlingMiddleware.createErrorResponse(
            ERROR_CODES.UNAUTHORIZED,
            'Bearer token is required'
          ),
        };
      }

      // Validate token using auth service
      const serviceFactory = ServiceFactory.getInstance();
      const authService = serviceFactory.getAuthService();

      let tokenPayload: JwtPayload;
      try {
        tokenPayload = await authService.validateToken(token);
      } catch (error: any) {
        logger.warn('Token validation failed', {
          requestId: context.requestId,
          error: error.message,
          tokenLength: token.length,
        });

        const errorInfo = ErrorHandlingMiddleware.handleAuthError(error, {
          requestId: context.requestId,
          operation: 'token-validation',
        });

        return {
          error: ErrorHandlingMiddleware.createErrorResponse(errorInfo.code, errorInfo.message),
        };
      }

      // Validate token payload structure
      if (!tokenPayload.userId || !tokenPayload.email) {
        logger.warn('Invalid token payload structure', {
          requestId: context.requestId,
          hasUserId: !!tokenPayload.userId,
          hasEmail: !!tokenPayload.email,
        });

        return {
          error: ErrorHandlingMiddleware.createErrorResponse(
            ERROR_CODES.UNAUTHORIZED,
            'Invalid token payload'
          ),
        };
      }

      // TODO: Future feature - validate roles and permissions
      if (options.roles && options.roles.length > 0) {
        logger.debug('Role validation not yet implemented', {
          requestId: context.requestId,
          requiredRoles: options.roles,
        });
      }

      if (options.permissions && options.permissions.length > 0) {
        logger.debug('Permission validation not yet implemented', {
          requestId: context.requestId,
          requiredPermissions: options.permissions,
        });
      }

      // Create authenticated context
      const authenticatedContext: AuthenticatedContext = {
        ...context,
        userId: tokenPayload.userId,
        userEmail: tokenPayload.email,
        tokenPayload,
      };

      logger.debug('Request authenticated successfully', {
        requestId: context.requestId,
        userId: tokenPayload.userId,
        email: tokenPayload.email,
      });

      return { authenticatedContext };
    } catch (error: any) {
      logger.error('Authentication middleware error', error, {
        requestId: context.requestId,
      });

      return {
        error: ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.INTERNAL_ERROR,
          'Authentication processing failed'
        ),
      };
    }
  }

  /**
   * Extract user ID from authenticated context (helper method)
   */
  static getUserId(context: AuthenticatedContext): string {
    return context.userId;
  }

  /**
   * Extract user email from authenticated context (helper method)
   */
  static getUserEmail(context: AuthenticatedContext): string {
    return context.userEmail;
  }

  /**
   * Check if request is authenticated (helper method)
   */
  static isAuthenticated(context: HandlerContext): context is AuthenticatedContext {
    return 'userId' in context && 'userEmail' in context && 'tokenPayload' in context;
  }

  /**
   * Create middleware function for specific auth requirements
   */
  static createAuthMiddleware(options: AuthOptions = { required: true }) {
    return async (
      context: HandlerContext
    ): Promise<{
      authenticatedContext?: AuthenticatedContext;
      error?: ApiResponse;
    }> => {
      return await this.authenticateRequest(context, options);
    };
  }

  /**
   * Extract token from request without validation (for logout operations)
   */
  static extractToken(context: HandlerContext): { token?: string; error?: ApiResponse } {
    const authHeader = context.event.headers?.Authorization || context.event.headers?.authorization;

    if (!authHeader) {
      return {
        error: ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Authorization header is required'
        ),
      };
    }

    if (!authHeader.startsWith('Bearer ')) {
      return {
        error: ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Authorization header must use Bearer token format'
        ),
      };
    }

    const token = authHeader.substring(7);

    if (!token || token.trim() === '') {
      return {
        error: ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Bearer token is required'
        ),
      };
    }

    return { token };
  }

  /**
   * Validate session ownership (helper for session-related operations)
   */
  static validateResourceOwnership(
    authenticatedContext: AuthenticatedContext,
    resourceUserId: string,
    resourceType: string = 'resource'
  ): ApiResponse | null {
    if (authenticatedContext.userId !== resourceUserId) {
      logger.warn('Resource access denied', {
        requestId: authenticatedContext.requestId,
        userId: authenticatedContext.userId,
        resourceUserId,
        resourceType,
      });

      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.FORBIDDEN,
        `Access denied to ${resourceType}`
      );
    }

    return null;
  }
}

// Common auth configurations that can be reused
export const AuthConfigs = {
  /**
   * No authentication required
   */
  PUBLIC: { required: false },

  /**
   * Basic authentication required
   */
  AUTHENTICATED: { required: true },

  /**
   * Admin authentication required (future feature)
   */
  ADMIN: { required: true, roles: ['admin'] },

  /**
   * User authentication required (future feature)
   */
  USER: { required: true, roles: ['user'] },
};
