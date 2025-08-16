// Refactored Session handler using middleware pattern
// Eliminates architecture violations: massive SRP violations, mixed routing/validation/parsing/error handling/business logic

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { SessionService } from '../services/session.service';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import {
  CreateSessionRequest,
  UpdateSessionRequest,
  SubmitAnswerRequest,
} from '../shared/types/session.types';

// Import new middleware
import {
  ParsingMiddleware,
  ErrorHandlingMiddleware,
  ErrorContexts,
  ValidationMiddleware,
  AuthMiddleware,
  AuthConfigs,
  AuthenticatedContext,
} from '../shared/middleware';
import { ValidationRules } from '../shared/validation/validation-rules';
import { SessionValidationSchemas, AdditionalValidationHelpers } from '../shared/middleware';
import { SessionOrchestrator } from '../shared/session-orchestrator';

export class SessionHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'SessionHandler' });
  private sessionOrchestrator = SessionOrchestrator.getInstance();

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      {
        method: 'POST',
        path: '/v1/sessions',
        handler: this.createSession.bind(this),
        requireAuth: false,
      },
      {
        method: 'GET',
        path: '/v1/sessions/{id}',
        handler: this.getSession.bind(this),
        requireAuth: false,
      },
      {
        method: 'PUT',
        path: '/v1/sessions/{id}',
        handler: this.updateSession.bind(this),
        requireAuth: false,
      },
      {
        method: 'DELETE',
        path: '/v1/sessions/{id}',
        handler: this.deleteSession.bind(this),
        requireAuth: false,
      },
      {
        method: 'POST',
        path: '/v1/sessions/{id}/answers',
        handler: this.submitAnswer.bind(this),
        requireAuth: false,
      },
      {
        method: 'POST',
        path: '/v1/sessions/{id}/complete',
        handler: this.completeSession.bind(this),
        requireAuth: false,
      },
      {
        method: 'POST',
        path: '/v1/sessions/adaptive',
        handler: this.createAdaptiveSession.bind(this),
        requireAuth: false,
      },
    ];
  }

  /**
   * Create a new study session - Pure routing with orchestrator delegation
   */
  private async createSession(context: HandlerContext): Promise<ApiResponse> {
    // Use optimized middleware pattern for write operations
    return this.executeWithMiddleware(
      context,
      'write', // Pattern: parsing + validation + error handling
      {
        body: AdditionalValidationHelpers.createEnhancedSessionValidation(),
      },
      async () => {
        // Delegate business logic to orchestrator
        const { result, error } = await this.sessionOrchestrator.orchestrateCreateSession(
          context,
          this.executeServiceOrError.bind(this)
        );

        if (error) return error;

        return result;
      }
    );
  }

  /**
   * Get an existing study session - Pure routing with orchestrator delegation
   */
  private async getSession(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Validate session ID using orchestrator
    const sessionIdError = this.sessionOrchestrator.validateSessionIdOrError(pathParams);
    if (sessionIdError) return sessionIdError;

    // Delegate business logic to orchestrator
    const { result, error } = await this.sessionOrchestrator.orchestrateGetSession(
      context,
      pathParams.id,
      this.executeServiceOrError.bind(this)
    );

    if (error) return error;

    return this.buildSuccessResponse('Session retrieved successfully', result);
  }

  /**
   * Update an existing study session - Pure routing with orchestrator delegation
   */
  private async updateSession(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Validate session ID using orchestrator
    const sessionIdError = this.sessionOrchestrator.validateSessionIdOrError(pathParams);
    if (sessionIdError) return sessionIdError;

    // Use optimized middleware pattern for write operations
    return this.executeWithMiddleware(
      context,
      'write', // Pattern: parsing + validation + error handling
      {
        path: AdditionalValidationHelpers.createEnhancedSessionIdValidation(),
        body: AdditionalValidationHelpers.createEnhancedUpdateValidation(),
      },
      async () => {
        // Delegate business logic to orchestrator
        const { result, error } = await this.sessionOrchestrator.orchestrateUpdateSession(
          context,
          pathParams.id,
          this.executeServiceOrError.bind(this)
        );

        if (error) return error;

        return result;
      }
    );
  }

  /**
   * Delete a study session - Pure routing with orchestrator delegation
   */
  private async deleteSession(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Validate session ID using orchestrator
    const sessionIdError = this.sessionOrchestrator.validateSessionIdOrError(pathParams);
    if (sessionIdError) return sessionIdError;

    // Delegate business logic to orchestrator
    const { result, error } = await this.sessionOrchestrator.orchestrateDeleteSession(
      context,
      pathParams.id,
      this.executeServiceOrError.bind(this)
    );

    if (error) return error;

    return this.buildSuccessResponse('Session deleted successfully', result);
  }

  /**
   * Submit answer for a question in a session - Pure routing with orchestrator delegation
   */
  private async submitAnswer(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Validate session ID using orchestrator
    const sessionIdError = this.sessionOrchestrator.validateSessionIdOrError(pathParams);
    if (sessionIdError) return sessionIdError;

    // Use optimized middleware pattern for write operations
    return this.executeWithMiddleware(
      context,
      'write', // Pattern: parsing + validation + error handling
      {
        path: AdditionalValidationHelpers.createEnhancedSessionIdValidation(),
        body: AdditionalValidationHelpers.createEnhancedAnswerValidation(),
      },
      async () => {
        // Delegate business logic to orchestrator
        const { result, error } = await this.sessionOrchestrator.orchestrateSubmitAnswer(
          context,
          pathParams.id,
          this.executeServiceOrError.bind(this)
        );

        if (error) return error;

        return result;
      }
    );
  }

  /**
   * Complete a study session - Pure routing with orchestrator delegation
   */
  private async completeSession(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Validate session ID using orchestrator
    const sessionIdError = this.sessionOrchestrator.validateSessionIdOrError(pathParams);
    if (sessionIdError) return sessionIdError;

    // Delegate business logic to orchestrator
    const { result, error } = await this.sessionOrchestrator.orchestrateCompleteSession(
      context,
      pathParams.id,
      this.executeServiceOrError.bind(this)
    );

    if (error) return error;

    return this.buildSuccessResponse('Session completed successfully', result);
  }

  /**
   * Create an adaptive study session - Pure routing with orchestrator delegation
   */
  private async createAdaptiveSession(context: HandlerContext): Promise<ApiResponse> {
    // Parse and validate request body using middleware
    const { data: requestBody, error: parseError } =
      await this.parseRequestBodyOrError<CreateSessionRequest>(context, true);
    if (parseError) return parseError;

    // Delegate business logic to orchestrator
    const { result, error } = await this.sessionOrchestrator.orchestrateCreateAdaptiveSession(
      context,
      this.executeServiceOrError.bind(this)
    );

    if (error) return error;

    return this.buildSuccessResponse('Adaptive session created successfully', result);
  }
}

// Export handler function for Lambda
const sessionHandler = new SessionHandler();
export const handler = sessionHandler.handle;
