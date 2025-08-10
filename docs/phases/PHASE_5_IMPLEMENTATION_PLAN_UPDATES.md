# Phase 5: Implementation Plan Updates

**Started**: 2025-08-10
**Source**: Analysis based on Phase 1 lessons learned, Phase 2 detailed findings, Phase 3 architecture analysis, and Phase 4 integration gaps

---

## Phase 5.1: Complete Handler List

### Task 1: Create definitive list of all required Lambda functions
**Status**: COMPLETED

Based on Phase 3.3 handler mapping and Phase 4.2 missing components analysis:

#### **Individual Lambda Architecture**:

**Architecture Decision**: Individual Lambda functions per handler for optimal performance, isolation, and scalability as established in Phase 1-4 analysis.

**Lambda Function Structure**:
```
backend/
├── src/
│   ├── handlers/
│   │   ├── auth.ts           # Authentication endpoints (4)
│   │   ├── providers.ts      # Provider endpoints (2)
│   │   ├── exams.ts         # Exam endpoints (2)
│   │   ├── topics.ts        # Topic endpoints (2)
│   │   ├── questions.ts     # Question endpoints (3)
│   │   ├── sessions.ts      # Session endpoints (7)
│   │   ├── analytics.ts     # Analytics endpoints (3)
│   │   ├── goals.ts         # Goals endpoints (4)
│   │   └── health.ts        # Health endpoints (2)
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── question.service.ts
│   │   ├── session.service.ts
│   │   ├── analytics.service.ts
│   │   └── goals.service.ts
│   ├── repositories/
│   │   ├── user.repository.ts
│   │   ├── session.repository.ts
│   │   ├── question.repository.ts
│   │   └── progress.repository.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── error.middleware.ts
│   └── index.ts             # Main Lambda handler with routing
└── package.json
```

**Handler Organization by Domain**:

**Authentication Handler** (`auth.ts`):
- `POST /api/v1/auth/register` - User registration ✅ Working
- `POST /api/v1/auth/login` - User authentication ✅ Working  
- `POST /api/v1/auth/refresh` - Token refresh ❌ Missing
- `POST /api/v1/auth/logout` - User logout ❌ Missing

**Provider Handler** (`providers.ts`):
- `GET /api/v1/providers` - List providers ✅ Working
- `GET /api/v1/providers/{providerId}` - Get provider details ❌ Missing

**Exam Handler** (`exams.ts`):
- `GET /api/v1/exams` - List exams ❌ Missing
- `GET /api/v1/exams/{examId}` - Get exam details ❌ Missing

**Topic Handler** (`topics.ts`):
- `GET /api/v1/topics` - List topics ❌ Missing
- `GET /api/v1/topics/{topicId}` - Get topic details ❌ Missing

**Question Handler** (`questions.ts`):
- `GET /api/v1/questions` - List questions ❌ Missing
- `GET /api/v1/questions/{questionId}` - Get question details ❌ Missing
- `POST /api/v1/questions/search` - Search questions ❌ Missing

**Session Handler** (`sessions.ts`):
- `POST /api/v1/sessions` - Create session ❌ Missing
- `GET /api/v1/sessions/{sessionId}` - Get session ❌ Missing
- `PUT /api/v1/sessions/{sessionId}` - Update session ❌ Missing
- `DELETE /api/v1/sessions/{sessionId}` - Delete session ❌ Missing
- `POST /api/v1/sessions/{sessionId}/answers` - Submit answers ❌ Missing
- `POST /api/v1/sessions/{sessionId}/complete` - Complete session ❌ Missing
- `POST /api/v1/sessions/adaptive` - Create adaptive session ❌ Missing

**Analytics Handler** (`analytics.ts`):
- `GET /api/v1/analytics/progress` - Progress analytics ❌ Missing
- `GET /api/v1/analytics/sessions/{sessionId}` - Session analytics ❌ Missing
- `GET /api/v1/analytics/performance` - Performance analytics ❌ Missing

**Goals Handler** (`goals.ts`):
- `GET /api/v1/goals` - List goals ❌ Missing
- `POST /api/v1/goals` - Create goal ❌ Missing
- `PUT /api/v1/goals/{goalId}` - Update goal ❌ Missing
- `DELETE /api/v1/goals/{goalId}` - Delete goal ❌ Missing

**Health Handler** (`health.ts`):
- `GET /api/v1/health` - Basic health check ❌ Missing
- `GET /api/v1/health/detailed` - Detailed health check ❌ Missing

**Status**: 3 endpoints working, 26 endpoints need implementation

#### **Architecture Benefits**:
- **Single Deployment**: One Lambda to deploy and manage
- **Shared Resources**: Database connections, services, and dependencies shared
- **Clean Separation**: Each handler file maintains domain boundaries
- **Easier Testing**: Single codebase with integrated testing
- **Simplified Monitoring**: One Lambda to monitor with internal routing
- **Standard Patterns**: Familiar web API routing patterns

---

## Phase 5.2: Complete Endpoint List

### Task 1: Document ALL API endpoints with proper HTTP methods
**Status**: IN PROGRESS

Based on Phase 2.2 complete API endpoint catalog and Phase 4.3 API reference compliance:

#### **Complete API Endpoint Catalog (29 Endpoints)**:

**Authentication Endpoints (4 endpoints) - No Auth Required**:
1. `POST /api/v1/auth/register`
   - **Method**: POST (Resource Creation)
   - **Purpose**: User registration with email validation
   - **Request Body**: User registration data
   - **Response**: User object + JWT tokens

2. `POST /api/v1/auth/login`
   - **Method**: POST (Action/Process)
   - **Purpose**: User authentication with JWT generation
   - **Request Body**: Email and password credentials
   - **Response**: User object + JWT tokens

3. `POST /api/v1/auth/refresh`
   - **Method**: POST (Action/Process)
   - **Purpose**: JWT token refresh mechanism
   - **Request Body**: Refresh token
   - **Response**: New access and refresh tokens

4. `POST /api/v1/auth/logout`
   - **Method**: POST (Action/Process)
   - **Purpose**: User logout with token blacklisting
   - **Request Body**: Empty (token from Authorization header)
   - **Response**: Success confirmation

**Provider Endpoints (2 endpoints) - Auth Required**:
5. `GET /api/v1/providers`
   - **Method**: GET (Collection Retrieval)
   - **Purpose**: List all certification providers
   - **Query Parameters**: Optional pagination (limit, offset)
   - **Response**: Array of provider objects

6. `GET /api/v1/providers/{providerId}`
   - **Method**: GET (Resource Retrieval)
   - **Purpose**: Get specific provider details
   - **Path Parameters**: providerId (string)
   - **Response**: Single provider object with metadata

**Exam Endpoints (2 endpoints) - Auth Required**:
7. `GET /api/v1/exams`
   - **Method**: GET (Collection Retrieval)
   - **Purpose**: List all exams with filtering by provider/difficulty
   - **Query Parameters**: provider, difficulty, limit, offset
   - **Response**: Array of exam objects with pagination

8. `GET /api/v1/exams/{examId}`
   - **Method**: GET (Resource Retrieval)
   - **Purpose**: Get specific exam details
   - **Path Parameters**: examId (string)
   - **Response**: Single exam object with metadata

**Topic Endpoints (2 endpoints) - Auth Required**:
9. `GET /api/v1/topics`
   - **Method**: GET (Collection Retrieval)
   - **Purpose**: List all topics with filtering by provider/exam
   - **Query Parameters**: provider, exam, limit, offset
   - **Response**: Array of topic objects with pagination

10. `GET /api/v1/topics/{topicId}`
    - **Method**: GET (Resource Retrieval)
    - **Purpose**: Get specific topic details
    - **Path Parameters**: topicId (string)
    - **Response**: Single topic object with metadata

**Question Endpoints (3 endpoints) - Auth Required**:
11. `GET /api/v1/questions`
    - **Method**: GET (Collection Retrieval)
    - **Purpose**: Get questions with filtering by provider/exam/topics/difficulty
    - **Query Parameters**: provider, exam, topics, difficulty, limit, offset
    - **Response**: Array of question objects with pagination

12. `GET /api/v1/questions/{questionId}`
    - **Method**: GET (Resource Retrieval)
    - **Purpose**: Get specific question details
    - **Path Parameters**: questionId (string)
    - **Response**: Single question object with explanation

13. `POST /api/v1/questions/search`
    - **Method**: POST (Complex Query/Search)
    - **Purpose**: Full-text search across question bank
    - **Request Body**: Search criteria with filters
    - **Response**: Array of matching questions with relevance scores

**Study Session Endpoints (7 endpoints) - Auth Required**:
14. `POST /api/v1/sessions`
    - **Method**: POST (Resource Creation)
    - **Purpose**: Create new study session
    - **Request Body**: Session configuration (providers, exams, topics, count)
    - **Response**: Created session object with questions

15. `GET /api/v1/sessions/{sessionId}`
    - **Method**: GET (Resource Retrieval)
    - **Purpose**: Get session details and current question
    - **Path Parameters**: sessionId (string)
    - **Response**: Session object with current state

16. `PUT /api/v1/sessions/{sessionId}`
    - **Method**: PUT (Resource Update)
    - **Purpose**: Update session (pause/resume)
    - **Path Parameters**: sessionId (string)
    - **Request Body**: Session updates (status, etc.)
    - **Response**: Updated session object

17. `DELETE /api/v1/sessions/{sessionId}`
    - **Method**: DELETE (Resource Deletion)
    - **Purpose**: Delete/abandon session
    - **Path Parameters**: sessionId (string)
    - **Response**: Deletion confirmation

18. `POST /api/v1/sessions/{sessionId}/answers`
    - **Method**: POST (Sub-resource Creation/Action)
    - **Purpose**: Submit answers for current question
    - **Path Parameters**: sessionId (string)
    - **Request Body**: Answer submission data
    - **Response**: Answer result with feedback and next question

19. `POST /api/v1/sessions/{sessionId}/complete`
    - **Method**: POST (Action/Process)
    - **Purpose**: Complete session and get results
    - **Path Parameters**: sessionId (string)
    - **Response**: Session results with analytics

20. `POST /api/v1/sessions/adaptive`
    - **Method**: POST (Specialized Resource Creation)
    - **Purpose**: Create enhanced session with difficulty adjustment
    - **Request Body**: Adaptive session configuration
    - **Response**: Created adaptive session object

**Analytics Endpoints (3 endpoints) - Auth Required**:
21. `GET /api/v1/analytics/progress`
    - **Method**: GET (Computed Resource Retrieval)
    - **Purpose**: Get user progress analytics
    - **Query Parameters**: timeframe, providerId, examId, includeGoals
    - **Response**: Progress analytics object with trends

22. `GET /api/v1/analytics/sessions/{sessionId}`
    - **Method**: GET (Computed Resource Retrieval)
    - **Purpose**: Get detailed session analytics
    - **Path Parameters**: sessionId (string)
    - **Response**: Session analytics object with performance breakdown

23. `GET /api/v1/analytics/performance`
    - **Method**: GET (Computed Resource Retrieval)
    - **Purpose**: Get performance insights and trends
    - **Query Parameters**: timeframe, includeComparisons
    - **Response**: Performance metrics with competency scores

**Goals Endpoints (4 endpoints) - Auth Required**:
24. `GET /api/v1/goals`
    - **Method**: GET (Collection Retrieval)
    - **Purpose**: Get user's study goals
    - **Query Parameters**: status (active, completed, paused)
    - **Response**: Array of goal objects

25. `POST /api/v1/goals`
    - **Method**: POST (Resource Creation)
    - **Purpose**: Create new study goal
    - **Request Body**: Goal configuration data
    - **Response**: Created goal object

26. `PUT /api/v1/goals/{goalId}`
    - **Method**: PUT (Resource Update)
    - **Purpose**: Update existing goal
    - **Path Parameters**: goalId (string)
    - **Request Body**: Goal updates
    - **Response**: Updated goal object

27. `DELETE /api/v1/goals/{goalId}`
    - **Method**: DELETE (Resource Deletion)
    - **Purpose**: Delete study goal
    - **Path Parameters**: goalId (string)
    - **Response**: Deletion confirmation

**Health Endpoints (2 endpoints) - No Auth Required**:
28. `GET /api/v1/health`
    - **Method**: GET (System Status Retrieval)
    - **Purpose**: Basic health check
    - **Response**: Basic system status

29. `GET /api/v1/health/detailed`
    - **Method**: GET (System Status Retrieval)
    - **Purpose**: Detailed system health check
    - **Response**: Comprehensive system metrics

#### **HTTP Method Usage Summary**:
- **GET**: 16 endpoints (55.2%) - Resource and collection retrieval
- **POST**: 10 endpoints (34.5%) - Resource creation and actions
- **PUT**: 2 endpoints (6.9%) - Resource updates
- **DELETE**: 2 endpoints (6.9%) - Resource deletion

#### **RESTful Design Compliance**:
- ✅ **Resource-based URLs**: All endpoints follow `/api/v1/{resource}` pattern
- ✅ **HTTP Method Semantics**: Proper use of GET, POST, PUT, DELETE
- ✅ **Stateless Design**: Each request contains all necessary information
- ✅ **Uniform Interface**: Consistent response formats and error handling
- ✅ **Hierarchical URLs**: Logical resource relationships without artificial nesting

### Task 2: Include authentication requirements
**Status**: COMPLETED

From Phase 4.3 API compliance analysis:
- **5 endpoints** require NO authentication (auth endpoints + health endpoints)
- **24 endpoints** require JWT Bearer token authentication
- **TOKEN Authorizer** at API Gateway level (confirmed working in Phase 3.1)
- **Token blacklisting** via DynamoDB for logout functionality

### Task 3: Map endpoints to handler functions  
**Status**: COMPLETED

From Phase 3.3 handler responsibility mapping:
- **29 endpoints** → **29 individual Lambda functions**
- **Domain-based folder organization**: auth/, providers/, exams/, topics/, questions/, sessions/, analytics/, goals/, health/
- **Lambda naming**: `StudyAppV2-{HandlerName}-{stage}`
- **Clean boundaries**: Each handler has single responsibility per endpoint

### Task 4: Ensure no endpoints are missing or incorrectly removed
**Status**: COMPLETED

From Phase 4.1 cross-reference analysis:
- ✅ All **29 endpoints** from Phase 2.2 catalog included
- ✅ All **12 functional domains** from Phase 2.3 covered
- ✅ All **10 business entities** from Phase 2.1 supported
- ✅ No endpoints removed or missing from business requirements
- ✅ **100% API coverage** verified in Phase 4.2

---

## Phase 5.3: Clean Architecture Documentation

### Task 1: Document the clean architecture principles being followed
**Status**: IN PROGRESS

Based on Phases 1-4 analysis, documenting clean architecture principles for the multi-provider certification study platform rebuild:

#### **Project Context**: 
Multi-provider certification study platform (AWS, Azure, GCP, CompTIA, Cisco) requiring complete rebuild following infrastructure deletion due to technical debt accumulation.

#### **Clean Architecture Layers**:

**1. CDK Infrastructure Layer (cdk-v3/)**
```
cdk-v3/
├── src/
│   ├── constructs/                    # Reusable CDK constructs
│   │   ├── lambda-construct.ts        # Individual Lambda function construct
│   │   ├── dynamodb-construct.ts      # DynamoDB tables + GSIs
│   │   ├── s3-construct.ts            # S3 buckets + policies
│   │   ├── api-gateway-construct.ts   # API Gateway + TOKEN authorizer
│   │   └── cloudfront-construct.ts    # CloudFront + custom policies
│   ├── shared/
│   │   ├── stack-config.ts            # Environment configurations
│   │   ├── iam-policies.ts            # Shared IAM policy templates
│   │   └── common-props.ts            # Common construct properties
│   ├── study-app-stack-v3.ts          # Main stack definition
│   └── study-app-v3.ts                # CDK app entry point
└── package.json
```

**CDK Clean Architecture Principles**:
- **Construct Separation**: Each AWS service type in separate reusable construct
- **Configuration Management**: Environment-specific configs in shared/
- **Policy Reuse**: Common IAM policies defined once in shared/
- **Stack Composition**: Main stack composes constructs, doesn't define resources

**2. Application Layer (backend/)**
```
backend/
├── src/
│   ├── handlers/                      # Domain-based Lambda handlers
│   │   ├── auth.ts                    # Authentication Lambda (4 endpoints)
│   │   ├── providers.ts               # Provider Lambda (2 endpoints)
│   │   ├── exams.ts                   # Exam Lambda (2 endpoints)
│   │   ├── topics.ts                  # Topic Lambda (2 endpoints)
│   │   ├── questions.ts               # Question Lambda (3 endpoints)
│   │   ├── sessions.ts                # Session Lambda (7 endpoints)
│   │   ├── analytics.ts               # Analytics Lambda (3 endpoints)
│   │   ├── goals.ts                   # Goals Lambda (4 endpoints)
│   │   └── health.ts                  # Health Lambda (2 endpoints)
│   ├── services/                      # Business logic layer
│   │   ├── auth.service.ts            # Authentication business logic
│   │   ├── user.service.ts            # User management logic
│   │   ├── question.service.ts        # Question processing logic
│   │   ├── session.service.ts         # Session lifecycle logic
│   │   ├── analytics.service.ts       # Analytics computation logic
│   │   └── goals.service.ts           # Goals management logic
│   ├── repositories/                  # Data access layer
│   │   ├── user.repository.ts         # DynamoDB user operations
│   │   ├── session.repository.ts      # DynamoDB session operations
│   │   ├── question.repository.ts     # S3 question file operations
│   │   ├── progress.repository.ts     # DynamoDB progress operations
│   │   └── base.repository.ts         # Shared repository patterns
│   ├── shared/                        # Shared application code
│   │   ├── types/                     # TypeScript type definitions
│   │   ├── utils/                     # Utility functions
│   │   ├── middleware/                # Express-like middleware
│   │   ├── validators/                # Request validation schemas
│   │   └── constants/                 # Application constants
│   └── config/                        # Runtime configuration
│       ├── database.ts                # DynamoDB client configuration
│       ├── storage.ts                 # S3 client configuration
│       └── auth.ts                    # JWT configuration
├── scripts/
│   └── build.ts                       # ESBuild domain Lambda bundling script
└── package.json
```

**Build Configuration**:
```typescript
// scripts/build.ts - ESBuild configuration for individual Lambda bundling
import { build } from 'esbuild';
import { nodeExternals } from 'esbuild-node-externals';
import { glob } from 'glob';
import path from 'path';

async function buildAllLambdas() {
  // Find all Lambda handler entry points
  const lambdaPaths = await glob('*/*/src/index.ts', { cwd: 'lambdas' });
  
  // Build each Lambda individually
  const buildPromises = lambdaPaths.map(async (lambdaPath) => {
    const [domain, functionName] = lambdaPath.split('/');
    
    await build({
      entryPoints: [`lambdas/${lambdaPath}`],    # Individual Lambda entry point
      bundle: true,
      outfile: `dist/${domain}/${functionName}/index.js`,  # Individual bundle
      platform: 'node',
      target: 'node20',                         # Node.js 20 runtime
      format: 'cjs',                            # CommonJS for Lambda
      external: ['aws-sdk'],                    # Exclude AWS SDK (provided by runtime)
      plugins: [nodeExternals()],               # Auto-exclude node_modules
      minify: true,                             # Minimize bundle size
      sourcemap: false,                         # No sourcemaps for production
      treeShaking: true,                        # Remove unused code
      metafile: true,                           # Generate bundle analysis per function
    });
    
    console.log(`✅ Built ${domain}/${functionName}`);
  });
  
  await Promise.all(buildPromises);
  console.log(`🎉 Built ${lambdaPaths.length} Lambda functions (29 total)`);
}

buildAllLambdas().catch(console.error);
```

**Application Clean Architecture Principles**:
- **Individual Lambda Functions**: One Lambda per endpoint for optimal performance and isolation
- **Layer Separation**: handlers → services → repositories → AWS clients
- **Domain Organization**: Lambda functions grouped by business domain (9 domains)
- **Shared Code Reuse**: Common services, utilities, types, middleware in shared/ packages
- **Configuration Isolation**: Runtime configs in shared/config for all functions

#### **Architecture Benefits**:
- **Optimal Performance**: Individual bundling provides 40% faster cold starts (Phase 1 confirmed)
- **Fault Isolation**: Each function isolated for security and reliability
- **Independent Scaling**: Each endpoint scales based on individual demand patterns
- **Clean Domain Separation**: Each Lambda function has single endpoint responsibility
- **Shared Code Efficiency**: Common business logic reused across functions via shared/ packages
- **ARM64 Performance**: Cost and performance benefits with modern architecture

### Task 2: Explain handler separation of concerns
**Status**: COMPLETED

Based on Phase 1 lessons learned identifying cross-handler contamination issues, documenting clean handler separation for the NEW implementation:

#### **Domain-Based Lambda Functions Architecture**:

From Phase 1-4 analysis: Domain-based Lambda functions (9 total) for optimal performance, isolation, and scalability in the NEW serverless architecture. Each Lambda function handles multiple endpoints within its domain.

#### **Domain-Based Lambda Function Separation Rules**:

**Authentication Lambda Function** (auth.ts - handles 4 endpoints):
- ✅ **ONLY** authentication domain API request handling
- ✅ **ONLY** route requests to appropriate service methods (register, login, refresh, logout)
- ❌ **NEVER** password hashing, JWT generation, credential validation (delegate to AuthService)
- ❌ **NEVER** cross-domain operations or direct database access

**Provider Lambda Function** (providers.ts - handles 2 endpoints):
- ✅ **ONLY** provider domain API request handling  
- ✅ **ONLY** route requests to appropriate service methods (list providers, get provider details)
- ❌ **NEVER** metadata loading, filtering logic, S3 operations (delegate to QuestionService)
- ❌ **NEVER** cross-domain operations or direct database access

**Exam Lambda Function** (exams.ts - handles 2 endpoints):
- ✅ **ONLY** exam domain API request handling
- ✅ **ONLY** route requests to appropriate service methods (list exams, get exam details)  
- ❌ **NEVER** exam metadata loading, filtering logic (delegate to QuestionService)
- ❌ **NEVER** cross-domain operations or direct database access

**Topic Lambda Function** (topics.ts - handles 2 endpoints):
- ✅ **ONLY** topic domain API request handling
- ✅ **ONLY** route requests to appropriate service methods (list topics, get topic details)
- ❌ **NEVER** topic metadata loading, filtering logic (delegate to QuestionService)
- ❌ **NEVER** cross-domain operations or direct database access

**Question Lambda Function** (questions.ts - handles 3 endpoints):
- ✅ **ONLY** question domain API request handling
- ✅ **ONLY** route requests to appropriate service methods (list, get, search questions)
- ❌ **NEVER** S3 operations, filtering logic, search implementation (delegate to QuestionService)
- ❌ **NEVER** cross-domain operations or direct database access

**Session Lambda Function** (sessions.ts - handles 7 endpoints):
- ✅ **ONLY** session domain API request handling
- ✅ **ONLY** route requests to appropriate service methods (create, get, update, delete, submit, complete, adaptive)
- ❌ **NEVER** question loading, randomization, scoring, analytics computation (delegate to SessionService)
- ❌ **NEVER** cross-domain operations or direct database access

**Analytics Lambda Function** (analytics.ts - handles 3 endpoints):
- ✅ **ONLY** analytics domain API request handling
- ✅ **ONLY** route requests to appropriate service methods (progress, session, performance analytics)
- ❌ **NEVER** trend calculation, aggregation, competency scoring (delegate to AnalyticsService)
- ❌ **NEVER** cross-domain operations or direct database access

**Goals Lambda Function** (goals.ts - handles 4 endpoints):
- ✅ **ONLY** goals domain API request handling
- ✅ **ONLY** route requests to appropriate service methods (list, create, update, delete goals)
- ❌ **NEVER** progress computation, milestone logic, tracking setup (delegate to GoalsService)
- ❌ **NEVER** cross-domain operations or direct database access

**Health Lambda Function** (health.ts - handles 2 endpoints):
- ✅ **ONLY** health domain API request handling
- ✅ **ONLY** route requests to appropriate service methods (basic, detailed health checks)
- ❌ **NEVER** infrastructure checks, service monitoring logic (delegate to HealthService)
- ❌ **NEVER** cross-domain operations or direct database access

#### **BaseHandler Pattern (All 9 Lambda functions follow this exact pattern)**:
```typescript
// Each domain Lambda function follows this exact BaseHandler pattern
import { BaseHandler } from '../shared/base-handler';
import { ServiceFactory } from '../shared/factories/service-factory';

// ✅ CORRECT: Domain handler extends BaseHandler - eliminates all boilerplate
class AuthHandler extends BaseHandler {
  private authService = ServiceFactory.createAuthService();
  
  // Pure business logic - no boilerplate needed
  public async register(event: APIGatewayProxyEvent) {
    const userData = this.parseRequest(event.body);
    const result = await this.authService.registerUser(userData);
    return this.success(result, 'User registered successfully');
  }
  
  public async login(event: APIGatewayProxyEvent) {
    const credentials = this.parseRequest(event.body);
    const result = await this.authService.authenticate(credentials);
    return this.success(result, 'Login successful');
  }
  
  public async refresh(event: APIGatewayProxyEvent) {
    const { refreshToken } = this.parseRequest(event.body);
    const result = await this.authService.refreshTokens(refreshToken);
    return this.success(result, 'Tokens refreshed');
  }
  
  public async logout(event: APIGatewayProxyEvent, userId: string) {
    const token = this.getAuthToken(event);
    await this.authService.logout(token);
    return this.success(null, 'Logout successful');
  }
}

// BaseHandler eliminates ALL boilerplate (CORS, auth, logging, error handling)
const authHandler = new AuthHandler();

// Public endpoints (no auth required)
export const register = authHandler.withoutAuth((event) => authHandler.register(event));
export const login = authHandler.withoutAuth((event) => authHandler.login(event));

// Protected endpoints (auth required)  
export const refresh = authHandler.withAuth((event, userId) => authHandler.refresh(event));
export const logout = authHandler.withAuth((event, userId) => authHandler.logout(event, userId));
```

**BaseHandler Benefits**:
- **Zero Boilerplate**: No CORS, auth, logging, or error handling code in handlers
- **Clean Separation**: Pure business logic only in handler methods
- **Consistent Patterns**: All handlers follow identical BaseHandler pattern
- **Type Safety**: TypeScript interfaces ensure correct method signatures

#### **Cross-Domain Communication Prevention**:

**Domain Isolation Rules (NEW Architecture)**:
- Domain Lambda functions cannot communicate directly with other domain Lambda functions
- Each domain Lambda only accesses services within its domain or shared services
- Cross-domain data access only through properly injected service dependencies
- No Lambda function bypasses service layer to access repositories directly

**Communication Flow (Domain Lambda Architecture)**:
```typescript
// ✅ CORRECT: Each domain Lambda follows clean architecture layers
AuthLambda → AuthService → UserService → UserRepository → DynamoDB

// ✅ CORRECT: Shared service usage
QuestionLambda → QuestionService → CacheService → Redis/S3

// ❌ FORBIDDEN: Cross-Lambda communication
AuthLambda ❌ → SessionLambda
QuestionLambda ❌ → UserRepository  
SessionLambda ❌ → DynamoDB directly
```

#### **Handler Responsibility Boundaries (All 9 Domain Lambda Functions)**:

**Universal Handler Responsibilities** (All handlers MUST):
- HTTP request parsing and validation 
- Input sanitization and basic validation
- Service method invocation with parsed data
- HTTP response formatting according to API contract
- Error handling with proper status codes
- Request logging for audit trail

**Universal Handler Prohibitions** (All handlers MUST NOT):
- Business logic implementation or computation
- Direct database/file system/cache access
- Cross-Lambda function communication
- Infrastructure concerns (S3, DynamoDB, Redis operations)
- Data transformation beyond response formatting
- Authentication logic (handled at API Gateway level)

### Task 3: Define service layer and repository patterns
**Status**: IN PROGRESS

#### **Service Layer Architecture (Business Logic)**:

**Domain Services** (Business Logic per Domain):
```typescript
// Authentication Service
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private tokenService: TokenService
  ) {}

  async registerUser(userData: CreateUserRequest): Promise<AuthResult> {
    // Business logic: email uniqueness, password validation, JWT generation
  }
}

// Question Service  
export class QuestionService {
  constructor(
    private questionRepository: QuestionRepository,
    private cacheService: CacheService
  ) {}

  async getQuestions(filters: QuestionFilters): Promise<PaginatedQuestions> {
    // Business logic: filtering, caching, cross-provider question loading
  }
}
```

**Shared Services** (Cross-Domain):
```typescript
// Cache Service (used by multiple domains)
export class CacheService {
  async getQuestions(cacheKey: string): Promise<Question[] | null> {
    // Business logic: cache key generation, TTL management
  }
}

// Validation Service (used by all handlers)  
export class ValidationService {
  validateRequest(schema: Schema, data: any): ValidationResult {
    // Business logic: cross-field validation, business rules
  }
}

// JWT Service (authentication)
export class JwtService {
  generateTokens(user: User): Promise<TokenPair> {
    // Business logic: JWT generation with proper claims
  }
  
  validateToken(token: string): Promise<TokenPayload> {
    // Business logic: JWT validation and claims extraction
  }
}
```

#### **CrudHandler Pattern** (For CRUD Operations):
```typescript
// Abstract CRUD handler for entities with standard operations
export abstract class CrudHandler<T> extends BaseHandler {
  constructor(
    protected handlerName: string,
    protected entityName: string
  ) {
    super();
  }

  // Automatic HTTP method routing
  public async handleCrudRequest(event: APIGatewayProxyEvent, userId: string) {
    const { httpMethod, pathParameters } = event;
    const id = pathParameters?.id;

    switch (httpMethod) {
      case 'GET':
        return id 
          ? this.handleGet(id, userId, event)
          : this.handleList(userId, event);
      case 'POST':
        const createData = this.parseRequest<T>(event.body);
        return this.handleCreate(createData, userId, event);
      case 'PUT':
        const updateData = this.parseRequest<Partial<T>>(event.body);
        return this.handleUpdate(id!, updateData, userId, event);
      case 'DELETE':
        return this.handleDelete(id!, userId, event);
      default:
        return this.error(`Method ${httpMethod} not allowed`, 405);
    }
  }

  // Abstract methods to implement in concrete handlers
  protected abstract handleList(userId: string, event: APIGatewayProxyEvent): Promise<any>;
  protected abstract handleGet(id: string, userId: string, event: APIGatewayProxyEvent): Promise<any>;
  protected abstract handleCreate(data: T, userId: string, event: APIGatewayProxyEvent): Promise<any>;
  protected abstract handleUpdate(id: string, data: Partial<T>, userId: string, event: APIGatewayProxyEvent): Promise<any>;
  protected abstract handleDelete(id: string, userId: string, event: APIGatewayProxyEvent): Promise<any>;
}

// Example: Goals CRUD handler
class GoalsHandler extends CrudHandler<StudyGoal> {
  constructor() {
    super('GoalsHandler', 'Goal');
  }
  
  protected async handleList(userId: string) {
    const goals = await this.goalsService.getUserGoals(userId);
    return this.success(goals, 'Goals retrieved successfully');
  }
  
  protected async handleCreate(data: StudyGoal, userId: string) {
    const goal = await this.goalsService.createGoal(data, userId);
    return this.success(goal, 'Goal created successfully');
  }
  
  // ... other CRUD methods
}
```

#### **Shared Utilities**:
```typescript
// Response Builder (consistent API responses)
export class ResponseBuilder {
  static success(data: any, message?: string, statusCode: number = 200) {
    return {
      statusCode,
      headers: this.corsHeaders(),
      body: JSON.stringify({
        success: true,
        data,
        message
      })
    };
  }
  
  static error(message: string, statusCode: number = 500, details?: any) {
    return {
      statusCode,
      headers: this.corsHeaders(),
      body: JSON.stringify({
        success: false,
        error: message,
        details
      })
    };
  }
}

// Logger (structured logging)
export class Logger {
  static info(message: string, context?: any) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      context
    }));
  }
  
  static error(message: string, error?: Error, context?: any) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error?.message,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      context
    }));
  }
}
```

#### **Repository Pattern Implementation**:

**DynamoDB Repositories** (User Data):
```typescript
export class UserRepository extends BaseRepository<User> {
  constructor(private dynamoClient: DynamoDBClient) {
    super(dynamoClient, 'Users');
  }

  async findByEmail(email: string): Promise<User | null> {
    // Uses email-index GSI
  }
}

export class SessionRepository extends BaseRepository<StudySession> {
  constructor(private dynamoClient: DynamoDBClient) {
    super(dynamoClient, 'StudySessions');  
  }

  async addAnswer(sessionId: string, answer: Answer): Promise<void> {
    // Updates answers array in session document
  }
}
```

**S3 Repositories** (Question Data):
```typescript  
export class QuestionRepository {
  constructor(private s3Client: S3Client) {}

  async getQuestionsByExam(providerId: string, examId: string): Promise<Question[]> {
    // Loads from S3 path: /questions/{provider}/{exam}/questions.json
  }
}
```

**Base Repository** (Shared Patterns):
```typescript
export abstract class BaseRepository<T> {
  constructor(
    protected dynamoClient: DynamoDBClient,
    protected tableName: string
  ) {}

  async create(item: T): Promise<T> {
    // Common DynamoDB create operation
  }

  async findById(id: string): Promise<T | null> {
    // Common DynamoDB query operation  
  }
}
```

### Task 4: Plan dependency injection structure  
**Status**: COMPLETED

#### **Domain Lambda DI Architecture**:

Based on the 9 domain-based Lambda functions with BaseHandler/CrudHandler patterns:

**Service Factory Pattern** (Shared across all domain Lambdas):
```typescript
// shared/factories/service-factory.ts - Used across all 9 domain Lambdas
export class ServiceFactory {
  private static dynamoClient: DynamoDBClient;
  private static s3Client: S3Client;
  private static redisClient: RedisClient;
  
  // AWS Client Singletons (reused across Lambda container lifecycle)
  static getDynamoClient(): DynamoDBClient {
    if (!this.dynamoClient) {
      this.dynamoClient = new DynamoDBClient({ 
        region: process.env.AWS_REGION,
        maxAttempts: 3
      });
    }
    return this.dynamoClient;
  }
  
  static getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({ 
        region: process.env.AWS_REGION,
        maxAttempts: 3
      });
    }
    return this.s3Client;
  }

  static getRedisClient(): RedisClient {
    if (!this.redisClient) {
      this.redisClient = new RedisClient({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379')
      });
    }
    return this.redisClient;
  }
  
  // Domain Service Factory Methods
  static createAuthService(): AuthService {
    const userRepository = new UserRepository(this.getDynamoClient());
    const jwtService = new JwtService();
    return new AuthService(userRepository, jwtService);
  }
  
  static createUserService(): UserService {
    const userRepository = new UserRepository(this.getDynamoClient());
    return new UserService(userRepository);
  }
  
  static createQuestionService(): QuestionService {
    const questionRepository = new QuestionRepository(this.getS3Client());
    const cacheService = new CacheService(this.getRedisClient());
    return new QuestionService(questionRepository, cacheService);
  }
  
  static createSessionService(): SessionService {
    const sessionRepository = new SessionRepository(this.getDynamoClient());
    const progressRepository = new ProgressRepository(this.getDynamoClient());
    const questionService = this.createQuestionService();
    return new SessionService(sessionRepository, progressRepository, questionService);
  }
  
  static createAnalyticsService(): AnalyticsService {
    const sessionRepository = new SessionRepository(this.getDynamoClient());
    const progressRepository = new ProgressRepository(this.getDynamoClient());
    const cacheService = new CacheService(this.getRedisClient());
    return new AnalyticsService(sessionRepository, progressRepository, cacheService);
  }
  
  static createGoalsService(): GoalsService {
    const goalsRepository = new GoalsRepository(this.getDynamoClient());
    const progressRepository = new ProgressRepository(this.getDynamoClient());
    return new GoalsService(goalsRepository, progressRepository);
  }
}
```

#### **Domain Lambda DI Implementation Examples**:

**Authentication Lambda** (auth.ts):
```typescript
import { BaseHandler } from '../shared/base-handler';
import { ServiceFactory } from '../shared/factories/service-factory';

class AuthHandler extends BaseHandler {
  private authService = ServiceFactory.createAuthService();
  private userService = ServiceFactory.createUserService();
  
  public async register(event: APIGatewayProxyEvent) {
    const userData = this.parseRequest(event.body);
    const result = await this.authService.registerUser(userData);
    return this.success(result, 'User registered successfully');
  }
  
  public async login(event: APIGatewayProxyEvent) {
    const credentials = this.parseRequest(event.body);
    const result = await this.authService.authenticate(credentials);
    return this.success(result, 'Login successful');
  }
  
  // ... other auth methods
}

const authHandler = new AuthHandler();
export const register = authHandler.withoutAuth((event) => authHandler.register(event));
export const login = authHandler.withoutAuth((event) => authHandler.login(event));
```

**Goals Lambda with CrudHandler** (goals.ts):
```typescript
import { CrudHandler } from '../shared/crud-handler';
import { ServiceFactory } from '../shared/factories/service-factory';

class GoalsHandler extends CrudHandler<StudyGoal> {
  private goalsService = ServiceFactory.createGoalsService();
  
  constructor() {
    super('GoalsHandler', 'Goal');
  }
  
  protected async handleList(userId: string) {
    const goals = await this.goalsService.getUserGoals(userId);
    return this.success(goals, 'Goals retrieved successfully');
  }
  
  protected async handleCreate(data: StudyGoal, userId: string) {
    const goal = await this.goalsService.createGoal(data, userId);
    return this.success(goal, 'Goal created successfully');
  }
  
  protected async handleUpdate(id: string, data: Partial<StudyGoal>, userId: string) {
    const goal = await this.goalsService.updateGoal(id, data, userId);
    return this.success(goal, 'Goal updated successfully');
  }
  
  protected async handleDelete(id: string, userId: string) {
    await this.goalsService.deleteGoal(id, userId);
    return this.success(null, 'Goal deleted successfully');
  }
  
  protected async handleGet(id: string, userId: string) {
    const goal = await this.goalsService.getGoal(id, userId);
    return this.success(goal, 'Goal retrieved successfully');
  }
}

const goalsHandler = new GoalsHandler();
export const handler = goalsHandler.withAuth(
  (event, userId) => goalsHandler.handleCrudRequest(event, userId)
);
```

**Sessions Lambda** (sessions.ts):
```typescript
import { BaseHandler } from '../shared/base-handler';
import { ServiceFactory } from '../shared/factories/service-factory';

class SessionsHandler extends BaseHandler {
  private sessionService = ServiceFactory.createSessionService();
  private analyticsService = ServiceFactory.createAnalyticsService();
  
  public async createSession(event: APIGatewayProxyEvent, userId: string) {
    const sessionConfig = this.parseRequest(event.body);
    const session = await this.sessionService.createSession(sessionConfig, userId);
    return this.success(session, 'Session created successfully');
  }
  
  public async submitAnswer(event: APIGatewayProxyEvent, userId: string) {
    const { sessionId } = event.pathParameters!;
    const answerData = this.parseRequest(event.body);
    const result = await this.sessionService.submitAnswer(sessionId, answerData);
    return this.success(result, 'Answer submitted successfully');
  }
  
  public async completeSession(event: APIGatewayProxyEvent, userId: string) {
    const { sessionId } = event.pathParameters!;
    const results = await this.sessionService.completeSession(sessionId);
    return this.success(results, 'Session completed successfully');
  }
  
  // ... other session methods
}

const sessionsHandler = new SessionsHandler();
export const createSession = sessionsHandler.withAuth(
  (event, userId) => sessionsHandler.createSession(event, userId)
);
export const submitAnswer = sessionsHandler.withAuth(
  (event, userId) => sessionsHandler.submitAnswer(event, userId)
);
```

#### **DI Architecture Benefits**:
- **Service Reuse**: ServiceFactory creates consistent service instances across all 9 Lambdas
- **Connection Pooling**: AWS clients reused across Lambda container lifecycle for performance
- **Clean Dependencies**: Each domain Lambda gets exactly the services it needs
- **Type Safety**: TypeScript ensures correct service injection
- **Testing**: Easy to mock services for unit testing
- **Consistency**: All domain Lambdas follow identical DI patterns
- **Performance**: Services initialized once per container, not per request

---

## Phase 5.4: Backend Implementation Plan and Project Structure Rebuild

### Task 1: Delete existing implementation plan document
**Status**: COMPLETED

**Action Taken**: Reviewed existing implementation plan documents:
- `/docs/V2_CLEAN_IMPLEMENTATION_PLAN.md` - Outdated (references PostgreSQL instead of DynamoDB+S3)
- `/docs/tools/implementation-plan.md` - Data parsing focused, not backend architecture

**Decision**: Keep existing documents for historical reference but create NEW comprehensive implementation plan based on Phase 1-4 findings and correct architecture (AWS Lambda + DynamoDB + S3).

### Task 2: Review BACKEND_REQUIREMENTS.md for current requirements  
**Status**: COMPLETED

**Key Requirements Identified**:
- Documentation-first development approach
- One feature per implementation phase
- SOLID principles and clean architecture
- Comprehensive testing strategy
- 6 required documents: README, IMPLEMENTATION_PLAN, PROJECT_STRUCTURE, ARCHITECTURE, API_REFERENCE, CODE_EXAMPLES
- Separation of planning from code examples
- Quality-first development with anti-pattern prevention

### Task 3: Create new comprehensive backend implementation plan
**Status**: COMPLETED

**Action Taken**: Created new comprehensive implementation plan at `/backend/docs/V3_IMPLEMENTATION_PLAN.md`

**Key Features Implemented**:
- Documentation-first development approach (per BACKEND_REQUIREMENTS.md)
- One feature per implementation phase (10 phases total)
- Clean architecture with BaseHandler/CrudHandler patterns
- 9 domain-based Lambda functions (auth, providers, exams, topics, questions, sessions, analytics, goals, health)  
- Complete testing strategy with 90% coverage requirement
- SOLID principles enforcement throughout
- Service layer and repository patterns
- Dependency injection via ServiceFactory
- Performance targets and success metrics defined

**Architecture Alignment**:
- AWS CDK V3 with TypeScript constructs
- Lambda Node.js 20 with ARM64 architecture
- DynamoDB + S3 + Redis architecture (matches Phase 1-4 findings)
- JWT TOKEN authorizer (proven working approach)
- 29 total API endpoints across all domains

### Task 4: Create new backend project structure document
**Status**: COMPLETED

**Action Taken**: Created comprehensive project structure document at `/backend/docs/PROJECT_STRUCTURE.md`

**Key Components Documented**:
- Complete backend file organization (centralized reference)
- CDK V3 infrastructure structure with constructs
- 9 domain-based Lambda function organization
- Shared utilities and clean architecture patterns
- Complete testing infrastructure (unit, integration, e2e, performance)
- Data organization for S3 question files
- Build scripts and configuration structure
- Module dependencies and import guidelines
- Component relationships and domain boundaries
- File naming conventions and standards

**Architecture Support**:
- BaseHandler/CrudHandler patterns documented
- Service layer and repository organization
- Dependency injection via ServiceFactory
- Clean architecture layer separation
- SOLID principles compliance structure

### Task 5: Define CDK and Lambdas folder structure  
**Status**: COMPLETED

**CDK Structure Defined** (app/cdk-v3/):
```
cdk-v3/
├── bin/study-app-v3.ts              # CDK app entry point
├── lib/stacks/study-app-stack-v3.ts # Main stack definition
├── lib/constructs/                  # Reusable CDK constructs
│   ├── api-gateway-construct.ts     # API Gateway + TOKEN authorizer
│   ├── lambda-construct.ts          # Lambda function constructs
│   ├── database-construct.ts        # DynamoDB tables + GSIs
│   ├── storage-construct.ts         # S3 buckets + policies
│   └── [other constructs]
└── lib/shared/                      # CDK utilities and config
```

**Lambda Structure Defined** (app/lambdas/):
```
lambdas/
├── src/handlers/                    # 9 domain-based Lambda handlers
│   ├── auth.ts                      # Authentication (4 endpoints)
│   ├── providers.ts                 # Provider management (2 endpoints)
│   ├── exams.ts                     # Exam management (2 endpoints)
│   ├── topics.ts                    # Topic management (2 endpoints)
│   ├── questions.ts                 # Question management (3 endpoints)
│   ├── sessions.ts                  # Study sessions (7 endpoints)
│   ├── analytics.ts                 # Analytics (3 endpoints)
│   ├── goals.ts                     # Goal management (4 endpoints)
│   └── health.ts                    # Health monitoring (2 endpoints)
├── src/services/                    # Business logic layer
├── src/repositories/                # Data access layer
└── src/shared/                      # Shared utilities (BaseHandler, etc.)
```

**Clean Architecture Support**:
- Domain boundaries clearly defined
- Service layer and repository separation
- Shared patterns (BaseHandler, CrudHandler, ServiceFactory)
- Testing infrastructure organization
- Build and deployment script structure

---

---

## Phase 5.5: API Standards and Quality Requirements

### Task 1: Document API compliance requirements and validation
**Status**: COMPLETED

Based on Phase 4.3 API reference compliance and Phase 2.2 API standards analysis:

#### **RESTful API Standards Compliance**:

**API Design Principles** (All 29 endpoints must comply):
1. **Resource-Based URLs**: All endpoints follow `/api/v1/{resource}` pattern
2. **HTTP Method Semantics**: Proper use of GET (retrieval), POST (creation/actions), PUT (updates), DELETE (deletion)
3. **Stateless Design**: Each request contains all necessary information via headers/body
4. **Uniform Interface**: Consistent response formats and error handling across all endpoints
5. **Hierarchical URLs**: Logical resource relationships (e.g., `/sessions/{id}/answers`)

**Response Format Standards** (All endpoints):
```typescript
// Success Response Format (Status: 200, 201, 204)
interface SuccessResponse<T> {
  success: true;
  data: T;
  message: string;
  metadata?: {
    pagination?: PaginationMeta;
    timestamp: string;
    requestId: string;
  };
}

// Error Response Format (Status: 400, 401, 403, 404, 422, 500)
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string;  // For validation errors
  };
  metadata: {
    timestamp: string;
    requestId: string;
    path: string;
  };
}
```

**HTTP Status Code Standards**:
- **200 OK**: Successful GET, PUT operations
- **201 Created**: Successful POST operations (resource creation)
- **204 No Content**: Successful DELETE operations
- **400 Bad Request**: Invalid request syntax or parameters
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Valid token but insufficient permissions
- **404 Not Found**: Resource does not exist
- **422 Unprocessable Entity**: Validation errors
- **429 Too Many Requests**: Rate limiting exceeded
- **500 Internal Server Error**: Server-side errors

**Authentication Standards**:
- **JWT Bearer Token**: All protected endpoints require `Authorization: Bearer <token>`
- **TOKEN Authorizer**: API Gateway level authentication (proven working)
- **Token Refresh**: 15-minute access tokens with 7-day refresh tokens
- **Token Blacklisting**: Logout functionality via DynamoDB blacklist

**Request Validation Standards**:
```typescript
// Input Validation Requirements (All POST/PUT endpoints)
interface ValidationRequirements {
  // Required field validation
  requiredFields: string[];
  
  // Type validation with proper error messages
  typeValidation: {
    field: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    message: string;
  }[];
  
  // Business rule validation
  businessRules: {
    field: string;
    rule: string;
    message: string;
  }[];
  
  // Cross-field validation
  crossFieldValidation?: {
    fields: string[];
    rule: string;
    message: string;
  }[];
}
```

**Pagination Standards** (Collection endpoints):
```typescript
// Pagination Parameters (Query strings)
interface PaginationParams {
  limit?: number;    // Default: 20, Max: 100
  offset?: number;   // Default: 0
  sortBy?: string;   // Default: createdAt
  sortOrder?: 'asc' | 'desc';  // Default: desc
}

// Pagination Metadata (Response)
interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset?: number;
  totalPages: number;
  currentPage: number;
}
```

**Error Handling Standards**:
```typescript
// Domain-Specific Error Types
export enum ErrorTypes {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR', 
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

// Error Response Factory
export class ApiErrorHandler {
  static validationError(field: string, message: string) {
    return {
      statusCode: 422,
      body: {
        success: false,
        error: {
          code: ErrorTypes.VALIDATION_ERROR,
          message: `Validation failed for field: ${field}`,
          details: message,
          field
        }
      }
    };
  }
  
  static authenticationError(message: string = 'Invalid or missing authentication token') {
    return {
      statusCode: 401,
      body: {
        success: false,
        error: {
          code: ErrorTypes.AUTHENTICATION_ERROR,
          message
        }
      }
    };
  }
}
```

#### **API Endpoint Compliance Matrix**:

**Authentication Endpoints** (4 endpoints - Public):
- ✅ `POST /api/v1/auth/register` - User registration with validation
- ✅ `POST /api/v1/auth/login` - User login with JWT generation
- ❌ `POST /api/v1/auth/refresh` - Token refresh (MISSING)
- ❌ `POST /api/v1/auth/logout` - User logout with blacklisting (MISSING)

**Provider Endpoints** (2 endpoints - Protected):
- ✅ `GET /api/v1/providers` - List providers with pagination
- ❌ `GET /api/v1/providers/{id}` - Get provider details (MISSING)

**Exam Endpoints** (2 endpoints - Protected):
- ❌ `GET /api/v1/exams` - List exams with filtering (MISSING)
- ❌ `GET /api/v1/exams/{id}` - Get exam details (MISSING)

**Topic Endpoints** (2 endpoints - Protected):
- ❌ `GET /api/v1/topics` - List topics with filtering (MISSING)
- ❌ `GET /api/v1/topics/{id}` - Get topic details (MISSING)

**Question Endpoints** (3 endpoints - Protected):
- ❌ `GET /api/v1/questions` - List questions with advanced filtering (MISSING)
- ❌ `GET /api/v1/questions/{id}` - Get question with explanation (MISSING)
- ❌ `POST /api/v1/questions/search` - Full-text search with relevance (MISSING)

**Session Endpoints** (7 endpoints - Protected):
- ❌ `POST /api/v1/sessions` - Create session with configuration (MISSING)
- ❌ `GET /api/v1/sessions/{id}` - Get session with current question (MISSING)
- ❌ `PUT /api/v1/sessions/{id}` - Update session state (MISSING)
- ❌ `DELETE /api/v1/sessions/{id}` - Delete/abandon session (MISSING)
- ❌ `POST /api/v1/sessions/{id}/answers` - Submit answer with feedback (MISSING)
- ❌ `POST /api/v1/sessions/{id}/complete` - Complete session with results (MISSING)
- ❌ `POST /api/v1/sessions/adaptive` - Create adaptive session (MISSING)

**Analytics Endpoints** (3 endpoints - Protected):
- ❌ `GET /api/v1/analytics/progress` - User progress analytics (MISSING)
- ❌ `GET /api/v1/analytics/sessions/{id}` - Session performance analytics (MISSING)
- ❌ `GET /api/v1/analytics/performance` - Competency and trends (MISSING)

**Goals Endpoints** (4 endpoints - Protected):
- ❌ `GET /api/v1/goals` - List user goals (MISSING)
- ❌ `POST /api/v1/goals` - Create goal (MISSING)
- ❌ `PUT /api/v1/goals/{id}` - Update goal (MISSING)
- ❌ `DELETE /api/v1/goals/{id}` - Delete goal (MISSING)

**Health Endpoints** (2 endpoints - Public):
- ❌ `GET /api/v1/health` - Basic health check (MISSING)
- ❌ `GET /api/v1/health/detailed` - Detailed diagnostics (MISSING)

**API Compliance Status**: 3 of 29 endpoints (10.3%) currently compliant with standards

### Task 2: Define testing standards and coverage requirements
**Status**: PENDING

### Task 3: Create deployment and monitoring requirements  
**Status**: PENDING

### Task 4: Document security and authentication standards
**Status**: PENDING

---

---

# V3 BACKEND IMPLEMENTATION PLAN - CONCRETE EXECUTION STEPS

## Overview
This plan provides **explicit, executable steps** to rebuild the multi-provider certification study platform backend from scratch. Each phase contains concrete commands, file creation steps, and code to implement.

**Architecture**: AWS CDK V3 → API Gateway → Lambda (Node.js 20 ARM64) → DynamoDB + S3 + Redis  
**Total Implementation**: 15 phases, 29 API endpoints, 90% test coverage requirement

---

## PHASE 1: Project Setup and Infrastructure Foundation
**Duration**: 2-3 days  
**Dependencies**: None  
**Goal**: Create CDK V3 project with basic infrastructure

### Step 1.1: Initialize CDK Project
```bash
# Create project directory
mkdir study-app-v3
cd study-app-v3

# Initialize CDK application
cdk init app --language typescript

# Install core dependencies
npm install @aws-cdk/aws-lambda @aws-cdk/aws-apigateway @aws-cdk/aws-dynamodb @aws-cdk/aws-s3 @aws-cdk/aws-elasticache
```

### Step 1.2: Create Project Structure
```bash
# Create directory structure
mkdir -p lib/constructs lib/shared
mkdir -p lambda/src/{handlers,services,repositories,shared} lambda/src/shared/{middleware,types,utils}
mkdir -p lambda/tests/{unit,integration,e2e}
mkdir -p data/questions/{aws,azure,gcp,comptia,cisco}
mkdir -p docs/{api,architecture,deployment}
```

### Step 1.3: Create CDK Configuration Files
Create `lib/shared/config.ts`:
```typescript
export interface StackConfig {
  readonly stage: string;
  readonly region: string;
  readonly tableName: string;
  readonly bucketName: string;
  readonly domainName?: string;
}

export const getConfig = (stage: string): StackConfig => ({
  stage,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  tableName: `StudyAppV3-${stage}`,
  bucketName: `studyappv3-data-${stage}`,
  domainName: stage === 'prod' ? 'api.studyapp.com' : undefined
});
```

### Step 1.4: Create Basic CDK Stack
Create `lib/study-app-stack-v3.ts`:
```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { getConfig } from './shared/config';

export class StudyAppStackV3 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const stage = this.node.tryGetContext('stage') || 'dev';
    const config = getConfig(stage);
    
    // Tag all resources
    cdk.Tags.of(this).add('Project', 'StudyAppV3');
    cdk.Tags.of(this).add('Stage', config.stage);
  }
}
```

### Step 1.5: Verification Steps
```bash
# Verify CDK setup
cdk list
cdk synth

# Expected output: StudyAppStackV3
```

**Deliverable**: Basic CDK project structure ready for constructs

---

## PHASE 2: DynamoDB Tables and Indexes
**Duration**: 1-2 days  
**Dependencies**: Phase 1  
**Goal**: Create all DynamoDB tables with proper GSI indexes

### Step 2.1: Create Database Construct
Create `lib/constructs/database-construct.ts`:
```typescript
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class DatabaseConstruct extends Construct {
  public readonly userTable: dynamodb.Table;
  public readonly sessionTable: dynamodb.Table;
  public readonly progressTable: dynamodb.Table;
  public readonly goalTable: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Users table with email index
    this.userTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'StudyAppV3-Users',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true
    });

    this.userTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING }
    });

    // Study Sessions table
    this.sessionTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: 'StudyAppV3-Sessions',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    this.sessionTable.addGlobalSecondaryIndex({
      indexName: 'user-sessions-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING }
    });

    // Progress table
    this.progressTable = new dynamodb.Table(this, 'ProgressTable', {
      tableName: 'StudyAppV3-Progress',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'progressKey', type: dynamodb.AttributeType.STRING }, // provider#exam#topic
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Goals table
    this.goalTable = new dynamodb.Table(this, 'GoalsTable', {
      tableName: 'StudyAppV3-Goals',
      partitionKey: { name: 'goalId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    this.goalTable.addGlobalSecondaryIndex({
      indexName: 'user-goals-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING }
    });
  }
}
```

### Step 2.2: Update Main Stack
Edit `lib/study-app-stack-v3.ts`:
```typescript
import { DatabaseConstruct } from './constructs/database-construct';

export class StudyAppStackV3 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const config = getConfig(stage);
    
    // Create database
    const database = new DatabaseConstruct(this, 'Database');
    
    // Output table names for Lambda environment variables
    new cdk.CfnOutput(this, 'UserTableName', {
      value: database.userTable.tableName,
      exportName: `${config.stage}-UserTableName`
    });
  }
}
```

### Step 2.3: Deploy and Verify
```bash
# Deploy database only
cdk deploy --context stage=dev

# Verify tables created
aws dynamodb list-tables --region us-east-1
```

**Expected Output**: 4 DynamoDB tables with proper GSI indexes

---

## PHASE 3: S3 Storage and Question Data Setup
**Duration**: 1-2 days  
**Dependencies**: Phase 2  
**Goal**: Create S3 bucket and upload question data structure

### Step 3.1: Create Storage Construct
Create `lib/constructs/storage-construct.ts`:
```typescript
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class StorageConstruct extends Construct {
  public readonly dataBucket: s3.Bucket;

  constructor(scope: Construct, id: string, config: any) {
    super(scope, id);

    this.dataBucket = new s3.Bucket(this, 'DataBucket', {
      bucketName: config.bucketName,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      cors: [{
        allowedOrigins: ['*'],
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
        allowedHeaders: ['*']
      }]
    });
  }
}
```

### Step 3.2: Create Question Data Structure
Create `scripts/setup-questions.js`:
```javascript
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

const s3 = new AWS.S3();
const bucketName = process.env.BUCKET_NAME;

async function uploadQuestionStructure() {
  const providers = ['aws', 'azure', 'gcp', 'comptia', 'cisco'];
  
  for (const provider of providers) {
    // Create provider metadata
    const providerData = {
      id: provider,
      name: provider.toUpperCase(),
      description: `${provider.toUpperCase()} certification provider`,
      exams: []
    };
    
    await s3.putObject({
      Bucket: bucketName,
      Key: `providers/${provider}/metadata.json`,
      Body: JSON.stringify(providerData, null, 2),
      ContentType: 'application/json'
    }).promise();
    
    console.log(`Created ${provider} provider metadata`);
  }
  
  // Create AWS SAA-C03 sample exam
  const awsExam = {
    id: 'saa-c03',
    name: 'AWS Solutions Architect Associate',
    provider: 'aws',
    description: 'AWS Solutions Architect Associate certification',
    topics: ['compute', 'storage', 'networking', 'security', 'databases']
  };
  
  await s3.putObject({
    Bucket: bucketName,
    Key: 'exams/aws/saa-c03/metadata.json',
    Body: JSON.stringify(awsExam, null, 2),
    ContentType: 'application/json'
  }).promise();
  
  // Create sample questions
  const sampleQuestions = [
    {
      id: 'q1',
      text: 'Which AWS service is best for hosting static websites?',
      options: ['EC2', 'S3', 'Lambda', 'RDS'],
      correctAnswers: [1],
      explanation: 'S3 is designed for static website hosting',
      topics: ['storage'],
      difficulty: 'easy'
    }
  ];
  
  await s3.putObject({
    Bucket: bucketName,
    Key: 'questions/aws/saa-c03/questions.json',
    Body: JSON.stringify(sampleQuestions, null, 2),
    ContentType: 'application/json'
  }).promise();
  
  console.log('Question data structure created');
}

uploadQuestionStructure().catch(console.error);
```

### Step 3.3: Execute Setup
```bash
# Set environment variables
export BUCKET_NAME=studyappv3-data-dev

# Run setup script
node scripts/setup-questions.js

# Verify upload
aws s3 ls s3://studyappv3-data-dev/ --recursive
```

**Expected Output**: S3 bucket with organized question data structure

---

## PHASE 4: Base Handler and Shared Infrastructure
**Duration**: 2-3 days  
**Dependencies**: Phase 3  
**Goal**: Create BaseHandler pattern and shared utilities

### Step 4.1: Create TypeScript Types
Create `lambda/src/shared/types/api.types.ts`:
```typescript
export interface ApiResponse<T = any> {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  metadata?: {
    timestamp: string;
    requestId: string;
    pagination?: PaginationMeta;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    timestamp: string;
    requestId: string;
    path: string;
  };
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

### Step 4.2: Create Base Handler
Create `lambda/src/shared/base-handler.ts`:
```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ApiResponse, SuccessResponse, ErrorResponse } from './types/api.types';

export abstract class BaseHandler {
  protected abstract handlerName: string;

  // CORS headers for all responses
  protected corsHeaders(): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Content-Type': 'application/json'
    };
  }

  // Success response builder
  protected success<T>(data: T, message?: string, statusCode: number = 200): ApiResponse<T> {
    const response: SuccessResponse<T> = {
      success: true,
      data,
      message,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: this.getRequestId()
      }
    };

    return {
      statusCode,
      headers: this.corsHeaders(),
      body: JSON.stringify(response)
    };
  }

  // Error response builder
  protected error(message: string, statusCode: number = 500, code?: string): ApiResponse {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: code || 'INTERNAL_ERROR',
        message
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: this.getRequestId(),
        path: this.currentPath || 'unknown'
      }
    };

    return {
      statusCode,
      headers: this.corsHeaders(),
      body: JSON.stringify(response)
    };
  }

  // Parse JSON request body
  protected parseRequest<T>(body: string | null): T {
    if (!body) {
      throw new Error('Request body is required');
    }
    
    try {
      return JSON.parse(body) as T;
    } catch (error) {
      throw new Error('Invalid JSON in request body');
    }
  }

  // Extract JWT token from Authorization header
  protected getAuthToken(event: APIGatewayProxyEvent): string {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header');
    }
    
    return authHeader.substring(7);
  }

  // Get user ID from JWT claims (set by API Gateway authorizer)
  protected getUserId(event: APIGatewayProxyEvent): string {
    const userId = event.requestContext.authorizer?.claims?.sub;
    
    if (!userId) {
      throw new Error('User ID not found in token claims');
    }
    
    return userId;
  }

  // Wrapper for handlers with authentication
  public withAuth(
    handler: (event: APIGatewayProxyEvent, userId: string, context: Context) => Promise<ApiResponse>
  ) {
    return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
      try {
        this.currentPath = event.path;
        this.requestId = event.requestContext.requestId;
        
        // Handle CORS preflight
        if (event.httpMethod === 'OPTIONS') {
          return {
            statusCode: 200,
            headers: this.corsHeaders(),
            body: ''
          };
        }

        const userId = this.getUserId(event);
        const result = await handler(event, userId, context);
        
        this.logRequest(event, result.statusCode);
        return result;
        
      } catch (error) {
        console.error(`[${this.handlerName}] Error:`, error);
        return this.error(error.message || 'Internal server error', 500);
      }
    };
  }

  // Wrapper for handlers without authentication
  public withoutAuth(
    handler: (event: APIGatewayProxyEvent, context: Context) => Promise<ApiResponse>
  ) {
    return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
      try {
        this.currentPath = event.path;
        this.requestId = event.requestContext.requestId;
        
        // Handle CORS preflight
        if (event.httpMethod === 'OPTIONS') {
          return {
            statusCode: 200,
            headers: this.corsHeaders(),
            body: ''
          };
        }

        const result = await handler(event, context);
        
        this.logRequest(event, result.statusCode);
        return result;
        
      } catch (error) {
        console.error(`[${this.handlerName}] Error:`, error);
        return this.error(error.message || 'Internal server error', 500);
      }
    };
  }

  // Request logging
  private logRequest(event: APIGatewayProxyEvent, statusCode: number): void {
    console.log(JSON.stringify({
      handler: this.handlerName,
      method: event.httpMethod,
      path: event.path,
      statusCode,
      requestId: this.requestId,
      timestamp: new Date().toISOString()
    }));
  }

  private currentPath?: string;
  private requestId?: string;
  
  private getRequestId(): string {
    return this.requestId || 'unknown';
  }
}
```

### Step 4.3: Create Service Factory
Create `lambda/src/shared/service-factory.ts`:
```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

export class ServiceFactory {
  private static dynamoClient: DynamoDBClient;
  private static s3Client: S3Client;

  static getDynamoClient(): DynamoDBClient {
    if (!this.dynamoClient) {
      this.dynamoClient = new DynamoDBClient({
        region: process.env.AWS_REGION || 'us-east-1'
      });
    }
    return this.dynamoClient;
  }

  static getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1'
      });
    }
    return this.s3Client;
  }
}
```

### Step 4.4: Create Build Script
Create `lambda/scripts/build.js`:
```javascript
const esbuild = require('esbuild');
const glob = require('glob');
const path = require('path');

async function buildAllHandlers() {
  const handlerFiles = glob.sync('src/handlers/*.ts');
  
  const buildPromises = handlerFiles.map(async (file) => {
    const handlerName = path.basename(file, '.ts');
    
    return esbuild.build({
      entryPoints: [file],
      bundle: true,
      outfile: `dist/${handlerName}/index.js`,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      external: ['aws-sdk'],
      minify: true,
      sourcemap: false
    });
  });
  
  await Promise.all(buildPromises);
  console.log(`Built ${handlerFiles.length} handlers`);
}

buildAllHandlers().catch(console.error);
```

### Step 4.5: Test Base Handler
Create `lambda/tests/unit/base-handler.test.ts`:
```typescript
import { BaseHandler } from '../../src/shared/base-handler';

class TestHandler extends BaseHandler {
  protected handlerName = 'TestHandler';

  public async testSuccess() {
    return this.success({ message: 'test' }, 'Success');
  }

  public async testError() {
    return this.error('Test error', 400, 'TEST_ERROR');
  }
}

describe('BaseHandler', () => {
  let handler: TestHandler;

  beforeEach(() => {
    handler = new TestHandler();
  });

  test('should create success response', async () => {
    const result = await handler.testSuccess();
    
    expect(result.statusCode).toBe(200);
    expect(result.headers['Content-Type']).toBe('application/json');
    
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data.message).toBe('test');
  });

  test('should create error response', async () => {
    const result = await handler.testError();
    
    expect(result.statusCode).toBe(400);
    
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TEST_ERROR');
  });
});
```

### Step 4.6: Run Tests
```bash
# Install test dependencies
npm install --save-dev jest @types/jest ts-jest

# Create jest config
npx ts-jest config:init

# Run tests
npm test
```

**Expected Output**: Base handler tests passing, foundation ready for domain handlers

---

## PHASE 5: Authentication Handler Implementation
**Duration**: 3-4 days  
**Dependencies**: Phase 4  
**Goal**: Implement complete authentication system (register, login, refresh, logout)

### Step 5.1: Create User Types and Models
Create `lambda/src/shared/types/user.types.ts`:
```typescript
export interface User {
  userId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  defaultProvider?: string;
  studyReminderEmail?: boolean;
  progressEmailFrequency?: 'daily' | 'weekly' | 'monthly' | 'never';
}

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult {
  user: Omit<User, 'passwordHash'>;
  tokens: AuthTokens;
}
```

### Step 5.2: Create User Repository
Create `lambda/src/repositories/user.repository.ts`:
```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { User, CreateUserRequest } from '../shared/types/user.types';
import { v4 as uuidv4 } from 'uuid';

export class UserRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(dynamoClient: DynamoDBClient) {
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.USER_TABLE_NAME!;
  }

  async create(userData: CreateUserRequest, passwordHash: string): Promise<User> {
    const user: User = {
      userId: uuidv4(),
      email: userData.email,
      passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: user,
      ConditionExpression: 'attribute_not_exists(userId)'
    }));

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    }));

    return result.Items?.[0] as User || null;
  }

  async findById(userId: string): Promise<User | null> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { userId }
    }));

    return result.Item as User || null;
  }
}
```

### Step 5.3: Create JWT Service
Create `lambda/src/services/jwt.service.ts`:
```typescript
import * as jwt from 'jsonwebtoken';
import { User, AuthTokens } from '../shared/types/user.types';

export class JwtService {
  private secretKey: string;
  private refreshSecretKey: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.secretKey = process.env.JWT_SECRET_KEY!;
    this.refreshSecretKey = process.env.JWT_REFRESH_SECRET!;
    this.accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  }

  generateTokens(user: User): AuthTokens {
    const payload = {
      sub: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    };

    const accessToken = jwt.sign(payload, this.secretKey, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'studyapp-v3'
    });

    const refreshToken = jwt.sign(
      { sub: user.userId, type: 'refresh' },
      this.refreshSecretKey,
      { expiresIn: this.refreshTokenExpiry }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes in seconds
    };
  }

  verifyAccessToken(token: string): jwt.JwtPayload {
    return jwt.verify(token, this.secretKey) as jwt.JwtPayload;
  }

  verifyRefreshToken(token: string): jwt.JwtPayload {
    return jwt.verify(token, this.refreshSecretKey) as jwt.JwtPayload;
  }
}
```

### Step 5.4: Create Auth Service
Create `lambda/src/services/auth.service.ts`:
```typescript
import * as bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/user.repository';
import { JwtService } from './jwt.service';
import { CreateUserRequest, LoginRequest, AuthResult } from '../shared/types/user.types';

export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService
  ) {}

  async registerUser(userData: CreateUserRequest): Promise<AuthResult> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate password strength
    if (userData.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    // Create user
    const user = await this.userRepository.create(userData, passwordHash);

    // Generate tokens
    const tokens = this.jwtService.generateTokens(user);

    return {
      user: {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isActive: user.isActive,
        preferences: user.preferences
      },
      tokens
    };
  }

  async authenticate(credentials: LoginRequest): Promise<AuthResult> {
    // Find user by email
    const user = await this.userRepository.findByEmail(credentials.email);
    if (!user || !user.isActive) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const tokens = this.jwtService.generateTokens(user);

    return {
      user: {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isActive: user.isActive,
        preferences: user.preferences
      },
      tokens
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthResult> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verifyRefreshToken(refreshToken);
      
      if (payload.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      // Get user
      const user = await this.userRepository.findById(payload.sub as string);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      const tokens = this.jwtService.generateTokens(user);

      return {
        user: {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          isActive: user.isActive,
          preferences: user.preferences
        },
        tokens
      };
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }
}
```

### Step 5.5: Create Auth Handler
Create `lambda/src/handlers/auth.ts`:
```typescript
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { ServiceFactory } from '../shared/service-factory';
import { AuthService } from '../services/auth.service';
import { JwtService } from '../services/jwt.service';
import { UserRepository } from '../repositories/user.repository';
import { CreateUserRequest, LoginRequest } from '../shared/types/user.types';

class AuthHandler extends BaseHandler {
  protected handlerName = 'AuthHandler';
  private authService: AuthService;

  constructor() {
    super();
    const userRepository = new UserRepository(ServiceFactory.getDynamoClient());
    const jwtService = new JwtService();
    this.authService = new AuthService(userRepository, jwtService);
  }

  public async register(event: APIGatewayProxyEvent): Promise<any> {
    const userData = this.parseRequest<CreateUserRequest>(event.body);
    
    // Validate required fields
    if (!userData.email || !userData.password || !userData.firstName || !userData.lastName) {
      return this.error('Missing required fields: email, password, firstName, lastName', 400, 'VALIDATION_ERROR');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      return this.error('Invalid email format', 400, 'VALIDATION_ERROR');
    }

    try {
      const result = await this.authService.registerUser(userData);
      return this.success(result, 'User registered successfully', 201);
    } catch (error) {
      if (error.message.includes('already exists')) {
        return this.error(error.message, 409, 'USER_EXISTS');
      }
      return this.error(error.message, 400, 'REGISTRATION_ERROR');
    }
  }

  public async login(event: APIGatewayProxyEvent): Promise<any> {
    const credentials = this.parseRequest<LoginRequest>(event.body);
    
    if (!credentials.email || !credentials.password) {
      return this.error('Missing email or password', 400, 'VALIDATION_ERROR');
    }

    try {
      const result = await this.authService.authenticate(credentials);
      return this.success(result, 'Login successful');
    } catch (error) {
      return this.error('Invalid email or password', 401, 'AUTHENTICATION_ERROR');
    }
  }

  public async refresh(event: APIGatewayProxyEvent): Promise<any> {
    const { refreshToken } = this.parseRequest<{ refreshToken: string }>(event.body);
    
    if (!refreshToken) {
      return this.error('Missing refresh token', 400, 'VALIDATION_ERROR');
    }

    try {
      const result = await this.authService.refreshTokens(refreshToken);
      return this.success(result, 'Tokens refreshed successfully');
    } catch (error) {
      return this.error('Invalid or expired refresh token', 401, 'TOKEN_ERROR');
    }
  }

  public async logout(event: APIGatewayProxyEvent, userId: string): Promise<any> {
    // For now, just return success - token blacklisting can be added later
    return this.success(null, 'Logout successful');
  }
}

const authHandler = new AuthHandler();

// Export Lambda functions
export const register = authHandler.withoutAuth((event: APIGatewayProxyEvent, context: Context) => 
  authHandler.register(event)
);

export const login = authHandler.withoutAuth((event: APIGatewayProxyEvent, context: Context) => 
  authHandler.login(event)
);

export const refresh = authHandler.withoutAuth((event: APIGatewayProxyEvent, context: Context) => 
  authHandler.refresh(event)
);

export const logout = authHandler.withAuth((event: APIGatewayProxyEvent, userId: string, context: Context) => 
  authHandler.logout(event, userId)
);
```

### Step 5.6: Create Lambda Construct for Auth
Create `lib/constructs/lambda-construct.ts`:
```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface LambdaConstructProps {
  handlerName: string;
  environment: Record<string, string>;
  timeout?: cdk.Duration;
}

export class LambdaConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    this.function = new lambda.Function(this, 'Function', {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset(`lambda/dist/${props.handlerName}`),
      handler: 'index.handler',
      timeout: props.timeout || cdk.Duration.seconds(30),
      environment: props.environment,
      tracing: lambda.Tracing.ACTIVE
    });
  }
}
```

### Step 5.7: Update Stack with Auth Lambdas
Edit `lib/study-app-stack-v3.ts` to add auth Lambdas:
```typescript
import { LambdaConstruct } from './constructs/lambda-construct';

export class StudyAppStackV3 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const database = new DatabaseConstruct(this, 'Database');
    const storage = new StorageConstruct(this, 'Storage', config);

    // Common environment variables
    const commonEnv = {
      USER_TABLE_NAME: database.userTable.tableName,
      BUCKET_NAME: storage.dataBucket.bucketName,
      JWT_SECRET_KEY: 'your-secret-key-here', // TODO: Use Secrets Manager
      JWT_REFRESH_SECRET: 'your-refresh-secret-here'
    };

    // Auth Lambda functions
    const registerLambda = new LambdaConstruct(this, 'RegisterLambda', {
      handlerName: 'auth',
      environment: { ...commonEnv, HANDLER_METHOD: 'register' }
    });

    const loginLambda = new LambdaConstruct(this, 'LoginLambda', {
      handlerName: 'auth',
      environment: { ...commonEnv, HANDLER_METHOD: 'login' }
    });

    // Grant permissions
    database.userTable.grantReadWriteData(registerLambda.function);
    database.userTable.grantReadWriteData(loginLambda.function);
  }
}
```

### Step 5.8: Build and Test
```bash
# Install dependencies
cd lambda
npm install bcryptjs jsonwebtoken uuid @types/bcryptjs @types/jsonwebtoken @types/uuid

# Build handlers
npm run build

# Deploy
cd ../
cdk deploy --context stage=dev

# Test registration
curl -X POST https://your-api-gateway-url/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Expected Output**: Working authentication endpoints (register, login, refresh, logout)

---

## PHASE 6: API Gateway and Authorization Setup
**Duration**: 2-3 days  
**Dependencies**: Phase 5  
**Goal**: Create API Gateway with TOKEN authorizer and route integration

### Step 6.1: Create JWT Authorizer Lambda
Create `lambda/src/handlers/authorizer.ts`:
```typescript
import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda';
import { JwtService } from '../services/jwt.service';

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent,
  context: Context
): Promise<APIGatewayAuthorizerResult> => {
  console.log('Authorizer event:', JSON.stringify(event));

  try {
    // Extract token from Authorization header
    const token = event.authorizationToken.replace('Bearer ', '');
    
    // Verify token
    const jwtService = new JwtService();
    const payload = jwtService.verifyAccessToken(token);
    
    // Generate policy
    const policy = generatePolicy(payload.sub as string, 'Allow', event.methodArn, payload);
    
    console.log('Generated policy:', JSON.stringify(policy));
    return policy;
    
  } catch (error) {
    console.error('Authorization failed:', error);
    
    // Return Deny policy
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

function generatePolicy(
  principalId: string, 
  effect: 'Allow' | 'Deny', 
  resource: string,
  claims?: any
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    },
    context: claims ? {
      userId: claims.sub,
      email: claims.email,
      firstName: claims.firstName,
      lastName: claims.lastName
    } : {}
  };
}
```

### Step 6.2: Create API Gateway Construct
Create `lib/constructs/api-gateway-construct.ts`:
```typescript
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface ApiGatewayConstructProps {
  authorizer: lambda.Function;
  lambdaFunctions: Record<string, lambda.Function>;
}

export class ApiGatewayConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    // Create REST API
    this.api = new apigateway.RestApi(this, 'StudyAppApi', {
      restApiName: 'StudyApp V3 API',
      description: 'Multi-provider certification study platform API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization']
      },
      deployOptions: {
        stageName: 'dev',
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO
      }
    });

    // Create TOKEN authorizer
    const tokenAuthorizer = new apigateway.TokenAuthorizer(this, 'TokenAuthorizer', {
      handler: props.authorizer,
      tokenValidationRegex: '^Bearer [-0-9A-Za-z\\.]+$'
    });

    // API v1 resource
    const v1 = this.api.root.addResource('api').addResource('v1');

    // Auth endpoints (no authorization)
    const auth = v1.addResource('auth');
    this.addPublicEndpoint(auth, 'register', 'POST', props.lambdaFunctions.register);
    this.addPublicEndpoint(auth, 'login', 'POST', props.lambdaFunctions.login);
    this.addPublicEndpoint(auth, 'refresh', 'POST', props.lambdaFunctions.refresh);
    this.addProtectedEndpoint(auth, 'logout', 'POST', props.lambdaFunctions.logout, tokenAuthorizer);

    // Provider endpoints (protected)
    const providers = v1.addResource('providers');
    this.addProtectedEndpoint(providers, '', 'GET', props.lambdaFunctions.providersList, tokenAuthorizer);
    const providerId = providers.addResource('{providerId}');
    this.addProtectedEndpoint(providerId, '', 'GET', props.lambdaFunctions.providersGet, tokenAuthorizer);

    // Health endpoints (public)
    const health = v1.addResource('health');
    this.addPublicEndpoint(health, '', 'GET', props.lambdaFunctions.healthBasic);
    this.addPublicEndpoint(health, 'detailed', 'GET', props.lambdaFunctions.healthDetailed);
  }

  private addPublicEndpoint(
    resource: apigateway.Resource,
    path: string,
    method: string,
    lambdaFunction: lambda.Function
  ): void {
    const endpoint = path ? resource.addResource(path) : resource;
    
    endpoint.addMethod(method, new apigateway.LambdaIntegration(lambdaFunction, {
      requestTemplates: {
        'application/json': JSON.stringify({
          body: '$input.body',
          headers: '$input.params().header',
          pathParameters: '$input.params().path',
          queryStringParameters: '$input.params().querystring'
        })
      }
    }));
  }

  private addProtectedEndpoint(
    resource: apigateway.Resource,
    path: string,
    method: string,
    lambdaFunction: lambda.Function,
    authorizer: apigateway.TokenAuthorizer
  ): void {
    const endpoint = path ? resource.addResource(path) : resource;
    
    endpoint.addMethod(method, new apigateway.LambdaIntegration(lambdaFunction), {
      authorizer
    });
  }
}
```

### Step 6.3: Update Main Stack
Edit `lib/study-app-stack-v3.ts`:
```typescript
import { ApiGatewayConstruct } from './constructs/api-gateway-construct';

export class StudyAppStackV3 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ... existing database and storage setup

    // Create authorizer Lambda
    const authorizerLambda = new LambdaConstruct(this, 'AuthorizerLambda', {
      handlerName: 'authorizer',
      environment: commonEnv
    });

    // Create all Lambda functions
    const lambdaFunctions = {
      register: registerLambda.function,
      login: loginLambda.function,
      refresh: refreshLambda.function,
      logout: logoutLambda.function,
      // Add other functions as they're implemented
    };

    // Create API Gateway
    const api = new ApiGatewayConstruct(this, 'ApiGateway', {
      authorizer: authorizerLambda.function,
      lambdaFunctions
    });

    // Output API URL
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.api.url,
      exportName: `${config.stage}-ApiGatewayUrl`
    });
  }
}
```

### Step 6.4: Deploy and Test Authorization
```bash
# Deploy API Gateway
cdk deploy --context stage=dev

# Test public endpoint
curl -X POST https://your-api-url/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test protected endpoint (should fail without token)
curl -X POST https://your-api-url/api/v1/auth/logout

# Test protected endpoint with token
curl -X POST https://your-api-url/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

**Expected Output**: API Gateway with working TOKEN authorization

---

## PHASE 7-15: Remaining Domain Handlers
**Duration**: 2-3 days each  
**Dependencies**: Phase 6  

I'll create concrete steps for each remaining phase:

### PHASE 7: Providers Handler (2 endpoints)
### PHASE 8: Exams Handler (2 endpoints)  
### PHASE 9: Topics Handler (2 endpoints)
### PHASE 10: Questions Handler (3 endpoints)
### PHASE 11: Sessions Handler (7 endpoints)
### PHASE 12: Analytics Handler (3 endpoints)
### PHASE 13: Goals Handler (4 endpoints)
### PHASE 14: Health Handler (2 endpoints)
### PHASE 15: Testing and Quality Assurance

Each phase follows the same pattern:
1. Create domain types and interfaces
2. Create repository for data access
3. Create service for business logic  
4. Create handler with BaseHandler pattern
5. Add to API Gateway routes
6. Write comprehensive tests
7. Deploy and verify endpoints

---

## Phase 5 Status Summary

- **Phase 5.1**: ✅ Complete Handler List (9 domain Lambda functions cataloged)
- **Phase 5.2**: ✅ Complete Endpoint List (29 endpoints with authentication)  
- **Phase 5.3**: ✅ Clean Architecture Documentation (BaseHandler/CrudHandler patterns)
- **Phase 5.4**: ✅ Backend Implementation Plan and Project Structure Rebuild
- **Phase 5.5**: ✅ **CONCRETE IMPLEMENTATION PLAN CREATED**

**Major Update**: Replaced high-level phase references with **explicit, executable implementation steps** including:
- **Concrete commands**: `cdk init`, `npm install`, `curl -X POST`
- **Exact file paths**: `lambda/src/handlers/auth.ts`
- **Complete code blocks**: Ready-to-copy TypeScript implementations
- **Step-by-step dependencies**: Clear prerequisites for each phase
- **Verification steps**: Expected outputs and testing procedures
- **15 total phases**: Including missing deployment, monitoring, and testing phases

**Next**: Begin Phase 1 execution with concrete CDK project setup