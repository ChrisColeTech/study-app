# Backend Code Examples - Study App

This document contains all code examples, snippets, and technical implementation details extracted from the implementation plan. Use this as a developer reference for implementing the Study App backend.

For high-level planning and project management information, see [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Table of Contents
- [Project Setup Examples](#project-setup-examples)
- [Architecture Foundation](#architecture-foundation)
- [Infrastructure Examples](#infrastructure-examples)
- [Handler Examples](#handler-examples)
- [Service Examples](#service-examples)
- [Repository Examples](#repository-examples)
- [Type Definitions](#type-definitions)
- [CDK Stack Examples](#cdk-stack-examples)
- [Testing Examples](#testing-examples)
- [Deployment Scripts](#deployment-scripts)

## Project Setup Examples

### CDK Project Initialization

```bash
# Create project directory
mkdir study-app-v3-backend
cd study-app-v3-backend

# Initialize CDK application
cdk init app --language typescript

# Install AWS CDK dependencies
npm install aws-cdk-lib constructs
npm install @aws-cdk/aws-lambda @aws-cdk/aws-apigateway @aws-cdk/aws-dynamodb @aws-cdk/aws-s3
npm install @types/node typescript ts-node

# Verify CDK setup
cdk --version
```

### Project Structure Creation

```bash
# Create directory structure
mkdir -p backend/src/{handlers,services,repositories,shared/{types,utils}}
mkdir -p backend/src/shared/{base,middleware}
mkdir -p infrastructure/{constructs,config}
mkdir -p docs

# Create base files
touch backend/src/shared/types/index.ts
touch backend/src/shared/utils/index.ts
touch backend/src/shared/base/index.ts
touch infrastructure/main.ts
```

## Architecture Foundation

### Clean Architecture Layers Structure

```
├── Handler Layer    → BaseHandler/CrudHandler (HTTP concerns only)
├── Service Layer    → Domain business logic and rules
├── Repository Layer → Data access abstraction (DynamoDB, S3, Redis)  
└── Infrastructure   → AWS SDK clients and external services
```

### Domain Organization (9 Lambda Functions)

```
backend/
├── handlers/
│   ├── auth.ts          # Authentication (4 endpoints)
│   ├── providers.ts     # Provider management (2 endpoints)
│   ├── exams.ts         # Exam management (2 endpoints)
│   ├── topics.ts        # Topic management (2 endpoints) 
│   ├── questions.ts     # Question management (3 endpoints)
│   ├── sessions.ts      # Study sessions (7 endpoints)
│   ├── analytics.ts     # Analytics and progress (3 endpoints)
│   ├── goals.ts         # Goal management (4 endpoints)
│   └── health.ts        # System monitoring (2 endpoints)
└── shared/
    ├── base-handler.ts   # Common handler patterns
    ├── crud-handler.ts   # CRUD operation base class
    ├── service-factory.ts # Dependency injection
    ├── response-builder.ts # API response formatting
    └── logger.ts         # Structured logging
```

## Infrastructure Examples

### CDK Configuration

```typescript
// infrastructure/config/app-config.ts
export interface AppConfig {
  environment: 'dev' | 'staging' | 'prod';
  region: string;
  stackName: string;
  apiGatewayName: string;
  lambdaRuntime: string;
  lambdaMemorySize: number;
  dynamoDbBillingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
}

export const getAppConfig = (): AppConfig => ({
  environment: (process.env.ENVIRONMENT as 'dev' | 'staging' | 'prod') || 'dev',
  region: process.env.AWS_REGION || 'us-east-1',
  stackName: `study-app-${process.env.ENVIRONMENT || 'dev'}`,
  apiGatewayName: `study-app-api-${process.env.ENVIRONMENT || 'dev'}`,
  lambdaRuntime: 'nodejs20.x',
  lambdaMemorySize: 256,
  dynamoDbBillingMode: 'PAY_PER_REQUEST'
});
```

### DynamoDB Construct

```typescript
// infrastructure/constructs/dynamodb-construct.ts
import { Construct } from 'constructs';
import { Table, TableV2, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';

export class DynamoDbConstruct extends Construct {
  public readonly userTable: TableV2;
  public readonly sessionTable: TableV2;
  public readonly tokenBlacklistTable: TableV2;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // User Table with GSI for email lookups
    this.userTable = new TableV2(this, 'UserTable', {
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // Change to RETAIN for production
      globalSecondaryIndexes: [{
        indexName: 'email-index',
        partitionKey: { name: 'email', type: AttributeType.STRING },
        projectionType: ProjectionType.ALL
      }]
    });

    // Session Table with GSI for user sessions
    this.sessionTable = new TableV2(this, 'SessionTable', {
      partitionKey: { name: 'sessionId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      globalSecondaryIndexes: [{
        indexName: 'user-sessions-index',
        partitionKey: { name: 'userId', type: AttributeType.STRING },
        sortKey: { name: 'startedAt', type: AttributeType.STRING },
        projectionType: ProjectionType.ALL
      }]
    });

    // Token Blacklist Table for JWT management
    this.tokenBlacklistTable = new TableV2(this, 'TokenBlacklistTable', {
      partitionKey: { name: 'tokenId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'expiresAt' // Automatic cleanup
    });
  }
}
```

### S3 Storage Construct

```typescript
// infrastructure/constructs/s3-construct.ts
import { Construct } from 'constructs';
import { Bucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy } from 'aws-cdk-lib';

export class S3StorageConstruct extends Construct {
  public readonly questionDataBucket: Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.questionDataBucket = new Bucket(this, 'QuestionDataBucket', {
      bucketName: `study-app-questions-${Date.now()}`, // Ensure unique name
      accessControl: BucketAccessControl.PRIVATE,
      removalPolicy: RemovalPolicy.DESTROY, // Change to RETAIN for production
      versioned: false,
      publicReadAccess: false
    });
  }
}
```

## Handler Examples

### Base Handler Pattern

```typescript
// backend/src/shared/base-handler.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ResponseBuilder } from './response-builder';
import { Logger } from './logger';

export abstract class BaseHandler {
  protected logger: Logger;
  protected responseBuilder: ResponseBuilder;

  constructor() {
    this.logger = new Logger();
    this.responseBuilder = new ResponseBuilder();
  }

  abstract handle(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult>;

  protected async executeWithErrorHandling(
    event: APIGatewayProxyEvent,
    context: Context,
    operation: () => Promise<APIGatewayProxyResult>
  ): Promise<APIGatewayProxyResult> {
    const startTime = Date.now();
    const requestId = context.awsRequestId;

    try {
      this.logger.info('Request started', {
        requestId,
        method: event.httpMethod,
        path: event.path,
        userAgent: event.headers['User-Agent'] || 'Unknown'
      });

      const result = await operation();

      this.logger.info('Request completed', {
        requestId,
        statusCode: result.statusCode,
        duration: Date.now() - startTime
      });

      return result;
    } catch (error: any) {
      this.logger.error('Request failed', {
        requestId,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime
      });

      return this.responseBuilder.error(
        'Internal server error',
        500,
        requestId
      );
    }
  }

  protected parseRequestBody<T>(event: APIGatewayProxyEvent): T {
    if (!event.body) {
      throw new Error('Request body is required');
    }

    try {
      return JSON.parse(event.body) as T;
    } catch (error) {
      throw new Error('Invalid JSON in request body');
    }
  }

  protected getPathParameter(event: APIGatewayProxyEvent, paramName: string): string {
    const param = event.pathParameters?.[paramName];
    if (!param) {
      throw new Error(`Path parameter '${paramName}' is required`);
    }
    return param;
  }

  protected getQueryParameter(event: APIGatewayProxyEvent, paramName: string): string | undefined {
    return event.queryStringParameters?.[paramName];
  }

  protected async withAuth(
    event: APIGatewayProxyEvent,
    operation: (userId: string) => Promise<APIGatewayProxyResult>
  ): Promise<APIGatewayProxyResult> {
    const authHeader = event.headers['Authorization'] || event.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return this.responseBuilder.error('Missing or invalid authorization header', 401);
    }

    const token = authHeader.substring(7);
    
    try {
      // JWT validation logic would go here
      // For now, assuming token contains userId
      const userId = 'extracted-user-id'; // Replace with actual JWT decode
      
      return await operation(userId);
    } catch (error) {
      return this.responseBuilder.error('Invalid or expired token', 401);
    }
  }
}
```

### Health Handler

```typescript
// backend/src/handlers/health.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';

class HealthHandler extends BaseHandler {
  async handle(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    return this.executeWithErrorHandling(event, context, async () => {
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.ENVIRONMENT || 'unknown'
      };

      return this.responseBuilder.success(healthData);
    });
  }
}

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const healthHandler = new HealthHandler();
  return healthHandler.handle(event, context);
};
```

### Authentication Handler

```typescript
// backend/src/handlers/auth.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { AuthService } from '../services/auth.service';
import { ServiceFactory } from '../shared/service-factory';
import { CreateUserRequest, LoginRequest } from '../shared/types/user.types';

class AuthHandler extends BaseHandler {
  private authService: AuthService;

  constructor() {
    super();
    this.authService = ServiceFactory.createAuthService();
  }

  async handle(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    return this.executeWithErrorHandling(event, context, async () => {
      const path = event.path;
      const method = event.httpMethod;

      if (path === '/auth/register' && method === 'POST') {
        return this.handleRegister(event);
      } else if (path === '/auth/login' && method === 'POST') {
        return this.handleLogin(event);
      } else if (path === '/auth/refresh' && method === 'POST') {
        return this.handleRefresh(event);
      } else if (path === '/auth/logout' && method === 'POST') {
        return this.handleLogout(event);
      }

      return this.responseBuilder.error('Endpoint not found', 404);
    });
  }

  private async handleRegister(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const userData = this.parseRequestBody<CreateUserRequest>(event);
    
    try {
      const result = await this.authService.register(userData);
      return this.responseBuilder.success(result, 201);
    } catch (error: any) {
      if (error.message === 'User already exists') {
        return this.responseBuilder.error('Email already registered', 409);
      }
      throw error;
    }
  }

  private async handleLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const loginData = this.parseRequestBody<LoginRequest>(event);
    
    try {
      const result = await this.authService.login(loginData.email, loginData.password);
      return this.responseBuilder.success(result);
    } catch (error: any) {
      if (error.message === 'Invalid credentials') {
        return this.responseBuilder.error('Invalid email or password', 401);
      }
      throw error;
    }
  }

  private async handleRefresh(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const { refreshToken } = this.parseRequestBody<{ refreshToken: string }>(event);
    
    try {
      const result = await this.authService.refreshToken(refreshToken);
      return this.responseBuilder.success(result);
    } catch (error: any) {
      return this.responseBuilder.error('Invalid or expired refresh token', 401);
    }
  }

  private async handleLogout(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.withAuth(event, async (userId: string) => {
      const authHeader = event.headers['Authorization'] || event.headers['authorization'];
      const token = authHeader!.substring(7);
      
      await this.authService.logout(token, userId);
      return this.responseBuilder.success({ message: 'Logged out successfully' });
    });
  }
}

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const authHandler = new AuthHandler();
  return authHandler.handle(event, context);
};
```

## Service Examples

### Authentication Service

```typescript
// backend/src/services/auth.service.ts
import { UserRepository } from '../repositories/user.repository';
import { JwtService } from '../shared/jwt.service';
import { TokenBlacklistRepository } from '../repositories/token-blacklist.repository';
import { User, CreateUserRequest, UserResponse } from '../shared/types/user.types';
import * as bcrypt from 'bcryptjs';

export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private tokenBlacklistRepository: TokenBlacklistRepository
  ) {}

  async register(userData: CreateUserRequest): Promise<{ user: UserResponse; tokens: { accessToken: string; refreshToken: string } }> {
    // Check if user exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(userData.password, 12);

    // Create user
    const user = await this.userRepository.create(userData, passwordHash);

    // Generate tokens
    const tokens = await this.jwtService.generateTokens(user.userId);

    // Return user response without password
    const userResponse: UserResponse = {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isActive: user.isActive,
      preferences: user.preferences
    };

    return { user: userResponse, tokens };
  }

  async login(email: string, password: string): Promise<{ user: UserResponse; tokens: { accessToken: string; refreshToken: string } }> {
    // Find user by email
    const user = await this.userRepository.findByEmail(email.toLowerCase());
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Generate tokens
    const tokens = await this.jwtService.generateTokens(user.userId);

    // Return user response without password
    const userResponse: UserResponse = {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isActive: user.isActive,
      preferences: user.preferences
    };

    return { user: userResponse, tokens };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const payload = await this.jwtService.verifyRefreshToken(refreshToken);
      
      // Check if token is blacklisted
      const isBlacklisted = await this.tokenBlacklistRepository.isTokenBlacklisted(payload.jti);
      if (isBlacklisted) {
        throw new Error('Token is invalid');
      }

      // Blacklist old refresh token
      await this.tokenBlacklistRepository.blacklistToken(payload.jti, payload.exp);

      // Generate new tokens
      return await this.jwtService.generateTokens(payload.sub);
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  async logout(accessToken: string, userId: string): Promise<void> {
    try {
      // Verify and decode access token to get token ID
      const payload = await this.jwtService.verifyAccessToken(accessToken);
      
      // Blacklist the access token
      await this.tokenBlacklistRepository.blacklistToken(payload.jti, payload.exp);
    } catch (error) {
      // Even if token verification fails, we should not throw error for logout
      // This ensures logout always succeeds from user perspective
    }
  }
}
```

### Provider Service

```typescript
// backend/src/services/provider.service.ts
import { QuestionRepository } from '../repositories/question.repository';
import { Provider, ProviderWithStats } from '../shared/types/provider.types';

export class ProviderService {
  constructor(private questionRepository: QuestionRepository) {}

  async getProviders(): Promise<Provider[]> {
    try {
      const providers = await this.questionRepository.getProviders();
      return providers;
    } catch (error) {
      throw new Error('Failed to fetch providers');
    }
  }

  async getProviderDetails(providerId: string): Promise<ProviderWithStats> {
    try {
      const provider = await this.questionRepository.getProviderById(providerId);
      if (!provider) {
        throw new Error('Provider not found');
      }

      // Get additional stats
      const exams = await this.questionRepository.getExamsByProvider(providerId);
      const totalQuestions = await this.questionRepository.getQuestionCountByProvider(providerId);

      const providerWithStats: ProviderWithStats = {
        ...provider,
        stats: {
          totalExams: exams.length,
          totalQuestions,
          totalTopics: exams.reduce((acc, exam) => acc + (exam.topics?.length || 0), 0)
        }
      };

      return providerWithStats;
    } catch (error: any) {
      if (error.message === 'Provider not found') {
        throw error;
      }
      throw new Error('Failed to fetch provider details');
    }
  }
}
```

## Repository Examples

### User Repository

```typescript
// backend/src/repositories/user.repository.ts
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
      email: userData.email.toLowerCase(),
      passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    try {
      await this.docClient.send(new PutCommand({
        TableName: this.tableName,
        Item: user,
        ConditionExpression: 'attribute_not_exists(userId)'
      }));

      return user;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('User ID conflict occurred');
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.docClient.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email.toLowerCase()
        }
      }));

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return result.Items[0] as User;
    } catch (error) {
      throw new Error('Failed to query user by email');
    }
  }

  async findById(userId: string): Promise<User | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { userId }
      }));

      return result.Item ? result.Item as User : null;
    } catch (error) {
      throw new Error('Failed to get user by ID');
    }
  }
}
```

### Question Repository (S3)

```typescript
// backend/src/repositories/question.repository.ts
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Provider, Exam, Topic, Question } from '../shared/types/provider.types';

export class QuestionRepository {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(s3Client: S3Client) {
    this.s3Client = s3Client;
    this.bucketName = process.env.QUESTION_BUCKET_NAME!;
  }

  async getProviders(): Promise<Provider[]> {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Delimiter: '/',
        Prefix: ''
      });

      const response = await this.s3Client.send(listCommand);
      const providers: Provider[] = [];

      if (response.CommonPrefixes) {
        for (const prefix of response.CommonPrefixes) {
          if (prefix.Prefix) {
            const providerId = prefix.Prefix.replace('/', '');
            try {
              const provider = await this.getProviderById(providerId);
              if (provider) {
                providers.push(provider);
              }
            } catch (error) {
              // Skip providers that don't have valid metadata
              continue;
            }
          }
        }
      }

      return providers.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      throw new Error('Failed to fetch providers from S3');
    }
  }

  async getProviderById(providerId: string): Promise<Provider | null> {
    try {
      const key = `${providerId}/provider.json`;
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      if (!response.Body) {
        return null;
      }

      const content = await response.Body.transformToString();
      return JSON.parse(content) as Provider;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return null;
      }
      throw new Error(`Failed to fetch provider ${providerId}`);
    }
  }

  async getExamsByProvider(providerId: string): Promise<Exam[]> {
    try {
      const provider = await this.getProviderById(providerId);
      return provider?.exams || [];
    } catch (error) {
      throw new Error(`Failed to fetch exams for provider ${providerId}`);
    }
  }

  async getQuestionCountByProvider(providerId: string): Promise<number> {
    try {
      const exams = await this.getExamsByProvider(providerId);
      let totalQuestions = 0;

      for (const exam of exams) {
        if (exam.topics) {
          for (const topic of exam.topics) {
            totalQuestions += topic.questionCount || 0;
          }
        }
      }

      return totalQuestions;
    } catch (error) {
      return 0;
    }
  }
}
```

## Type Definitions

### User Types

```typescript
// backend/src/shared/types/user.types.ts
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

export interface UserResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  preferences?: UserPreferences;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: UserResponse;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}
```

### Provider Types

```typescript
// backend/src/shared/types/provider.types.ts
export interface Provider {
  providerId: string;
  name: string;
  description: string;
  website?: string;
  logoUrl?: string;
  exams: Exam[];
}

export interface Exam {
  examId: string;
  name: string;
  description: string;
  duration?: number; // in minutes
  passingScore?: number;
  totalQuestions?: number;
  topics?: Topic[];
}

export interface Topic {
  topicId: string;
  name: string;
  description?: string;
  questionCount: number;
  weight?: number; // percentage weight in exam
}

export interface Question {
  questionId: string;
  topicId: string;
  examId: string;
  providerId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

export interface ProviderWithStats extends Provider {
  stats: {
    totalExams: number;
    totalQuestions: number;
    totalTopics: number;
  };
}
```

## CDK Stack Examples

### Lambda Construct

```typescript
// infrastructure/constructs/lambda-construct.ts
import { Construct } from 'constructs';
import { Function, Runtime, Architecture, Code } from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from 'aws-cdk-lib/aws-s3';

export interface LambdaEnvironment {
  USER_TABLE_NAME: string;
  SESSION_TABLE_NAME: string;
  TOKEN_BLACKLIST_TABLE_NAME: string;
  QUESTION_BUCKET_NAME: string;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}

export class LambdaConstruct extends Construct {
  public readonly healthFunction: Function;
  public readonly authFunction: Function;
  public readonly providerFunction: Function;

  constructor(
    scope: Construct,
    id: string,
    environment: LambdaEnvironment
  ) {
    super(scope, id);

    const commonProps = {
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(30),
      memorySize: 256,
      logRetention: RetentionDays.ONE_WEEK,
      environment
    };

    this.healthFunction = new Function(this, 'HealthFunction', {
      ...commonProps,
      functionName: 'study-app-health',
      code: Code.fromAsset('backend/dist'),
      handler: 'handlers/health.handler'
    });

    this.authFunction = new Function(this, 'AuthFunction', {
      ...commonProps,
      functionName: 'study-app-auth',
      code: Code.fromAsset('backend/dist'),
      handler: 'handlers/auth.handler'
    });

    this.providerFunction = new Function(this, 'ProviderFunction', {
      ...commonProps,
      functionName: 'study-app-providers',
      code: Code.fromAsset('backend/dist'),
      handler: 'handlers/providers.handler'
    });
  }

  public grantTablePermissions(tables: { userTable: Table; sessionTable: Table; tokenBlacklistTable: Table }) {
    // Grant DynamoDB permissions
    tables.userTable.grantReadWriteData(this.authFunction);
    tables.sessionTable.grantReadWriteData(this.authFunction);
    tables.tokenBlacklistTable.grantReadWriteData(this.authFunction);
  }

  public grantS3Permissions(bucket: Bucket) {
    // Grant S3 read permissions
    bucket.grantRead(this.providerFunction);
  }
}
```

### API Gateway Construct

```typescript
// infrastructure/constructs/apigateway-construct.ts
import { Construct } from 'constructs';
import {
  RestApi,
  LambdaIntegration,
  Resource,
  Cors,
  AuthorizationType,
  TokenAuthorizer
} from 'aws-cdk-lib/aws-apigateway';
import { Function } from 'aws-cdk-lib/aws-lambda';

export class ApiGatewayConstruct extends Construct {
  public readonly api: RestApi;

  constructor(
    scope: Construct,
    id: string,
    functions: {
      healthFunction: Function;
      authFunction: Function;
      providerFunction: Function;
    }
  ) {
    super(scope, id);

    this.api = new RestApi(this, 'StudyAppApi', {
      restApiName: 'Study App API',
      description: 'API for Study App Backend',
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token'
        ]
      }
    });

    // Health endpoint (no auth required)
    const healthResource = this.api.root.addResource('health');
    healthResource.addMethod('GET', new LambdaIntegration(functions.healthFunction));

    // Auth endpoints (no auth required for these)
    const authResource = this.api.root.addResource('auth');
    authResource.addResource('register').addMethod('POST', new LambdaIntegration(functions.authFunction));
    authResource.addResource('login').addMethod('POST', new LambdaIntegration(functions.authFunction));
    authResource.addResource('refresh').addMethod('POST', new LambdaIntegration(functions.authFunction));
    authResource.addResource('logout').addMethod('POST', new LambdaIntegration(functions.authFunction));

    // Provider endpoints (public for listing, could be protected later)
    const providersResource = this.api.root.addResource('providers');
    providersResource.addMethod('GET', new LambdaIntegration(functions.providerFunction));
    providersResource.addResource('{providerId}').addMethod('GET', new LambdaIntegration(functions.providerFunction));
  }
}
```

### Main Stack

```typescript
// infrastructure/main.ts
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DynamoDbConstruct } from './constructs/dynamodb-construct';
import { S3StorageConstruct } from './constructs/s3-construct';
import { LambdaConstruct } from './constructs/lambda-construct';
import { ApiGatewayConstruct } from './constructs/apigateway-construct';

export class StudyAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create DynamoDB tables
    const dynamoDb = new DynamoDbConstruct(this, 'DynamoDB');

    // Create S3 buckets
    const s3Storage = new S3StorageConstruct(this, 'S3Storage');

    // Create Lambda functions
    const lambdas = new LambdaConstruct(this, 'Lambdas', {
      USER_TABLE_NAME: dynamoDb.userTable.tableName,
      SESSION_TABLE_NAME: dynamoDb.sessionTable.tableName,
      TOKEN_BLACKLIST_TABLE_NAME: dynamoDb.tokenBlacklistTable.tableName,
      QUESTION_BUCKET_NAME: s3Storage.questionDataBucket.bucketName,
      JWT_SECRET: 'your-super-secret-jwt-key-change-in-production',
      ENVIRONMENT: 'dev'
    });

    // Grant permissions
    lambdas.grantTablePermissions({
      userTable: dynamoDb.userTable,
      sessionTable: dynamoDb.sessionTable,
      tokenBlacklistTable: dynamoDb.tokenBlacklistTable
    });
    lambdas.grantS3Permissions(s3Storage.questionDataBucket);

    // Create API Gateway
    const apiGateway = new ApiGatewayConstruct(this, 'ApiGateway', {
      healthFunction: lambdas.healthFunction,
      authFunction: lambdas.authFunction,
      providerFunction: lambdas.providerFunction
    });
  }
}

const app = new App();
new StudyAppStack(app, 'StudyAppStack');
```

## Testing Examples

### Unit Test Example

```typescript
// backend/tests/services/auth.service.test.ts
import { AuthService } from '../../src/services/auth.service';
import { UserRepository } from '../../src/repositories/user.repository';
import { JwtService } from '../../src/shared/jwt.service';
import { TokenBlacklistRepository } from '../../src/repositories/token-blacklist.repository';

jest.mock('../../src/repositories/user.repository');
jest.mock('../../src/shared/jwt.service');
jest.mock('../../src/repositories/token-blacklist.repository');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockTokenBlacklistRepository: jest.Mocked<TokenBlacklistRepository>;

  beforeEach(() => {
    mockUserRepository = new UserRepository({} as any) as jest.Mocked<UserRepository>;
    mockJwtService = new JwtService('secret') as jest.Mocked<JwtService>;
    mockTokenBlacklistRepository = new TokenBlacklistRepository({} as any) as jest.Mocked<TokenBlacklistRepository>;
    
    authService = new AuthService(
      mockUserRepository,
      mockJwtService,
      mockTokenBlacklistRepository
    );
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        userId: '123',
        email: userData.email,
        passwordHash: 'hashedPassword',
        firstName: userData.firstName,
        lastName: userData.lastName,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        isActive: true
      });
      mockJwtService.generateTokens.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      // Act
      const result = await authService.register(userData);

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe(userData.email);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      mockUserRepository.findByEmail.mockResolvedValue({
        userId: '123',
        email: userData.email,
        passwordHash: 'hashedPassword',
        firstName: userData.firstName,
        lastName: userData.lastName,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        isActive: true
      });

      // Act & Assert
      await expect(authService.register(userData)).rejects.toThrow('User already exists');
    });
  });
});
```

## Deployment Scripts

### Build Script

```bash
#!/bin/bash
# build.sh

echo "🏗️ Building Study App Backend..."

# Clean previous build
rm -rf backend/dist

# Install dependencies
echo "📦 Installing dependencies..."
cd backend && npm install

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npx tsc

# Copy package.json to dist for lambda deployment
cp package.json dist/
cp package-lock.json dist/

# Install production dependencies in dist
cd dist
npm ci --only=production

echo "✅ Build completed successfully!"
```

### Deployment Script

```bash
#!/bin/bash
# deploy.sh

set -e

ENVIRONMENT=${1:-dev}

echo "🚀 Deploying Study App Backend to $ENVIRONMENT..."

# Build the application
./build.sh

# Bootstrap CDK (only needed once per account/region)
echo "🏃‍♂️ Bootstrapping CDK..."
npx cdk bootstrap

# Deploy the stack
echo "📦 Deploying CDK stack..."
npx cdk deploy --require-approval never

# Get API Gateway URL
echo "🔗 Getting API Gateway URL..."
API_URL=$(aws cloudformation describe-stacks \
  --stack-name StudyAppStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text)

echo "✅ Deployment completed!"
echo "🌐 API Gateway URL: $API_URL"
echo "🧪 Test health endpoint: curl $API_URL/health"
```

### Test Script

```bash
#!/bin/bash
# test.sh

API_URL=$1

if [ -z "$API_URL" ]; then
  echo "Usage: ./test.sh <API_GATEWAY_URL>"
  exit 1
fi

echo "🧪 Testing Study App Backend API..."

# Test health endpoint
echo "Testing health endpoint..."
curl -X GET "$API_URL/health" | jq .

# Test user registration
echo -e "\n\nTesting user registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }')

echo $REGISTER_RESPONSE | jq .

# Extract access token for further tests
ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.tokens.accessToken')

# Test provider listing
echo -e "\n\nTesting provider listing..."
curl -X GET "$API_URL/providers" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

echo -e "\n\n✅ API testing completed!"
```

---

This document contains all the technical implementation code examples from the Study App backend implementation plan. For project management and high-level planning information, refer to the main [Implementation Plan](./IMPLEMENTATION_PLAN.md).