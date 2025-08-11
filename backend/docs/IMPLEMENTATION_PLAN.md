# Backend Implementation Plan V3 - Study App

## 🎯 Project Overview

**Project**: Multi-Provider Certification Study Platform Backend V3  
**Architecture**: AWS CDK + Lambda + DynamoDB + S3  
**Approach**: Clean Architecture with Domain-Driven Design  
**Implementation**: One feature per phase following SOLID principles  

Based on comprehensive Phase 1-4 analysis findings, this implementation plan creates a NEW backend with proper clean architecture, BaseHandler/CrudHandler patterns, and 9 domain-based Lambda functions.

## 📋 Implementation Philosophy

### Documentation-First Development
- All features documented before implementation starts
- Complete API specification before any coding
- Architecture patterns defined upfront
- Testing strategy planned for each feature

### One Feature Per Phase
- Each phase focuses on single feature implementation
- No grouping multiple features together
- Clear dependencies between phases
- Validation before moving to next phase

### Clean Architecture Enforcement
- BaseHandler pattern eliminates boilerplate code
- CrudHandler for standard CRUD operations  
- Service layer contains all business logic
- Repository layer abstracts data access
- Dependency injection via ServiceFactory

## 🏗️ Architecture Foundation

### AWS CDK Infrastructure
- **CDK Version**: V3 with TypeScript constructs
- **Lambda Runtime**: Node.js 20 with ARM64 architecture
- **API Gateway**: REST API with JWT TOKEN authorizer
- **DynamoDB**: User data with GSI indexes
- **S3**: Question data in JSON format by provider/exam
- **Redis/ElastiCache**: Caching layer for performance
- **CloudFront**: CDN distribution
- **CloudWatch**: Logging and monitoring

### Clean Architecture Layers
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

## 📝 Implementation Phases

### Phase 1: Infrastructure Foundation
**Dependencies**: None  
**Objective**: Deploy clean CDK infrastructure with health monitoring endpoint

#### Step 1.1: Initialize CDK Project
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

#### Step 1.2: Create Project Structure
```bash
# Create directory structure
mkdir -p cdk-v3/src/constructs cdk-v3/src/shared
mkdir -p backend/src/{handlers,services,repositories,shared}
mkdir -p backend/src/shared/{types,utils,middleware}
mkdir -p backend/tests/{unit,integration,e2e}
mkdir -p docs/{api,architecture}
```

#### Step 1.3: Create CDK Configuration
Create `cdk-v3/src/shared/stack-config.ts`:
```bash
cat > cdk-v3/src/shared/stack-config.ts << 'EOF'
export interface StackConfig {
  readonly stage: string;
  readonly region: string;
  readonly userTableName: string;
  readonly sessionTableName: string;
  readonly progressTableName: string;
  readonly goalTableName: string;
  readonly bucketName: string;
  readonly domainName?: string;
}

export const getConfig = (stage: string): StackConfig => ({
  stage,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  userTableName: `StudyAppV3-Users-${stage}`,
  sessionTableName: `StudyAppV3-Sessions-${stage}`,
  progressTableName: `StudyAppV3-Progress-${stage}`,
  goalTableName: `StudyAppV3-Goals-${stage}`,
  bucketName: `studyappv3-data-${stage.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`,
  domainName: stage === 'prod' ? 'api.studyapp.com' : undefined
});
EOF
```

#### Step 1.4: Create DynamoDB Construct
Create `cdk-v3/src/constructs/database-construct.ts`:
```bash
cat > cdk-v3/src/constructs/database-construct.ts << 'EOF'
import * as dynamodb from 'aws-cdk-cdk-v3/src/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackConfig } from '../shared/config';

export class DatabaseConstruct extends Construct {
  public readonly userTable: dynamodb.Table;
  public readonly sessionTable: dynamodb.Table;
  public readonly progressTable: dynamodb.Table;
  public readonly goalTable: dynamodb.Table;

  constructor(scope: Construct, id: string, config: StackConfig) {
    super(scope, id);

    // Users table with email index
    this.userTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: config.userTableName,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: false
    });

    this.userTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING }
    });

    // Sessions table
    this.sessionTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: config.sessionTableName,
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
      tableName: config.progressTableName,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'progressKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Goals table
    this.goalTable = new dynamodb.Table(this, 'GoalsTable', {
      tableName: config.goalTableName,
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
EOF
```

#### Step 1.5: Create S3 Storage Construct
Create `cdk-v3/src/constructs/storage-construct.ts`:
```bash
cat > cdk-v3/src/constructs/storage-construct.ts << 'EOF'
import * as s3 from 'aws-cdk-cdk-v3/src/aws-s3';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackConfig } from '../shared/config';

export class StorageConstruct extends Construct {
  public readonly dataBucket: s3.Bucket;

  constructor(scope: Construct, id: string, config: StackConfig) {
    super(scope, id);

    this.dataBucket = new s3.Bucket(this, 'DataBucket', {
      bucketName: config.bucketName,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedOrigins: ['*'],
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedHeaders: ['*']
      }]
    });
  }
}
EOF
```

#### Step 1.6: Create Base Handler Pattern
Create `backend/src/shared/base-handler.ts`:
```bash
cat > backend/src/shared/base-handler.ts << 'EOF'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

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

export abstract class BaseHandler {
  protected abstract handlerName: string;

  protected corsHeaders(): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Content-Type': 'application/json'
    };
  }

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

  public withoutAuth(
    handler: (event: APIGatewayProxyEvent, context: Context) => Promise<ApiResponse>
  ) {
    return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
      try {
        this.currentPath = event.path;
        this.requestId = event.requestContext.requestId;
        
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
EOF
```

#### Step 1.7: Create Health Handler
Create `backend/src/handlers/health.ts`:
```bash
cat > backend/src/handlers/health.ts << 'EOF'
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';

class HealthHandler extends BaseHandler {
  protected handlerName = 'HealthHandler';

  public async basicHealth(event: APIGatewayProxyEvent, context: Context) {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'StudyApp V3 Backend',
      version: '1.0.0',
      environment: process.env.STAGE || 'development'
    };

    return this.success(healthData, 'Health check successful');
  }
}

const healthHandler = new HealthHandler();

export const basicHealth = healthHandler.withoutAuth(
  (event: APIGatewayProxyEvent, context: Context) => healthHandler.basicHealth(event, context)
);
EOF
```

#### Step 1.8: Create Lambda Construct
Create `cdk-v3/src/constructs/lambda-construct.ts`:
```bash
cat > cdk-v3/src/constructs/lambda-construct.ts << 'EOF'
import * as lambda from 'aws-cdk-cdk-v3/src/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface LambdaConstructProps {
  functionName: string;
  handlerPath: string;
  environment: Record<string, string>;
  timeout?: cdk.Duration;
  memorySize?: number;
}

export class LambdaConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    this.function = new lambda.Function(this, 'Function', {
      functionName: props.functionName,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset('backend/dist'),
      handler: props.handlerPath,
      timeout: props.timeout || cdk.Duration.seconds(30),
      memorySize: props.memorySize || 256,
      environment: props.environment,
      tracing: lambda.Tracing.ACTIVE
    });
  }
}
EOF
```

#### Step 1.9: Create API Gateway Construct
Create `cdk-v3/src/constructs/api-gateway-construct.ts`:
```bash
cat > cdk-v3/src/constructs/api-gateway-construct.ts << 'EOF'
import * as apigateway from 'aws-cdk-cdk-v3/src/aws-apigateway';
import * as lambda from 'aws-cdk-cdk-v3/src/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface ApiGatewayConstructProps {
  stage: string;
  healthFunction: lambda.Function;
}

export class ApiGatewayConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    this.api = new apigateway.RestApi(this, 'StudyAppApi', {
      restApiName: `StudyApp V3 API - ${props.stage}`,
      description: 'Multi-provider certification study platform API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization']
      },
      deployOptions: {
        stageName: props.stage,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO
      }
    });

    // API v1 resource
    const v1 = this.api.root.addResource('api').addResource('v1');

    // Health endpoint (public)
    const health = v1.addResource('health');
    health.addMethod('GET', new apigateway.LambdaIntegration(props.healthFunction));
  }
}
EOF
```

#### Step 1.10: Create Main Stack
Create `cdk-v3/src/study-app-stack-v3.ts`:
```bash
cat > cdk-v3/src/study-app-stack-v3.ts << 'EOF'
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseConstruct } from './constructs/database-construct';
import { StorageConstruct } from './constructs/storage-construct';
import { LambdaConstruct } from './constructs/lambda-construct';
import { ApiGatewayConstruct } from './constructs/api-gateway-construct';
import { getConfig } from './shared/config';

export class StudyAppStackV3 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const stage = this.node.tryGetContext('stage') || 'dev';
    const config = getConfig(stage);
    
    // Tag all resources
    cdk.Tags.of(this).add('Project', 'StudyAppV3');
    cdk.Tags.of(this).add('Stage', config.stage);

    // Create database
    const database = new DatabaseConstruct(this, 'Database', config);
    
    // Create storage
    const storage = new StorageConstruct(this, 'Storage', config);

    // Common environment variables
    const commonEnv = {
      STAGE: config.stage,
      REGION: config.region,
      USER_TABLE_NAME: database.userTable.tableName,
      SESSION_TABLE_NAME: database.sessionTable.tableName,
      PROGRESS_TABLE_NAME: database.progressTable.tableName,
      GOAL_TABLE_NAME: database.goalTable.tableName,
      BUCKET_NAME: storage.dataBucket.bucketName
    };

    // Create health Lambda
    const healthLambda = new LambdaConstruct(this, 'HealthLambda', {
      functionName: `StudyAppV3-Health-${stage}`,
      handlerPath: 'health.basicHealth',
      environment: commonEnv
    });

    // Create API Gateway
    const api = new ApiGatewayConstruct(this, 'ApiGateway', {
      stage: config.stage,
      healthFunction: healthLambda.function
    });

    // Output values
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.api.url,
      exportName: `${config.stage}-ApiGatewayUrl`
    });

    new cdk.CfnOutput(this, 'UserTableName', {
      value: database.userTable.tableName,
      exportName: `${config.stage}-UserTableName`
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: storage.dataBucket.bucketName,
      exportName: `${config.stage}-BucketName`
    });
  }
}
EOF
```

#### Step 1.11: Create Lambda Build Script
Create `backend/package.json`:
```bash
cat > backend/package.json << 'EOF'
{
  "name": "studyapp-v3-lambda",
  "version": "1.0.0",
  "description": "Lambda functions for StudyApp V3",
  "scripts": {
    "build": "node build.js",
    "clean": "rm -rf dist",
    "test": "jest"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0",
    "@aws-sdk/client-s3": "^3.0.0"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.0",
    "@types/node": "^20.0.0",
    "esbuild": "^0.19.0",
    "typescript": "^5.0.0"
  }
}
EOF
```

Create `backend/build.js`:
```bash
cat > backend/build.js << 'EOF'
const esbuild = require('esbuild');
const glob = require('glob');
const fs = require('fs');
const path = require('path');

async function build() {
  // Clean dist directory
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true });
  }
  fs.mkdirSync('dist', { recursive: true });

  // Build all handler files
  const handlerFiles = glob.sync('backend/src/handlers/*.ts');
  
  const buildPromises = handlerFiles.map(async (file) => {
    const handlerName = path.basename(file, '.ts');
    
    return esbuild.build({
      entryPoints: [file],
      bundle: true,
      outfile: `dist/${handlerName}.js`,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      external: ['aws-sdk'],
      minify: true,
      sourcemap: false,
      tsconfig: '../tsconfig.json'
    });
  });
  
  await Promise.all(buildPromises);
  console.log(`✅ Built ${handlerFiles.length} Lambda functions`);
}

build().catch(console.error);
EOF
```

#### Step 1.12: Build and Deploy
```bash
# Install Lambda dependencies
cd lambda
npm install
npm install -g glob

# Build Lambda functions
npm run build

# Return to CDK directory
cd ..

# Bootstrap CDK (first time only)
cdk bootstrap --context stage=dev

# Deploy infrastructure
cdk deploy --context stage=dev --require-approval never

# Verify deployment
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)
echo "API URL: $API_URL"
```

#### Step 1.13: Test Health Endpoint
```bash
# Test health endpoint
curl -X GET "$API_URL/api/v1/health"

# Expected output:
# {
#   "success": true,
#   "data": {
#     "status": "healthy",
#     "timestamp": "2024-01-15T10:30:00.000Z",
#     "service": "StudyApp V3 Backend",
#     "version": "1.0.0",
#     "environment": "dev"
#   },
#   "message": "Health check successful",
#   "metadata": {
#     "timestamp": "2024-01-15T10:30:00.000Z",
#     "requestId": "abc-123-def"
#   }
# }
```

**Success Criteria**:
- ✅ CDK deploys without errors
- ✅ Health endpoint returns 200 status
- ✅ DynamoDB tables created with GSI indexes
- ✅ S3 bucket created with CORS
- ✅ API Gateway configured with CORS
- ✅ BaseHandler pattern working
- ✅ CloudWatch logs capturing requests

### Phase 2: User Registration Feature
**Dependencies**: Phase 1  
**Objective**: Implement user registration with email validation and password hashing

#### Step 2.1: Create User Types
Create `backend/src/shared/types/user.types.ts`:
```bash
cat > backend/src/shared/types/user.types.ts << 'EOF'
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
EOF
```

#### Step 2.2: Create User Repository
Create `backend/src/repositories/user.repository.ts`:
```bash
cat > backend/src/repositories/user.repository.ts << 'EOF'
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

      return result.Items?.[0] as User || null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  async findById(userId: string): Promise<User | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { userId }
      }));

      return result.Item as User || null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }
}
EOF
```

#### Step 2.3: Create Service Factory
Create `backend/src/shared/service-factory.ts`:
```bash
cat > backend/src/shared/service-factory.ts << 'EOF'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { UserRepository } from '../repositories/user.repository';

export class ServiceFactory {
  private static dynamoClient: DynamoDBClient;
  private static s3Client: S3Client;
  private static userRepository: UserRepository;

  static getDynamoClient(): DynamoDBClient {
    if (!this.dynamoClient) {
      this.dynamoClient = new DynamoDBClient({
        region: process.env.REGION || 'us-east-1'
      });
    }
    return this.dynamoClient;
  }

  static getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: process.env.REGION || 'us-east-1'
      });
    }
    return this.s3Client;
  }

  static getUserRepository(): UserRepository {
    if (!this.userRepository) {
      this.userRepository = new UserRepository(this.getDynamoClient());
    }
    return this.userRepository;
  }
}
EOF
```

#### Step 2.4: Create Auth Service
Create `backend/src/services/auth.service.ts`:
```bash
cat > backend/src/services/auth.service.ts << 'EOF'
import * as bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/user.repository';
import { CreateUserRequest, User, UserResponse } from '../shared/types/user.types';

export class AuthService {
  constructor(private userRepository: UserRepository) {}

  async registerUser(userData: CreateUserRequest): Promise<UserResponse> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      throw new Error('Invalid email format');
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate password strength
    if (!userData.password || userData.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Validate required fields
    if (!userData.firstName?.trim()) {
      throw new Error('First name is required');
    }

    if (!userData.lastName?.trim()) {
      throw new Error('Last name is required');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    // Create user
    const user = await this.userRepository.create(userData, passwordHash);

    // Return user without password hash
    return {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isActive: user.isActive,
      preferences: user.preferences
    };
  }
}
EOF
```

#### Step 2.5: Create Auth Handler
Create `backend/src/handlers/auth.ts`:
```bash
cat > backend/src/handlers/auth.ts << 'EOF'
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { ServiceFactory } from '../shared/service-factory';
import { AuthService } from '../services/auth.service';
import { CreateUserRequest } from '../shared/types/user.types';

class AuthHandler extends BaseHandler {
  protected handlerName = 'AuthHandler';
  private authService: AuthService;

  constructor() {
    super();
    const userRepository = ServiceFactory.getUserRepository();
    this.authService = new AuthService(userRepository);
  }

  public async register(event: APIGatewayProxyEvent, context: Context) {
    try {
      // Parse and validate request body
      const userData = this.parseRequest<CreateUserRequest>(event.body);
      
      // Validate required fields
      if (!userData.email || !userData.password || !userData.firstName || !userData.lastName) {
        return this.error(
          'Missing required fields: email, password, firstName, lastName', 
          400, 
          'VALIDATION_ERROR'
        );
      }

      // Register user
      const result = await this.authService.registerUser(userData);
      
      return this.success(result, 'User registered successfully', 201);
      
    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.message.includes('already exists')) {
        return this.error(error.message, 409, 'USER_EXISTS');
      }
      
      if (error.message.includes('Invalid email') || 
          error.message.includes('Password must') ||
          error.message.includes('required')) {
        return this.error(error.message, 400, 'VALIDATION_ERROR');
      }
      
      return this.error('Internal server error during registration', 500, 'REGISTRATION_ERROR');
    }
  }
}

const authHandler = new AuthHandler();

export const register = authHandler.withoutAuth(
  (event: APIGatewayProxyEvent, context: Context) => authHandler.register(event, context)
);
EOF
```

#### Step 2.6: Install Dependencies
```bash
# Install bcrypt for password hashing
cd lambda
npm install bcryptjs uuid
npm install --save-dev @types/bcryptjs @types/uuid

# Update package.json dependencies
cat > package.json << 'EOF'
{
  "name": "studyapp-v3-lambda",
  "version": "1.0.0",
  "description": "Lambda functions for StudyApp V3",
  "scripts": {
    "build": "node build.js",
    "clean": "rm -rf dist",
    "test": "jest"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "bcryptjs": "^2.4.3",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.0",
    "@types/node": "^20.0.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/uuid": "^9.0.0",
    "esbuild": "^0.19.0",
    "typescript": "^5.0.0"
  }
}
EOF

npm install
```

#### Step 2.7: Update API Gateway
Edit `cdk-v3/src/constructs/api-gateway-construct.ts`:
```bash
# Add auth endpoints to API Gateway construct
cat >> cdk-v3/src/constructs/api-gateway-construct.ts << 'EOF'

export interface ApiGatewayConstructProps {
  stage: string;
  healthFunction: lambda.Function;
  authRegisterFunction?: lambda.Function;
}

// In constructor, after health endpoint:
    // Auth endpoints (no authorization required)
    if (props.authRegisterFunction) {
      const auth = v1.addResource('auth');
      auth.addResource('register').addMethod('POST', new apigateway.LambdaIntegration(props.authRegisterFunction));
    }
EOF
```

#### Step 2.8: Update Main Stack
Edit `cdk-v3/src/study-app-stack-v3.ts` to add auth Lambda:
```bash
# Add after health Lambda creation
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Create auth registration Lambda
    const authRegisterLambda = new LambdaConstruct(this, 'AuthRegisterLambda', {
      functionName: `StudyAppV3-AuthRegister-${stage}`,
      handlerPath: 'auth.register',
      environment: commonEnv
    });

    // Grant DynamoDB permissions
    database.userTable.grantReadWriteData(authRegisterLambda.function);

    // Update API Gateway construction to include auth function
    const api = new ApiGatewayConstruct(this, 'ApiGateway', {
      stage: config.stage,
      healthFunction: healthLambda.function,
      authRegisterFunction: authRegisterLambda.function
    });
EOF
```

#### Step 2.9: Build and Deploy
```bash
# Build Lambda functions
cd lambda
npm run build

# Return to CDK directory and deploy
cd ..
cdk deploy --context stage=dev --require-approval never
```

#### Step 2.10: Test Registration Endpoint
```bash
# Get API URL
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Test user registration
curl -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'

# Expected output:
# {
#   "success": true,
#   "data": {
#     "userId": "abc-123-def",
#     "email": "test@example.com",
#     "firstName": "Test",
#     "lastName": "User",
#     "createdAt": "2024-01-15T10:30:00.000Z",
#     "updatedAt": "2024-01-15T10:30:00.000Z",
#     "isActive": true
#   },
#   "message": "User registered successfully"
# }

# Test duplicate email error
curl -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password456",
    "firstName": "Another",
    "lastName": "User"
  }'

# Expected output:
# {
#   "success": false,
#   "error": {
#     "code": "USER_EXISTS",
#     "message": "User with this email already exists"
#   }
# }
```

#### Step 2.11: Verify DynamoDB Data
```bash
# Check if user was created in DynamoDB
export TABLE_NAME=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`UserTableName`].OutputValue' --output text)

aws dynamodb scan --table-name "$TABLE_NAME" --select COUNT

# Should show ItemCount: 1
```

**Success Criteria**:
- ✅ Registration endpoint accepts valid user data
- ✅ Passwords are securely hashed with bcrypt
- ✅ Email uniqueness is enforced
- ✅ User data is stored in DynamoDB
- ✅ Appropriate error messages for validation failures
- ✅ BaseHandler pattern eliminates HTTP boilerplate
- ✅ Service layer properly separates business logic

### Phase 3: User Login Feature
**Dependencies**: Phase 2  
**Objective**: Implement user login with JWT token generation

#### Step 3.1: Create JWT Service
Create `backend/src/services/jwt.service.ts`:
```bash
cat > backend/src/services/jwt.service.ts << 'EOF'
import * as jwt from 'jsonwebtoken';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export class JwtService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;

  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-key';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key';
    this.accessTokenExpiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  }

  generateTokens(userId: string, email: string): TokenPair {
    const accessPayload: JwtPayload = {
      userId,
      email,
      type: 'access'
    };

    const refreshPayload: JwtPayload = {
      userId,
      email,
      type: 'refresh'
    };

    const accessToken = jwt.sign(accessPayload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiresIn,
      algorithm: 'HS256'
    });

    const refreshToken = jwt.sign(refreshPayload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiresIn,
      algorithm: 'HS256'
    });

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  verifyRefreshToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.refreshTokenSecret) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }
}
EOF
```

#### Step 3.2: Update Auth Service with Login Logic
Edit `backend/src/services/auth.service.ts` to add login method:
```bash
cat >> backend/src/services/auth.service.ts << 'EOF'

  async loginUser(email: string, password: string): Promise<{ user: UserResponse; tokens: TokenPair }> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.isActive) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT tokens
    const jwtService = new JwtService();
    const tokens = jwtService.generateTokens(user.userId, user.email);

    // Return user data (without password) and tokens
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
}
EOF
```

#### Step 3.3: Update Service Factory for JWT Service
Edit `backend/src/shared/service-factory.ts`:
```bash
cat >> backend/src/shared/service-factory.ts << 'EOF'

  static getJwtService(): JwtService {
    if (!this.jwtService) {
      this.jwtService = new JwtService();
    }
    return this.jwtService;
  }

  private static jwtService: JwtService;
EOF

# Import JwtService at top of file
sed -i '1i import { JwtService } from "../services/jwt.service";' backend/src/shared/service-factory.ts
```

#### Step 3.4: Add Login Method to Auth Handler
Edit `backend/src/handlers/auth.ts` to add login method:
```bash
cat >> backend/src/handlers/auth.ts << 'EOF'

  public async login(event: APIGatewayProxyEvent, context: Context) {
    try {
      // Parse and validate request body
      const loginData = this.parseRequest<{ email: string; password: string }>(event.body);
      
      // Validate required fields
      if (!loginData.email || !loginData.password) {
        return this.error(
          'Missing required fields: email, password', 
          400, 
          'VALIDATION_ERROR'
        );
      }

      // Authenticate user
      const result = await this.authService.loginUser(loginData.email, loginData.password);
      
      return this.success(result, 'Login successful', 200);
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.message.includes('Invalid email or password') || 
          error.message.includes('Invalid email format')) {
        return this.error(error.message, 401, 'AUTHENTICATION_ERROR');
      }
      
      return this.error('Internal server error during login', 500, 'LOGIN_ERROR');
    }
  }
}

// Add login export
export const login = authHandler.withoutAuth(
  (event: APIGatewayProxyEvent, context: Context) => authHandler.login(event, context)
);
EOF
```

#### Step 3.5: Create Login Request/Response Types
Create `backend/src/shared/types/auth.types.ts`:
```bash
cat > backend/src/shared/types/auth.types.ts << 'EOF'
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
    preferences?: any;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}
EOF
```

#### Step 3.6: Install JWT Dependencies
```bash
cd lambda
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken

# Update imports in auth service
sed -i '4i import { JwtService, TokenPair } from "./jwt.service";' backend/src/services/auth.service.ts
```

#### Step 3.7: Update API Gateway for Login Endpoint
Edit `cdk-v3/src/constructs/api-gateway-construct.ts` to add login endpoint:
```bash
# Add login function parameter
sed -i 's/authRegisterFunction?: lambda.Function;/authRegisterFunction?: lambda.Function;\n  authLoginFunction?: lambda.Function;/' cdk-v3/src/constructs/api-gateway-construct.ts

# Add login endpoint
sed -i '/auth.addResource('\''register'\'').addMethod/a\      auth.addResource('\''login'\'').addMethod('\''POST'\'', new apigateway.LambdaIntegration(props.authLoginFunction!));' cdk-v3/src/constructs/api-gateway-construct.ts
```

#### Step 3.8: Update Main Stack for Login Lambda
Edit `cdk-v3/src/study-app-stack-v3.ts` to add login Lambda:
```bash
# Add after auth register Lambda
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Create auth login Lambda
    const authLoginLambda = new LambdaConstruct(this, 'AuthLoginLambda', {
      functionName: `StudyAppV3-AuthLogin-${stage}`,
      handlerPath: 'auth.login',
      environment: commonEnv
    });

    // Grant DynamoDB permissions
    database.userTable.grantReadData(authLoginLambda.function);
EOF

# Update API Gateway construction
sed -i 's/authRegisterFunction: authRegisterLambda.function/authRegisterFunction: authRegisterLambda.function,\n      authLoginFunction: authLoginLambda.function/' cdk-v3/src/study-app-stack-v3.ts
```

#### Step 3.9: Build and Deploy
```bash
# Build Lambda functions
cd lambda
npm run build

# Return to CDK directory and deploy
cd ..
cdk deploy --context stage=dev --require-approval never
```

#### Step 3.10: Test Login Endpoint
```bash
# Get API URL
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Test user login (use user created in Phase 2)
curl -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Expected output:
# {
#   "success": true,
#   "data": {
#     "user": {
#       "userId": "abc-123-def",
#       "email": "test@example.com",
#       "firstName": "Test",
#       "lastName": "User",
#       "createdAt": "2024-01-15T10:30:00.000Z",
#       "updatedAt": "2024-01-15T10:30:00.000Z",
#       "isActive": true
#     },
#     "tokens": {
#       "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#       "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
#     }
#   },
#   "message": "Login successful"
# }

# Test invalid credentials
curl -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "wrongpassword"
  }'

# Expected output:
# {
#   "success": false,
#   "error": {
#     "code": "AUTHENTICATION_ERROR",
#     "message": "Invalid email or password"
#   }
# }
```

**Success Criteria**:
- ✅ Login endpoint accepts valid credentials and returns JWT tokens
- ✅ Invalid credentials return 401 with appropriate error message
- ✅ JWT tokens are properly formatted and signed
- ✅ Password verification uses secure bcrypt comparison
- ✅ User data returned without password hash
- ✅ BaseHandler pattern eliminates HTTP boilerplate
- ✅ Service layer properly separated from handler logic

### Phase 4: Token Refresh Feature
**Dependencies**: Phase 3  
**Objective**: Implement JWT token refresh mechanism

#### Step 4.1: Create Token Blacklist Repository
Create `backend/src/repositories/token-blacklist.repository.ts`:
```bash
cat > backend/src/repositories/token-blacklist.repository.ts << 'EOF'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

export interface BlacklistedToken {
  tokenId: string;
  userId: string;
  tokenType: 'access' | 'refresh';
  blacklistedAt: string;
  expiresAt: string;
}

export class TokenBlacklistRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(dynamoClient: DynamoDBClient) {
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.TOKEN_BLACKLIST_TABLE_NAME || 'TokenBlacklist';
  }

  async blacklistToken(tokenId: string, userId: string, tokenType: 'access' | 'refresh', expiresAt: Date): Promise<void> {
    const blacklistEntry: BlacklistedToken = {
      tokenId,
      userId,
      tokenType,
      blacklistedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: blacklistEntry
    }));
  }

  async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { tokenId }
      }));

      if (!result.Item) {
        return false;
      }

      // Check if token has expired (can be removed from blacklist)
      const expiresAt = new Date(result.Item.expiresAt);
      if (expiresAt < new Date()) {
        return false; // Token has naturally expired, no longer needs to be blacklisted
      }

      return true;
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      return false; // Default to not blacklisted if there's an error
    }
  }
}
EOF
```

#### Step 4.2: Enhance JWT Service with Token ID Support
Edit `backend/src/services/jwt.service.ts` to add token ID tracking:
```bash
cat > backend/src/services/jwt.service.ts << 'EOF'
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenIds: {
    accessTokenId: string;
    refreshTokenId: string;
  };
}

export interface JwtPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
  tokenId: string;
  iat?: number;
  exp?: number;
}

export class JwtService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;

  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-key';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key';
    this.accessTokenExpiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  }

  generateTokens(userId: string, email: string): TokenPair {
    const accessTokenId = uuidv4();
    const refreshTokenId = uuidv4();

    const accessPayload: JwtPayload = {
      userId,
      email,
      type: 'access',
      tokenId: accessTokenId
    };

    const refreshPayload: JwtPayload = {
      userId,
      email,
      type: 'refresh',
      tokenId: refreshTokenId
    };

    const accessToken = jwt.sign(accessPayload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiresIn,
      algorithm: 'HS256'
    });

    const refreshToken = jwt.sign(refreshPayload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiresIn,
      algorithm: 'HS256'
    });

    return { 
      accessToken, 
      refreshToken,
      tokenIds: {
        accessTokenId,
        refreshTokenId
      }
    };
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  verifyRefreshToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.refreshTokenSecret) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  getTokenExpiration(token: string): Date {
    try {
      const decoded = jwt.decode(token) as any;
      return new Date(decoded.exp * 1000);
    } catch (error) {
      throw new Error('Invalid token format');
    }
  }
}
EOF
```

#### Step 4.3: Add Refresh Method to Auth Service
Edit `backend/src/services/auth.service.ts` to add refresh functionality:
```bash
cat >> backend/src/services/auth.service.ts << 'EOF'

  async refreshTokens(refreshToken: string): Promise<{ tokens: TokenPair }> {
    const jwtService = new JwtService();
    
    // Verify refresh token
    let payload: JwtPayload;
    try {
      payload = jwtService.verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }

    // Check if token is blacklisted
    const tokenBlacklistRepo = ServiceFactory.getTokenBlacklistRepository();
    const isBlacklisted = await tokenBlacklistRepo.isTokenBlacklisted(payload.tokenId);
    if (isBlacklisted) {
      throw new Error('Refresh token has been revoked');
    }

    // Verify user still exists and is active
    const user = await this.userRepository.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Generate new token pair
    const tokens = jwtService.generateTokens(user.userId, user.email);

    // Blacklist the old refresh token
    const oldTokenExpiration = jwtService.getTokenExpiration(refreshToken);
    await tokenBlacklistRepo.blacklistToken(
      payload.tokenId, 
      payload.userId, 
      'refresh', 
      oldTokenExpiration
    );

    return { tokens };
  }
EOF
```

#### Step 4.4: Add Refresh Method to Auth Handler
Edit `backend/src/handlers/auth.ts` to add refresh method:
```bash
cat >> backend/src/handlers/auth.ts << 'EOF'

  public async refresh(event: APIGatewayProxyEvent, context: Context) {
    try {
      // Parse and validate request body
      const refreshData = this.parseRequest<{ refreshToken: string }>(event.body);
      
      // Validate required fields
      if (!refreshData.refreshToken) {
        return this.error(
          'Missing required field: refreshToken', 
          400, 
          'VALIDATION_ERROR'
        );
      }

      // Refresh tokens
      const result = await this.authService.refreshTokens(refreshData.refreshToken);
      
      return this.success(result, 'Tokens refreshed successfully', 200);
      
    } catch (error: any) {
      console.error('Token refresh error:', error);
      
      if (error.message.includes('Invalid or expired') || 
          error.message.includes('revoked') ||
          error.message.includes('not found')) {
        return this.error(error.message, 401, 'TOKEN_ERROR');
      }
      
      return this.error('Internal server error during token refresh', 500, 'REFRESH_ERROR');
    }
  }
}

// Add refresh export
export const refresh = authHandler.withoutAuth(
  (event: APIGatewayProxyEvent, context: Context) => authHandler.refresh(event, context)
);
EOF
```

#### Step 4.5: Update Service Factory for Token Blacklist Repository
Edit `backend/src/shared/service-factory.ts`:
```bash
cat >> backend/src/shared/service-factory.ts << 'EOF'

  static getTokenBlacklistRepository(): TokenBlacklistRepository {
    if (!this.tokenBlacklistRepository) {
      this.tokenBlacklistRepository = new TokenBlacklistRepository(this.getDynamoClient());
    }
    return this.tokenBlacklistRepository;
  }

  private static tokenBlacklistRepository: TokenBlacklistRepository;
EOF

# Add import for TokenBlacklistRepository
sed -i '4i import { TokenBlacklistRepository } from "../repositories/token-blacklist.repository";' backend/src/shared/service-factory.ts
```

#### Step 4.6: Create Token Blacklist Table in CDK
Edit `cdk-v3/src/constructs/database-construct.ts` to add token blacklist table:
```bash
# Add after goals table creation
sed -i '/this\.goalTable\.addGlobalSecondaryIndex/a\
\
    // Token blacklist table\
    this.tokenBlacklistTable = new dynamodb.Table(this, '\''TokenBlacklistTable'\'', {\
      tableName: `${config.stage}-TokenBlacklist`,\
      partitionKey: { name: '\''tokenId'\'', type: dynamodb.AttributeType.STRING },\
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,\
      removalPolicy: cdk.RemovalPolicy.DESTROY,\
      timeToLiveAttribute: '\''expiresAt'\''\
    });' cdk-v3/src/constructs/database-construct.ts

# Add property declaration
sed -i '/public readonly goalTable: dynamodb.Table;/a\  public readonly tokenBlacklistTable: dynamodb.Table;' cdk-v3/src/constructs/database-construct.ts
```

#### Step 4.7: Update API Gateway for Refresh Endpoint
Edit `cdk-v3/src/constructs/api-gateway-construct.ts`:
```bash
# Add refresh function parameter
sed -i 's/authLoginFunction?: lambda.Function;/authLoginFunction?: lambda.Function;\n  authRefreshFunction?: lambda.Function;/' cdk-v3/src/constructs/api-gateway-construct.ts

# Add refresh endpoint
sed -i '/auth.addResource('\''login'\'').addMethod/a\      auth.addResource('\''refresh'\'').addMethod('\''POST'\'', new apigateway.LambdaIntegration(props.authRefreshFunction!));' cdk-v3/src/constructs/api-gateway-construct.ts
```

#### Step 4.8: Update Main Stack for Refresh Lambda
Edit `cdk-v3/src/study-app-stack-v3.ts`:
```bash
# Add token blacklist table to environment
sed -i 's/BUCKET_NAME: storage.dataBucket.bucketName/BUCKET_NAME: storage.dataBucket.bucketName,\n      TOKEN_BLACKLIST_TABLE_NAME: database.tokenBlacklistTable.tableName/' cdk-v3/src/study-app-stack-v3.ts

# Add after auth login Lambda
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Create auth refresh Lambda
    const authRefreshLambda = new LambdaConstruct(this, 'AuthRefreshLambda', {
      functionName: `StudyAppV3-AuthRefresh-${stage}`,
      handlerPath: 'auth.refresh',
      environment: commonEnv
    });

    // Grant DynamoDB permissions
    database.userTable.grantReadData(authRefreshLambda.function);
    database.tokenBlacklistTable.grantReadWriteData(authRefreshLambda.function);
EOF

# Update API Gateway construction
sed -i 's/authLoginFunction: authLoginLambda.function/authLoginFunction: authLoginLambda.function,\n      authRefreshFunction: authRefreshLambda.function/' cdk-v3/src/study-app-stack-v3.ts
```

#### Step 4.9: Build and Deploy
```bash
# Build Lambda functions
cd lambda
npm run build

# Return to CDK directory and deploy
cd ..
cdk deploy --context stage=dev --require-approval never
```

#### Step 4.10: Test Token Refresh Endpoint
```bash
# Get API URL
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# First, get tokens by logging in
TOKENS_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }')

# Extract refresh token from response
REFRESH_TOKEN=$(echo $TOKENS_RESPONSE | jq -r '.data.tokens.refreshToken')

# Test token refresh
curl -X POST "$API_URL/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }"

# Expected output:
# {
#   "success": true,
#   "data": {
#     "tokens": {
#       "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#       "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#       "tokenIds": {
#         "accessTokenId": "uuid...",
#         "refreshTokenId": "uuid..."
#       }
#     }
#   },
#   "message": "Tokens refreshed successfully"
# }

# Test using old refresh token (should fail)
curl -X POST "$API_URL/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }"

# Expected output:
# {
#   "success": false,
#   "error": {
#     "code": "TOKEN_ERROR",
#     "message": "Refresh token has been revoked"
#   }
# }
```

**Success Criteria**:
- ✅ Refresh endpoint accepts valid refresh tokens and returns new token pair
- ✅ Old refresh tokens are blacklisted after use
- ✅ Blacklisted tokens are rejected on subsequent refresh attempts
- ✅ Token blacklist table has TTL for automatic cleanup
- ✅ User validation ensures only active users can refresh tokens
- ✅ BaseHandler pattern eliminates HTTP boilerplate
- ✅ Service layer properly handles token lifecycle management

### Phase 5: User Logout Feature
**Dependencies**: Phase 4  
**Objective**: Implement user logout with token blacklisting

#### Step 5.1: Create JWT Authorizer Middleware
Create `backend/src/shared/middleware/auth.middleware.ts`:
```bash
cat > backend/src/shared/middleware/auth.middleware.ts << 'EOF'
import { APIGatewayProxyEvent } from 'aws-lambda';
import { JwtService, JwtPayload } from '../../services/jwt.service';
import { ServiceFactory } from '../service-factory';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  tokenId: string;
}

export class AuthMiddleware {
  private jwtService: JwtService;

  constructor() {
    this.jwtService = ServiceFactory.getJwtService();
  }

  async authenticateToken(event: APIGatewayProxyEvent): Promise<AuthenticatedUser> {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new Error('Invalid Authorization header format');
    }

    // Verify JWT token
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verifyAccessToken(token);
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }

    // Check if token is blacklisted
    const tokenBlacklistRepo = ServiceFactory.getTokenBlacklistRepository();
    const isBlacklisted = await tokenBlacklistRepo.isTokenBlacklisted(payload.tokenId);
    if (isBlacklisted) {
      throw new Error('Access token has been revoked');
    }

    return {
      userId: payload.userId,
      email: payload.email,
      tokenId: payload.tokenId
    };
  }
}
EOF
```

#### Step 5.2: Add withAuth Method to BaseHandler
Edit `backend/src/shared/base-handler.ts` to add authentication wrapper:
```bash
# Add after withoutAuth method
cat >> backend/src/shared/base-handler.ts << 'EOF'

  public withAuth(
    handler: (event: APIGatewayProxyEvent, context: Context, user: AuthenticatedUser) => Promise<ApiResponse>
  ) {
    return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
      try {
        this.currentPath = event.path;
        this.requestId = event.requestContext.requestId;
        
        if (event.httpMethod === 'OPTIONS') {
          return {
            statusCode: 200,
            headers: this.corsHeaders(),
            body: ''
          };
        }

        // Authenticate user
        const authMiddleware = new AuthMiddleware();
        let user: AuthenticatedUser;
        
        try {
          user = await authMiddleware.authenticateToken(event);
        } catch (authError: any) {
          console.error(`[${this.handlerName}] Auth error:`, authError.message);
          return this.error(authError.message, 401, 'AUTHENTICATION_ERROR');
        }

        const result = await handler(event, context, user);
        this.logRequest(event, result.statusCode);
        return result;
        
      } catch (error) {
        console.error(`[${this.handlerName}] Error:`, error);
        return this.error(error.message || 'Internal server error', 500);
      }
    };
  }
EOF

# Add import for AuthenticatedUser and AuthMiddleware
sed -i '1i import { AuthenticatedUser, AuthMiddleware } from "./middleware/auth.middleware";' backend/src/shared/base-handler.ts
```

#### Step 5.3: Add Logout Method to Auth Service
Edit `backend/src/services/auth.service.ts`:
```bash
cat >> backend/src/services/auth.service.ts << 'EOF'

  async logoutUser(accessToken: string): Promise<void> {
    const jwtService = new JwtService();
    
    // Verify and parse access token
    let payload: JwtPayload;
    try {
      payload = jwtService.verifyAccessToken(accessToken);
    } catch (error) {
      throw new Error('Invalid access token');
    }

    // Get token expiration
    const tokenExpiration = jwtService.getTokenExpiration(accessToken);
    
    // Blacklist the access token
    const tokenBlacklistRepo = ServiceFactory.getTokenBlacklistRepository();
    await tokenBlacklistRepo.blacklistToken(
      payload.tokenId,
      payload.userId,
      'access',
      tokenExpiration
    );

    console.log(`User ${payload.userId} logged out, token ${payload.tokenId} blacklisted`);
  }
EOF
```

#### Step 5.4: Add Logout Method to Auth Handler
Edit `backend/src/handlers/auth.ts`:
```bash
cat >> backend/src/handlers/auth.ts << 'EOF'

  public async logout(event: APIGatewayProxyEvent, context: Context, user: AuthenticatedUser) {
    try {
      // Extract access token from Authorization header
      const authHeader = event.headers.Authorization || event.headers.authorization;
      const accessToken = authHeader?.replace('Bearer ', '');
      
      if (!accessToken) {
        return this.error('Access token is required', 400, 'VALIDATION_ERROR');
      }

      // Logout user (blacklist token)
      await this.authService.logoutUser(accessToken);
      
      return this.success({ message: 'Successfully logged out' }, 'Logout successful', 200);
      
    } catch (error: any) {
      console.error('Logout error:', error);
      
      if (error.message.includes('Invalid access token')) {
        return this.error(error.message, 401, 'AUTHENTICATION_ERROR');
      }
      
      return this.error('Internal server error during logout', 500, 'LOGOUT_ERROR');
    }
  }
}

// Add logout export
export const logout = authHandler.withAuth(
  (event: APIGatewayProxyEvent, context: Context, user: AuthenticatedUser) => 
    authHandler.logout(event, context, user)
);
EOF
```

#### Step 5.5: Update API Gateway for Logout Endpoint
Edit `cdk-v3/src/constructs/api-gateway-construct.ts`:
```bash
# Add logout function parameter
sed -i 's/authRefreshFunction?: lambda.Function;/authRefreshFunction?: lambda.Function;\n  authLogoutFunction?: lambda.Function;/' cdk-v3/src/constructs/api-gateway-construct.ts

# Add logout endpoint
sed -i '/auth.addResource('\''refresh'\'').addMethod/a\      auth.addResource('\''logout'\'').addMethod('\''POST'\'', new apigateway.LambdaIntegration(props.authLogoutFunction!));' cdk-v3/src/constructs/api-gateway-construct.ts
```

#### Step 5.6: Update Main Stack for Logout Lambda
Edit `cdk-v3/src/study-app-stack-v3.ts`:
```bash
# Add after auth refresh Lambda
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Create auth logout Lambda
    const authLogoutLambda = new LambdaConstruct(this, 'AuthLogoutLambda', {
      functionName: `StudyAppV3-AuthLogout-${stage}`,
      handlerPath: 'auth.logout',
      environment: commonEnv
    });

    // Grant DynamoDB permissions
    database.tokenBlacklistTable.grantReadWriteData(authLogoutLambda.function);
EOF

# Update API Gateway construction
sed -i 's/authRefreshFunction: authRefreshLambda.function/authRefreshFunction: authRefreshLambda.function,\n      authLogoutFunction: authLogoutLambda.function/' cdk-v3/src/study-app-stack-v3.ts
```

#### Step 5.7: Build and Deploy
```bash
# Build Lambda functions
cd lambda
npm run build

# Return to CDK directory and deploy
cd ..
cdk deploy --context stage=dev --require-approval never
```

#### Step 5.8: Test Logout Endpoint
```bash
# Get API URL
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# First, get tokens by logging in
TOKENS_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }')

# Extract access token from response
ACCESS_TOKEN=$(echo $TOKENS_RESPONSE | jq -r '.data.tokens.accessToken')

# Test logout
curl -X POST "$API_URL/api/v1/auth/logout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Expected output:
# {
#   "success": true,
#   "data": {
#     "message": "Successfully logged out"
#   },
#   "message": "Logout successful"
# }

# Test using the same access token again (should fail)
curl -X POST "$API_URL/api/v1/auth/logout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Expected output:
# {
#   "success": false,
#   "error": {
#     "code": "AUTHENTICATION_ERROR",
#     "message": "Access token has been revoked"
#   }
# }
```

#### Step 5.9: Test Authentication Middleware with a Protected Endpoint
Create a simple test endpoint to verify auth middleware:
```bash
# Create test handler
cat > backend/src/handlers/test.ts << 'EOF'
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { AuthenticatedUser } from '../shared/middleware/auth.middleware';

class TestHandler extends BaseHandler {
  protected handlerName = 'TestHandler';

  public async protectedEndpoint(event: APIGatewayProxyEvent, context: Context, user: AuthenticatedUser) {
    return this.success({
      message: 'You have access to this protected endpoint!',
      user: {
        userId: user.userId,
        email: user.email
      }
    });
  }
}

const testHandler = new TestHandler();

export const protectedEndpoint = testHandler.withAuth(
  (event: APIGatewayProxyEvent, context: Context, user: AuthenticatedUser) => 
    testHandler.protectedEndpoint(event, context, user)
);
EOF

# Test the protected endpoint
TOKENS_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }')

NEW_ACCESS_TOKEN=$(echo $TOKENS_RESPONSE | jq -r '.data.tokens.accessToken')

# This would work if we had deployed the test endpoint
echo "Access token for protected endpoint testing: $NEW_ACCESS_TOKEN"
```

**Success Criteria**:
- ✅ Logout endpoint requires valid authentication
- ✅ Access tokens are blacklisted upon logout
- ✅ Blacklisted access tokens cannot be used for subsequent requests
- ✅ Auth middleware properly validates JWT tokens
- ✅ Auth middleware checks token blacklist status
- ✅ BaseHandler pattern supports both authenticated and unauthenticated endpoints
- ✅ Service layer properly handles token blacklisting logic

### Phase 6: Provider Listing Feature
**Dependencies**: Phase 5  
**Objective**: Implement certification provider catalog from S3 metadata

#### Step 6.1: Create Provider Types
Create `backend/src/shared/types/provider.types.ts`:
```bash
cat > backend/src/shared/types/provider.types.ts << 'EOF'
export interface Provider {
  providerId: string;
  providerName: string;
  description: string;
  logoUrl?: string;
  websiteUrl?: string;
  examCount: number;
  topicCount: number;
  questionCount: number;
  isActive: boolean;
  metadata: {
    difficulty: string[];
    examTypes: string[];
    certificationLevels: string[];
    lastUpdated: string;
  };
}

export interface ProviderListResponse {
  providers: Provider[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ProviderDetailsResponse extends Provider {
  exams: {
    examId: string;
    examName: string;
    examCode: string;
    difficulty: string;
    questionCount: number;
  }[];
  topicCategories: {
    categoryName: string;
    topicCount: number;
    questionCount: number;
  }[];
}
EOF
```

#### Step 6.2: Create S3 Question Repository
Create `backend/src/repositories/question.repository.ts`:
```bash
cat > backend/src/repositories/question.repository.ts << 'EOF'
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

export interface ProviderMetadata {
  providerId: string;
  providerName: string;
  description: string;
  logoUrl?: string;
  websiteUrl?: string;
  exams: ExamMetadata[];
  isActive: boolean;
  lastUpdated: string;
}

export interface ExamMetadata {
  examId: string;
  examName: string;
  examCode: string;
  description: string;
  difficulty: string;
  questionCount: number;
  topics: string[];
}

export class QuestionRepository {
  private s3Client: S3Client;
  private bucketName: string;
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(s3Client: S3Client) {
    this.s3Client = s3Client;
    this.bucketName = process.env.BUCKET_NAME!;
  }

  async getAllProviders(): Promise<ProviderMetadata[]> {
    const cacheKey = 'all_providers';
    
    // Check cache
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // List all provider directories
      const listResponse = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: 'providers/',
        Delimiter: '/'
      }));

      const providers: ProviderMetadata[] = [];

      for (const prefix of listResponse.CommonPrefixes || []) {
        const providerDir = prefix.Prefix!.replace('providers/', '').replace('/', '');
        if (providerDir) {
          try {
            const metadata = await this.getProviderMetadata(providerDir);
            if (metadata) {
              providers.push(metadata);
            }
          } catch (error) {
            console.warn(`Failed to load metadata for provider ${providerDir}:`, error);
          }
        }
      }

      // Cache result
      this.cache.set(cacheKey, providers);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return providers;
    } catch (error) {
      console.error('Error listing providers from S3:', error);
      throw new Error('Failed to load providers');
    }
  }

  async getProviderMetadata(providerId: string): Promise<ProviderMetadata | null> {
    const cacheKey = `provider_${providerId}`;
    
    // Check cache
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const key = `providers/${providerId}/metadata.json`;
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      }));

      const body = await response.Body?.transformToString();
      if (!body) {
        return null;
      }

      const metadata = JSON.parse(body) as ProviderMetadata;
      
      // Cache result
      this.cache.set(cacheKey, metadata);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return metadata;
    } catch (error) {
      console.error(`Error loading provider ${providerId} metadata:`, error);
      return null;
    }
  }

  async getProviderExams(providerId: string): Promise<ExamMetadata[]> {
    const cacheKey = `provider_exams_${providerId}`;
    
    // Check cache
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // List exam directories for provider
      const listResponse = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `providers/${providerId}/exams/`,
        Delimiter: '/'
      }));

      const exams: ExamMetadata[] = [];

      for (const prefix of listResponse.CommonPrefixes || []) {
        const examDir = prefix.Prefix!.split('/').slice(-2, -1)[0];
        if (examDir) {
          try {
            const examKey = `providers/${providerId}/exams/${examDir}/metadata.json`;
            const examResponse = await this.s3Client.send(new GetObjectCommand({
              Bucket: this.bucketName,
              Key: examKey
            }));

            const examBody = await examResponse.Body?.transformToString();
            if (examBody) {
              const examMetadata = JSON.parse(examBody) as ExamMetadata;
              exams.push(examMetadata);
            }
          } catch (error) {
            console.warn(`Failed to load exam metadata for ${examDir}:`, error);
          }
        }
      }

      // Cache result
      this.cache.set(cacheKey, exams);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return exams;
    } catch (error) {
      console.error(`Error loading exams for provider ${providerId}:`, error);
      return [];
    }
  }

  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return false;
    }
    return this.cache.has(key);
  }
}
EOF
```

#### Step 6.3: Create Provider Service
Create `backend/src/services/provider.service.ts`:
```bash
cat > backend/src/services/provider.service.ts << 'EOF'
import { QuestionRepository, ProviderMetadata } from '../repositories/question.repository';
import { Provider, ProviderListResponse, ProviderDetailsResponse } from '../shared/types/provider.types';

export class ProviderService {
  constructor(private questionRepository: QuestionRepository) {}

  async listProviders(limit: number = 50, offset: number = 0): Promise<ProviderListResponse> {
    try {
      // Get all provider metadata
      const providerMetadata = await this.questionRepository.getAllProviders();
      
      // Filter active providers
      const activeProviders = providerMetadata.filter(p => p.isActive);
      
      // Convert to Provider format
      const providers: Provider[] = activeProviders.map(metadata => ({
        providerId: metadata.providerId,
        providerName: metadata.providerName,
        description: metadata.description,
        logoUrl: metadata.logoUrl,
        websiteUrl: metadata.websiteUrl,
        examCount: metadata.exams?.length || 0,
        topicCount: this.calculateTopicCount(metadata),
        questionCount: this.calculateQuestionCount(metadata),
        isActive: metadata.isActive,
        metadata: {
          difficulty: this.extractDifficulties(metadata),
          examTypes: this.extractExamTypes(metadata),
          certificationLevels: this.extractCertificationLevels(metadata),
          lastUpdated: metadata.lastUpdated
        }
      }));

      // Apply pagination
      const total = providers.length;
      const paginatedProviders = providers.slice(offset, offset + limit);
      
      return {
        providers: paginatedProviders,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };
    } catch (error) {
      console.error('Error in listProviders:', error);
      throw new Error('Failed to retrieve providers');
    }
  }

  async getProviderDetails(providerId: string): Promise<ProviderDetailsResponse | null> {
    try {
      // Get provider metadata
      const metadata = await this.questionRepository.getProviderMetadata(providerId);
      if (!metadata) {
        return null;
      }

      // Get provider exams
      const exams = await this.questionRepository.getProviderExams(providerId);
      
      // Calculate topic categories
      const topicCategories = this.calculateTopicCategories(exams);

      return {
        providerId: metadata.providerId,
        providerName: metadata.providerName,
        description: metadata.description,
        logoUrl: metadata.logoUrl,
        websiteUrl: metadata.websiteUrl,
        examCount: exams.length,
        topicCount: this.calculateTopicCount(metadata),
        questionCount: this.calculateQuestionCount(metadata),
        isActive: metadata.isActive,
        metadata: {
          difficulty: this.extractDifficulties(metadata),
          examTypes: this.extractExamTypes(metadata),
          certificationLevels: this.extractCertificationLevels(metadata),
          lastUpdated: metadata.lastUpdated
        },
        exams: exams.map(exam => ({
          examId: exam.examId,
          examName: exam.examName,
          examCode: exam.examCode,
          difficulty: exam.difficulty,
          questionCount: exam.questionCount
        })),
        topicCategories
      };
    } catch (error) {
      console.error(`Error getting provider details for ${providerId}:`, error);
      throw new Error('Failed to retrieve provider details');
    }
  }

  private calculateTopicCount(metadata: ProviderMetadata): number {
    const allTopics = new Set<string>();
    for (const exam of metadata.exams || []) {
      for (const topic of exam.topics || []) {
        allTopics.add(topic);
      }
    }
    return allTopics.size;
  }

  private calculateQuestionCount(metadata: ProviderMetadata): number {
    return (metadata.exams || []).reduce((total, exam) => total + (exam.questionCount || 0), 0);
  }

  private extractDifficulties(metadata: ProviderMetadata): string[] {
    const difficulties = new Set<string>();
    for (const exam of metadata.exams || []) {
      if (exam.difficulty) {
        difficulties.add(exam.difficulty);
      }
    }
    return Array.from(difficulties).sort();
  }

  private extractExamTypes(metadata: ProviderMetadata): string[] {
    return (metadata.exams || []).map(exam => exam.examCode).sort();
  }

  private extractCertificationLevels(metadata: ProviderMetadata): string[] {
    // Extract from exam codes and names
    const levels = new Set<string>();
    for (const exam of metadata.exams || []) {
      if (exam.examName.toLowerCase().includes('associate')) levels.add('Associate');
      if (exam.examName.toLowerCase().includes('professional')) levels.add('Professional');
      if (exam.examName.toLowerCase().includes('expert')) levels.add('Expert');
      if (exam.examName.toLowerCase().includes('fundamental')) levels.add('Fundamental');
      if (exam.examName.toLowerCase().includes('specialty')) levels.add('Specialty');
    }
    return Array.from(levels).sort();
  }

  private calculateTopicCategories(exams: any[]): { categoryName: string; topicCount: number; questionCount: number; }[] {
    const categories = new Map<string, { topicCount: number; questionCount: number }>();
    
    for (const exam of exams) {
      for (const topic of exam.topics || []) {
        // Categorize topics (simplified categorization)
        const category = this.categorizeTopicName(topic);
        const existing = categories.get(category) || { topicCount: 0, questionCount: 0 };
        existing.topicCount += 1;
        existing.questionCount += Math.floor(exam.questionCount / (exam.topics?.length || 1));
        categories.set(category, existing);
      }
    }

    return Array.from(categories.entries()).map(([categoryName, data]) => ({
      categoryName,
      topicCount: data.topicCount,
      questionCount: data.questionCount
    })).sort((a, b) => b.questionCount - a.questionCount);
  }

  private categorizeTopicName(topicName: string): string {
    const topic = topicName.toLowerCase();
    if (topic.includes('compute') || topic.includes('server') || topic.includes('instance')) return 'Compute';
    if (topic.includes('storage') || topic.includes('database') || topic.includes('backup')) return 'Storage';
    if (topic.includes('network') || topic.includes('vpc') || topic.includes('dns')) return 'Networking';
    if (topic.includes('security') || topic.includes('iam') || topic.includes('auth')) return 'Security';
    if (topic.includes('monitor') || topic.includes('log') || topic.includes('alert')) return 'Monitoring';
    if (topic.includes('deploy') || topic.includes('ci/cd') || topic.includes('pipeline')) return 'DevOps';
    return 'Other';
  }
}
EOF
```

#### Step 6.4: Create Provider Handler
Create `backend/src/handlers/providers.ts`:
```bash
cat > backend/src/handlers/providers.ts << 'EOF'
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { AuthenticatedUser } from '../shared/middleware/auth.middleware';
import { ServiceFactory } from '../shared/service-factory';
import { ProviderService } from '../services/provider.service';

class ProvidersHandler extends BaseHandler {
  protected handlerName = 'ProvidersHandler';
  private providerService: ProviderService;

  constructor() {
    super();
    const questionRepository = ServiceFactory.getQuestionRepository();
    this.providerService = new ProviderService(questionRepository);
  }

  public async listProviders(event: APIGatewayProxyEvent, context: Context, user: AuthenticatedUser) {
    try {
      // Parse query parameters
      const limit = parseInt(event.queryStringParameters?.limit || '50');
      const offset = parseInt(event.queryStringParameters?.offset || '0');

      // Validate parameters
      if (limit < 1 || limit > 100) {
        return this.error('Limit must be between 1 and 100', 400, 'VALIDATION_ERROR');
      }

      if (offset < 0) {
        return this.error('Offset must be non-negative', 400, 'VALIDATION_ERROR');
      }

      // Get providers
      const result = await this.providerService.listProviders(limit, offset);
      
      return this.success(result, 'Providers retrieved successfully');
      
    } catch (error: any) {
      console.error('List providers error:', error);
      return this.error('Failed to retrieve providers', 500, 'PROVIDERS_ERROR');
    }
  }

  public async getProviderDetails(event: APIGatewayProxyEvent, context: Context, user: AuthenticatedUser) {
    try {
      // Extract provider ID from path
      const providerId = event.pathParameters?.providerId;
      if (!providerId) {
        return this.error('Provider ID is required', 400, 'VALIDATION_ERROR');
      }

      // Validate provider ID format
      if (!/^[a-z0-9-]+$/.test(providerId)) {
        return this.error('Invalid provider ID format', 400, 'VALIDATION_ERROR');
      }

      // Get provider details
      const result = await this.providerService.getProviderDetails(providerId);
      
      if (!result) {
        return this.error('Provider not found', 404, 'PROVIDER_NOT_FOUND');
      }
      
      return this.success(result, 'Provider details retrieved successfully');
      
    } catch (error: any) {
      console.error('Get provider details error:', error);
      return this.error('Failed to retrieve provider details', 500, 'PROVIDER_DETAILS_ERROR');
    }
  }
}

const providersHandler = new ProvidersHandler();

export const listProviders = providersHandler.withAuth(
  (event: APIGatewayProxyEvent, context: Context, user: AuthenticatedUser) => 
    providersHandler.listProviders(event, context, user)
);

export const getProviderDetails = providersHandler.withAuth(
  (event: APIGatewayProxyEvent, context: Context, user: AuthenticatedUser) => 
    providersHandler.getProviderDetails(event, context, user)
);
EOF
```

#### Step 6.5: Update Service Factory for Question Repository
Edit `backend/src/shared/service-factory.ts`:
```bash
cat >> backend/src/shared/service-factory.ts << 'EOF'

  static getQuestionRepository(): QuestionRepository {
    if (!this.questionRepository) {
      this.questionRepository = new QuestionRepository(this.getS3Client());
    }
    return this.questionRepository;
  }

  private static questionRepository: QuestionRepository;
EOF

# Add import for QuestionRepository
sed -i '5i import { QuestionRepository } from "../repositories/question.repository";' backend/src/shared/service-factory.ts
```

#### Step 6.6: Create Sample Provider Data Structure
```bash
# Create sample provider metadata structure in S3
cat > sample-provider-data.json << 'EOF'
{
  "providerId": "aws",
  "providerName": "Amazon Web Services",
  "description": "AWS cloud computing certification exams covering compute, storage, networking, and security services.",
  "logoUrl": "https://example.com/aws-logo.png",
  "websiteUrl": "https://aws.amazon.com/certification/",
  "isActive": true,
  "lastUpdated": "2024-01-15T10:00:00.000Z",
  "exams": [
    {
      "examId": "saa-c03",
      "examName": "AWS Certified Solutions Architect - Associate",
      "examCode": "SAA-C03",
      "description": "Validates ability to design distributed systems on AWS",
      "difficulty": "intermediate",
      "questionCount": 150,
      "topics": ["compute", "storage", "networking", "security", "databases"]
    },
    {
      "examId": "clf-c01",
      "examName": "AWS Certified Cloud Practitioner",
      "examCode": "CLF-C01", 
      "description": "Foundational understanding of AWS services and concepts",
      "difficulty": "beginner",
      "questionCount": 100,
      "topics": ["cloud-concepts", "security", "technology", "billing"]
    }
  ]
}
EOF

echo "Sample provider metadata created in sample-provider-data.json"
echo "In production, upload this to S3 bucket at: providers/aws/metadata.json"
```

#### Step 6.7: Update API Gateway for Provider Endpoints
Edit `cdk-v3/src/constructs/api-gateway-construct.ts`:
```bash
# Add provider function parameters
sed -i 's/authLogoutFunction?: lambda.Function;/authLogoutFunction?: lambda.Function;\n  providersListFunction?: lambda.Function;\n  providersDetailsFunction?: lambda.Function;/' cdk-v3/src/constructs/api-gateway-construct.ts

# Add provider endpoints after auth endpoints
sed -i '/auth.addResource('\''logout'\'').addMethod/a\
\
    // Provider endpoints (authenticated)\
    if (props.providersListFunction && props.providersDetailsFunction) {\
      const providers = v1.addResource('\''providers'\'');\
      providers.addMethod('\''GET'\'', new apigateway.LambdaIntegration(props.providersListFunction));\
      \
      const providerDetails = providers.addResource('\''{providerId}'\'');\
      providerDetails.addMethod('\''GET'\'', new apigateway.LambdaIntegration(props.providersDetailsFunction));\
    }' cdk-v3/src/constructs/api-gateway-construct.ts
```

#### Step 6.8: Update Main Stack for Provider Lambdas
Edit `cdk-v3/src/study-app-stack-v3.ts`:
```bash
# Add after auth logout Lambda
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Create providers list Lambda
    const providersListLambda = new LambdaConstruct(this, 'ProvidersListLambda', {
      functionName: `StudyAppV3-ProvidersList-${stage}`,
      handlerPath: 'providers.listProviders',
      environment: commonEnv
    });

    // Create provider details Lambda
    const providersDetailsLambda = new LambdaConstruct(this, 'ProvidersDetailsLambda', {
      functionName: `StudyAppV3-ProvidersDetails-${stage}`,
      handlerPath: 'providers.getProviderDetails',
      environment: commonEnv
    });

    // Grant S3 permissions for provider Lambdas
    storage.dataBucket.grantRead(providersListLambda.function);
    storage.dataBucket.grantRead(providersDetailsLambda.function);
    database.tokenBlacklistTable.grantReadData(providersListLambda.function);
    database.tokenBlacklistTable.grantReadData(providersDetailsLambda.function);
EOF

# Update API Gateway construction
sed -i 's/authLogoutFunction: authLogoutLambda.function/authLogoutFunction: authLogoutLambda.function,\n      providersListFunction: providersListLambda.function,\n      providersDetailsFunction: providersDetailsLambda.function/' cdk-v3/src/study-app-stack-v3.ts
```

#### Step 6.9: Build and Deploy
```bash
# Build Lambda functions
cd lambda
npm run build

# Return to CDK directory and deploy
cd ..
cdk deploy --context stage=dev --require-approval never
```

#### Step 6.10: Test Provider Endpoints
```bash
# Get API URL and access token
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Login to get access token
TOKENS_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }')

ACCESS_TOKEN=$(echo $TOKENS_RESPONSE | jq -r '.data.tokens.accessToken')

# Test list providers endpoint
curl -X GET "$API_URL/api/v1/providers" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Expected output (if no providers in S3):
# {
#   "success": true,
#   "data": {
#     "providers": [],
#     "pagination": {
#       "total": 0,
#       "limit": 50,
#       "offset": 0,
#       "hasMore": false
#     }
#   },
#   "message": "Providers retrieved successfully"
# }

# Test provider details endpoint
curl -X GET "$API_URL/api/v1/providers/aws" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Expected output (if AWS provider not found in S3):
# {
#   "success": false,
#   "error": {
#     "code": "PROVIDER_NOT_FOUND", 
#     "message": "Provider not found"
#   }
# }

# Test pagination
curl -X GET "$API_URL/api/v1/providers?limit=10&offset=0" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### Step 6.11: Upload Sample Provider Data (Optional)
```bash
# Get bucket name
export BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text)

# Upload sample provider metadata
aws s3 cp sample-provider-data.json "s3://$BUCKET_NAME/providers/aws/metadata.json"

# Test again after uploading data
curl -X GET "$API_URL/api/v1/providers" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Should now return AWS provider data
```

**Success Criteria**:
- ✅ Providers endpoint requires authentication
- ✅ Provider listing with pagination support
- ✅ Provider details endpoint returns comprehensive information
- ✅ S3 integration loads provider metadata from JSON files
- ✅ Caching optimizes repeated S3 requests
- ✅ Error handling for missing providers
- ✅ BaseHandler pattern eliminates HTTP boilerplate
- ✅ Service layer properly separated from handler logic

### Phase 7: Provider Details Feature  
**Dependencies**: Phase 6  
**Objective**: Enhance provider details with comprehensive exam and topic information

#### Step 7.1: Already Implemented in Phase 6
The provider details functionality was already implemented as part of Phase 6 in the `getProviderDetails` method. This phase focuses on testing and validation of the existing implementation.

#### Step 7.2: Test Provider Details Endpoint Thoroughly
```bash
# Get API URL and access token
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Login to get access token
TOKENS_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com", 
    "password": "password123"
  }')

ACCESS_TOKEN=$(echo $TOKENS_RESPONSE | jq -r '.data.tokens.accessToken')

# Test provider details endpoint with various scenarios
echo "Testing provider details endpoint..."

# Test valid provider ID
curl -X GET "$API_URL/api/v1/providers/aws" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Test invalid provider ID
curl -X GET "$API_URL/api/v1/providers/invalid-provider" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Test provider ID with special characters (should fail validation)  
curl -X GET "$API_URL/api/v1/providers/aws@#$" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Test without authentication (should fail)
curl -X GET "$API_URL/api/v1/providers/aws"

# Test with expired/invalid token (should fail)
curl -X GET "$API_URL/api/v1/providers/aws" \
  -H "Authorization: Bearer invalid_token"
```

#### Step 7.3: Create Additional Sample Provider Data
```bash
# Create Azure provider sample data
cat > sample-azure-data.json << 'EOF'
{
  "providerId": "azure",
  "providerName": "Microsoft Azure",
  "description": "Microsoft Azure cloud computing certification exams covering compute, storage, networking, AI, and data services.",
  "logoUrl": "https://example.com/azure-logo.png", 
  "websiteUrl": "https://docs.microsoft.com/en-us/learn/certifications/",
  "isActive": true,
  "lastUpdated": "2024-01-15T10:00:00.000Z",
  "exams": [
    {
      "examId": "az-900",
      "examName": "Microsoft Azure Fundamentals",
      "examCode": "AZ-900",
      "description": "Foundational level knowledge of cloud services and how those services are provided with Microsoft Azure",
      "difficulty": "beginner",
      "questionCount": 120,
      "topics": ["cloud-concepts", "azure-services", "security", "privacy", "pricing"]
    },
    {
      "examId": "az-104",
      "examName": "Microsoft Azure Administrator",
      "examCode": "AZ-104", 
      "description": "Skills needed to implement, manage, and monitor an organization's Microsoft Azure environment",
      "difficulty": "intermediate",
      "questionCount": 180,
      "topics": ["identity", "governance", "storage", "compute", "virtual-networking", "monitoring"]
    }
  ]
}
EOF

# Create GCP provider sample data
cat > sample-gcp-data.json << 'EOF'
{
  "providerId": "gcp",
  "providerName": "Google Cloud Platform",
  "description": "Google Cloud Platform certification exams covering cloud architecture, data engineering, and machine learning.",
  "logoUrl": "https://example.com/gcp-logo.png",
  "websiteUrl": "https://cloud.google.com/certification",
  "isActive": true,
  "lastUpdated": "2024-01-15T10:00:00.000Z", 
  "exams": [
    {
      "examId": "ace",
      "examName": "Associate Cloud Engineer",
      "examCode": "ACE",
      "description": "Deploy applications, monitor operations, and manage enterprise solutions on Google Cloud",
      "difficulty": "intermediate", 
      "questionCount": 130,
      "topics": ["compute-engine", "kubernetes", "app-engine", "storage", "networking", "security"]
    },
    {
      "examId": "pca",
      "examName": "Professional Cloud Architect", 
      "examCode": "PCA",
      "description": "Design, develop, and manage robust, secure, scalable, and dynamic solutions on Google Cloud",
      "difficulty": "advanced",
      "questionCount": 200,
      "topics": ["architecture", "security", "scalability", "reliability", "cost-optimization"]
    }
  ]
}
EOF

echo "Created sample Azure and GCP provider data files"
```

#### Step 7.4: Upload Multiple Provider Data for Testing
```bash
# Get bucket name
export BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text)

# Upload sample provider metadata files
aws s3 cp sample-provider-data.json "s3://$BUCKET_NAME/providers/aws/metadata.json"
aws s3 cp sample-azure-data.json "s3://$BUCKET_NAME/providers/azure/metadata.json" 
aws s3 cp sample-gcp-data.json "s3://$BUCKET_NAME/providers/gcp/metadata.json"

echo "Uploaded sample provider data to S3"

# Verify files were uploaded
aws s3 ls "s3://$BUCKET_NAME/providers/" --recursive
```

#### Step 7.5: Test Provider Listing and Details with Real Data
```bash
# Test provider listing with multiple providers
echo "Testing provider listing with multiple providers..."
curl -X GET "$API_URL/api/v1/providers" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Expected output should now show 3 providers (AWS, Azure, GCP)

# Test each provider details endpoint  
echo "Testing AWS provider details..."
curl -X GET "$API_URL/api/v1/providers/aws" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

echo "Testing Azure provider details..."  
curl -X GET "$API_URL/api/v1/providers/azure" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

echo "Testing GCP provider details..."
curl -X GET "$API_URL/api/v1/providers/gcp" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test pagination with real data
echo "Testing pagination with limit=2..."
curl -X GET "$API_URL/api/v1/providers?limit=2&offset=0" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

echo "Testing pagination with offset=2..." 
curl -X GET "$API_URL/api/v1/providers?limit=2&offset=2" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
```

#### Step 7.6: Validate Provider Details Response Structure
```bash
# Create validation script for provider details response
cat > validate-provider-details.js << 'EOF'
const response = JSON.parse(process.argv[2]);

// Validate response structure
const requiredFields = [
  'providerId', 'providerName', 'description', 'examCount', 
  'topicCount', 'questionCount', 'isActive', 'metadata', 
  'exams', 'topicCategories'
];

const requiredMetadataFields = [
  'difficulty', 'examTypes', 'certificationLevels', 'lastUpdated'
];

const requiredExamFields = [
  'examId', 'examName', 'examCode', 'difficulty', 'questionCount'
];

console.log('Validating provider details response structure...');

// Check main fields
for (const field of requiredFields) {
  if (!(field in response.data)) {
    console.error(`Missing required field: ${field}`);
    process.exit(1);
  }
}

// Check metadata fields
for (const field of requiredMetadataFields) {
  if (!(field in response.data.metadata)) {
    console.error(`Missing required metadata field: ${field}`);
    process.exit(1);
  }
}

// Check exam structure
if (response.data.exams.length > 0) {
  for (const field of requiredExamFields) {
    if (!(field in response.data.exams[0])) {
      console.error(`Missing required exam field: ${field}`);
      process.exit(1);
    }
  }
}

// Check topic categories structure
if (response.data.topicCategories.length > 0) {
  const requiredTopicFields = ['categoryName', 'topicCount', 'questionCount'];
  for (const field of requiredTopicFields) {
    if (!(field in response.data.topicCategories[0])) {
      console.error(`Missing required topic category field: ${field}`);
      process.exit(1);
    }
  }
}

console.log('✅ Provider details response structure is valid');
console.log(`Provider: ${response.data.providerName}`);
console.log(`Exams: ${response.data.examCount}`);
console.log(`Topics: ${response.data.topicCount}`); 
console.log(`Questions: ${response.data.questionCount}`);
EOF

# Test validation with AWS provider
AWS_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/providers/aws" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

node validate-provider-details.js "$AWS_RESPONSE"
```

#### Step 7.7: Test Error Handling and Edge Cases
```bash
# Test error scenarios
echo "Testing error scenarios..."

# Test missing provider ID
curl -X GET "$API_URL/api/v1/providers/" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Test provider with empty name  
curl -X GET "$API_URL/api/v1/providers/" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Test very long provider ID
curl -X GET "$API_URL/api/v1/providers/this-is-a-very-long-provider-id-that-might-cause-issues" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Test SQL injection attempt (should be blocked by validation)
curl -X GET "$API_URL/api/v1/providers/aws'; DROP TABLE users;--" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

echo "Error handling tests completed"
```

#### Step 7.8: Performance Testing for Provider Details
```bash  
# Test response times and caching
echo "Testing provider details performance and caching..."

# First call (cache miss)
echo "First call (should populate cache):"
time curl -s -X GET "$API_URL/api/v1/providers/aws" \
  -H "Authorization: Bearer $ACCESS_TOKEN" > /dev/null

# Second call (cache hit)
echo "Second call (should use cache):"
time curl -s -X GET "$API_URL/api/v1/providers/aws" \
  -H "Authorization: Bearer $ACCESS_TOKEN" > /dev/null

# Third call (should still use cache)
echo "Third call (should still use cache):"
time curl -s -X GET "$API_URL/api/v1/providers/aws" \
  -H "Authorization: Bearer $ACCESS_TOKEN" > /dev/null

echo "Performance testing completed"
```

**Success Criteria**:
- ✅ Provider details endpoint returns comprehensive provider information
- ✅ Response includes exam list with metadata
- ✅ Response includes topic categories with statistics  
- ✅ Error handling works for invalid provider IDs
- ✅ Authentication is properly enforced
- ✅ Input validation prevents malicious requests
- ✅ Caching improves response times for repeated requests
- ✅ Response structure is consistent and well-formatted

### Phase 8: Exam Listing Feature
**Dependencies**: Phase 7  
**Objective**: Implement comprehensive exam catalog with cross-provider filtering

#### Step 8.1: Create Exam Types  
Create `backend/src/shared/types/exam.types.ts`:
```bash
cat > backend/src/shared/types/exam.types.ts << 'EOF'
export interface Exam {
  examId: string;
  examName: string;
  examCode: string;
  providerId: string;
  providerName: string;
  description: string;
  difficulty: string;
  duration?: number;
  questionCount: number;
  passingScore?: number;
  topics: string[];
  isActive: boolean;
  metadata: {
    lastUpdated: string;
    examUrl?: string;
    cost?: string;
    prerequisites?: string[];
  };
}

export interface ExamListResponse {
  exams: Exam[];
  filters: {
    providers: { id: string; name: string; count: number }[];
    difficulties: { level: string; count: number }[];
    topics: { topic: string; count: number }[];
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ExamDetailsResponse extends Exam {
  relatedExams: {
    examId: string;
    examName: string;
    examCode: string;
    difficulty: string;
    similarity: number;
  }[];
  topicBreakdown: {
    topicName: string;
    questionCount: number;
    percentage: number;
    difficulty: string;
  }[];
  studyPath?: {
    recommendedOrder: number;
    prerequisites: string[];
    nextExams: string[];
  };
}
EOF
```

#### Step 8.2: Enhance Question Repository with Exam Methods
Edit `backend/src/repositories/question.repository.ts` to add exam-specific methods:
```bash
cat >> backend/src/repositories/question.repository.ts << 'EOF'

  async getAllExams(): Promise<ExamMetadata[]> {
    const cacheKey = 'all_exams';
    
    // Check cache
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Get all providers first
      const providers = await this.getAllProviders();
      const allExams: ExamMetadata[] = [];

      // Collect exams from all providers
      for (const provider of providers) {
        if (provider.isActive && provider.exams) {
          for (const exam of provider.exams) {
            allExams.push({
              ...exam,
              providerId: provider.providerId,
              providerName: provider.providerName
            } as ExamMetadata & { providerId: string; providerName: string });
          }
        }
      }

      // Cache result
      this.cache.set(cacheKey, allExams);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return allExams;
    } catch (error) {
      console.error('Error listing all exams:', error);
      throw new Error('Failed to load exams');
    }
  }

  async getExamById(examId: string): Promise<(ExamMetadata & { providerId: string; providerName: string }) | null> {
    const cacheKey = `exam_${examId}`;
    
    // Check cache
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Search through all providers for this exam
      const providers = await this.getAllProviders();
      
      for (const provider of providers) {
        if (provider.exams) {
          const exam = provider.exams.find(e => e.examId === examId);
          if (exam) {
            const examWithProvider = {
              ...exam,
              providerId: provider.providerId,
              providerName: provider.providerName
            };
            
            // Cache result
            this.cache.set(cacheKey, examWithProvider);
            this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);
            
            return examWithProvider;
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`Error loading exam ${examId}:`, error);
      return null;
    }
  }

  async getExamsByProvider(providerId: string): Promise<ExamMetadata[]> {
    const cacheKey = `provider_exams_list_${providerId}`;
    
    // Check cache
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const provider = await this.getProviderMetadata(providerId);
      if (!provider || !provider.exams) {
        return [];
      }

      const exams = provider.exams.map(exam => ({
        ...exam,
        providerId: provider.providerId,
        providerName: provider.providerName
      }));

      // Cache result  
      this.cache.set(cacheKey, exams);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return exams;
    } catch (error) {
      console.error(`Error loading exams for provider ${providerId}:`, error);
      return [];
    }
  }

  async searchExams(filters: {
    provider?: string;
    difficulty?: string;
    topics?: string[];
    searchTerm?: string;
  }): Promise<ExamMetadata[]> {
    try {
      let exams = await this.getAllExams();

      // Apply provider filter
      if (filters.provider) {
        exams = exams.filter(exam => (exam as any).providerId === filters.provider);
      }

      // Apply difficulty filter
      if (filters.difficulty) {
        exams = exams.filter(exam => exam.difficulty === filters.difficulty);
      }

      // Apply topics filter
      if (filters.topics && filters.topics.length > 0) {
        exams = exams.filter(exam => 
          filters.topics!.some(topic => exam.topics.includes(topic))
        );
      }

      // Apply search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        exams = exams.filter(exam => 
          exam.examName.toLowerCase().includes(searchLower) ||
          exam.examCode.toLowerCase().includes(searchLower) ||
          exam.description.toLowerCase().includes(searchLower)
        );
      }

      return exams;
    } catch (error) {
      console.error('Error searching exams:', error);
      return [];
    }
  }
EOF
```

#### Step 8.3: Create Exam Service
Create `backend/src/services/exam.service.ts`:
```bash
cat > backend/src/services/exam.service.ts << 'EOF'
import { QuestionRepository, ExamMetadata } from '../repositories/question.repository';
import { Exam, ExamListResponse, ExamDetailsResponse } from '../shared/types/exam.types';

export class ExamService {
  constructor(private questionRepository: QuestionRepository) {}

  async listExams(
    limit: number = 50, 
    offset: number = 0,
    filters: {
      provider?: string;
      difficulty?: string; 
      topics?: string[];
      searchTerm?: string;
    } = {}
  ): Promise<ExamListResponse> {
    try {
      // Get filtered exams
      const examMetadata = await this.questionRepository.searchExams(filters);
      
      // Convert to Exam format
      const exams: Exam[] = examMetadata.map(metadata => this.mapExamMetadataToExam(metadata));
      
      // Apply pagination
      const total = exams.length;
      const paginatedExams = exams.slice(offset, offset + limit);
      
      // Generate filter options
      const filterOptions = await this.generateFilterOptions(examMetadata);
      
      return {
        exams: paginatedExams,
        filters: filterOptions,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };
    } catch (error) {
      console.error('Error in listExams:', error);
      throw new Error('Failed to retrieve exams');
    }
  }

  async getExamDetails(examId: string): Promise<ExamDetailsResponse | null> {
    try {
      // Get exam metadata
      const examMetadata = await this.questionRepository.getExamById(examId);
      if (!examMetadata) {
        return null;
      }

      // Get related exams
      const relatedExams = await this.findRelatedExams(examMetadata);
      
      // Calculate topic breakdown
      const topicBreakdown = this.calculateTopicBreakdown(examMetadata);
      
      // Generate study path recommendations
      const studyPath = await this.generateStudyPath(examMetadata);

      const exam = this.mapExamMetadataToExam(examMetadata);

      return {
        ...exam,
        relatedExams,
        topicBreakdown,
        studyPath
      };
    } catch (error) {
      console.error(`Error getting exam details for ${examId}:`, error);
      throw new Error('Failed to retrieve exam details');
    }
  }

  private mapExamMetadataToExam(metadata: ExamMetadata & { providerId?: string; providerName?: string }): Exam {
    return {
      examId: metadata.examId,
      examName: metadata.examName,
      examCode: metadata.examCode,
      providerId: metadata.providerId || 'unknown',
      providerName: metadata.providerName || 'Unknown Provider',
      description: metadata.description,
      difficulty: metadata.difficulty,
      questionCount: metadata.questionCount,
      topics: metadata.topics || [],
      isActive: true,
      metadata: {
        lastUpdated: new Date().toISOString()
      }
    };
  }

  private async generateFilterOptions(exams: ExamMetadata[]): Promise<{
    providers: { id: string; name: string; count: number }[];
    difficulties: { level: string; count: number }[];
    topics: { topic: string; count: number }[];
  }> {
    const providerCounts = new Map<string, { name: string; count: number }>();
    const difficultyCounts = new Map<string, number>();
    const topicCounts = new Map<string, number>();

    for (const exam of exams) {
      // Count providers
      const providerId = (exam as any).providerId || 'unknown';
      const providerName = (exam as any).providerName || 'Unknown';
      const existingProvider = providerCounts.get(providerId);
      providerCounts.set(providerId, {
        name: providerName,
        count: (existingProvider?.count || 0) + 1
      });

      // Count difficulties
      if (exam.difficulty) {
        difficultyCounts.set(exam.difficulty, (difficultyCounts.get(exam.difficulty) || 0) + 1);
      }

      // Count topics
      for (const topic of exam.topics || []) {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      }
    }

    return {
      providers: Array.from(providerCounts.entries())
        .map(([id, data]) => ({ id, name: data.name, count: data.count }))
        .sort((a, b) => b.count - a.count),
      difficulties: Array.from(difficultyCounts.entries())
        .map(([level, count]) => ({ level, count }))
        .sort((a, b) => b.count - a.count),
      topics: Array.from(topicCounts.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20) // Limit to top 20 topics
    };
  }

  private async findRelatedExams(exam: ExamMetadata): Promise<{
    examId: string;
    examName: string; 
    examCode: string;
    difficulty: string;
    similarity: number;
  }[]> {
    try {
      const allExams = await this.questionRepository.getAllExams();
      const relatedExams = [];

      for (const otherExam of allExams) {
        if (otherExam.examId === exam.examId) continue;

        // Calculate similarity based on shared topics
        const sharedTopics = exam.topics.filter(topic => otherExam.topics.includes(topic));
        const similarity = sharedTopics.length / Math.max(exam.topics.length, otherExam.topics.length);

        if (similarity > 0.3) { // At least 30% similarity
          relatedExams.push({
            examId: otherExam.examId,
            examName: otherExam.examName,
            examCode: otherExam.examCode, 
            difficulty: otherExam.difficulty,
            similarity: Math.round(similarity * 100) / 100
          });
        }
      }

      return relatedExams
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5); // Top 5 related exams
    } catch (error) {
      console.error('Error finding related exams:', error);
      return [];
    }
  }

  private calculateTopicBreakdown(exam: ExamMetadata): {
    topicName: string;
    questionCount: number;
    percentage: number;
    difficulty: string;
  }[] {
    if (!exam.topics || exam.topics.length === 0) {
      return [];
    }

    const questionsPerTopic = Math.floor(exam.questionCount / exam.topics.length);
    const remainder = exam.questionCount % exam.topics.length;

    return exam.topics.map((topic, index) => ({
      topicName: topic,
      questionCount: questionsPerTopic + (index < remainder ? 1 : 0),
      percentage: Math.round(((questionsPerTopic + (index < remainder ? 1 : 0)) / exam.questionCount) * 100),
      difficulty: this.inferTopicDifficulty(topic, exam.difficulty)
    }));
  }

  private inferTopicDifficulty(topicName: string, examDifficulty: string): string {
    const topic = topicName.toLowerCase();
    
    // Advanced topics
    if (topic.includes('architecture') || topic.includes('optimization') || topic.includes('advanced')) {
      return 'advanced';
    }
    
    // Basic/fundamental topics
    if (topic.includes('fundamental') || topic.includes('basic') || topic.includes('intro')) {
      return 'beginner';
    }
    
    // Default to exam difficulty
    return examDifficulty;
  }

  private async generateStudyPath(exam: ExamMetadata): Promise<{
    recommendedOrder: number;
    prerequisites: string[];
    nextExams: string[];
  }> {
    // Simplified study path generation
    const difficulty = exam.difficulty.toLowerCase();
    
    let recommendedOrder = 2; // Default to intermediate
    if (difficulty === 'beginner') recommendedOrder = 1;
    if (difficulty === 'advanced') recommendedOrder = 3;

    return {
      recommendedOrder,
      prerequisites: difficulty === 'advanced' ? ['intermediate-certification'] : [],
      nextExams: difficulty === 'beginner' ? ['intermediate-level-exams'] : []
    };
  }
}
EOF
```

#### Step 8.4: Create Exam Handler  
Create `backend/src/handlers/exams.ts`:
```bash
cat > backend/src/handlers/exams.ts << 'EOF'
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { AuthenticatedUser } from '../shared/middleware/auth.middleware';
import { ServiceFactory } from '../shared/service-factory';
import { ExamService } from '../services/exam.service';

class ExamsHandler extends BaseHandler {
  protected handlerName = 'ExamsHandler';
  private examService: ExamService;

  constructor() {
    super();
    const questionRepository = ServiceFactory.getQuestionRepository();
    this.examService = new ExamService(questionRepository);
  }

  public async listExams(event: APIGatewayProxyEvent, context: Context, user: AuthenticatedUser) {
    try {
      // Parse query parameters
      const limit = parseInt(event.queryStringParameters?.limit || '50');
      const offset = parseInt(event.queryStringParameters?.offset || '0');
      const provider = event.queryStringParameters?.provider;
      const difficulty = event.queryStringParameters?.difficulty;
      const topicsParam = event.queryStringParameters?.topics;
      const searchTerm = event.queryStringParameters?.search;

      // Validate parameters
      if (limit < 1 || limit > 100) {
        return this.error('Limit must be between 1 and 100', 400, 'VALIDATION_ERROR');
      }

      if (offset < 0) {
        return this.error('Offset must be non-negative', 400, 'VALIDATION_ERROR');
      }

      // Parse topics array from comma-separated string
      const topics = topicsParam ? topicsParam.split(',').map(t => t.trim()) : undefined;

      // Build filters
      const filters = {
        provider,
        difficulty,
        topics,
        searchTerm
      };

      // Get exams
      const result = await this.examService.listExams(limit, offset, filters);
      
      return this.success(result, 'Exams retrieved successfully');
      
    } catch (error: any) {
      console.error('List exams error:', error);
      return this.error('Failed to retrieve exams', 500, 'EXAMS_ERROR');
    }
  }

  public async getExamDetails(event: APIGatewayProxyEvent, context: Context, user: AuthenticatedUser) {
    try {
      // Extract exam ID from path
      const examId = event.pathParameters?.examId;
      if (!examId) {
        return this.error('Exam ID is required', 400, 'VALIDATION_ERROR');
      }

      // Validate exam ID format
      if (!/^[a-z0-9-]+$/.test(examId)) {
        return this.error('Invalid exam ID format', 400, 'VALIDATION_ERROR');
      }

      // Get exam details
      const result = await this.examService.getExamDetails(examId);
      
      if (!result) {
        return this.error('Exam not found', 404, 'EXAM_NOT_FOUND');
      }
      
      return this.success(result, 'Exam details retrieved successfully');
      
    } catch (error: any) {
      console.error('Get exam details error:', error);
      return this.error('Failed to retrieve exam details', 500, 'EXAM_DETAILS_ERROR');
    }
  }
}

const examsHandler = new ExamsHandler();

export const listExams = examsHandler.withAuth(
  (event: APIGatewayProxyEvent, context: Context, user: AuthenticatedUser) => 
    examsHandler.listExams(event, context, user)
);

export const getExamDetails = examsHandler.withAuth(
  (event: APIGatewayProxyEvent, context: Context, user: AuthenticatedUser) => 
    examsHandler.getExamDetails(event, context, user)
);
EOF
```

#### Step 8.5: Update API Gateway for Exam Endpoints
Edit `cdk-v3/src/constructs/api-gateway-construct.ts`:
```bash
# Add exam function parameters
sed -i 's/providersDetailsFunction?: lambda.Function;/providersDetailsFunction?: lambda.Function;\n  examsListFunction?: lambda.Function;\n  examsDetailsFunction?: lambda.Function;/' cdk-v3/src/constructs/api-gateway-construct.ts

# Add exam endpoints after provider endpoints
sed -i '/providerDetails.addMethod/a\
\
    // Exam endpoints (authenticated)\
    if (props.examsListFunction && props.examsDetailsFunction) {\
      const exams = v1.addResource('\''exams'\'');\
      exams.addMethod('\''GET'\'', new apigateway.LambdaIntegration(props.examsListFunction));\
      \
      const examDetails = exams.addResource('\''{examId}'\'');\
      examDetails.addMethod('\''GET'\'', new apigateway.LambdaIntegration(props.examsDetailsFunction));\
    }' cdk-v3/src/constructs/api-gateway-construct.ts
```

#### Step 8.6: Update Main Stack for Exam Lambdas
Edit `cdk-v3/src/study-app-stack-v3.ts`:
```bash
# Add after provider Lambdas
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Create exams list Lambda
    const examsListLambda = new LambdaConstruct(this, 'ExamsListLambda', {
      functionName: `StudyAppV3-ExamsList-${stage}`,
      handlerPath: 'exams.listExams',
      environment: commonEnv
    });

    // Create exam details Lambda
    const examsDetailsLambda = new LambdaConstruct(this, 'ExamsDetailsLambda', {
      functionName: `StudyAppV3-ExamsDetails-${stage}`,
      handlerPath: 'exams.getExamDetails',
      environment: commonEnv
    });

    // Grant S3 permissions for exam Lambdas
    storage.dataBucket.grantRead(examsListLambda.function);
    storage.dataBucket.grantRead(examsDetailsLambda.function);
    database.tokenBlacklistTable.grantReadData(examsListLambda.function);
    database.tokenBlacklistTable.grantReadData(examsDetailsLambda.function);
EOF

# Update API Gateway construction
sed -i 's/providersDetailsFunction: providersDetailsLambda.function/providersDetailsFunction: providersDetailsLambda.function,\n      examsListFunction: examsListLambda.function,\n      examsDetailsFunction: examsDetailsLambda.function/' cdk-v3/src/study-app-stack-v3.ts
```

#### Step 8.7: Build and Deploy
```bash
# Build Lambda functions
cd lambda
npm run build

# Return to CDK directory and deploy
cd ..
cdk deploy --context stage=dev --require-approval never
```

#### Step 8.8: Test Exam Endpoints
```bash
# Get API URL and access token
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

TOKENS_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }')

ACCESS_TOKEN=$(echo $TOKENS_RESPONSE | jq -r '.data.tokens.accessToken')

# Test list exams endpoint
curl -X GET "$API_URL/api/v1/exams" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test with filters
curl -X GET "$API_URL/api/v1/exams?provider=aws&difficulty=intermediate" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test with search
curl -X GET "$API_URL/api/v1/exams?search=architect" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test exam details
curl -X GET "$API_URL/api/v1/exams/saa-c03" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test pagination
curl -X GET "$API_URL/api/v1/exams?limit=2&offset=0" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.data.pagination'

# Expected outputs will depend on the provider data uploaded in previous phases
```

**Success Criteria**:
- ✅ Exam listing endpoint returns paginated results with filters
- ✅ Cross-provider exam filtering works correctly
- ✅ Search functionality finds exams by name, code, and description
- ✅ Exam details endpoint provides comprehensive information
- ✅ Related exams are identified based on topic similarity
- ✅ Topic breakdown shows question distribution
- ✅ Filter options help users navigate available exams
- ✅ BaseHandler pattern eliminates HTTP boilerplate
- ✅ Service layer properly separated from handler logic

### Phase 9: Exam Details Feature
**Dependencies**: Phase 8  
**Objective**: Implement individual exam details with topic breakdown and related exams

#### Step 9.1: Enhance Question Service with Exam Details Methods
Edit `backend/src/services/question.service.ts` to add exam details method:
```bash
cat >> backend/src/services/question.service.ts << 'EOF'

  async getExamDetails(examId: string): Promise<ExamDetailsResponse | null> {
    try {
      // Get basic exam info
      const exam = await this.questionRepository.getExamById(examId);
      if (!exam) {
        return null;
      }

      // Get topic breakdown for the exam
      const topicBreakdown = await this.getExamTopicBreakdown(examId);
      
      // Get related exams
      const relatedExams = await this.findRelatedExams(examId, exam.topics);
      
      // Build study path recommendations
      const studyPath = await this.buildStudyPath(examId, exam.difficulty);

      const examDetails: ExamDetailsResponse = {
        ...exam,
        relatedExams,
        topicBreakdown,
        studyPath
      };

      return examDetails;
    } catch (error) {
      console.error(`Error getting exam details ${examId}:`, error);
      return null;
    }
  }

  private async getExamTopicBreakdown(examId: string): Promise<Array<{
    topicName: string;
    questionCount: number;
    percentage: number;
    difficulty: string;
  }>> {
    try {
      // Get all questions for this exam
      const questions = await this.questionRepository.getQuestionsByExam(examId);
      
      // Group by topic
      const topicMap = new Map();
      const totalQuestions = questions.length;

      for (const question of questions) {
        const topic = question.topic || 'General';
        if (!topicMap.has(topic)) {
          topicMap.set(topic, {
            topicName: topic,
            questionCount: 0,
            difficulties: []
          });
        }
        
        const topicData = topicMap.get(topic);
        topicData.questionCount++;
        topicData.difficulties.push(question.difficulty);
      }

      // Calculate percentages and average difficulty
      const breakdown = Array.from(topicMap.values()).map(topic => {
        const percentage = Math.round((topic.questionCount / totalQuestions) * 100);
        
        // Calculate most common difficulty
        const diffCounts = topic.difficulties.reduce((acc: any, diff: string) => {
          acc[diff] = (acc[diff] || 0) + 1;
          return acc;
        }, {});
        
        const difficulty = Object.keys(diffCounts).reduce((a, b) => 
          diffCounts[a] > diffCounts[b] ? a : b
        );

        return {
          topicName: topic.topicName,
          questionCount: topic.questionCount,
          percentage,
          difficulty
        };
      });

      return breakdown.sort((a, b) => b.questionCount - a.questionCount);
    } catch (error) {
      console.error('Error getting topic breakdown:', error);
      return [];
    }
  }

  private async findRelatedExams(examId: string, examTopics: string[]): Promise<Array<{
    examId: string;
    examName: string;
    examCode: string;
    difficulty: string;
    similarity: number;
  }>> {
    try {
      const allExams = await this.questionRepository.getAllExams();
      const relatedExams = [];

      for (const exam of allExams) {
        if (exam.examId === examId) continue;

        // Calculate topic similarity
        const commonTopics = exam.topics.filter(topic => examTopics.includes(topic));
        const similarity = Math.round((commonTopics.length / Math.max(exam.topics.length, examTopics.length)) * 100);

        if (similarity > 30) { // At least 30% topic overlap
          relatedExams.push({
            examId: exam.examId,
            examName: exam.examName,
            examCode: exam.examCode,
            difficulty: exam.difficulty,
            similarity
          });
        }
      }

      return relatedExams
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5); // Top 5 related exams
    } catch (error) {
      console.error('Error finding related exams:', error);
      return [];
    }
  }

  private async buildStudyPath(examId: string, difficulty: string): Promise<{
    recommendedOrder: number;
    prerequisites: string[];
    nextExams: string[];
  } | undefined> {
    try {
      // Simple study path based on difficulty progression
      const difficultyOrder = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3, 'Expert': 4 };
      const recommendedOrder = difficultyOrder[difficulty as keyof typeof difficultyOrder] || 2;

      // Find prerequisite exams (lower difficulty)
      const allExams = await this.questionRepository.getAllExams();
      const prerequisites = allExams
        .filter(exam => {
          const examDiffLevel = difficultyOrder[exam.difficulty as keyof typeof difficultyOrder] || 2;
          return examDiffLevel < recommendedOrder;
        })
        .slice(0, 3)
        .map(exam => exam.examId);

      // Find next level exams (higher difficulty)
      const nextExams = allExams
        .filter(exam => {
          const examDiffLevel = difficultyOrder[exam.difficulty as keyof typeof difficultyOrder] || 2;
          return examDiffLevel > recommendedOrder;
        })
        .slice(0, 3)
        .map(exam => exam.examId);

      return {
        recommendedOrder,
        prerequisites,
        nextExams
      };
    } catch (error) {
      console.error('Error building study path:', error);
      return undefined;
    }
  }
}
EOF
```

#### Step 9.2: Create Exam Details Handler Method
Edit `backend/src/handlers/question.ts` to add exam details endpoint:
```bash
cat >> backend/src/handlers/question.ts << 'EOF'

  public async getExamDetails(event: APIGatewayProxyEvent, context: Context) {
    try {
      // Extract exam ID from path parameters
      const examId = event.pathParameters?.id;
      
      if (!examId) {
        return this.error('Exam ID is required', 400, 'MISSING_EXAM_ID');
      }

      // Get exam details
      const examDetails = await this.questionService.getExamDetails(examId);
      
      if (!examDetails) {
        return this.error(`Exam not found: ${examId}`, 404, 'EXAM_NOT_FOUND');
      }

      return this.success(
        examDetails, 
        `Exam details retrieved successfully for ${examDetails.examName}`,
        200
      );
      
    } catch (error: any) {
      console.error('Get exam details error:', error);
      return this.error('Failed to retrieve exam details', 500, 'EXAM_DETAILS_ERROR');
    }
  }
}

// Add exam details export
export const getExamDetails = questionHandler.withoutAuth(
  (event: APIGatewayProxyEvent, context: Context) => questionHandler.getExamDetails(event, context)
);
EOF
```

#### Step 9.3: Update Question Repository with Exam Questions Method
Edit `backend/src/repositories/question.repository.ts` to add exam questions method:
```bash
cat >> backend/src/repositories/question.repository.ts << 'EOF'

  async getQuestionsByExam(examId: string): Promise<QuestionMetadata[]> {
    const cacheKey = `exam_questions_${examId}`;
    
    // Check cache
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Find the provider and exam
      const exam = await this.getExamById(examId);
      if (!exam) {
        return [];
      }

      // Load provider metadata to get questions
      const provider = await this.getProviderMetadata((exam as any).providerId);
      if (!provider || !provider.questionFiles) {
        return [];
      }

      const allQuestions: QuestionMetadata[] = [];

      // Load questions from all files for this provider
      for (const file of provider.questionFiles) {
        try {
          const questions = await this.loadQuestionFile(provider.providerId, file.fileName);
          // Filter questions by exam
          const examQuestions = questions.filter(q => q.examId === examId);
          allQuestions.push(...examQuestions);
        } catch (error) {
          console.error(`Error loading questions from ${file.fileName}:`, error);
        }
      }

      // Cache result
      this.cache.set(cacheKey, allQuestions);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return allQuestions;
    } catch (error) {
      console.error(`Error getting questions for exam ${examId}:`, error);
      return [];
    }
  }
EOF
```

#### Step 9.4: Update API Gateway for Exam Details Endpoint
Edit `cdk-v3/src/constructs/api-gateway-construct.ts` to add exam details endpoint:
```bash
# Add exam details function parameter
sed -i 's/examListFunction?: lambda.Function;/examListFunction?: lambda.Function;\n  examDetailsFunction?: lambda.Function;/' cdk-v3/src/constructs/api-gateway-construct.ts

# Add exam details endpoint with ID parameter
sed -i '/exams.addMethod('\''GET'\'', new apigateway.LambdaIntegration/a\      const examResource = exams.addResource('\''{id}'\'');\n      examResource.addMethod('\''GET'\'', new apigateway.LambdaIntegration(props.examDetailsFunction!));' cdk-v3/src/constructs/api-gateway-construct.ts
```

#### Step 9.5: Update Main Stack for Exam Details Lambda
Edit `cdk-v3/src/study-app-stack-v3.ts` to add exam details Lambda:
```bash
# Add after exam list Lambda
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Create exam details Lambda
    const examDetailsLambda = new LambdaConstruct(this, 'ExamDetailsLambda', {
      functionName: `StudyAppV3-ExamDetails-${stage}`,
      handlerPath: 'question.getExamDetails',
      environment: commonEnv
    });

    // Grant S3 permissions for question data access
    database.questionBucket.grantRead(examDetailsLambda.function);
EOF

# Update API Gateway construction
sed -i 's/examListFunction: examListLambda.function/examListFunction: examListLambda.function,\n      examDetailsFunction: examDetailsLambda.function/' cdk-v3/src/study-app-stack-v3.ts
```

#### Step 9.6: Build and Deploy
```bash
# Build Lambda functions
cd lambda
npm run build

# Return to CDK directory and deploy
cd ..
cdk deploy --context stage=dev --require-approval never
```

#### Step 9.7: Test Exam Details Endpoint
```bash
# Get API URL
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Test exam details (use exam ID from Phase 8 exam list)
curl -X GET "$API_URL/api/v1/exams/aws-saa-c03" \
  -H "Content-Type: application/json"

# Expected output:
# {
#   "success": true,
#   "message": "Exam details retrieved successfully for AWS Solutions Architect Associate",
#   "data": {
#     "examId": "aws-saa-c03",
#     "examName": "AWS Solutions Architect Associate",
#     "examCode": "SAA-C03",
#     "providerId": "aws",
#     "providerName": "Amazon Web Services",
#     "description": "Validates expertise in designing distributed systems...",
#     "difficulty": "Intermediate",
#     "questionCount": 850,
#     "topics": ["EC2", "S3", "VPC", "IAM"],
#     "relatedExams": [
#       {
#         "examId": "aws-scp-c01",
#         "examName": "AWS Cloud Practitioner",
#         "examCode": "CLF-C01", 
#         "difficulty": "Beginner",
#         "similarity": 65
#       }
#     ],
#     "topicBreakdown": [
#       {
#         "topicName": "EC2",
#         "questionCount": 180,
#         "percentage": 21,
#         "difficulty": "Intermediate"
#       }
#     ],
#     "studyPath": {
#       "recommendedOrder": 2,
#       "prerequisites": ["aws-clp-c01"],
#       "nextExams": ["aws-sap-c02"]
#     }
#   },
#   "timestamp": "2024-01-15T10:30:00.000Z"
# }

# Test with invalid exam ID
curl -X GET "$API_URL/api/v1/exams/invalid-exam" \
  -H "Content-Type: application/json"

# Expected output:
# {
#   "success": false,
#   "message": "Exam not found: invalid-exam",
#   "errorCode": "EXAM_NOT_FOUND",
#   "timestamp": "2024-01-15T10:30:00.000Z"
# }
```

#### Step 9.8: Validation Tests
```bash
# Test exam with many questions
curl -X GET "$API_URL/api/v1/exams/cisco-ccna" \
  -H "Content-Type: application/json"

# Verify topic breakdown sums to 100%
# Verify related exams are properly sorted by similarity
# Verify study path recommendations are logical
```

**Phase 9 Success Criteria**:
- ✅ Individual exam details endpoint functional
- ✅ Topic breakdown calculated correctly
- ✅ Related exams found with similarity scoring
- ✅ Study path recommendations generated
- ✅ Error handling for invalid exam IDs
- ✅ Response format matches ExamDetailsResponse type
- ✅ Performance optimized with caching

### Phase 10: Topic Listing Feature
**Dependencies**: Phase 9  
**Objective**: Implement comprehensive topic catalog with cross-provider aggregation

#### Step 10.1: Create Topic Types
Create `backend/src/shared/types/topic.types.ts`:
```bash
cat > backend/src/shared/types/topic.types.ts << 'EOF'
export interface Topic {
  topicId: string;
  topicName: string;
  description: string;
  category: string;
  difficulty: string;
  questionCount: number;
  examCount: number;
  providers: {
    providerId: string;
    providerName: string;
    questionCount: number;
  }[];
  metadata: {
    lastUpdated: string;
    relatedTopics: string[];
    skillLevel: string;
    estimatedStudyHours: number;
  };
}

export interface TopicListResponse {
  topics: Topic[];
  categories: {
    category: string;
    topicCount: number;
    questionCount: number;
  }[];
  filters: {
    difficulties: { level: string; count: number }[];
    providers: { id: string; name: string; count: number }[];
    categories: { category: string; count: number }[];
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface TopicDetailsResponse extends Topic {
  examBreakdown: {
    examId: string;
    examName: string;
    examCode: string;
    providerId: string;
    questionCount: number;
    difficulty: string;
  }[];
  studyResources: {
    type: string;
    title: string;
    url?: string;
    description: string;
  }[];
  learningPath: {
    prerequisites: string[];
    currentLevel: string;
    nextTopics: string[];
  };
}
EOF
```

#### Step 10.2: Enhance Question Repository with Topic Methods
Edit `backend/src/repositories/question.repository.ts` to add topic-specific methods:
```bash
cat >> backend/src/repositories/question.repository.ts << 'EOF'

  async getAllTopics(): Promise<TopicMetadata[]> {
    const cacheKey = 'all_topics';
    
    // Check cache
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Get all questions to extract topics
      const providers = await this.getAllProviders();
      const topicMap = new Map();

      // Process all providers
      for (const provider of providers) {
        if (!provider.isActive || !provider.questionFiles) continue;

        for (const file of provider.questionFiles) {
          try {
            const questions = await this.loadQuestionFile(provider.providerId, file.fileName);
            
            // Extract topics from questions
            for (const question of questions) {
              const topicName = question.topic || 'General';
              const topicId = this.generateTopicId(topicName);

              if (!topicMap.has(topicId)) {
                topicMap.set(topicId, {
                  topicId,
                  topicName,
                  description: this.generateTopicDescription(topicName),
                  category: this.categorizeTopicByName(topicName),
                  difficulty: question.difficulty,
                  questionCount: 0,
                  examCount: 0,
                  exams: new Set(),
                  providers: new Map(),
                  metadata: {
                    lastUpdated: new Date().toISOString(),
                    relatedTopics: [],
                    skillLevel: question.difficulty,
                    estimatedStudyHours: 0
                  }
                });
              }

              const topic = topicMap.get(topicId);
              topic.questionCount++;
              topic.exams.add(question.examId);

              // Track provider stats
              if (!topic.providers.has(provider.providerId)) {
                topic.providers.set(provider.providerId, {
                  providerId: provider.providerId,
                  providerName: provider.providerName,
                  questionCount: 0
                });
              }
              topic.providers.get(provider.providerId).questionCount++;
            }
          } catch (error) {
            console.error(`Error processing question file ${file.fileName}:`, error);
          }
        }
      }

      // Convert to final format
      const topics = Array.from(topicMap.values()).map(topic => ({
        ...topic,
        examCount: topic.exams.size,
        providers: Array.from(topic.providers.values()),
        metadata: {
          ...topic.metadata,
          estimatedStudyHours: Math.ceil(topic.questionCount / 50) // Rough estimate: 50 questions per hour
        }
      }));

      // Remove temporary properties
      topics.forEach(topic => {
        delete (topic as any).exams;
      });

      // Cache result
      this.cache.set(cacheKey, topics);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return topics;
    } catch (error) {
      console.error('Error loading all topics:', error);
      throw new Error('Failed to load topics');
    }
  }

  async getTopicById(topicId: string): Promise<TopicMetadata | null> {
    const cacheKey = `topic_${topicId}`;
    
    // Check cache
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const allTopics = await this.getAllTopics();
      const topic = allTopics.find(t => t.topicId === topicId);
      
      if (topic) {
        // Cache result
        this.cache.set(cacheKey, topic);
        this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);
      }

      return topic || null;
    } catch (error) {
      console.error(`Error loading topic ${topicId}:`, error);
      return null;
    }
  }

  async searchTopics(filters: {
    category?: string;
    difficulty?: string;
    provider?: string;
    searchTerm?: string;
  }): Promise<TopicMetadata[]> {
    try {
      let topics = await this.getAllTopics();

      // Apply category filter
      if (filters.category) {
        topics = topics.filter(topic => topic.category === filters.category);
      }

      // Apply difficulty filter
      if (filters.difficulty) {
        topics = topics.filter(topic => topic.difficulty === filters.difficulty);
      }

      // Apply provider filter
      if (filters.provider) {
        topics = topics.filter(topic => 
          topic.providers.some(p => p.providerId === filters.provider)
        );
      }

      // Apply search term filter
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        topics = topics.filter(topic =>
          topic.topicName.toLowerCase().includes(term) ||
          topic.description.toLowerCase().includes(term)
        );
      }

      return topics;
    } catch (error) {
      console.error('Error searching topics:', error);
      return [];
    }
  }

  private generateTopicId(topicName: string): string {
    return topicName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private generateTopicDescription(topicName: string): string {
    // Simple description generator based on topic name
    const descriptions: { [key: string]: string } = {
      'ec2': 'Amazon Elastic Compute Cloud virtual servers and instance management',
      's3': 'Amazon Simple Storage Service object storage and data management',
      'vpc': 'Virtual Private Cloud networking and security configurations',
      'iam': 'Identity and Access Management roles, policies, and permissions',
      'rds': 'Relational Database Service managed database solutions',
      'lambda': 'AWS Lambda serverless computing functions'
    };
    
    const key = topicName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return descriptions[key] || `${topicName} concepts and best practices`;
  }

  private categorizeTopicByName(topicName: string): string {
    const categories: { [key: string]: string } = {
      // AWS categories
      'ec2': 'Compute',
      'lambda': 'Compute',
      'ecs': 'Compute',
      's3': 'Storage',
      'ebs': 'Storage',
      'vpc': 'Networking',
      'cloudfront': 'Networking',
      'iam': 'Security',
      'cognito': 'Security',
      'rds': 'Database',
      'dynamodb': 'Database',
      // Cisco categories
      'ospf': 'Routing',
      'bgp': 'Routing',
      'vlan': 'Switching',
      'stp': 'Switching'
    };
    
    const key = topicName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return categories[key] || 'General';
  }
}
EOF
```

#### Step 10.3: Create Topic Service  
Create `backend/src/services/topic.service.ts`:
```bash
cat > backend/src/services/topic.service.ts << 'EOF'
import { QuestionRepository } from '../repositories/question.repository';
import { Topic, TopicListResponse } from '../shared/types/topic.types';

export class TopicService {
  private questionRepository: QuestionRepository;

  constructor(questionRepository: QuestionRepository) {
    this.questionRepository = questionRepository;
  }

  async listTopics(options: {
    category?: string;
    difficulty?: string;
    provider?: string;
    searchTerm?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<TopicListResponse> {
    try {
      // Apply filters
      const filteredTopics = await this.questionRepository.searchTopics({
        category: options.category,
        difficulty: options.difficulty,
        provider: options.provider,
        searchTerm: options.searchTerm
      });

      // Sort by question count (most popular first)
      const sortedTopics = filteredTopics.sort((a, b) => b.questionCount - a.questionCount);

      // Apply pagination
      const limit = Math.min(options.limit || 50, 100); // Max 100
      const offset = Math.max(options.offset || 0, 0);
      const paginatedTopics = sortedTopics.slice(offset, offset + limit);

      // Generate categories summary
      const categories = this.generateCategorySummary(filteredTopics);

      // Generate filters
      const filters = await this.generateFilters(filteredTopics);

      return {
        topics: paginatedTopics,
        categories,
        filters,
        pagination: {
          total: sortedTopics.length,
          limit,
          offset,
          hasMore: (offset + limit) < sortedTopics.length
        }
      };
    } catch (error) {
      console.error('Error listing topics:', error);
      throw new Error('Failed to list topics');
    }
  }

  private generateCategorySummary(topics: Topic[]): Array<{
    category: string;
    topicCount: number;
    questionCount: number;
  }> {
    const categoryMap = new Map();

    for (const topic of topics) {
      const category = topic.category;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          topicCount: 0,
          questionCount: 0
        });
      }

      const cat = categoryMap.get(category);
      cat.topicCount++;
      cat.questionCount += topic.questionCount;
    }

    return Array.from(categoryMap.values())
      .sort((a, b) => b.questionCount - a.questionCount);
  }

  private async generateFilters(topics: Topic[]): Promise<{
    difficulties: { level: string; count: number }[];
    providers: { id: string; name: string; count: number }[];
    categories: { category: string; count: number }[];
  }> {
    // Generate difficulty filters
    const difficultyMap = new Map();
    const providerMap = new Map();
    const categoryMap = new Map();

    for (const topic of topics) {
      // Difficulty counts
      const difficulty = topic.difficulty;
      difficultyMap.set(difficulty, (difficultyMap.get(difficulty) || 0) + 1);

      // Provider counts
      for (const provider of topic.providers) {
        if (!providerMap.has(provider.providerId)) {
          providerMap.set(provider.providerId, {
            id: provider.providerId,
            name: provider.providerName,
            count: 0
          });
        }
        providerMap.get(provider.providerId).count++;
      }

      // Category counts
      const category = topic.category;
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    }

    return {
      difficulties: Array.from(difficultyMap.entries())
        .map(([level, count]) => ({ level, count }))
        .sort((a, b) => b.count - a.count),
      
      providers: Array.from(providerMap.values())
        .sort((a, b) => b.count - a.count),
      
      categories: Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
    };
  }
}
EOF
```

#### Step 10.4: Create Topic Handler
Create `backend/src/handlers/topic.ts`:
```bash
cat > backend/src/handlers/topic.ts << 'EOF'
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { ServiceFactory } from '../shared/service-factory';
import { TopicService } from '../services/topic.service';

class TopicHandler extends BaseHandler {
  private topicService: TopicService;

  constructor() {
    super();
    this.topicService = new TopicService(ServiceFactory.getQuestionRepository());
  }

  public async listTopics(event: APIGatewayProxyEvent, context: Context) {
    try {
      // Parse query parameters
      const queryParams = event.queryStringParameters || {};
      const filters = {
        category: queryParams.category,
        difficulty: queryParams.difficulty,
        provider: queryParams.provider,
        searchTerm: queryParams.search,
        limit: queryParams.limit ? parseInt(queryParams.limit) : undefined,
        offset: queryParams.offset ? parseInt(queryParams.offset) : undefined
      };

      // Validate pagination parameters
      if (filters.limit && (filters.limit < 1 || filters.limit > 100)) {
        return this.error('Limit must be between 1 and 100', 400, 'INVALID_LIMIT');
      }

      if (filters.offset && filters.offset < 0) {
        return this.error('Offset must be non-negative', 400, 'INVALID_OFFSET');
      }

      // Get topics
      const topicList = await this.topicService.listTopics(filters);

      return this.success(
        topicList,
        `Retrieved ${topicList.topics.length} topics`,
        200
      );
      
    } catch (error: any) {
      console.error('List topics error:', error);
      return this.error('Failed to retrieve topics', 500, 'TOPICS_LIST_ERROR');
    }
  }
}

// Create singleton instance
const topicHandler = new TopicHandler();

// Export handler functions
export const listTopics = topicHandler.withoutAuth(
  (event: APIGatewayProxyEvent, context: Context) => topicHandler.listTopics(event, context)
);
EOF
```

#### Step 10.5: Update Service Factory for Topic Service
Edit `backend/src/shared/service-factory.ts`:
```bash
cat >> backend/src/shared/service-factory.ts << 'EOF'

  static getTopicService(): TopicService {
    if (!this.topicService) {
      this.topicService = new TopicService(this.getQuestionRepository());
    }
    return this.topicService;
  }

  private static topicService: TopicService;
EOF

# Import TopicService at top of file
sed -i '1i import { TopicService } from "../services/topic.service";' backend/src/shared/service-factory.ts
```

#### Step 10.6: Update API Gateway for Topic Endpoints
Edit `cdk-v3/src/constructs/api-gateway-construct.ts` to add topic endpoints:
```bash
# Add topic function parameter
sed -i 's/examDetailsFunction?: lambda.Function;/examDetailsFunction?: lambda.Function;\n  topicListFunction?: lambda.Function;/' cdk-v3/src/constructs/api-gateway-construct.ts

# Add topics resource and endpoint
sed -i '/const examResource = exams.addResource/a\      \n      // Topics endpoints\n      const topics = v1.addResource('\''topics'\'');\n      topics.addMethod('\''GET'\'', new apigateway.LambdaIntegration(props.topicListFunction!));' cdk-v3/src/constructs/api-gateway-construct.ts
```

#### Step 10.7: Update Main Stack for Topic Lambda
Edit `cdk-v3/src/study-app-stack-v3.ts` to add topic Lambda:
```bash
# Add after exam details Lambda
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Create topic list Lambda
    const topicListLambda = new LambdaConstruct(this, 'TopicListLambda', {
      functionName: `StudyAppV3-TopicList-${stage}`,
      handlerPath: 'topic.listTopics',
      environment: commonEnv
    });

    // Grant S3 permissions for question data access
    database.questionBucket.grantRead(topicListLambda.function);
EOF

# Update API Gateway construction
sed -i 's/examDetailsFunction: examDetailsLambda.function/examDetailsFunction: examDetailsLambda.function,\n      topicListFunction: topicListLambda.function/' cdk-v3/src/study-app-stack-v3.ts
```

#### Step 10.8: Build and Deploy
```bash
# Build Lambda functions
cd lambda
npm run build

# Return to CDK directory and deploy
cd ..
cdk deploy --context stage=dev --require-approval never
```

#### Step 10.9: Test Topic Listing Endpoint
```bash
# Get API URL
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Test basic topic listing
curl -X GET "$API_URL/api/v1/topics" \
  -H "Content-Type: application/json"

# Test with filters
curl -X GET "$API_URL/api/v1/topics?category=Compute&difficulty=Intermediate&limit=10" \
  -H "Content-Type: application/json"

# Test with search
curl -X GET "$API_URL/api/v1/topics?search=storage&provider=aws" \
  -H "Content-Type: application/json"

# Test pagination
curl -X GET "$API_URL/api/v1/topics?limit=5&offset=10" \
  -H "Content-Type: application/json"

# Expected output:
# {
#   "success": true,
#   "message": "Retrieved 25 topics",
#   "data": {
#     "topics": [
#       {
#         "topicId": "ec2",
#         "topicName": "EC2",
#         "description": "Amazon Elastic Compute Cloud virtual servers...",
#         "category": "Compute",
#         "difficulty": "Intermediate",
#         "questionCount": 180,
#         "examCount": 5,
#         "providers": [
#           {
#             "providerId": "aws",
#             "providerName": "Amazon Web Services",
#             "questionCount": 180
#           }
#         ],
#         "metadata": {
#           "lastUpdated": "2024-01-15T10:30:00.000Z",
#           "relatedTopics": ["VPC", "ELB"],
#           "skillLevel": "Intermediate",
#           "estimatedStudyHours": 4
#         }
#       }
#     ],
#     "categories": [
#       {
#         "category": "Compute",
#         "topicCount": 8,
#         "questionCount": 450
#       }
#     ],
#     "filters": {
#       "difficulties": [
#         { "level": "Intermediate", "count": 15 },
#         { "level": "Beginner", "count": 8 }
#       ],
#       "providers": [
#         { "id": "aws", "name": "Amazon Web Services", "count": 20 }
#       ],
#       "categories": [
#         { "category": "Compute", "count": 8 }
#       ]
#     },
#     "pagination": {
#       "total": 25,
#       "limit": 50,
#       "offset": 0,
#       "hasMore": false
#     }
#   }
# }
```

**Phase 10 Success Criteria**:
- ✅ Comprehensive topic listing with cross-provider aggregation
- ✅ Category-based organization working correctly
- ✅ Advanced filtering (category, difficulty, provider, search)
- ✅ Proper pagination implementation
- ✅ Filter metadata generation
- ✅ Performance optimized with caching
- ✅ Error handling for invalid parameters

### Phase 11: Topic Details Feature  
**Dependencies**: Phase 10  
**Objective**: Implement individual topic details with exam breakdown and learning resources

#### Step 11.1: Enhance Topic Service with Details Method
Edit `backend/src/services/topic.service.ts` to add topic details method:
```bash
cat >> backend/src/services/topic.service.ts << 'EOF'

  async getTopicDetails(topicId: string): Promise<TopicDetailsResponse | null> {
    try {
      // Get basic topic info
      const topic = await this.questionRepository.getTopicById(topicId);
      if (!topic) {
        return null;
      }

      // Get exam breakdown for the topic
      const examBreakdown = await this.getTopicExamBreakdown(topicId);
      
      // Generate study resources
      const studyResources = this.generateStudyResources(topic);
      
      // Build learning path
      const learningPath = await this.buildLearningPath(topicId, topic.category);

      const topicDetails: TopicDetailsResponse = {
        ...topic,
        examBreakdown,
        studyResources,
        learningPath
      };

      return topicDetails;
    } catch (error) {
      console.error(`Error getting topic details ${topicId}:`, error);
      return null;
    }
  }

  private async getTopicExamBreakdown(topicId: string): Promise<Array<{
    examId: string;
    examName: string;
    examCode: string;
    providerId: string;
    questionCount: number;
    difficulty: string;
  }>> {
    try {
      // Get all exams and find those containing this topic
      const allExams = await this.questionRepository.getAllExams();
      const examBreakdown = [];

      for (const exam of allExams) {
        // Get questions for this exam and count topic matches
        const examQuestions = await this.questionRepository.getQuestionsByExam(exam.examId);
        const topicQuestions = examQuestions.filter(q => 
          this.questionRepository.generateTopicId(q.topic || 'General') === topicId
        );

        if (topicQuestions.length > 0) {
          examBreakdown.push({
            examId: exam.examId,
            examName: exam.examName,
            examCode: exam.examCode,
            providerId: (exam as any).providerId,
            questionCount: topicQuestions.length,
            difficulty: exam.difficulty
          });
        }
      }

      return examBreakdown.sort((a, b) => b.questionCount - a.questionCount);
    } catch (error) {
      console.error('Error getting exam breakdown:', error);
      return [];
    }
  }

  private generateStudyResources(topic: Topic): Array<{
    type: string;
    title: string;
    url?: string;
    description: string;
  }> {
    const resources = [];

    // Add documentation links based on topic
    if (topic.topicName.toLowerCase().includes('aws')) {
      resources.push({
        type: 'Official Documentation',
        title: `AWS ${topic.topicName} Documentation`,
        url: `https://docs.aws.amazon.com/${topic.topicName.toLowerCase()}/`,
        description: `Official AWS documentation for ${topic.topicName}`
      });
    }

    // Add practice recommendations
    resources.push({
      type: 'Practice Questions',
      title: `${topic.topicName} Practice Questions`,
      description: `${topic.questionCount} practice questions available across ${topic.examCount} exams`
    });

    // Add video resources
    resources.push({
      type: 'Video Tutorial',
      title: `${topic.topicName} Deep Dive`,
      description: `Comprehensive video tutorial covering ${topic.topicName} concepts and best practices`
    });

    // Add hands-on labs
    if (['EC2', 'S3', 'Lambda', 'VPC'].includes(topic.topicName)) {
      resources.push({
        type: 'Hands-on Lab',
        title: `${topic.topicName} Lab Environment`,
        description: `Interactive lab exercises for practical ${topic.topicName} experience`
      });
    }

    return resources;
  }

  private async buildLearningPath(topicId: string, category: string): Promise<{
    prerequisites: string[];
    currentLevel: string;
    nextTopics: string[];
  }> {
    try {
      // Get all topics in the same category
      const allTopics = await this.questionRepository.getAllTopics();
      const categoryTopics = allTopics.filter(t => t.category === category);

      // Define difficulty progression
      const difficultyOrder = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3, 'Expert': 4 };
      const currentTopic = categoryTopics.find(t => t.topicId === topicId);
      
      if (!currentTopic) {
        return { prerequisites: [], currentLevel: 'Intermediate', nextTopics: [] };
      }

      const currentLevel = difficultyOrder[currentTopic.difficulty as keyof typeof difficultyOrder] || 2;

      // Find prerequisites (easier topics in same category)
      const prerequisites = categoryTopics
        .filter(topic => {
          const topicLevel = difficultyOrder[topic.difficulty as keyof typeof difficultyOrder] || 2;
          return topicLevel < currentLevel && topic.topicId !== topicId;
        })
        .sort((a, b) => b.questionCount - a.questionCount) // Most popular first
        .slice(0, 3)
        .map(topic => topic.topicId);

      // Find next topics (harder topics in same category)
      const nextTopics = categoryTopics
        .filter(topic => {
          const topicLevel = difficultyOrder[topic.difficulty as keyof typeof difficultyOrder] || 2;
          return topicLevel > currentLevel && topic.topicId !== topicId;
        })
        .sort((a, b) => b.questionCount - a.questionCount) // Most popular first
        .slice(0, 3)
        .map(topic => topic.topicId);

      return {
        prerequisites,
        currentLevel: currentTopic.difficulty,
        nextTopics
      };
    } catch (error) {
      console.error('Error building learning path:', error);
      return { prerequisites: [], currentLevel: 'Intermediate', nextTopics: [] };
    }
  }
}
EOF
```

#### Step 11.2: Add Topic Details Handler Method
Edit `backend/src/handlers/topic.ts` to add details endpoint:
```bash
cat >> backend/src/handlers/topic.ts << 'EOF'

  public async getTopicDetails(event: APIGatewayProxyEvent, context: Context) {
    try {
      // Extract topic ID from path parameters
      const topicId = event.pathParameters?.id;
      
      if (!topicId) {
        return this.error('Topic ID is required', 400, 'MISSING_TOPIC_ID');
      }

      // Get topic details
      const topicDetails = await this.topicService.getTopicDetails(topicId);
      
      if (!topicDetails) {
        return this.error(`Topic not found: ${topicId}`, 404, 'TOPIC_NOT_FOUND');
      }

      return this.success(
        topicDetails, 
        `Topic details retrieved successfully for ${topicDetails.topicName}`,
        200
      );
      
    } catch (error: any) {
      console.error('Get topic details error:', error);
      return this.error('Failed to retrieve topic details', 500, 'TOPIC_DETAILS_ERROR');
    }
  }
}

// Add topic details export
export const getTopicDetails = topicHandler.withoutAuth(
  (event: APIGatewayProxyEvent, context: Context) => topicHandler.getTopicDetails(event, context)
);
EOF
```

#### Step 11.3: Fix Repository Method Access
Edit `backend/src/repositories/question.repository.ts` to make generateTopicId public:
```bash
# Make generateTopicId method public
sed -i 's/private generateTopicId/public generateTopicId/' backend/src/repositories/question.repository.ts
```

#### Step 11.4: Update API Gateway for Topic Details Endpoint
Edit `cdk-v3/src/constructs/api-gateway-construct.ts` to add topic details endpoint:
```bash
# Add topic details function parameter
sed -i 's/topicListFunction?: lambda.Function;/topicListFunction?: lambda.Function;\n  topicDetailsFunction?: lambda.Function;/' cdk-v3/src/constructs/api-gateway-construct.ts

# Add topic details endpoint with ID parameter
sed -i '/topics.addMethod('\''GET'\'', new apigateway.LambdaIntegration/a\      const topicResource = topics.addResource('\''{id}'\'');\n      topicResource.addMethod('\''GET'\'', new apigateway.LambdaIntegration(props.topicDetailsFunction!));' cdk-v3/src/constructs/api-gateway-construct.ts
```

#### Step 11.5: Update Main Stack for Topic Details Lambda
Edit `cdk-v3/src/study-app-stack-v3.ts` to add topic details Lambda:
```bash
# Add after topic list Lambda
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Create topic details Lambda
    const topicDetailsLambda = new LambdaConstruct(this, 'TopicDetailsLambda', {
      functionName: `StudyAppV3-TopicDetails-${stage}`,
      handlerPath: 'topic.getTopicDetails',
      environment: commonEnv
    });

    // Grant S3 permissions for question data access
    database.questionBucket.grantRead(topicDetailsLambda.function);
EOF

# Update API Gateway construction
sed -i 's/topicListFunction: topicListLambda.function/topicListFunction: topicListLambda.function,\n      topicDetailsFunction: topicDetailsLambda.function/' cdk-v3/src/study-app-stack-v3.ts
```

#### Step 11.6: Build and Deploy
```bash
# Build Lambda functions
cd lambda
npm run build

# Return to CDK directory and deploy
cd ..
cdk deploy --context stage=dev --require-approval never
```

#### Step 11.7: Test Topic Details Endpoint
```bash
# Get API URL
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Test topic details (use topic ID from Phase 10 topic list)
curl -X GET "$API_URL/api/v1/topics/ec2" \
  -H "Content-Type: application/json"

# Expected output:
# {
#   "success": true,
#   "message": "Topic details retrieved successfully for EC2",
#   "data": {
#     "topicId": "ec2",
#     "topicName": "EC2",
#     "description": "Amazon Elastic Compute Cloud virtual servers and instance management",
#     "category": "Compute",
#     "difficulty": "Intermediate",
#     "questionCount": 180,
#     "examCount": 3,
#     "providers": [
#       {
#         "providerId": "aws",
#         "providerName": "Amazon Web Services",
#         "questionCount": 180
#       }
#     ],
#     "metadata": {
#       "lastUpdated": "2024-01-15T10:30:00.000Z",
#       "relatedTopics": [],
#       "skillLevel": "Intermediate",
#       "estimatedStudyHours": 4
#     },
#     "examBreakdown": [
#       {
#         "examId": "aws-saa-c03",
#         "examName": "AWS Solutions Architect Associate",
#         "examCode": "SAA-C03",
#         "providerId": "aws",
#         "questionCount": 85,
#         "difficulty": "Intermediate"
#       }
#     ],
#     "studyResources": [
#       {
#         "type": "Official Documentation",
#         "title": "AWS EC2 Documentation",
#         "url": "https://docs.aws.amazon.com/ec2/",
#         "description": "Official AWS documentation for EC2"
#       },
#       {
#         "type": "Practice Questions",
#         "title": "EC2 Practice Questions",
#         "description": "180 practice questions available across 3 exams"
#       },
#       {
#         "type": "Hands-on Lab",
#         "title": "EC2 Lab Environment",
#         "description": "Interactive lab exercises for practical EC2 experience"
#       }
#     ],
#     "learningPath": {
#       "prerequisites": ["iam"],
#       "currentLevel": "Intermediate",
#       "nextTopics": ["lambda", "ecs"]
#     }
#   },
#   "timestamp": "2024-01-15T10:30:00.000Z"
# }

# Test with invalid topic ID
curl -X GET "$API_URL/api/v1/topics/invalid-topic" \
  -H "Content-Type: application/json"

# Expected output:
# {
#   "success": false,
#   "message": "Topic not found: invalid-topic",
#   "errorCode": "TOPIC_NOT_FOUND",
#   "timestamp": "2024-01-15T10:30:00.000Z"
# }
```

#### Step 11.8: Validation Tests
```bash
# Test topic with many exams
curl -X GET "$API_URL/api/v1/topics/networking" \
  -H "Content-Type: application/json"

# Verify exam breakdown shows all relevant exams
# Verify study resources are appropriate for topic
# Verify learning path makes sense
```

**Phase 11 Success Criteria**:
- ✅ Individual topic details endpoint functional  
- ✅ Exam breakdown shows relevant exams and question counts
- ✅ Study resources generated appropriately
- ✅ Learning path with prerequisites and next steps
- ✅ Error handling for invalid topic IDs
- ✅ Response format matches TopicDetailsResponse type
- ✅ Performance optimized with caching

### Phase 12: Question Listing Feature
**Dependencies**: Phase 11  
**Objective**: Implement comprehensive question catalog with advanced filtering and search

#### Step 12.1: Create Question List Types
Create `backend/src/shared/types/question.types.ts`:
```bash
cat > backend/src/shared/types/question.types.ts << 'EOF'
export interface Question {
  questionId: string;
  examId: string;
  examName: string;
  examCode: string;
  providerId: string;
  providerName: string;
  topic: string;
  subtopic?: string;
  difficulty: string;
  questionText: string;
  questionType: 'multiple-choice' | 'multiple-select' | 'drag-drop' | 'simulation';
  options?: string[];
  correctAnswers: string[];
  explanation: string;
  references?: string[];
  metadata: {
    lastUpdated: string;
    tags: string[];
    estimatedTime: number;
    complexity: string;
  };
}

export interface QuestionListResponse {
  questions: Question[];
  filters: {
    exams: { examId: string; examName: string; count: number }[];
    providers: { id: string; name: string; count: number }[];
    topics: { topic: string; count: number }[];
    difficulties: { level: string; count: number }[];
    types: { type: string; count: number }[];
  };
  aggregations: {
    totalQuestions: number;
    avgDifficulty: string;
    topicsCount: number;
    examsCount: number;
    providersCount: number;
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface QuestionSearchOptions {
  examId?: string;
  providerId?: string;
  topic?: string;
  difficulty?: string;
  questionType?: string;
  searchTerm?: string;
  tags?: string[];
  sortBy?: 'relevance' | 'difficulty' | 'topic' | 'exam' | 'recent';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
EOF
```

#### Step 12.2: Enhance Question Repository with Advanced Search
Edit `backend/src/repositories/question.repository.ts` to add question search methods:
```bash
cat >> backend/src/repositories/question.repository.ts << 'EOF'

  async searchQuestions(options: QuestionSearchOptions): Promise<QuestionMetadata[]> {
    const cacheKey = `questions_search_${JSON.stringify(options)}`;
    
    // Check cache for complex searches only
    if (this.shouldUseCache(options) && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Get base question set
      let questions = await this.getAllQuestions();

      // Apply filters
      questions = this.applyQuestionFilters(questions, options);

      // Apply search term
      if (options.searchTerm) {
        questions = this.applySearchTerm(questions, options.searchTerm);
      }

      // Apply sorting
      questions = this.applySorting(questions, options);

      // Cache results for complex searches
      if (this.shouldUseCache(options)) {
        this.cache.set(cacheKey, questions);
        this.cacheExpiry.set(cacheKey, Date.now() + (this.CACHE_TTL / 2)); // Shorter cache for search
      }

      return questions;
    } catch (error) {
      console.error('Error searching questions:', error);
      return [];
    }
  }

  private async getAllQuestions(): Promise<QuestionMetadata[]> {
    const cacheKey = 'all_questions';
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const providers = await this.getAllProviders();
      const allQuestions: QuestionMetadata[] = [];

      for (const provider of providers) {
        if (!provider.isActive || !provider.questionFiles) continue;

        for (const file of provider.questionFiles) {
          try {
            const questions = await this.loadQuestionFile(provider.providerId, file.fileName);
            // Add provider info to each question
            const questionsWithProvider = questions.map(q => ({
              ...q,
              providerId: provider.providerId,
              providerName: provider.providerName
            }));
            allQuestions.push(...questionsWithProvider);
          } catch (error) {
            console.error(`Error loading questions from ${file.fileName}:`, error);
          }
        }
      }

      // Cache result
      this.cache.set(cacheKey, allQuestions);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return allQuestions;
    } catch (error) {
      console.error('Error loading all questions:', error);
      throw new Error('Failed to load questions');
    }
  }

  private applyQuestionFilters(questions: QuestionMetadata[], options: QuestionSearchOptions): QuestionMetadata[] {
    let filtered = questions;

    // Filter by exam
    if (options.examId) {
      filtered = filtered.filter(q => q.examId === options.examId);
    }

    // Filter by provider
    if (options.providerId) {
      filtered = filtered.filter(q => (q as any).providerId === options.providerId);
    }

    // Filter by topic
    if (options.topic) {
      filtered = filtered.filter(q => q.topic === options.topic);
    }

    // Filter by difficulty
    if (options.difficulty) {
      filtered = filtered.filter(q => q.difficulty === options.difficulty);
    }

    // Filter by question type
    if (options.questionType) {
      filtered = filtered.filter(q => q.questionType === options.questionType);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(q => 
        q.tags && options.tags!.some(tag => q.tags!.includes(tag))
      );
    }

    return filtered;
  }

  private applySearchTerm(questions: QuestionMetadata[], searchTerm: string): QuestionMetadata[] {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return questions;

    return questions.filter(q => {
      // Search in question text
      if (q.questionText?.toLowerCase().includes(term)) return true;
      
      // Search in explanation
      if (q.explanation?.toLowerCase().includes(term)) return true;
      
      // Search in topic
      if (q.topic?.toLowerCase().includes(term)) return true;
      
      // Search in tags
      if (q.tags?.some(tag => tag.toLowerCase().includes(term))) return true;
      
      return false;
    });
  }

  private applySorting(questions: QuestionMetadata[], options: QuestionSearchOptions): QuestionMetadata[] {
    const sortBy = options.sortBy || 'relevance';
    const sortOrder = options.sortOrder || 'desc';

    const sorted = [...questions].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'difficulty':
          const diffOrder = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3, 'Expert': 4 };
          const aLevel = diffOrder[a.difficulty as keyof typeof diffOrder] || 2;
          const bLevel = diffOrder[b.difficulty as keyof typeof diffOrder] || 2;
          comparison = aLevel - bLevel;
          break;
          
        case 'topic':
          comparison = (a.topic || '').localeCompare(b.topic || '');
          break;
          
        case 'exam':
          comparison = (a.examId || '').localeCompare(b.examId || '');
          break;
          
        case 'recent':
          const aTime = new Date(a.lastUpdated || 0).getTime();
          const bTime = new Date(b.lastUpdated || 0).getTime();
          comparison = aTime - bTime;
          break;
          
        case 'relevance':
        default:
          // For relevance, use a combination of factors
          const aScore = this.calculateRelevanceScore(a, options.searchTerm);
          const bScore = this.calculateRelevanceScore(b, options.searchTerm);
          comparison = aScore - bScore;
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  private calculateRelevanceScore(question: QuestionMetadata, searchTerm?: string): number {
    let score = 0;

    if (!searchTerm) {
      // Default relevance based on question metadata
      return Math.random(); // Random order if no search term
    }

    const term = searchTerm.toLowerCase();

    // Exact matches in question text get highest score
    if (question.questionText?.toLowerCase().includes(term)) {
      score += 10;
    }

    // Topic matches get high score
    if (question.topic?.toLowerCase().includes(term)) {
      score += 8;
    }

    // Explanation matches get medium score
    if (question.explanation?.toLowerCase().includes(term)) {
      score += 5;
    }

    // Tag matches get lower score
    if (question.tags?.some(tag => tag.toLowerCase().includes(term))) {
      score += 3;
    }

    return score;
  }

  private shouldUseCache(options: QuestionSearchOptions): boolean {
    // Use cache for complex searches with multiple filters
    const filterCount = [
      options.examId,
      options.providerId,
      options.topic,
      options.difficulty,
      options.questionType,
      options.searchTerm
    ].filter(Boolean).length;

    return filterCount >= 2; // Cache if 2 or more filters
  }
}
EOF
```

#### Step 12.3: Create Question Service
Create `backend/src/services/question-list.service.ts`:
```bash
cat > backend/src/services/question-list.service.ts << 'EOF'
import { QuestionRepository } from '../repositories/question.repository';
import { Question, QuestionListResponse, QuestionSearchOptions } from '../shared/types/question.types';

export class QuestionListService {
  private questionRepository: QuestionRepository;

  constructor(questionRepository: QuestionRepository) {
    this.questionRepository = questionRepository;
  }

  async listQuestions(options: QuestionSearchOptions = {}): Promise<QuestionListResponse> {
    try {
      // Set defaults and validate
      const validatedOptions = this.validateAndSetDefaults(options);

      // Search questions with filters
      const filteredQuestions = await this.questionRepository.searchQuestions(validatedOptions);

      // Apply pagination
      const paginatedQuestions = this.applyPagination(filteredQuestions, validatedOptions);

      // Generate filters metadata
      const filters = await this.generateFilters(filteredQuestions);

      // Generate aggregations
      const aggregations = this.generateAggregations(filteredQuestions);

      return {
        questions: paginatedQuestions.map(q => this.formatQuestionForList(q)),
        filters,
        aggregations,
        pagination: {
          total: filteredQuestions.length,
          limit: validatedOptions.limit!,
          offset: validatedOptions.offset!,
          hasMore: (validatedOptions.offset! + validatedOptions.limit!) < filteredQuestions.length
        }
      };
    } catch (error) {
      console.error('Error listing questions:', error);
      throw new Error('Failed to list questions');
    }
  }

  private validateAndSetDefaults(options: QuestionSearchOptions): Required<QuestionSearchOptions> {
    return {
      examId: options.examId || '',
      providerId: options.providerId || '',
      topic: options.topic || '',
      difficulty: options.difficulty || '',
      questionType: options.questionType || '',
      searchTerm: options.searchTerm || '',
      tags: options.tags || [],
      sortBy: options.sortBy || 'relevance',
      sortOrder: options.sortOrder || 'desc',
      limit: Math.min(Math.max(options.limit || 20, 1), 100), // Between 1 and 100
      offset: Math.max(options.offset || 0, 0)
    };
  }

  private applyPagination(questions: any[], options: Required<QuestionSearchOptions>): any[] {
    const start = options.offset;
    const end = start + options.limit;
    return questions.slice(start, end);
  }

  private formatQuestionForList(question: any): Question {
    return {
      questionId: question.questionId,
      examId: question.examId,
      examName: question.examName || 'Unknown Exam',
      examCode: question.examCode || question.examId?.toUpperCase() || 'UNK',
      providerId: question.providerId,
      providerName: question.providerName,
      topic: question.topic || 'General',
      subtopic: question.subtopic,
      difficulty: question.difficulty,
      questionText: question.questionText,
      questionType: question.questionType || 'multiple-choice',
      options: question.options || [],
      correctAnswers: question.correctAnswers || [],
      explanation: question.explanation || '',
      references: question.references || [],
      metadata: {
        lastUpdated: question.lastUpdated || new Date().toISOString(),
        tags: question.tags || [],
        estimatedTime: question.estimatedTime || 90, // Default 90 seconds
        complexity: this.calculateComplexity(question)
      }
    };
  }

  private calculateComplexity(question: any): string {
    let complexity = 'Medium';

    // Base complexity on question length
    const textLength = (question.questionText || '').length;
    const optionCount = (question.options || []).length;
    
    if (textLength < 200 && optionCount <= 4) {
      complexity = 'Low';
    } else if (textLength > 500 || optionCount > 6) {
      complexity = 'High';
    }

    // Adjust for difficulty
    if (question.difficulty === 'Expert') {
      complexity = complexity === 'Low' ? 'Medium' : 'High';
    }

    return complexity;
  }

  private async generateFilters(questions: any[]): Promise<{
    exams: { examId: string; examName: string; count: number }[];
    providers: { id: string; name: string; count: number }[];
    topics: { topic: string; count: number }[];
    difficulties: { level: string; count: number }[];
    types: { type: string; count: number }[];
  }> {
    const examMap = new Map();
    const providerMap = new Map();
    const topicMap = new Map();
    const difficultyMap = new Map();
    const typeMap = new Map();

    for (const question of questions) {
      // Exam counts
      const examKey = question.examId;
      if (!examMap.has(examKey)) {
        examMap.set(examKey, {
          examId: question.examId,
          examName: question.examName || 'Unknown Exam',
          count: 0
        });
      }
      examMap.get(examKey).count++;

      // Provider counts
      const providerKey = question.providerId;
      if (!providerMap.has(providerKey)) {
        providerMap.set(providerKey, {
          id: question.providerId,
          name: question.providerName,
          count: 0
        });
      }
      providerMap.get(providerKey).count++;

      // Topic counts
      const topic = question.topic || 'General';
      topicMap.set(topic, (topicMap.get(topic) || 0) + 1);

      // Difficulty counts
      const difficulty = question.difficulty;
      difficultyMap.set(difficulty, (difficultyMap.get(difficulty) || 0) + 1);

      // Type counts
      const type = question.questionType || 'multiple-choice';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    }

    return {
      exams: Array.from(examMap.values()).sort((a, b) => b.count - a.count),
      providers: Array.from(providerMap.values()).sort((a, b) => b.count - a.count),
      topics: Array.from(topicMap.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count),
      difficulties: Array.from(difficultyMap.entries())
        .map(([level, count]) => ({ level, count }))
        .sort((a, b) => b.count - a.count),
      types: Array.from(typeMap.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
    };
  }

  private generateAggregations(questions: any[]): {
    totalQuestions: number;
    avgDifficulty: string;
    topicsCount: number;
    examsCount: number;
    providersCount: number;
  } {
    const uniqueTopics = new Set(questions.map(q => q.topic || 'General'));
    const uniqueExams = new Set(questions.map(q => q.examId));
    const uniqueProviders = new Set(questions.map(q => q.providerId));

    // Calculate average difficulty
    const difficultyValues = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3, 'Expert': 4 };
    const avgDifficultyValue = questions.reduce((sum, q) => {
      return sum + (difficultyValues[q.difficulty as keyof typeof difficultyValues] || 2);
    }, 0) / questions.length;

    const avgDifficulty = avgDifficultyValue <= 1.5 ? 'Beginner' :
                         avgDifficultyValue <= 2.5 ? 'Intermediate' :
                         avgDifficultyValue <= 3.5 ? 'Advanced' : 'Expert';

    return {
      totalQuestions: questions.length,
      avgDifficulty,
      topicsCount: uniqueTopics.size,
      examsCount: uniqueExams.size,
      providersCount: uniqueProviders.size
    };
  }
}
EOF
```

#### Step 12.4: Create Question List Handler
Create `backend/src/handlers/question-list.ts`:
```bash
cat > backend/src/handlers/question-list.ts << 'EOF'
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { ServiceFactory } from '../shared/service-factory';
import { QuestionListService } from '../services/question-list.service';
import { QuestionSearchOptions } from '../shared/types/question.types';

class QuestionListHandler extends BaseHandler {
  private questionListService: QuestionListService;

  constructor() {
    super();
    this.questionListService = new QuestionListService(ServiceFactory.getQuestionRepository());
  }

  public async listQuestions(event: APIGatewayProxyEvent, context: Context) {
    try {
      // Parse query parameters
      const queryParams = event.queryStringParameters || {};
      
      // Validate and parse tags if provided
      let tags: string[] = [];
      if (queryParams.tags) {
        try {
          tags = queryParams.tags.split(',').map(tag => tag.trim()).filter(Boolean);
        } catch (error) {
          return this.error('Invalid tags format. Use comma-separated values.', 400, 'INVALID_TAGS');
        }
      }

      const options: QuestionSearchOptions = {
        examId: queryParams.examId,
        providerId: queryParams.providerId || queryParams.provider,
        topic: queryParams.topic,
        difficulty: queryParams.difficulty,
        questionType: queryParams.questionType || queryParams.type,
        searchTerm: queryParams.search || queryParams.q,
        tags: tags.length > 0 ? tags : undefined,
        sortBy: queryParams.sortBy as any,
        sortOrder: queryParams.sortOrder as any,
        limit: queryParams.limit ? parseInt(queryParams.limit) : undefined,
        offset: queryParams.offset ? parseInt(queryParams.offset) : undefined
      };

      // Validate pagination parameters
      if (options.limit && (options.limit < 1 || options.limit > 100)) {
        return this.error('Limit must be between 1 and 100', 400, 'INVALID_LIMIT');
      }

      if (options.offset && options.offset < 0) {
        return this.error('Offset must be non-negative', 400, 'INVALID_OFFSET');
      }

      // Validate sort parameters
      const validSortBy = ['relevance', 'difficulty', 'topic', 'exam', 'recent'];
      if (options.sortBy && !validSortBy.includes(options.sortBy)) {
        return this.error(`Invalid sortBy. Must be one of: ${validSortBy.join(', ')}`, 400, 'INVALID_SORT_BY');
      }

      const validSortOrder = ['asc', 'desc'];
      if (options.sortOrder && !validSortOrder.includes(options.sortOrder)) {
        return this.error(`Invalid sortOrder. Must be one of: ${validSortOrder.join(', ')}`, 400, 'INVALID_SORT_ORDER');
      }

      // Get questions
      const questionList = await this.questionListService.listQuestions(options);

      return this.success(
        questionList,
        `Retrieved ${questionList.questions.length} questions`,
        200
      );
      
    } catch (error: any) {
      console.error('List questions error:', error);
      return this.error('Failed to retrieve questions', 500, 'QUESTIONS_LIST_ERROR');
    }
  }
}

// Create singleton instance
const questionListHandler = new QuestionListHandler();

// Export handler functions
export const listQuestions = questionListHandler.withoutAuth(
  (event: APIGatewayProxyEvent, context: Context) => questionListHandler.listQuestions(event, context)
);
EOF
```

#### Step 12.5: Update Service Factory for Question List Service
Edit `backend/src/shared/service-factory.ts`:
```bash
cat >> backend/src/shared/service-factory.ts << 'EOF'

  static getQuestionListService(): QuestionListService {
    if (!this.questionListService) {
      this.questionListService = new QuestionListService(this.getQuestionRepository());
    }
    return this.questionListService;
  }

  private static questionListService: QuestionListService;
EOF

# Import QuestionListService at top of file
sed -i '1i import { QuestionListService } from "../services/question-list.service";' backend/src/shared/service-factory.ts
```

#### Step 12.6: Update API Gateway for Question List Endpoint
Edit `cdk-v3/src/constructs/api-gateway-construct.ts` to add questions endpoint:
```bash
# Add question list function parameter
sed -i 's/topicDetailsFunction?: lambda.Function;/topicDetailsFunction?: lambda.Function;\n  questionListFunction?: lambda.Function;/' cdk-v3/src/constructs/api-gateway-construct.ts

# Add questions resource and endpoint
sed -i '/const topicResource = topics.addResource/a\      \n      // Questions endpoints\n      const questions = v1.addResource('\''questions'\'');\n      questions.addMethod('\''GET'\'', new apigateway.LambdaIntegration(props.questionListFunction!));' cdk-v3/src/constructs/api-gateway-construct.ts
```

#### Step 12.7: Update Main Stack for Question List Lambda
Edit `cdk-v3/src/study-app-stack-v3.ts` to add question list Lambda:
```bash
# Add after topic details Lambda
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Create question list Lambda
    const questionListLambda = new LambdaConstruct(this, 'QuestionListLambda', {
      functionName: `StudyAppV3-QuestionList-${stage}`,
      handlerPath: 'question-list.listQuestions',
      environment: commonEnv
    });

    // Grant S3 permissions for question data access
    database.questionBucket.grantRead(questionListLambda.function);
EOF

# Update API Gateway construction
sed -i 's/topicDetailsFunction: topicDetailsLambda.function/topicDetailsFunction: topicDetailsLambda.function,\n      questionListFunction: questionListLambda.function/' cdk-v3/src/study-app-stack-v3.ts
```

#### Step 12.8: Build and Deploy
```bash
# Build Lambda functions
cd lambda
npm run build

# Return to CDK directory and deploy
cd ..
cdk deploy --context stage=dev --require-approval never
```

#### Step 12.9: Test Question List Endpoint
```bash
# Get API URL
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Test basic question listing
curl -X GET "$API_URL/api/v1/questions" \
  -H "Content-Type: application/json"

# Test with filters
curl -X GET "$API_URL/api/v1/questions?examId=aws-saa-c03&difficulty=Intermediate&limit=10" \
  -H "Content-Type: application/json"

# Test with search
curl -X GET "$API_URL/api/v1/questions?search=storage&topic=S3&sortBy=relevance" \
  -H "Content-Type: application/json"

# Test with multiple filters and sorting
curl -X GET "$API_URL/api/v1/questions?provider=aws&difficulty=Advanced&sortBy=difficulty&sortOrder=desc&limit=5" \
  -H "Content-Type: application/json"

# Test with tags
curl -X GET "$API_URL/api/v1/questions?tags=security,encryption&sortBy=recent" \
  -H "Content-Type: application/json"

# Test pagination
curl -X GET "$API_URL/api/v1/questions?limit=10&offset=20" \
  -H "Content-Type: application/json"

# Expected output:
# {
#   "success": true,
#   "message": "Retrieved 10 questions",
#   "data": {
#     "questions": [
#       {
#         "questionId": "q-aws-ec2-001",
#         "examId": "aws-saa-c03",
#         "examName": "AWS Solutions Architect Associate",
#         "examCode": "SAA-C03",
#         "providerId": "aws",
#         "providerName": "Amazon Web Services",
#         "topic": "EC2",
#         "subtopic": "Instance Types",
#         "difficulty": "Intermediate",
#         "questionText": "Which EC2 instance type is optimized for...",
#         "questionType": "multiple-choice",
#         "options": [
#           "t3.micro",
#           "m5.large", 
#           "c5.xlarge",
#           "r5.2xlarge"
#         ],
#         "correctAnswers": ["c5.xlarge"],
#         "explanation": "C5 instances are compute optimized...",
#         "references": ["https://docs.aws.amazon.com/ec2/"],
#         "metadata": {
#           "lastUpdated": "2024-01-15T10:30:00.000Z",
#           "tags": ["compute", "performance"],
#           "estimatedTime": 90,
#           "complexity": "Medium"
#         }
#       }
#     ],
#     "filters": {
#       "exams": [
#         { "examId": "aws-saa-c03", "examName": "AWS Solutions Architect Associate", "count": 850 }
#       ],
#       "providers": [
#         { "id": "aws", "name": "Amazon Web Services", "count": 1200 }
#       ],
#       "topics": [
#         { "topic": "EC2", "count": 180 },
#         { "topic": "S3", "count": 150 }
#       ],
#       "difficulties": [
#         { "level": "Intermediate", "count": 500 },
#         { "level": "Advanced", "count": 300 }
#       ],
#       "types": [
#         { "type": "multiple-choice", "count": 800 },
#         { "type": "multiple-select", "count": 200 }
#       ]
#     },
#     "aggregations": {
#       "totalQuestions": 1000,
#       "avgDifficulty": "Intermediate",
#       "topicsCount": 25,
#       "examsCount": 8,
#       "providersCount": 3
#     },
#     "pagination": {
#       "total": 1000,
#       "limit": 10,
#       "offset": 0,
#       "hasMore": true
#     }
#   },
#   "timestamp": "2024-01-15T10:30:00.000Z"
# }
```

#### Step 12.10: Validation Tests
```bash
# Test invalid parameters
curl -X GET "$API_URL/api/v1/questions?limit=500" \
  -H "Content-Type: application/json"
# Should return validation error

curl -X GET "$API_URL/api/v1/questions?sortBy=invalid" \
  -H "Content-Type: application/json"  
# Should return validation error

# Test edge cases
curl -X GET "$API_URL/api/v1/questions?search=" \
  -H "Content-Type: application/json"
# Should work with empty search

curl -X GET "$API_URL/api/v1/questions?examId=nonexistent" \
  -H "Content-Type: application/json"
# Should return empty results

# Performance test with complex filters
curl -X GET "$API_URL/api/v1/questions?search=security&provider=aws&difficulty=Advanced&topic=IAM&sortBy=relevance&limit=50" \
  -H "Content-Type: application/json"
# Should complete in reasonable time
```

**Phase 12 Success Criteria**:
- ✅ Comprehensive question listing with advanced filtering
- ✅ Multi-dimensional search (text, tags, metadata)
- ✅ Flexible sorting options (relevance, difficulty, topic, etc.)
- ✅ Proper pagination with performance optimization
- ✅ Rich filter metadata and aggregations
- ✅ Input validation and error handling
- ✅ Performance optimized with intelligent caching
- ✅ Response format matches QuestionListResponse type

### Phase 17: Analytics System
**Dependencies**: Phases 1-16  
**Objective**: Implement comprehensive analytics system with progress tracking and performance insights

#### Step 17.1: Create Analytics Service Layer
```bash
# Create analytics service directory structure
mkdir -p backend/src/services/analytics
mkdir -p backend/src/types/analytics

# Create analytics service implementation
cat > backend/src/services/analytics/AnalyticsService.ts << 'EOF'
import { BaseService } from '../base/BaseService';
import { Logger } from '../../shared/utils/Logger';
import { DynamoDBService } from '../database/DynamoDBService';
import { CacheService } from '../cache/CacheService';
import {
  ProgressAnalyticsRequest,
  ProgressAnalyticsResponse,
  PerformanceAnalyticsRequest,
  PerformanceAnalyticsResponse,
  SessionAnalyticsRequest,
  SessionAnalyticsResponse,
  UserProgressData,
  PerformanceMetrics,
  SessionInsights
} from '../../types/analytics/AnalyticsTypes';

export class AnalyticsService extends BaseService {
  private dynamodb: DynamoDBService;
  private cache: CacheService;
  private logger: Logger;

  constructor(
    dynamodb: DynamoDBService,
    cache: CacheService,
    logger: Logger
  ) {
    super();
    this.dynamodb = dynamodb;
    this.cache = cache;
    this.logger = logger;
  }

  async getProgressAnalytics(
    userId: string,
    request: ProgressAnalyticsRequest
  ): Promise<ProgressAnalyticsResponse> {
    this.logger.info('Getting progress analytics', { userId, request });

    const cacheKey = `progress_analytics:${userId}:${JSON.stringify(request)}`;
    const cached = await this.cache.get<ProgressAnalyticsResponse>(cacheKey);
    if (cached) {
      this.logger.info('Returning cached progress analytics');
      return cached;
    }

    try {
      // Get user session history
      const sessions = await this.getUserSessions(userId, request.timeRange);
      
      // Calculate progress metrics
      const progressData = await this.calculateProgressMetrics(sessions, request);
      
      // Get competency analysis
      const competencyAnalysis = await this.analyzeCompetencies(sessions, request);
      
      // Get learning velocity
      const learningVelocity = await this.calculateLearningVelocity(sessions, request);

      const response: ProgressAnalyticsResponse = {
        userId,
        timeRange: request.timeRange,
        totalSessions: sessions.length,
        totalQuestions: sessions.reduce((sum, s) => sum + s.questionsAnswered, 0),
        averageScore: this.calculateAverageScore(sessions),
        progressTrend: progressData.trend,
        competencyBreakdown: competencyAnalysis,
        learningVelocity,
        weeklyProgress: progressData.weeklyData,
        strongAreas: competencyAnalysis.strengths,
        improvementAreas: competencyAnalysis.weaknesses,
        studyStreak: await this.calculateStudyStreak(userId),
        timeSpent: sessions.reduce((sum, s) => sum + s.duration, 0),
        lastUpdated: new Date().toISOString()
      };

      // Cache for 1 hour
      await this.cache.set(cacheKey, response, 3600);
      
      this.logger.info('Progress analytics calculated successfully');
      return response;
      
    } catch (error) {
      this.logger.error('Error calculating progress analytics', error);
      throw this.createError('Failed to calculate progress analytics', 500);
    }
  }

  async getPerformanceAnalytics(
    userId: string,
    request: PerformanceAnalyticsRequest
  ): Promise<PerformanceAnalyticsResponse> {
    this.logger.info('Getting performance analytics', { userId, request });

    const cacheKey = `performance_analytics:${userId}:${JSON.stringify(request)}`;
    const cached = await this.cache.get<PerformanceAnalyticsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const sessions = await this.getUserSessions(userId, request.timeRange);
      const performanceMetrics = await this.calculatePerformanceMetrics(sessions, request);
      
      const response: PerformanceAnalyticsResponse = {
        userId,
        timeRange: request.timeRange,
        overallScore: performanceMetrics.overallScore,
        accuracyTrend: performanceMetrics.accuracyTrend,
        speedMetrics: performanceMetrics.speedMetrics,
        difficultyPerformance: performanceMetrics.difficultyBreakdown,
        topicPerformance: performanceMetrics.topicPerformance,
        examReadiness: await this.calculateExamReadiness(sessions, request),
        competencyScores: performanceMetrics.competencyScores,
        improvementRecommendations: await this.generateRecommendations(performanceMetrics),
        lastUpdated: new Date().toISOString()
      };

      await this.cache.set(cacheKey, response, 3600);
      return response;
      
    } catch (error) {
      this.logger.error('Error calculating performance analytics', error);
      throw this.createError('Failed to calculate performance analytics', 500);
    }
  }

  async getSessionAnalytics(
    userId: string,
    sessionId: string,
    request: SessionAnalyticsRequest
  ): Promise<SessionAnalyticsResponse> {
    this.logger.info('Getting session analytics', { userId, sessionId, request });

    try {
      const session = await this.getSessionDetails(sessionId, userId);
      const sessionInsights = await this.analyzeSession(session, request);
      
      const response: SessionAnalyticsResponse = {
        sessionId,
        userId,
        sessionType: session.type,
        duration: session.duration,
        questionsAnswered: session.questionsAnswered,
        correctAnswers: session.correctAnswers,
        accuracy: (session.correctAnswers / session.questionsAnswered) * 100,
        averageTimePerQuestion: session.duration / session.questionsAnswered,
        difficultyDistribution: sessionInsights.difficultyDistribution,
        topicPerformance: sessionInsights.topicPerformance,
        learningGains: sessionInsights.learningGains,
        weaknessesIdentified: sessionInsights.weaknessesIdentified,
        strengthsReinforced: sessionInsights.strengthsReinforced,
        recommendedFollowUp: sessionInsights.recommendedActions,
        lastUpdated: new Date().toISOString()
      };

      return response;
      
    } catch (error) {
      this.logger.error('Error calculating session analytics', error);
      throw this.createError('Failed to calculate session analytics', 500);
    }
  }

  private async getUserSessions(userId: string, timeRange: string): Promise<any[]> {
    const params = {
      TableName: process.env.SESSIONS_TABLE!,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };

    // Add time range filter
    if (timeRange !== 'all') {
      const startDate = this.getStartDateForRange(timeRange);
      params.KeyConditionExpression += ' AND createdAt >= :startDate';
      params.ExpressionAttributeValues[':startDate'] = startDate;
    }

    const result = await this.dynamodb.query(params);
    return result.Items || [];
  }

  private async calculateProgressMetrics(sessions: any[], request: ProgressAnalyticsRequest): Promise<any> {
    // Calculate weekly progress data
    const weeklyData = this.groupSessionsByWeek(sessions);
    
    // Calculate trend
    const trend = this.calculateTrend(weeklyData);
    
    return {
      weeklyData,
      trend
    };
  }

  private async analyzeCompetencies(sessions: any[], request: ProgressAnalyticsRequest): Promise<any> {
    const topicPerformance = new Map();
    
    for (const session of sessions) {
      for (const answer of session.answers || []) {
        const topic = answer.question.topicId;
        if (!topicPerformance.has(topic)) {
          topicPerformance.set(topic, { correct: 0, total: 0 });
        }
        
        const stats = topicPerformance.get(topic);
        stats.total++;
        if (answer.isCorrect) {
          stats.correct++;
        }
      }
    }
    
    const competencies = Array.from(topicPerformance.entries()).map(([topic, stats]) => ({
      topic,
      accuracy: (stats.correct / stats.total) * 100,
      questionsAnswered: stats.total
    }));
    
    return {
      strengths: competencies.filter(c => c.accuracy >= 80).slice(0, 5),
      weaknesses: competencies.filter(c => c.accuracy < 60).slice(0, 5),
      all: competencies
    };
  }

  private async calculateLearningVelocity(sessions: any[], request: ProgressAnalyticsRequest): Promise<any> {
    const sortedSessions = sessions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    const velocity = {
      questionsPerHour: 0,
      accuracyImprovement: 0,
      consistencyScore: 0
    };
    
    if (sortedSessions.length >= 2) {
      const totalTime = sortedSessions.reduce((sum, s) => sum + s.duration, 0) / 3600000; // Convert to hours
      const totalQuestions = sortedSessions.reduce((sum, s) => sum + s.questionsAnswered, 0);
      
      velocity.questionsPerHour = totalQuestions / totalTime;
      
      // Calculate accuracy improvement
      const firstHalf = sortedSessions.slice(0, Math.floor(sortedSessions.length / 2));
      const secondHalf = sortedSessions.slice(Math.floor(sortedSessions.length / 2));
      
      const firstHalfAccuracy = this.calculateAverageScore(firstHalf);
      const secondHalfAccuracy = this.calculateAverageScore(secondHalf);
      
      velocity.accuracyImprovement = secondHalfAccuracy - firstHalfAccuracy;
    }
    
    return velocity;
  }

  private calculateAverageScore(sessions: any[]): number {
    if (sessions.length === 0) return 0;
    const totalScore = sessions.reduce((sum, session) => sum + session.score, 0);
    return totalScore / sessions.length;
  }

  private async calculateStudyStreak(userId: string): Promise<number> {
    // Implementation for calculating current study streak
    // This would look at consecutive days with study sessions
    return 0; // Placeholder
  }

  private getStartDateForRange(timeRange: string): string {
    const now = new Date();
    switch (timeRange) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(0).toISOString(); // Beginning of time
    }
  }

  private groupSessionsByWeek(sessions: any[]): any[] {
    const weeks = new Map();
    
    sessions.forEach(session => {
      const date = new Date(session.createdAt);
      const weekKey = this.getWeekKey(date);
      
      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, {
          week: weekKey,
          sessions: 0,
          questions: 0,
          averageScore: 0,
          totalScore: 0
        });
      }
      
      const week = weeks.get(weekKey);
      week.sessions++;
      week.questions += session.questionsAnswered;
      week.totalScore += session.score;
      week.averageScore = week.totalScore / week.sessions;
    });
    
    return Array.from(weeks.values()).sort((a, b) => a.week.localeCompare(b.week));
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private calculateTrend(weeklyData: any[]): 'improving' | 'declining' | 'stable' {
    if (weeklyData.length < 2) return 'stable';
    
    const recent = weeklyData.slice(-3);
    const earlier = weeklyData.slice(-6, -3);
    
    if (earlier.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, w) => sum + w.averageScore, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, w) => sum + w.averageScore, 0) / earlier.length;
    
    const diff = recentAvg - earlierAvg;
    
    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
  }

  private async calculatePerformanceMetrics(sessions: any[], request: PerformanceAnalyticsRequest): Promise<any> {
    // Detailed performance calculations
    const metrics = {
      overallScore: this.calculateAverageScore(sessions),
      accuracyTrend: this.calculateAccuracyTrend(sessions),
      speedMetrics: this.calculateSpeedMetrics(sessions),
      difficultyBreakdown: this.calculateDifficultyBreakdown(sessions),
      topicPerformance: this.calculateTopicPerformance(sessions),
      competencyScores: this.calculateCompetencyScores(sessions)
    };
    
    return metrics;
  }

  private calculateAccuracyTrend(sessions: any[]): any[] {
    return sessions.map(session => ({
      date: session.createdAt,
      accuracy: (session.correctAnswers / session.questionsAnswered) * 100
    }));
  }

  private calculateSpeedMetrics(sessions: any[]): any {
    const speeds = sessions.map(s => s.duration / s.questionsAnswered);
    return {
      averageTimePerQuestion: speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length,
      fastest: Math.min(...speeds),
      slowest: Math.max(...speeds)
    };
  }

  private calculateDifficultyBreakdown(sessions: any[]): any {
    const breakdown = { beginner: 0, intermediate: 0, advanced: 0 };
    
    sessions.forEach(session => {
      session.answers?.forEach(answer => {
        const difficulty = answer.question.difficulty;
        if (breakdown.hasOwnProperty(difficulty)) {
          breakdown[difficulty] += answer.isCorrect ? 1 : 0;
        }
      });
    });
    
    return breakdown;
  }

  private calculateTopicPerformance(sessions: any[]): any[] {
    const topicStats = new Map();
    
    sessions.forEach(session => {
      session.answers?.forEach(answer => {
        const topic = answer.question.topicId;
        if (!topicStats.has(topic)) {
          topicStats.set(topic, { correct: 0, total: 0 });
        }
        
        const stats = topicStats.get(topic);
        stats.total++;
        if (answer.isCorrect) {
          stats.correct++;
        }
      });
    });
    
    return Array.from(topicStats.entries()).map(([topic, stats]) => ({
      topic,
      accuracy: (stats.correct / stats.total) * 100,
      questionsAnswered: stats.total
    }));
  }

  private calculateCompetencyScores(sessions: any[]): any {
    // Calculate competency scores based on performance patterns
    return {
      technical: 0,
      conceptual: 0,
      practical: 0
    };
  }

  private async calculateExamReadiness(sessions: any[], request: PerformanceAnalyticsRequest): Promise<any> {
    // Calculate exam readiness score and recommendations
    return {
      score: 75,
      recommendation: 'Continue practicing weak areas',
      estimatedPassProbability: 0.8
    };
  }

  private async generateRecommendations(metrics: any): Promise<string[]> {
    const recommendations = [];
    
    if (metrics.overallScore < 70) {
      recommendations.push('Focus on fundamental concepts before attempting advanced topics');
    }
    
    if (metrics.speedMetrics.averageTimePerQuestion > 120000) { // 2 minutes
      recommendations.push('Practice timed sessions to improve response speed');
    }
    
    return recommendations;
  }

  private async getSessionDetails(sessionId: string, userId: string): Promise<any> {
    const params = {
      TableName: process.env.SESSIONS_TABLE!,
      Key: { sessionId, userId }
    };
    
    const result = await this.dynamodb.get(params);
    if (!result.Item) {
      throw this.createError('Session not found', 404);
    }
    
    return result.Item;
  }

  private async analyzeSession(session: any, request: SessionAnalyticsRequest): Promise<any> {
    // Detailed session analysis
    return {
      difficultyDistribution: this.analyzeDifficultyDistribution(session),
      topicPerformance: this.analyzeTopicPerformance(session),
      learningGains: this.calculateLearningGains(session),
      weaknessesIdentified: this.identifyWeaknesses(session),
      strengthsReinforced: this.identifyStrengths(session),
      recommendedActions: this.generateSessionRecommendations(session)
    };
  }

  private analyzeDifficultyDistribution(session: any): any {
    const distribution = { beginner: 0, intermediate: 0, advanced: 0 };
    
    session.answers?.forEach(answer => {
      const difficulty = answer.question.difficulty;
      if (distribution.hasOwnProperty(difficulty)) {
        distribution[difficulty]++;
      }
    });
    
    return distribution;
  }

  private analyzeTopicPerformance(session: any): any[] {
    const topicStats = new Map();
    
    session.answers?.forEach(answer => {
      const topic = answer.question.topicId;
      if (!topicStats.has(topic)) {
        topicStats.set(topic, { correct: 0, total: 0 });
      }
      
      const stats = topicStats.get(topic);
      stats.total++;
      if (answer.isCorrect) {
        stats.correct++;
      }
    });
    
    return Array.from(topicStats.entries()).map(([topic, stats]) => ({
      topic,
      accuracy: (stats.correct / stats.total) * 100,
      questionsAnswered: stats.total
    }));
  }

  private calculateLearningGains(session: any): string[] {
    // Identify what the user learned in this session
    return []; // Placeholder
  }

  private identifyWeaknesses(session: any): string[] {
    const weaknesses = [];
    const topicPerformance = this.analyzeTopicPerformance(session);
    
    topicPerformance.forEach(topic => {
      if (topic.accuracy < 60) {
        weaknesses.push(`${topic.topic}: ${topic.accuracy.toFixed(1)}% accuracy`);
      }
    });
    
    return weaknesses;
  }

  private identifyStrengths(session: any): string[] {
    const strengths = [];
    const topicPerformance = this.analyzeTopicPerformance(session);
    
    topicPerformance.forEach(topic => {
      if (topic.accuracy >= 80) {
        strengths.push(`${topic.topic}: ${topic.accuracy.toFixed(1)}% accuracy`);
      }
    });
    
    return strengths;
  }

  private generateSessionRecommendations(session: any): string[] {
    const recommendations = [];
    const accuracy = (session.correctAnswers / session.questionsAnswered) * 100;
    
    if (accuracy < 70) {
      recommendations.push('Review concepts before attempting more questions');
    }
    
    if (session.duration / session.questionsAnswered > 180000) { // 3 minutes per question
      recommendations.push('Practice more to improve response speed');
    }
    
    return recommendations;
  }
}
EOF

echo "Created AnalyticsService"
```

#### Step 17.2: Create Analytics Types
```bash
# Create analytics type definitions
cat > backend/src/types/analytics/AnalyticsTypes.ts << 'EOF'
// Analytics Request Types
export interface ProgressAnalyticsRequest {
  timeRange: '7d' | '30d' | '90d' | 'all';
  includeTopics?: string[];
  excludeTopics?: string[];
  examFilter?: string[];
  providerFilter?: string[];
}

export interface PerformanceAnalyticsRequest {
  timeRange: '7d' | '30d' | '90d' | 'all';
  includeMetrics?: ('accuracy' | 'speed' | 'consistency' | 'improvement')[];
  examFilter?: string[];
  difficultyFilter?: ('beginner' | 'intermediate' | 'advanced')[];
  topicFilter?: string[];
}

export interface SessionAnalyticsRequest {
  includeAnswerDetails?: boolean;
  includeRecommendations?: boolean;
  includeComparisons?: boolean;
}

// Analytics Response Types
export interface ProgressAnalyticsResponse {
  userId: string;
  timeRange: string;
  totalSessions: number;
  totalQuestions: number;
  averageScore: number;
  progressTrend: 'improving' | 'declining' | 'stable';
  competencyBreakdown: CompetencyAnalysis;
  learningVelocity: LearningVelocity;
  weeklyProgress: WeeklyProgressData[];
  strongAreas: TopicCompetency[];
  improvementAreas: TopicCompetency[];
  studyStreak: number;
  timeSpent: number; // in milliseconds
  lastUpdated: string;
}

export interface PerformanceAnalyticsResponse {
  userId: string;
  timeRange: string;
  overallScore: number;
  accuracyTrend: AccuracyDataPoint[];
  speedMetrics: SpeedMetrics;
  difficultyPerformance: DifficultyBreakdown;
  topicPerformance: TopicPerformance[];
  examReadiness: ExamReadiness;
  competencyScores: CompetencyScores;
  improvementRecommendations: string[];
  lastUpdated: string;
}

export interface SessionAnalyticsResponse {
  sessionId: string;
  userId: string;
  sessionType: string;
  duration: number;
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  averageTimePerQuestion: number;
  difficultyDistribution: DifficultyBreakdown;
  topicPerformance: TopicPerformance[];
  learningGains: string[];
  weaknessesIdentified: string[];
  strengthsReinforced: string[];
  recommendedFollowUp: string[];
  lastUpdated: string;
}

// Supporting Types
export interface UserProgressData {
  date: string;
  sessionsCompleted: number;
  questionsAnswered: number;
  averageAccuracy: number;
  timeSpent: number;
}

export interface PerformanceMetrics {
  overallScore: number;
  accuracyTrend: AccuracyDataPoint[];
  speedMetrics: SpeedMetrics;
  difficultyBreakdown: DifficultyBreakdown;
  topicPerformance: TopicPerformance[];
  competencyScores: CompetencyScores;
}

export interface SessionInsights {
  difficultyDistribution: DifficultyBreakdown;
  topicPerformance: TopicPerformance[];
  learningGains: string[];
  weaknessesIdentified: string[];
  strengthsReinforced: string[];
  recommendedActions: string[];
}

export interface CompetencyAnalysis {
  strengths: TopicCompetency[];
  weaknesses: TopicCompetency[];
  all: TopicCompetency[];
}

export interface TopicCompetency {
  topic: string;
  accuracy: number;
  questionsAnswered: number;
  trend?: 'improving' | 'declining' | 'stable';
}

export interface LearningVelocity {
  questionsPerHour: number;
  accuracyImprovement: number;
  consistencyScore: number;
}

export interface WeeklyProgressData {
  week: string;
  sessions: number;
  questions: number;
  averageScore: number;
  totalScore: number;
}

export interface AccuracyDataPoint {
  date: string;
  accuracy: number;
}

export interface SpeedMetrics {
  averageTimePerQuestion: number;
  fastest: number;
  slowest: number;
  trend?: 'improving' | 'declining' | 'stable';
}

export interface DifficultyBreakdown {
  beginner: number;
  intermediate: number;
  advanced: number;
}

export interface TopicPerformance {
  topic: string;
  accuracy: number;
  questionsAnswered: number;
  averageTime?: number;
  trend?: 'improving' | 'declining' | 'stable';
}

export interface ExamReadiness {
  score: number; // 0-100
  recommendation: string;
  estimatedPassProbability: number;
  areasToImprove: string[];
  strongAreas: string[];
}

export interface CompetencyScores {
  technical: number;
  conceptual: number;
  practical: number;
  overall: number;
}
EOF

echo "Created analytics types"
```

#### Step 17.3: Create Analytics Handler
```bash
# Create analytics handler
cat > backend/src/handlers/analytics/AnalyticsHandler.ts << 'EOF'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../base/BaseHandler';
import { ServiceFactory } from '../../services/ServiceFactory';
import { Logger } from '../../shared/utils/Logger';
import {
  ProgressAnalyticsRequest,
  PerformanceAnalyticsRequest,
  SessionAnalyticsRequest
} from '../../types/analytics/AnalyticsTypes';

export class AnalyticsHandler extends BaseHandler {
  private analyticsService: any;

  constructor() {
    super();
    const serviceFactory = ServiceFactory.getInstance();
    this.analyticsService = serviceFactory.createAnalyticsService();
  }

  async getProgressAnalytics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const userId = this.getUserIdFromToken(event);
      const request = this.parseQueryParameters(event.queryStringParameters) as ProgressAnalyticsRequest;
      
      // Validate request parameters
      this.validateProgressAnalyticsRequest(request);
      
      const analytics = await this.analyticsService.getProgressAnalytics(userId, request);
      
      return this.success(analytics, 'Progress analytics retrieved successfully');
    });
  }

  async getPerformanceAnalytics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const userId = this.getUserIdFromToken(event);
      const request = this.parseQueryParameters(event.queryStringParameters) as PerformanceAnalyticsRequest;
      
      // Validate request parameters
      this.validatePerformanceAnalyticsRequest(request);
      
      const analytics = await this.analyticsService.getPerformanceAnalytics(userId, request);
      
      return this.success(analytics, 'Performance analytics retrieved successfully');
    });
  }

  async getSessionAnalytics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const userId = this.getUserIdFromToken(event);
      const sessionId = event.pathParameters?.sessionId;
      
      if (!sessionId) {
        throw this.createError('Session ID is required', 400);
      }
      
      const request = this.parseQueryParameters(event.queryStringParameters) as SessionAnalyticsRequest;
      
      const analytics = await this.analyticsService.getSessionAnalytics(userId, sessionId, request);
      
      return this.success(analytics, 'Session analytics retrieved successfully');
    });
  }

  private validateProgressAnalyticsRequest(request: ProgressAnalyticsRequest): void {
    const validTimeRanges = ['7d', '30d', '90d', 'all'];
    if (!validTimeRanges.includes(request.timeRange)) {
      throw this.createError('Invalid time range. Must be one of: 7d, 30d, 90d, all', 400);
    }

    if (request.includeTopics && !Array.isArray(request.includeTopics)) {
      throw this.createError('includeTopics must be an array', 400);
    }

    if (request.excludeTopics && !Array.isArray(request.excludeTopics)) {
      throw this.createError('excludeTopics must be an array', 400);
    }
  }

  private validatePerformanceAnalyticsRequest(request: PerformanceAnalyticsRequest): void {
    const validTimeRanges = ['7d', '30d', '90d', 'all'];
    if (!validTimeRanges.includes(request.timeRange)) {
      throw this.createError('Invalid time range. Must be one of: 7d, 30d, 90d, all', 400);
    }

    if (request.includeMetrics) {
      const validMetrics = ['accuracy', 'speed', 'consistency', 'improvement'];
      const invalidMetrics = request.includeMetrics.filter(m => !validMetrics.includes(m));
      if (invalidMetrics.length > 0) {
        throw this.createError(`Invalid metrics: ${invalidMetrics.join(', ')}`, 400);
      }
    }

    if (request.difficultyFilter) {
      const validDifficulties = ['beginner', 'intermediate', 'advanced'];
      const invalidDifficulties = request.difficultyFilter.filter(d => !validDifficulties.includes(d));
      if (invalidDifficulties.length > 0) {
        throw this.createError(`Invalid difficulty levels: ${invalidDifficulties.join(', ')}`, 400);
      }
    }
  }

  private parseQueryParameters(params: any): any {
    if (!params) return { timeRange: '30d' };
    
    const parsed: any = {};
    
    // Handle timeRange
    parsed.timeRange = params.timeRange || '30d';
    
    // Handle array parameters
    if (params.includeTopics) {
      parsed.includeTopics = params.includeTopics.split(',');
    }
    
    if (params.excludeTopics) {
      parsed.excludeTopics = params.excludeTopics.split(',');
    }
    
    if (params.examFilter) {
      parsed.examFilter = params.examFilter.split(',');
    }
    
    if (params.providerFilter) {
      parsed.providerFilter = params.providerFilter.split(',');
    }
    
    if (params.includeMetrics) {
      parsed.includeMetrics = params.includeMetrics.split(',');
    }
    
    if (params.difficultyFilter) {
      parsed.difficultyFilter = params.difficultyFilter.split(',');
    }
    
    if (params.topicFilter) {
      parsed.topicFilter = params.topicFilter.split(',');
    }
    
    // Handle boolean parameters
    if (params.includeAnswerDetails) {
      parsed.includeAnswerDetails = params.includeAnswerDetails === 'true';
    }
    
    if (params.includeRecommendations) {
      parsed.includeRecommendations = params.includeRecommendations === 'true';
    }
    
    if (params.includeComparisons) {
      parsed.includeComparisons = params.includeComparisons === 'true';
    }
    
    return parsed;
  }
}

// Export handler functions
const handler = new AnalyticsHandler();

export const getProgressAnalytics = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.getProgressAnalytics(event);

export const getPerformanceAnalytics = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.getPerformanceAnalytics(event);

export const getSessionAnalytics = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.getSessionAnalytics(event);
EOF

echo "Created AnalyticsHandler"
```

#### Step 17.4: Update CDK Stack for Analytics Endpoints
```bash
# Update CDK stack to include analytics endpoints
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Analytics endpoints
    const analyticsResource = api.root.addResource('analytics');
    
    // Progress analytics: GET /analytics/progress
    const progressAnalyticsFunction = new lambda.Function(this, 'ProgressAnalyticsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'analytics/AnalyticsHandler.getProgressAnalytics',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        SESSIONS_TABLE: sessionsTable.tableName,
        ANSWERS_TABLE: answersTable.tableName,
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512
    });

    sessionsTable.grantReadData(progressAnalyticsFunction);
    answersTable.grantReadData(progressAnalyticsFunction);
    jwtSecret.grantRead(progressAnalyticsFunction);

    const progressAnalyticsResource = analyticsResource.addResource('progress');
    progressAnalyticsResource.addMethod('GET', new apigateway.LambdaIntegration(progressAnalyticsFunction), {
      authorizer: authorizer,
      requestParameters: {
        'method.request.querystring.timeRange': false,
        'method.request.querystring.includeTopics': false,
        'method.request.querystring.excludeTopics': false,
        'method.request.querystring.examFilter': false,
        'method.request.querystring.providerFilter': false
      }
    });

    // Performance analytics: GET /analytics/performance
    const performanceAnalyticsFunction = new lambda.Function(this, 'PerformanceAnalyticsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'analytics/AnalyticsHandler.getPerformanceAnalytics',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        SESSIONS_TABLE: sessionsTable.tableName,
        ANSWERS_TABLE: answersTable.tableName,
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512
    });

    sessionsTable.grantReadData(performanceAnalyticsFunction);
    answersTable.grantReadData(performanceAnalyticsFunction);
    jwtSecret.grantRead(performanceAnalyticsFunction);

    const performanceAnalyticsResource = analyticsResource.addResource('performance');
    performanceAnalyticsResource.addMethod('GET', new apigateway.LambdaIntegration(performanceAnalyticsFunction), {
      authorizer: authorizer,
      requestParameters: {
        'method.request.querystring.timeRange': false,
        'method.request.querystring.includeMetrics': false,
        'method.request.querystring.examFilter': false,
        'method.request.querystring.difficultyFilter': false,
        'method.request.querystring.topicFilter': false
      }
    });

    // Session analytics: GET /analytics/sessions/{sessionId}
    const sessionAnalyticsFunction = new lambda.Function(this, 'SessionAnalyticsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'analytics/AnalyticsHandler.getSessionAnalytics',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        SESSIONS_TABLE: sessionsTable.tableName,
        ANSWERS_TABLE: answersTable.tableName,
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512
    });

    sessionsTable.grantReadData(sessionAnalyticsFunction);
    answersTable.grantReadData(sessionAnalyticsFunction);
    jwtSecret.grantRead(sessionAnalyticsFunction);

    const sessionsAnalyticsResource = analyticsResource.addResource('sessions');
    const sessionAnalyticsResource = sessionsAnalyticsResource.addResource('{sessionId}');
    sessionAnalyticsResource.addMethod('GET', new apigateway.LambdaIntegration(sessionAnalyticsFunction), {
      authorizer: authorizer,
      requestParameters: {
        'method.request.path.sessionId': true,
        'method.request.querystring.includeAnswerDetails': false,
        'method.request.querystring.includeRecommendations': false,
        'method.request.querystring.includeComparisons': false
      }
    });
EOF

echo "Updated CDK stack with analytics endpoints"
```

#### Step 17.5: Update Service Factory
```bash
# Update ServiceFactory to include AnalyticsService
cat >> backend/src/services/ServiceFactory.ts << 'EOF'
  
  createAnalyticsService(): AnalyticsService {
    return new AnalyticsService(
      this.createDynamoDBService(),
      this.createCacheService(),
      this.createLogger()
    );
  }
EOF

# Import AnalyticsService in ServiceFactory
sed -i '1i import { AnalyticsService } from "./analytics/AnalyticsService";' backend/src/services/ServiceFactory.ts

echo "Updated ServiceFactory with analytics service"
```

#### Step 17.6: Deploy and Test Analytics Endpoints
```bash
# Deploy the updated stack
npm run build
cdk deploy --require-approval never

# Get API URL and login for testing
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Login to get access token
TOKENS_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com", 
    "password": "password123"
  }')

ACCESS_TOKEN=$(echo $TOKENS_RESPONSE | jq -r '.data.tokens.accessToken')

echo "Testing Analytics Endpoints..."

# Test progress analytics endpoint
echo "1. Testing Progress Analytics"
curl -X GET "$API_URL/api/v1/analytics/progress?timeRange=30d" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test with filters
echo "2. Testing Progress Analytics with filters"
curl -X GET "$API_URL/api/v1/analytics/progress?timeRange=7d&examFilter=aws-saa,aws-dva" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test performance analytics endpoint
echo "3. Testing Performance Analytics"
curl -X GET "$API_URL/api/v1/analytics/performance?timeRange=30d" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test with metrics filter
echo "4. Testing Performance Analytics with metrics filter"
curl -X GET "$API_URL/api/v1/analytics/performance?timeRange=90d&includeMetrics=accuracy,speed&difficultyFilter=intermediate,advanced" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test session analytics endpoint (using a mock session ID)
echo "5. Testing Session Analytics"
curl -X GET "$API_URL/api/v1/analytics/sessions/session-123?includeAnswerDetails=true&includeRecommendations=true" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test error cases
echo "6. Testing Invalid Time Range"
curl -X GET "$API_URL/api/v1/analytics/progress?timeRange=invalid" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test unauthorized access
echo "7. Testing Unauthorized Access"
curl -X GET "$API_URL/api/v1/analytics/progress" | jq '.'

echo "Analytics endpoints testing completed"
```

**Phase 17 Success Criteria**:
- ✅ Analytics service layer implemented with comprehensive metrics calculation
- ✅ Three main analytics endpoints implemented (progress, performance, session)
- ✅ Advanced filtering and parameter validation
- ✅ Caching implemented for performance optimization
- ✅ Proper error handling and input validation
- ✅ Authentication and authorization enforced
- ✅ CDK infrastructure properly configured
- ✅ Response format matches analytics type definitions

### Phase 18: Goals Management System
**Dependencies**: Phase 17  
**Objective**: Implement complete CRUD system for user goal management with progress tracking

#### Step 18.1: Create Goals Service and Types
```bash
# Create goals service directory
mkdir -p backend/src/services/goals
mkdir -p backend/src/types/goals

# Create goals types
cat > backend/src/types/goals/GoalsTypes.ts << 'EOF'
// Goal Request Types
export interface CreateGoalRequest {
  title: string;
  description?: string;
  type: 'exam_preparation' | 'topic_mastery' | 'daily_practice' | 'score_target' | 'streak';
  targetType: 'exam' | 'topic' | 'questions' | 'score' | 'days';
  targetValue: string | number;
  targetDate: string;
  examId?: string;
  topicId?: string;
  providerFilter?: string[];
  difficultyLevel?: 'beginner' | 'intermediate' | 'advanced';
  questionsPerDay?: number;
  targetScore?: number;
  isActive: boolean;
  priority: 'low' | 'medium' | 'high';
  reminders?: GoalReminder[];
}

export interface UpdateGoalRequest {
  title?: string;
  description?: string;
  targetDate?: string;
  targetValue?: string | number;
  questionsPerDay?: number;
  targetScore?: number;
  isActive?: boolean;
  priority?: 'low' | 'medium' | 'high';
  reminders?: GoalReminder[];
  status?: 'active' | 'completed' | 'paused' | 'abandoned';
}

export interface GoalsListRequest {
  status?: 'active' | 'completed' | 'paused' | 'abandoned' | 'all';
  type?: 'exam_preparation' | 'topic_mastery' | 'daily_practice' | 'score_target' | 'streak';
  priority?: 'low' | 'medium' | 'high';
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'targetDate' | 'progress' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

// Goal Response Types
export interface GoalResponse {
  goalId: string;
  userId: string;
  title: string;
  description?: string;
  type: string;
  targetType: string;
  targetValue: string | number;
  targetDate: string;
  examId?: string;
  topicId?: string;
  providerFilter?: string[];
  difficultyLevel?: string;
  questionsPerDay?: number;
  targetScore?: number;
  currentProgress: GoalProgress;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  priority: 'low' | 'medium' | 'high';
  isActive: boolean;
  reminders?: GoalReminder[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  daysRemaining: number;
  progressPercentage: number;
  isOnTrack: boolean;
  milestones?: GoalMilestone[];
}

export interface GoalsListResponse {
  goals: GoalResponse[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
  summary: {
    totalActive: number;
    totalCompleted: number;
    totalPaused: number;
    totalAbandoned: number;
    onTrackCount: number;
    behindCount: number;
    completedThisWeek: number;
    completedThisMonth: number;
  };
}

// Supporting Types
export interface GoalProgress {
  current: number;
  target: number;
  percentage: number;
  dailyAverage: number;
  weeklyAverage: number;
  trend: 'improving' | 'declining' | 'stable';
  lastUpdated: string;
  milestones: GoalMilestone[];
}

export interface GoalReminder {
  id: string;
  type: 'daily' | 'weekly' | 'deadline' | 'milestone';
  time: string; // HH:MM format
  days: number[]; // 0-6, Sunday-Saturday
  message?: string;
  isActive: boolean;
}

export interface GoalMilestone {
  id: string;
  title: string;
  targetValue: number;
  achievedValue: number;
  targetDate: string;
  achievedDate?: string;
  isCompleted: boolean;
  description?: string;
}

export interface GoalStatistics {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  completionRate: number;
  averageCompletionTime: number; // in days
  mostCommonGoalType: string;
  streakCount: number;
  longestStreak: number;
  currentMonthProgress: number;
}
EOF

# Create Goals service
cat > backend/src/services/goals/GoalsService.ts << 'EOF'
import { BaseService } from '../base/BaseService';
import { Logger } from '../../shared/utils/Logger';
import { DynamoDBService } from '../database/DynamoDBService';
import { CacheService } from '../cache/CacheService';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateGoalRequest,
  UpdateGoalRequest,
  GoalsListRequest,
  GoalResponse,
  GoalsListResponse,
  GoalProgress,
  GoalMilestone,
  GoalStatistics
} from '../../types/goals/GoalsTypes';

export class GoalsService extends BaseService {
  private dynamodb: DynamoDBService;
  private cache: CacheService;
  private logger: Logger;
  private goalsTable: string;

  constructor(
    dynamodb: DynamoDBService,
    cache: CacheService,
    logger: Logger
  ) {
    super();
    this.dynamodb = dynamodb;
    this.cache = cache;
    this.logger = logger;
    this.goalsTable = process.env.GOALS_TABLE!;
  }

  async createGoal(userId: string, request: CreateGoalRequest): Promise<GoalResponse> {
    this.logger.info('Creating new goal', { userId, request });

    try {
      // Validate goal request
      this.validateCreateGoalRequest(request);

      // Generate goal ID
      const goalId = uuidv4();
      const now = new Date().toISOString();

      // Create milestones if applicable
      const milestones = this.generateMilestones(request);

      const goal = {
        goalId,
        userId,
        ...request,
        currentProgress: this.initializeProgress(request),
        status: 'active',
        createdAt: now,
        updatedAt: now,
        progressPercentage: 0,
        daysRemaining: this.calculateDaysRemaining(request.targetDate),
        isOnTrack: true,
        milestones
      };

      // Save to DynamoDB
      const params = {
        TableName: this.goalsTable,
        Item: goal,
        ConditionExpression: 'attribute_not_exists(goalId)'
      };

      await this.dynamodb.put(params);

      // Clear user goals cache
      await this.cache.delete(`user_goals:${userId}`);

      this.logger.info('Goal created successfully', { goalId });
      return this.mapToGoalResponse(goal);

    } catch (error) {
      this.logger.error('Error creating goal', error);
      throw this.createError('Failed to create goal', 500);
    }
  }

  async getUserGoals(userId: string, request: GoalsListRequest): Promise<GoalsListResponse> {
    this.logger.info('Getting user goals', { userId, request });

    try {
      const cacheKey = `user_goals:${userId}:${JSON.stringify(request)}`;
      const cached = await this.cache.get<GoalsListResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      // Build query parameters
      const params: any = {
        TableName: this.goalsTable,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      };

      // Add filter expression if status is specified
      if (request.status && request.status !== 'all') {
        params.FilterExpression = '#status = :status';
        params.ExpressionAttributeNames = { '#status': 'status' };
        params.ExpressionAttributeValues[':status'] = request.status;
      }

      // Add additional filters
      const filterConditions = [];
      if (request.type) {
        filterConditions.push('#type = :type');
        params.ExpressionAttributeNames = { ...params.ExpressionAttributeNames, '#type': 'type' };
        params.ExpressionAttributeValues[':type'] = request.type;
      }

      if (request.priority) {
        filterConditions.push('priority = :priority');
        params.ExpressionAttributeValues[':priority'] = request.priority;
      }

      if (filterConditions.length > 0) {
        const additionalFilter = filterConditions.join(' AND ');
        params.FilterExpression = params.FilterExpression ? 
          `${params.FilterExpression} AND ${additionalFilter}` : 
          additionalFilter;
      }

      // Execute query
      const result = await this.dynamodb.query(params);
      let goals = result.Items || [];

      // Update progress for all goals
      goals = await Promise.all(goals.map(goal => this.updateGoalProgress(goal)));

      // Apply sorting
      goals = this.sortGoals(goals, request.sortBy || 'createdAt', request.sortOrder || 'desc');

      // Apply pagination
      const total = goals.length;
      const offset = request.offset || 0;
      const limit = request.limit || 20;
      const paginatedGoals = goals.slice(offset, offset + limit);

      // Calculate summary
      const summary = this.calculateGoalsSummary(goals);

      const response: GoalsListResponse = {
        goals: paginatedGoals.map(goal => this.mapToGoalResponse(goal)),
        pagination: {
          total,
          offset,
          limit,
          hasMore: offset + limit < total
        },
        summary
      };

      // Cache for 5 minutes
      await this.cache.set(cacheKey, response, 300);

      return response;

    } catch (error) {
      this.logger.error('Error getting user goals', error);
      throw this.createError('Failed to retrieve goals', 500);
    }
  }

  async getGoalById(userId: string, goalId: string): Promise<GoalResponse> {
    this.logger.info('Getting goal by ID', { userId, goalId });

    try {
      const params = {
        TableName: this.goalsTable,
        Key: { goalId, userId }
      };

      const result = await this.dynamodb.get(params);
      if (!result.Item) {
        throw this.createError('Goal not found', 404);
      }

      // Update progress before returning
      const updatedGoal = await this.updateGoalProgress(result.Item);
      return this.mapToGoalResponse(updatedGoal);

    } catch (error) {
      if (error.statusCode === 404) {
        throw error;
      }
      this.logger.error('Error getting goal by ID', error);
      throw this.createError('Failed to retrieve goal', 500);
    }
  }

  async updateGoal(userId: string, goalId: string, request: UpdateGoalRequest): Promise<GoalResponse> {
    this.logger.info('Updating goal', { userId, goalId, request });

    try {
      // Get existing goal
      const existingGoal = await this.getGoalById(userId, goalId);

      // Build update expression
      const updateExpressions = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      for (const [key, value] of Object.entries(request)) {
        if (value !== undefined) {
          updateExpressions.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = value;
        }
      }

      if (updateExpressions.length === 0) {
        throw this.createError('No valid fields to update', 400);
      }

      // Add updatedAt
      updateExpressions.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      // Add completedAt if status is completed
      if (request.status === 'completed') {
        updateExpressions.push('#completedAt = :completedAt');
        expressionAttributeNames['#completedAt'] = 'completedAt';
        expressionAttributeValues[':completedAt'] = new Date().toISOString();
      }

      const params = {
        TableName: this.goalsTable,
        Key: { goalId, userId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      };

      const result = await this.dynamodb.update(params);

      // Clear cache
      await this.cache.delete(`user_goals:${userId}`);

      return this.mapToGoalResponse(result.Attributes);

    } catch (error) {
      this.logger.error('Error updating goal', error);
      throw this.createError('Failed to update goal', 500);
    }
  }

  async deleteGoal(userId: string, goalId: string): Promise<void> {
    this.logger.info('Deleting goal', { userId, goalId });

    try {
      // Verify goal exists and belongs to user
      await this.getGoalById(userId, goalId);

      const params = {
        TableName: this.goalsTable,
        Key: { goalId, userId }
      };

      await this.dynamodb.delete(params);

      // Clear cache
      await this.cache.delete(`user_goals:${userId}`);

      this.logger.info('Goal deleted successfully', { goalId });

    } catch (error) {
      if (error.statusCode === 404) {
        throw error;
      }
      this.logger.error('Error deleting goal', error);
      throw this.createError('Failed to delete goal', 500);
    }
  }

  private validateCreateGoalRequest(request: CreateGoalRequest): void {
    if (!request.title || request.title.trim().length === 0) {
      throw this.createError('Goal title is required', 400);
    }

    if (request.title.length > 200) {
      throw this.createError('Goal title cannot exceed 200 characters', 400);
    }

    if (request.description && request.description.length > 1000) {
      throw this.createError('Goal description cannot exceed 1000 characters', 400);
    }

    const validTypes = ['exam_preparation', 'topic_mastery', 'daily_practice', 'score_target', 'streak'];
    if (!validTypes.includes(request.type)) {
      throw this.createError(`Invalid goal type. Must be one of: ${validTypes.join(', ')}`, 400);
    }

    const validTargetTypes = ['exam', 'topic', 'questions', 'score', 'days'];
    if (!validTargetTypes.includes(request.targetType)) {
      throw this.createError(`Invalid target type. Must be one of: ${validTargetTypes.join(', ')}`, 400);
    }

    // Validate target date
    const targetDate = new Date(request.targetDate);
    if (isNaN(targetDate.getTime())) {
      throw this.createError('Invalid target date format', 400);
    }

    if (targetDate <= new Date()) {
      throw this.createError('Target date must be in the future', 400);
    }

    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(request.priority)) {
      throw this.createError(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`, 400);
    }
  }

  private initializeProgress(request: CreateGoalRequest): GoalProgress {
    return {
      current: 0,
      target: typeof request.targetValue === 'number' ? request.targetValue : 0,
      percentage: 0,
      dailyAverage: 0,
      weeklyAverage: 0,
      trend: 'stable',
      lastUpdated: new Date().toISOString(),
      milestones: []
    };
  }

  private generateMilestones(request: CreateGoalRequest): GoalMilestone[] {
    const milestones: GoalMilestone[] = [];
    
    if (typeof request.targetValue === 'number' && request.targetValue > 100) {
      // Create 25%, 50%, 75% milestones for large targets
      [25, 50, 75].forEach(percentage => {
        milestones.push({
          id: uuidv4(),
          title: `${percentage}% Complete`,
          targetValue: Math.floor(request.targetValue as number * percentage / 100),
          achievedValue: 0,
          targetDate: this.calculateMilestoneDate(request.targetDate, percentage),
          isCompleted: false,
          description: `Reach ${percentage}% of your goal`
        });
      });
    }
    
    return milestones;
  }

  private calculateMilestoneDate(targetDate: string, percentage: number): string {
    const target = new Date(targetDate);
    const now = new Date();
    const totalDays = Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const milestoneDate = new Date(now.getTime() + (totalDays * percentage / 100) * 24 * 60 * 60 * 1000);
    return milestoneDate.toISOString();
  }

  private calculateDaysRemaining(targetDate: string): number {
    const target = new Date(targetDate);
    const now = new Date();
    return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  private async updateGoalProgress(goal: any): Promise<any> {
    // This would typically fetch actual progress data from user's study sessions
    // For now, we'll return the goal with calculated fields
    
    const now = new Date();
    const targetDate = new Date(goal.targetDate);
    const daysRemaining = Math.max(0, Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Update progress percentage (this would be calculated from actual user data)
    const progressPercentage = Math.min(100, (goal.currentProgress?.current || 0) / (goal.currentProgress?.target || 1) * 100);
    
    // Determine if on track
    const totalDays = Math.ceil((targetDate.getTime() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const daysPassed = totalDays - daysRemaining;
    const expectedProgress = totalDays > 0 ? (daysPassed / totalDays) * 100 : 0;
    const isOnTrack = progressPercentage >= expectedProgress * 0.8; // 80% of expected progress
    
    return {
      ...goal,
      daysRemaining,
      progressPercentage: Math.round(progressPercentage),
      isOnTrack
    };
  }

  private sortGoals(goals: any[], sortBy: string, sortOrder: string): any[] {
    return goals.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      // Handle date sorting
      if (sortBy === 'createdAt' || sortBy === 'targetDate') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      // Handle numeric sorting
      if (sortBy === 'progress') {
        aValue = a.progressPercentage;
        bValue = b.progressPercentage;
      }
      
      if (sortBy === 'priority') {
        const priorities = { high: 3, medium: 2, low: 1 };
        aValue = priorities[aValue];
        bValue = priorities[bValue];
      }
      
      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  }

  private calculateGoalsSummary(goals: any[]): any {
    const summary = {
      totalActive: 0,
      totalCompleted: 0,
      totalPaused: 0,
      totalAbandoned: 0,
      onTrackCount: 0,
      behindCount: 0,
      completedThisWeek: 0,
      completedThisMonth: 0
    };
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    goals.forEach(goal => {
      // Count by status
      switch (goal.status) {
        case 'active':
          summary.totalActive++;
          break;
        case 'completed':
          summary.totalCompleted++;
          
          // Count completed this week/month
          if (goal.completedAt) {
            const completedDate = new Date(goal.completedAt);
            if (completedDate >= oneWeekAgo) {
              summary.completedThisWeek++;
            }
            if (completedDate >= oneMonthAgo) {
              summary.completedThisMonth++;
            }
          }
          break;
        case 'paused':
          summary.totalPaused++;
          break;
        case 'abandoned':
          summary.totalAbandoned++;
          break;
      }
      
      // Count tracking status for active goals
      if (goal.status === 'active') {
        if (goal.isOnTrack) {
          summary.onTrackCount++;
        } else {
          summary.behindCount++;
        }
      }
    });
    
    return summary;
  }

  private mapToGoalResponse(goal: any): GoalResponse {
    return {
      goalId: goal.goalId,
      userId: goal.userId,
      title: goal.title,
      description: goal.description,
      type: goal.type,
      targetType: goal.targetType,
      targetValue: goal.targetValue,
      targetDate: goal.targetDate,
      examId: goal.examId,
      topicId: goal.topicId,
      providerFilter: goal.providerFilter,
      difficultyLevel: goal.difficultyLevel,
      questionsPerDay: goal.questionsPerDay,
      targetScore: goal.targetScore,
      currentProgress: goal.currentProgress,
      status: goal.status,
      priority: goal.priority,
      isActive: goal.isActive,
      reminders: goal.reminders,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      completedAt: goal.completedAt,
      daysRemaining: goal.daysRemaining,
      progressPercentage: goal.progressPercentage,
      isOnTrack: goal.isOnTrack,
      milestones: goal.milestones
    };
  }
}
EOF

echo "Created Goals service and types"
```

#### Step 18.2: Create Goals Handler
```bash
# Create goals handler
cat > backend/src/handlers/goals/GoalsHandler.ts << 'EOF'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CrudHandler } from '../base/CrudHandler';
import { ServiceFactory } from '../../services/ServiceFactory';
import {
  CreateGoalRequest,
  UpdateGoalRequest,
  GoalsListRequest
} from '../../types/goals/GoalsTypes';

export class GoalsHandler extends CrudHandler {
  private goalsService: any;

  constructor() {
    super();
    const serviceFactory = ServiceFactory.getInstance();
    this.goalsService = serviceFactory.createGoalsService();
  }

  async createGoal(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const userId = this.getUserIdFromToken(event);
      const request = JSON.parse(event.body || '{}') as CreateGoalRequest;
      
      const goal = await this.goalsService.createGoal(userId, request);
      
      return this.created(goal, 'Goal created successfully');
    });
  }

  async getUserGoals(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const userId = this.getUserIdFromToken(event);
      const request = this.parseQueryParameters(event.queryStringParameters) as GoalsListRequest;
      
      const goals = await this.goalsService.getUserGoals(userId, request);
      
      return this.success(goals, 'Goals retrieved successfully');
    });
  }

  async getGoalById(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const userId = this.getUserIdFromToken(event);
      const goalId = event.pathParameters?.goalId;
      
      if (!goalId) {
        throw this.createError('Goal ID is required', 400);
      }
      
      const goal = await this.goalsService.getGoalById(userId, goalId);
      
      return this.success(goal, 'Goal retrieved successfully');
    });
  }

  async updateGoal(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const userId = this.getUserIdFromToken(event);
      const goalId = event.pathParameters?.goalId;
      
      if (!goalId) {
        throw this.createError('Goal ID is required', 400);
      }
      
      const request = JSON.parse(event.body || '{}') as UpdateGoalRequest;
      
      const goal = await this.goalsService.updateGoal(userId, goalId, request);
      
      return this.success(goal, 'Goal updated successfully');
    });
  }

  async deleteGoal(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const userId = this.getUserIdFromToken(event);
      const goalId = event.pathParameters?.goalId;
      
      if (!goalId) {
        throw this.createError('Goal ID is required', 400);
      }
      
      await this.goalsService.deleteGoal(userId, goalId);
      
      return this.success(null, 'Goal deleted successfully');
    });
  }

  private parseQueryParameters(params: any): GoalsListRequest {
    const request: GoalsListRequest = {};
    
    if (params?.status) {
      request.status = params.status;
    }
    
    if (params?.type) {
      request.type = params.type;
    }
    
    if (params?.priority) {
      request.priority = params.priority;
    }
    
    if (params?.limit) {
      request.limit = parseInt(params.limit);
    }
    
    if (params?.offset) {
      request.offset = parseInt(params.offset);
    }
    
    if (params?.sortBy) {
      request.sortBy = params.sortBy;
    }
    
    if (params?.sortOrder) {
      request.sortOrder = params.sortOrder;
    }
    
    return request;
  }
}

// Export handler functions
const handler = new GoalsHandler();

export const createGoal = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.createGoal(event);

export const getUserGoals = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.getUserGoals(event);

export const getGoalById = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.getGoalById(event);

export const updateGoal = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.updateGoal(event);

export const deleteGoal = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.deleteGoal(event);
EOF

echo "Created Goals handler"
```

#### Step 18.3: Update CDK Stack for Goals Management
```bash
# Add goals table and endpoints to CDK stack
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Goals table
    const goalsTable = new dynamodb.Table(this, 'GoalsTable', {
      tableName: 'StudyAppGoals',
      partitionKey: { name: 'goalId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Add GSI for querying goals by user
    goalsTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // Goals endpoints
    const goalsResource = api.root.addResource('goals');
    
    // Create goal: POST /goals
    const createGoalFunction = new lambda.Function(this, 'CreateGoalFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'goals/GoalsHandler.createGoal',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        GOALS_TABLE: goalsTable.tableName,
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256
    });

    goalsTable.grantWriteData(createGoalFunction);
    jwtSecret.grantRead(createGoalFunction);

    goalsResource.addMethod('POST', new apigateway.LambdaIntegration(createGoalFunction), {
      authorizer: authorizer
    });

    // List goals: GET /goals
    const getUserGoalsFunction = new lambda.Function(this, 'GetUserGoalsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'goals/GoalsHandler.getUserGoals',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        GOALS_TABLE: goalsTable.tableName,
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256
    });

    goalsTable.grantReadData(getUserGoalsFunction);
    jwtSecret.grantRead(getUserGoalsFunction);

    goalsResource.addMethod('GET', new apigateway.LambdaIntegration(getUserGoalsFunction), {
      authorizer: authorizer,
      requestParameters: {
        'method.request.querystring.status': false,
        'method.request.querystring.type': false,
        'method.request.querystring.priority': false,
        'method.request.querystring.limit': false,
        'method.request.querystring.offset': false,
        'method.request.querystring.sortBy': false,
        'method.request.querystring.sortOrder': false
      }
    });

    // Get specific goal: GET /goals/{goalId}
    const goalIdResource = goalsResource.addResource('{goalId}');
    
    const getGoalByIdFunction = new lambda.Function(this, 'GetGoalByIdFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'goals/GoalsHandler.getGoalById',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        GOALS_TABLE: goalsTable.tableName,
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256
    });

    goalsTable.grantReadData(getGoalByIdFunction);
    jwtSecret.grantRead(getGoalByIdFunction);

    goalIdResource.addMethod('GET', new apigateway.LambdaIntegration(getGoalByIdFunction), {
      authorizer: authorizer,
      requestParameters: {
        'method.request.path.goalId': true
      }
    });

    // Update goal: PUT /goals/{goalId}
    const updateGoalFunction = new lambda.Function(this, 'UpdateGoalFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'goals/GoalsHandler.updateGoal',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        GOALS_TABLE: goalsTable.tableName,
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256
    });

    goalsTable.grantReadWriteData(updateGoalFunction);
    jwtSecret.grantRead(updateGoalFunction);

    goalIdResource.addMethod('PUT', new apigateway.LambdaIntegration(updateGoalFunction), {
      authorizer: authorizer,
      requestParameters: {
        'method.request.path.goalId': true
      }
    });

    // Delete goal: DELETE /goals/{goalId}
    const deleteGoalFunction = new lambda.Function(this, 'DeleteGoalFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'goals/GoalsHandler.deleteGoal',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        GOALS_TABLE: goalsTable.tableName,
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256
    });

    goalsTable.grantReadWriteData(deleteGoalFunction);
    jwtSecret.grantRead(deleteGoalFunction);

    goalIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteGoalFunction), {
      authorizer: authorizer,
      requestParameters: {
        'method.request.path.goalId': true
      }
    });
EOF

echo "Updated CDK stack with goals management"
```

#### Step 18.4: Update Service Factory
```bash
# Update ServiceFactory to include GoalsService
cat >> backend/src/services/ServiceFactory.ts << 'EOF'
  
  createGoalsService(): GoalsService {
    return new GoalsService(
      this.createDynamoDBService(),
      this.createCacheService(),
      this.createLogger()
    );
  }
EOF

# Import GoalsService in ServiceFactory
sed -i '1i import { GoalsService } from "./goals/GoalsService";' backend/src/services/ServiceFactory.ts

echo "Updated ServiceFactory with goals service"
```

#### Step 18.5: Deploy and Test Goals Management System
```bash
# Deploy the updated stack
npm run build
cdk deploy --require-approval never

# Test goals management endpoints
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Login to get access token
TOKENS_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com", 
    "password": "password123"
  }')

ACCESS_TOKEN=$(echo $TOKENS_RESPONSE | jq -r '.data.tokens.accessToken')

echo "Testing Goals Management System..."

# Test create goal
echo "1. Testing Create Goal"
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/goals" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Pass AWS Solutions Architect Associate",
    "description": "Prepare for and pass the AWS SAA exam by March 2024",
    "type": "exam_preparation",
    "targetType": "score",
    "targetValue": 750,
    "targetDate": "2024-03-15T00:00:00.000Z",
    "examId": "aws-saa",
    "targetScore": 750,
    "questionsPerDay": 50,
    "isActive": true,
    "priority": "high",
    "providerFilter": ["aws"],
    "difficultyLevel": "intermediate"
  }')

echo $CREATE_RESPONSE | jq '.'
GOAL_ID=$(echo $CREATE_RESPONSE | jq -r '.data.goalId')

# Test create daily practice goal
echo "2. Testing Create Daily Practice Goal"
curl -s -X POST "$API_URL/api/v1/goals" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Daily Practice - 30 Questions",
    "description": "Answer 30 practice questions every day",
    "type": "daily_practice",
    "targetType": "questions",
    "targetValue": 30,
    "targetDate": "2024-06-01T00:00:00.000Z",
    "questionsPerDay": 30,
    "isActive": true,
    "priority": "medium"
  }' | jq '.'

# Test list goals
echo "3. Testing List User Goals"
curl -s -X GET "$API_URL/api/v1/goals" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test list with filters
echo "4. Testing List Goals with Filters"
curl -s -X GET "$API_URL/api/v1/goals?status=active&priority=high&sortBy=priority&sortOrder=desc" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test get specific goal
echo "5. Testing Get Goal by ID"
curl -s -X GET "$API_URL/api/v1/goals/$GOAL_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test update goal
echo "6. Testing Update Goal"
curl -s -X PUT "$API_URL/api/v1/goals/$GOAL_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Pass AWS Solutions Architect Associate (Updated)",
    "questionsPerDay": 75,
    "priority": "high",
    "status": "active"
  }' | jq '.'

# Test mark goal as completed
echo "7. Testing Mark Goal as Completed"
curl -s -X PUT "$API_URL/api/v1/goals/$GOAL_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed"
  }' | jq '.'

# Test error cases
echo "8. Testing Invalid Goal Creation"
curl -s -X POST "$API_URL/api/v1/goals" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "",
    "type": "invalid_type",
    "targetType": "exam",
    "targetValue": 750,
    "targetDate": "2023-01-01T00:00:00.000Z"
  }' | jq '.'

# Test unauthorized access
echo "9. Testing Unauthorized Access"
curl -s -X GET "$API_URL/api/v1/goals" | jq '.'

# Test delete goal
echo "10. Testing Delete Goal"
curl -s -X DELETE "$API_URL/api/v1/goals/$GOAL_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

echo "Goals management system testing completed"
```

**Phase 18 Success Criteria**:
- ✅ Complete CRUD operations for goals (Create, Read, Update, Delete)
- ✅ Advanced filtering and pagination for goal listings
- ✅ Goal progress tracking and milestone system
- ✅ Multiple goal types supported (exam prep, topic mastery, daily practice, etc.)
- ✅ Comprehensive validation and error handling
- ✅ User isolation and authorization enforced
- ✅ DynamoDB table with proper indexes for efficient querying
- ✅ Caching implemented for performance optimization

### Phase 19: Detailed Health Monitoring
  
**Dependencies**: Phase 18  
**Objective**: Implement comprehensive health monitoring with infrastructure checks and system diagnostics

#### Step 19.1: Create Health Service with Infrastructure Checks
```bash
# Create health service directory
mkdir -p backend/src/services/health

# Create detailed health service
cat > backend/src/services/health/HealthService.ts << 'EOF'
import { BaseService } from '../base/BaseService';
import { Logger } from '../../shared/utils/Logger';
import { DynamoDBService } from '../database/DynamoDBService';
import { CacheService } from '../cache/CacheService';
import AWS from 'aws-sdk';

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  timestamp: string;
  details?: any;
  error?: string;
}

export interface DetailedHealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
  performance: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
    responseTime: number;
  };
}

export class HealthService extends BaseService {
  private dynamodb: DynamoDBService;
  private cache: CacheService;
  private logger: Logger;
  private s3: AWS.S3;
  private cloudWatch: AWS.CloudWatch;
  private startTime: number;

  constructor(
    dynamodb: DynamoDBService,
    cache: CacheService,
    logger: Logger
  ) {
    super();
    this.dynamodb = dynamodb;
    this.cache = cache;
    this.logger = logger;
    this.s3 = new AWS.S3();
    this.cloudWatch = new AWS.CloudWatch();
    this.startTime = Date.now();
  }

  async getDetailedHealth(): Promise<DetailedHealthResponse> {
    this.logger.info('Performing detailed health check');
    
    const startTime = Date.now();
    const checks: HealthCheck[] = [];

    // Perform all health checks concurrently
    const healthChecks = await Promise.allSettled([
      this.checkDynamoDB(),
      this.checkRedis(),
      this.checkS3(),
      this.checkSecrets(),
      this.checkCloudWatch(),
      this.checkMemory(),
      this.checkDisk()
    ]);

    // Process health check results
    healthChecks.forEach((result, index) => {
      const serviceName = ['DynamoDB', 'Redis', 'S3', 'SecretsManager', 'CloudWatch', 'Memory', 'Disk'][index];
      
      if (result.status === 'fulfilled') {
        checks.push(result.value);
      } else {
        checks.push({
          service: serviceName,
          status: 'unhealthy',
          responseTime: 0,
          timestamp: new Date().toISOString(),
          error: result.reason?.message || 'Unknown error'
        });
      }
    });

    // Calculate overall status
    const summary = this.calculateSummary(checks);
    const overallStatus = this.determineOverallStatus(summary);
    
    const response: DetailedHealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      summary,
      performance: {
        memoryUsage: process.memoryUsage(),
        responseTime: Date.now() - startTime
      }
    };

    this.logger.info('Detailed health check completed', { status: overallStatus, responseTime: response.performance.responseTime });
    return response;
  }

  private async checkDynamoDB(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Check if we can list tables
      const result = await this.dynamodb.listTables();
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'DynamoDB',
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString(),
        details: {
          tablesCount: result.TableNames?.length || 0,
          region: process.env.AWS_REGION || 'us-east-1'
        }
      };
    } catch (error) {
      return {
        service: 'DynamoDB',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test Redis connection with a simple ping
      const testKey = 'health_check_test';
      const testValue = 'ping';
      
      await this.cache.set(testKey, testValue, 10);
      const result = await this.cache.get(testKey);
      await this.cache.delete(testKey);
      
      const responseTime = Date.now() - startTime;
      
      if (result === testValue) {
        return {
          service: 'Redis',
          status: 'healthy',
          responseTime,
          timestamp: new Date().toISOString(),
          details: {
            endpoint: process.env.REDIS_ENDPOINT || 'localhost',
            testPassed: true
          }
        };
      } else {
        return {
          service: 'Redis',
          status: 'degraded',
          responseTime,
          timestamp: new Date().toISOString(),
          error: 'Test value mismatch'
        };
      }
    } catch (error) {
      return {
        service: 'Redis',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async checkS3(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const bucketName = process.env.S3_BUCKET_NAME;
      if (!bucketName) {
        throw new Error('S3 bucket name not configured');
      }

      // Check if bucket exists and is accessible
      await this.s3.headBucket({ Bucket: bucketName }).promise();
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'S3',
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString(),
        details: {
          bucket: bucketName,
          region: process.env.AWS_REGION || 'us-east-1'
        }
      };
    } catch (error) {
      return {
        service: 'S3',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async checkSecrets(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const secretsManager = new AWS.SecretsManager();
      const secretName = process.env.JWT_SECRET_NAME;
      
      if (!secretName) {
        throw new Error('JWT secret name not configured');
      }

      // Try to access the secret
      await secretsManager.describeSecret({ SecretId: secretName }).promise();
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'SecretsManager',
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString(),
        details: {
          secretName: secretName
        }
      };
    } catch (error) {
      return {
        service: 'SecretsManager',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async checkCloudWatch(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Try to list metrics to verify CloudWatch access
      await this.cloudWatch.listMetrics({ MaxRecords: 1 }).promise();
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'CloudWatch',
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString(),
        details: {
          region: process.env.AWS_REGION || 'us-east-1'
        }
      };
    } catch (error) {
      return {
        service: 'CloudWatch',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.heapTotal;
      const usedMemory = memoryUsage.heapUsed;
      const memoryUtilization = (usedMemory / totalMemory) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (memoryUtilization > 90) {
        status = 'unhealthy';
      } else if (memoryUtilization > 75) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'Memory',
        status,
        responseTime,
        timestamp: new Date().toISOString(),
        details: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          utilization: `${memoryUtilization.toFixed(2)}%`
        }
      };
    } catch (error) {
      return {
        service: 'Memory',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async checkDisk(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const fs = require('fs');
      const stats = fs.statSync('/tmp');
      
      // For Lambda, we check /tmp directory which has 10GB limit
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'Disk',
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString(),
        details: {
          path: '/tmp',
          accessible: true,
          lastModified: stats.mtime
        }
      };
    } catch (error) {
      return {
        service: 'Disk',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private calculateSummary(checks: HealthCheck[]): { total: number; healthy: number; unhealthy: number; degraded: number } {
    return checks.reduce(
      (summary, check) => {
        summary.total++;
        summary[check.status]++;
        return summary;
      },
      { total: 0, healthy: 0, unhealthy: 0, degraded: 0 }
    );
  }

  private determineOverallStatus(summary: { total: number; healthy: number; unhealthy: number; degraded: number }): 'healthy' | 'degraded' | 'unhealthy' {
    if (summary.unhealthy > 0) {
      return 'unhealthy';
    } else if (summary.degraded > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  async sendHealthMetrics(health: DetailedHealthResponse): Promise<void> {
    try {
      const params = {
        Namespace: 'StudyApp/Health',
        MetricData: [
          {
            MetricName: 'HealthyServices',
            Value: health.summary.healthy,
            Unit: 'Count',
            Timestamp: new Date()
          },
          {
            MetricName: 'UnhealthyServices',
            Value: health.summary.unhealthy,
            Unit: 'Count',
            Timestamp: new Date()
          },
          {
            MetricName: 'ResponseTime',
            Value: health.performance.responseTime,
            Unit: 'Milliseconds',
            Timestamp: new Date()
          },
          {
            MetricName: 'MemoryUtilization',
            Value: (health.performance.memoryUsage.heapUsed / health.performance.memoryUsage.heapTotal) * 100,
            Unit: 'Percent',
            Timestamp: new Date()
          }
        ]
      };

      await this.cloudWatch.putMetricData(params).promise();
      this.logger.info('Health metrics sent to CloudWatch');
    } catch (error) {
      this.logger.error('Failed to send health metrics', error);
    }
  }
}
EOF

echo "Created detailed health service"
```

#### Step 19.2: Create Health Handler
```bash
# Create health handler
cat > backend/src/handlers/health/DetailedHealthHandler.ts << 'EOF'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../base/BaseHandler';
import { ServiceFactory } from '../../services/ServiceFactory';

export class DetailedHealthHandler extends BaseHandler {
  private healthService: any;

  constructor() {
    super();
    const serviceFactory = ServiceFactory.getInstance();
    this.healthService = serviceFactory.createHealthService();
  }

  async getDetailedHealth(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    // No authentication required for health endpoint
    try {
      const health = await this.healthService.getDetailedHealth();
      
      // Send metrics to CloudWatch in the background
      this.healthService.sendHealthMetrics(health).catch(err => 
        this.logger.error('Failed to send health metrics', err)
      );
      
      // Return appropriate HTTP status based on health
      const statusCode = this.getHttpStatusFromHealth(health.status);
      
      return {
        statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: JSON.stringify({
          success: health.status === 'healthy',
          data: health,
          message: `System is ${health.status}`,
          timestamp: health.timestamp
        })
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      
      return {
        statusCode: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: JSON.stringify({
          success: false,
          data: null,
          message: 'Health check failed',
          error: error.message,
          timestamp: new Date().toISOString()
        })
      };
    }
  }

  private getHttpStatusFromHealth(status: string): number {
    switch (status) {
      case 'healthy':
        return 200;
      case 'degraded':
        return 200; // Still functional but with warnings
      case 'unhealthy':
        return 503; // Service unavailable
      default:
        return 500;
    }
  }
}

// Export handler function
const handler = new DetailedHealthHandler();

export const getDetailedHealth = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.getDetailedHealth(event);
EOF

echo "Created detailed health handler"
```

#### Step 19.3: Update CDK Stack for Detailed Health Endpoint
```bash
# Add detailed health endpoint to CDK stack
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Detailed health endpoint: GET /health/detailed
    const healthResource = api.root.getResource('health') || api.root.addResource('health');
    
    const detailedHealthFunction = new lambda.Function(this, 'DetailedHealthFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'health/DetailedHealthHandler.getDetailedHealth',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        S3_BUCKET_NAME: bucket.bucketName,
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET_NAME: jwtSecret.secretName,
        NODE_ENV: 'production'
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256
    });

    // Grant permissions for health checks
    usersTable.grantReadData(detailedHealthFunction);
    bucket.grantRead(detailedHealthFunction);
    jwtSecret.grantRead(detailedHealthFunction);
    
    // CloudWatch permissions
    detailedHealthFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:ListMetrics',
        'cloudwatch:PutMetricData'
      ],
      resources: ['*']
    }));

    const detailedResource = healthResource.addResource('detailed');
    detailedResource.addMethod('GET', new apigateway.LambdaIntegration(detailedHealthFunction), {
      // No authorizer for health endpoint
    });
EOF

echo "Updated CDK stack with detailed health endpoint"
```

#### Step 19.4: Update Service Factory
```bash
# Update ServiceFactory to include HealthService
cat >> backend/src/services/ServiceFactory.ts << 'EOF'
  
  createHealthService(): HealthService {
    return new HealthService(
      this.createDynamoDBService(),
      this.createCacheService(),
      this.createLogger()
    );
  }
EOF

# Import HealthService in ServiceFactory
sed -i '1i import { HealthService } from "./health/HealthService";' backend/src/services/ServiceFactory.ts

echo "Updated ServiceFactory with health service"
```

#### Step 19.5: Deploy and Test Detailed Health Monitoring
```bash
# Deploy the updated stack
npm run build
cdk deploy --require-approval never

# Test detailed health endpoint
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

echo "Testing Detailed Health Monitoring..."

# Test detailed health check (no auth required)
echo "1. Testing Detailed Health Check"
curl -X GET "$API_URL/api/v1/health/detailed" | jq '.'

# Test health check response format
echo "2. Testing Health Check Response Structure"
HEALTH_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/health/detailed")

# Validate required fields are present
echo $HEALTH_RESPONSE | jq '.data.status, .data.checks, .data.summary, .data.performance'

# Test health check performance
echo "3. Testing Health Check Performance"
time curl -s -X GET "$API_URL/api/v1/health/detailed" > /dev/null

# Test health check multiple times to verify consistency
echo "4. Testing Health Check Consistency"
for i in {1..3}; do
  echo "Check $i:"
  curl -s -X GET "$API_URL/api/v1/health/detailed" | jq '.data.status, .data.performance.responseTime'
  sleep 2
done

echo "Detailed health monitoring testing completed"
```

**Phase 19 Success Criteria**:
- ✅ Comprehensive infrastructure health checks (DynamoDB, Redis, S3, etc.)
- ✅ System resource monitoring (memory, disk, CPU)
- ✅ Performance metrics collection and reporting
- ✅ CloudWatch metrics integration for monitoring
- ✅ Proper HTTP status codes based on health status
- ✅ No authentication required for health endpoints
- ✅ Structured health response with detailed diagnostics
- ✅ Error handling and graceful degradation

### Phase 20: Session Completion
**Dependencies**: Phase 19 (Answer Submission)  
**Objective**: Complete study sessions and generate session analytics

#### Step 20.1: Create Session Completion Handler
```bash
# Create session completion handler
cat > backend/src/handlers/sessions/CompleteSessionHandler.ts << 'EOF'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../base/BaseHandler';
import { ServiceFactory } from '../../services/ServiceFactory';
import { SessionService } from '../../services/SessionService';
import { AnalyticsService } from '../../services/AnalyticsService';
import { StudySession } from '../../shared/types/session.types';
import { SessionAnalytics } from '../../shared/types/analytics.types';

export class CompleteSessionHandler extends BaseHandler {
  private sessionService: SessionService;
  private analyticsService: AnalyticsService;

  constructor() {
    super();
    const serviceFactory = ServiceFactory.getInstance();
    this.sessionService = serviceFactory.createSessionService();
    this.analyticsService = serviceFactory.createAnalyticsService();
  }

  async complete(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const { sessionId } = this.getPathParameters(event, ['sessionId']);
      const userId = this.getUserIdFromToken(event);
      
      // Validate session belongs to user and is in progress
      const session = await this.sessionService.getSession(sessionId, userId);
      if (!session) {
        throw this.createError('Session not found', 404);
      }
      
      if (session.status !== 'in_progress') {
        throw this.createError(`Cannot complete session with status: ${session.status}`, 400);
      }
      
      // Complete the session
      const completedSession = await this.sessionService.completeSession(sessionId, userId);
      
      // Generate session analytics
      const analytics = await this.analyticsService.generateSessionAnalytics(sessionId, userId);
      
      return this.success({
        session: completedSession,
        analytics: analytics
      }, 'Session completed successfully');
    });
  }
}

const handler = new CompleteSessionHandler();

export const complete = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.complete(event);
EOF

echo "Created session completion handler"
```

#### Step 20.2: Update Session Service with Completion Logic
```bash
# Add session completion methods to SessionService
cat >> backend/src/services/SessionService.ts << 'EOF'

  async completeSession(sessionId: string, userId: string): Promise<StudySession> {
    this.logger.info('Completing session', { sessionId, userId });

    try {
      const session = await this.getSession(sessionId, userId);
      if (!session) {
        throw this.createError('Session not found', 404);
      }
      
      if (session.status !== 'in_progress') {
        throw this.createError(`Session already ${session.status}`, 400);
      }
      
      // Calculate final session metrics
      const totalQuestions = session.answers.length;
      const correctAnswers = session.answers.filter(a => a.isCorrect).length;
      const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
      
      // Calculate time taken
      const startTime = new Date(session.startedAt).getTime();
      const endTime = Date.now();
      const totalTimeMs = endTime - startTime;
      
      // Update session with completion data
      const updateParams = {
        TableName: this.sessionsTable,
        Key: { sessionId, userId },
        UpdateExpression: `
          SET #status = :status,
              completedAt = :completedAt,
              totalQuestions = :totalQuestions,
              correctAnswers = :correctAnswers,
              accuracy = :accuracy,
              totalTimeMs = :totalTimeMs,
              updatedAt = :updatedAt
        `,
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'completed',
          ':completedAt': new Date().toISOString(),
          ':totalQuestions': totalQuestions,
          ':correctAnswers': correctAnswers,
          ':accuracy': accuracy,
          ':totalTimeMs': totalTimeMs,
          ':updatedAt': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      };
      
      const result = await this.dynamodb.update(updateParams);
      const completedSession = result.Attributes as StudySession;
      
      // Update user progress
      await this.updateUserProgress(userId, completedSession);
      
      // Clear session cache
      await this.cache.delete(`session:${sessionId}`);
      
      this.logger.info('Session completed successfully', {
        sessionId,
        userId,
        accuracy,
        totalQuestions,
        correctAnswers
      });
      
      return completedSession;
    } catch (error) {
      this.logger.error('Error completing session', error);
      throw error;
    }
  }
  
  private async updateUserProgress(userId: string, session: StudySession): Promise<void> {
    try {
      // Update progress for each provider/exam/topic combination
      const progressUpdates = new Map<string, any>();
      
      for (const answer of session.answers) {
        // Create progress keys for different dimensions
        const providerKey = `progress:${userId}:provider:${answer.questionMetadata.provider}`;
        const examKey = `progress:${userId}:exam:${answer.questionMetadata.examId}`;
        const topicKeys = answer.questionMetadata.topics.map(
          topic => `progress:${userId}:topic:${topic}`
        );
        
        // Aggregate progress data
        [providerKey, examKey, ...topicKeys].forEach(key => {
          if (!progressUpdates.has(key)) {
            progressUpdates.set(key, {
              totalQuestions: 0,
              correctAnswers: 0,
              sessions: new Set()
            });
          }
          
          const progress = progressUpdates.get(key);
          progress.totalQuestions += 1;
          if (answer.isCorrect) progress.correctAnswers += 1;
          progress.sessions.add(session.sessionId);
        });
      }
      
      // Batch update progress records
      const batchPromises = Array.from(progressUpdates.entries()).map(([key, data]) => {
        const [, userId, dimension, identifier] = key.split(':');
        
        return this.dynamodb.update({
          TableName: this.userProgressTable,
          Key: { userId, progressKey: `${dimension}:${identifier}` },
          UpdateExpression: `
            ADD totalQuestions :totalQ, correctAnswers :correctA, sessionCount :sessionC
            SET accuracy = (correctAnswers + :correctA) / (totalQuestions + :totalQ) * :hundred,
                lastStudiedAt = :now,
                updatedAt = :now
          `,
          ExpressionAttributeValues: {
            ':totalQ': data.totalQuestions,
            ':correctA': data.correctAnswers,
            ':sessionC': data.sessions.size,
            ':hundred': 100,
            ':now': new Date().toISOString()
          }
        });
      });
      
      await Promise.all(batchPromises);
      
    } catch (error) {
      this.logger.error('Error updating user progress', error);
      // Don't throw - progress update failure shouldn't fail session completion
    }
  }
EOF

echo "Updated SessionService with completion logic"
```

#### Step 20.3: Add Session Completion Route to CDK
```bash
# Add completion route to CDK stack
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Session completion endpoint
    const completeSessionFunction = new lambda.Function(this, 'CompleteSessionFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handlers/sessions/CompleteSessionHandler.complete',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512
    });
    
    // Grant DynamoDB permissions
    studySessionsTable.grantReadWriteData(completeSessionFunction);
    userProgressTable.grantReadWriteData(completeSessionFunction);
    
    // Add route
    const sessionsResource = apiV1.root.getResource('sessions');
    const sessionByIdResource = sessionsResource.getResource('{sessionId}');
    const completeResource = sessionByIdResource.addResource('complete');
    
    completeResource.addMethod('POST', new apigateway.LambdaIntegration(completeSessionFunction), {
      methodResponses: [{ statusCode: '200' }, { statusCode: '400' }, { statusCode: '404' }]
    });
EOF

echo "Added session completion route to CDK"
```

#### Step 20.4: Deploy and Test Session Completion
```bash
# Deploy the updated stack
npm run build
cdk deploy --require-approval never

# Test session completion
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

echo "Testing Session Completion..."

# Create and start a test session first
SESSION_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "aws",
    "exam": "saa-c03",
    "questionCount": 3
  }')

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.data.session.sessionId')
echo "Created test session: $SESSION_ID"

# Submit some test answers
echo "Submitting test answers..."
curl -s -X POST "$API_URL/api/v1/sessions/$SESSION_ID/answers" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "q1",
    "selectedAnswers": ["A"],
    "timeSpentMs": 30000
  }' > /dev/null

curl -s -X POST "$API_URL/api/v1/sessions/$SESSION_ID/answers" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "q2",
    "selectedAnswers": ["B"],
    "timeSpentMs": 25000
  }' > /dev/null

# Complete the session
echo "Completing session..."
COMPLETION_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/sessions/$SESSION_ID/complete")
echo $COMPLETION_RESPONSE | jq '.'

# Verify session is marked as completed
echo "Verifying session status..."
VERIFY_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/sessions/$SESSION_ID")
STATUS=$(echo $VERIFY_RESPONSE | jq -r '.data.session.status')
ACCURACY=$(echo $VERIFY_RESPONSE | jq -r '.data.session.accuracy')

echo "Session Status: $STATUS"
echo "Final Accuracy: $ACCURACY%"

# Test completing already completed session (should fail)
echo "Testing double completion (should fail)..."
ERROR_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/sessions/$SESSION_ID/complete")
echo $ERROR_RESPONSE | jq '.error.message'

echo "Session completion testing completed"
```

**Phase 20 Success Criteria**:
- ✅ Session completion handler implemented and working
- ✅ Final session metrics calculated (accuracy, time, questions answered)
- ✅ User progress updated across all dimensions (provider/exam/topic)
- ✅ Session status properly transitioned to 'completed'
- ✅ Session analytics generated and returned
- ✅ Proper validation prevents double completion
- ✅ Cache invalidation after completion
- ✅ Error handling for edge cases

### Phase 21: Data Upload System
**Dependencies**: Phase 20  
**Objective**: Implement S3 question data management system with validation and processing

#### Step 21.1: Create Data Upload Service
```bash
# Create data upload service directory
mkdir -p backend/src/services/upload
mkdir -p backend/src/types/upload

# Create upload types
cat > backend/src/types/upload/UploadTypes.ts << 'EOF'
export interface UploadRequest {
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadType: 'questions' | 'images' | 'documents';
  providerId?: string;
  examId?: string;
  topicId?: string;
  metadata?: Record<string, any>;
}

export interface UploadResponse {
  uploadId: string;
  uploadUrl: string;
  fileName: string;
  expiresAt: string;
  maxFileSize: number;
  allowedTypes: string[];
  fields: Record<string, string>;
}

export interface UploadStatus {
  uploadId: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  fileName: string;
  fileSize?: number;
  uploadedAt?: string;
  processedAt?: string;
  errorMessage?: string;
  progress?: {
    uploaded: number;
    total: number;
    percentage: number;
  };
  validation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recordCount?: number;
    validRecords?: number;
    invalidRecords?: number;
  };
}

export interface ProcessedData {
  uploadId: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicateRecords: number;
  summary: {
    providers: string[];
    exams: string[];
    topics: string[];
    difficulties: Record<string, number>;
  };
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  row: number;
  field: string;
  value: any;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  row: number;
  field: string;
  value: any;
  message: string;
}

export interface QuestionRecord {
  questionId: string;
  providerId: string;
  examId: string;
  topicId: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  metadata: Record<string, any>;
}
EOF

# Create data upload service
cat > backend/src/services/upload/DataUploadService.ts << 'EOF'
import { BaseService } from '../base/BaseService';
import { Logger } from '../../shared/utils/Logger';
import { DynamoDBService } from '../database/DynamoDBService';
import { CacheService } from '../cache/CacheService';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  UploadRequest,
  UploadResponse,
  UploadStatus,
  ProcessedData,
  ValidationError,
  QuestionRecord
} from '../../types/upload/UploadTypes';

export class DataUploadService extends BaseService {
  private dynamodb: DynamoDBService;
  private cache: CacheService;
  private logger: Logger;
  private s3: AWS.S3;
  private uploadsTable: string;
  private bucketName: string;

  constructor(
    dynamodb: DynamoDBService,
    cache: CacheService,
    logger: Logger
  ) {
    super();
    this.dynamodb = dynamodb;
    this.cache = cache;
    this.logger = logger;
    this.s3 = new AWS.S3();
    this.uploadsTable = process.env.UPLOADS_TABLE || 'StudyAppUploads';
    this.bucketName = process.env.S3_BUCKET_NAME!;
  }

  async createUpload(userId: string, request: UploadRequest): Promise<UploadResponse> {
    this.logger.info('Creating upload request', { userId, request });

    try {
      // Validate upload request
      this.validateUploadRequest(request);

      const uploadId = uuidv4();
      const key = `uploads/${uploadId}/${request.fileName}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      // Create presigned POST URL
      const presignedPost = this.s3.createPresignedPost({
        Bucket: this.bucketName,
        Key: key,
        Expires: 3600, // 1 hour
        Conditions: [
          ['content-length-range', 0, this.getMaxFileSize(request.uploadType)],
          ['starts-with', '$Content-Type', this.getAllowedContentType(request.uploadType)]
        ],
        Fields: {
          'x-amz-meta-upload-id': uploadId,
          'x-amz-meta-user-id': userId,
          'x-amz-meta-upload-type': request.uploadType
        }
      });

      // Store upload metadata
      const uploadRecord = {
        uploadId,
        userId,
        fileName: request.fileName,
        fileSize: request.fileSize,
        fileType: request.fileType,
        uploadType: request.uploadType,
        s3Key: key,
        status: 'pending',
        providerId: request.providerId,
        examId: request.examId,
        topicId: request.topicId,
        metadata: request.metadata,
        createdAt: new Date().toISOString(),
        expiresAt
      };

      await this.dynamodb.put({
        TableName: this.uploadsTable,
        Item: uploadRecord
      });

      const response: UploadResponse = {
        uploadId,
        uploadUrl: presignedPost.url,
        fileName: request.fileName,
        expiresAt,
        maxFileSize: this.getMaxFileSize(request.uploadType),
        allowedTypes: this.getAllowedFileTypes(request.uploadType),
        fields: presignedPost.fields
      };

      this.logger.info('Upload request created', { uploadId });
      return response;

    } catch (error) {
      this.logger.error('Error creating upload', error);
      throw this.createError('Failed to create upload', 500);
    }
  }

  async getUploadStatus(userId: string, uploadId: string): Promise<UploadStatus> {
    this.logger.info('Getting upload status', { userId, uploadId });

    try {
      const params = {
        TableName: this.uploadsTable,
        Key: { uploadId }
      };

      const result = await this.dynamodb.get(params);
      if (!result.Item) {
        throw this.createError('Upload not found', 404);
      }

      const upload = result.Item;

      // Verify user owns this upload
      if (upload.userId !== userId) {
        throw this.createError('Upload not found', 404);
      }

      // Check if file has been uploaded to S3
      if (upload.status === 'pending') {
        const fileExists = await this.checkS3FileExists(upload.s3Key);
        if (fileExists) {
          await this.updateUploadStatus(uploadId, 'processing');
          // Trigger processing
          await this.processUpload(uploadId);
          upload.status = 'processing';
        }
      }

      const status: UploadStatus = {
        uploadId: upload.uploadId,
        status: upload.status,
        fileName: upload.fileName,
        fileSize: upload.fileSize,
        uploadedAt: upload.uploadedAt,
        processedAt: upload.processedAt,
        errorMessage: upload.errorMessage,
        progress: upload.progress,
        validation: upload.validation
      };

      return status;

    } catch (error) {
      if (error.statusCode === 404) {
        throw error;
      }
      this.logger.error('Error getting upload status', error);
      throw this.createError('Failed to get upload status', 500);
    }
  }

  async processUpload(uploadId: string): Promise<void> {
    this.logger.info('Processing upload', { uploadId });

    try {
      const upload = await this.getUploadRecord(uploadId);
      
      if (upload.status !== 'processing') {
        await this.updateUploadStatus(uploadId, 'processing');
      }

      // Download file from S3
      const fileContent = await this.downloadFromS3(upload.s3Key);
      
      // Parse and validate data based on upload type
      let processedData: ProcessedData;
      
      switch (upload.uploadType) {
        case 'questions':
          processedData = await this.processQuestionData(uploadId, fileContent, upload);
          break;
        default:
          throw new Error(`Unsupported upload type: ${upload.uploadType}`);
      }

      // Update upload record with results
      await this.updateUploadResults(uploadId, processedData);

      this.logger.info('Upload processed successfully', { uploadId, processedData: processedData.summary });

    } catch (error) {
      this.logger.error('Error processing upload', error);
      await this.updateUploadStatus(uploadId, 'failed', error.message);
      throw error;
    }
  }

  private async processQuestionData(uploadId: string, fileContent: Buffer, upload: any): Promise<ProcessedData> {
    const data = JSON.parse(fileContent.toString());
    
    if (!Array.isArray(data)) {
      throw new Error('Question data must be an array');
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const validRecords: QuestionRecord[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    const providersSet = new Set<string>();
    const examsSet = new Set<string>();
    const topicsSet = new Set<string>();
    const difficultyCount: Record<string, number> = {
      beginner: 0,
      intermediate: 0,
      advanced: 0
    };

    // Validate each question record
    for (let i = 0; i < data.length; i++) {
      const row = i + 1;
      const record = data[i];

      try {
        const validatedRecord = this.validateQuestionRecord(record, row);
        
        // Check for duplicates
        const isDuplicate = await this.checkQuestionDuplicate(validatedRecord.questionId);
        if (isDuplicate) {
          duplicateCount++;
          warnings.push({
            row,
            field: 'questionId',
            value: validatedRecord.questionId,
            message: 'Question ID already exists - will be skipped'
          });
          continue;
        }

        validRecords.push(validatedRecord);
        validCount++;

        // Collect metadata
        providersSet.add(validatedRecord.providerId);
        examsSet.add(validatedRecord.examId);
        topicsSet.add(validatedRecord.topicId);
        difficultyCount[validatedRecord.difficulty]++;

      } catch (error) {
        invalidCount++;
        errors.push({
          row,
          field: 'record',
          value: record,
          message: error.message,
          severity: 'error'
        });
      }
    }

    // Store valid records
    await this.storeQuestionRecords(validRecords, uploadId);

    return {
      uploadId,
      totalRecords: data.length,
      validRecords: validCount,
      invalidRecords: invalidCount,
      duplicateRecords: duplicateCount,
      summary: {
        providers: Array.from(providersSet),
        exams: Array.from(examsSet),
        topics: Array.from(topicsSet),
        difficulties: difficultyCount
      },
      errors,
      warnings
    };
  }

  private validateQuestionRecord(record: any, row: number): QuestionRecord {
    const required = ['questionId', 'providerId', 'examId', 'topicId', 'questionText', 'options', 'correctAnswer'];
    
    for (const field of required) {
      if (!record[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!Array.isArray(record.options) || record.options.length < 2) {
      throw new Error('Options must be an array with at least 2 items');
    }

    if (typeof record.correctAnswer !== 'number' || record.correctAnswer < 0 || record.correctAnswer >= record.options.length) {
      throw new Error('correctAnswer must be a valid option index');
    }

    if (!['beginner', 'intermediate', 'advanced'].includes(record.difficulty)) {
      throw new Error('difficulty must be one of: beginner, intermediate, advanced');
    }

    return {
      questionId: record.questionId,
      providerId: record.providerId,
      examId: record.examId,
      topicId: record.topicId,
      questionText: record.questionText,
      options: record.options,
      correctAnswer: record.correctAnswer,
      explanation: record.explanation || '',
      difficulty: record.difficulty,
      tags: Array.isArray(record.tags) ? record.tags : [],
      metadata: record.metadata || {}
    };
  }

  private async checkQuestionDuplicate(questionId: string): Promise<boolean> {
    try {
      const result = await this.dynamodb.get({
        TableName: process.env.QUESTIONS_TABLE || 'StudyAppQuestions',
        Key: { questionId }
      });
      return !!result.Item;
    } catch (error) {
      // If table doesn't exist or other errors, assume not duplicate
      return false;
    }
  }

  private async storeQuestionRecords(records: QuestionRecord[], uploadId: string): Promise<void> {
    const questionsTable = process.env.QUESTIONS_TABLE || 'StudyAppQuestions';
    
    // Batch write records
    const batchSize = 25; // DynamoDB batch write limit
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const params = {
        RequestItems: {
          [questionsTable]: batch.map(record => ({
            PutRequest: {
              Item: {
                ...record,
                uploadId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            }
          }))
        }
      };

      await this.dynamodb.batchWrite(params);
    }
  }

  private validateUploadRequest(request: UploadRequest): void {
    const maxSize = this.getMaxFileSize(request.uploadType);
    if (request.fileSize > maxSize) {
      throw this.createError(`File size exceeds maximum allowed: ${maxSize} bytes`, 400);
    }

    const allowedTypes = this.getAllowedFileTypes(request.uploadType);
    if (!allowedTypes.includes(request.fileType)) {
      throw this.createError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`, 400);
    }

    if (request.uploadType === 'questions' && (!request.providerId || !request.examId)) {
      throw this.createError('providerId and examId are required for question uploads', 400);
    }
  }

  private getMaxFileSize(uploadType: string): number {
    switch (uploadType) {
      case 'questions':
        return 50 * 1024 * 1024; // 50MB
      case 'images':
        return 10 * 1024 * 1024; // 10MB
      case 'documents':
        return 25 * 1024 * 1024; // 25MB
      default:
        return 10 * 1024 * 1024; // 10MB
    }
  }

  private getAllowedFileTypes(uploadType: string): string[] {
    switch (uploadType) {
      case 'questions':
        return ['application/json', 'text/csv'];
      case 'images':
        return ['image/jpeg', 'image/png', 'image/gif'];
      case 'documents':
        return ['application/pdf', 'text/plain'];
      default:
        return ['application/json'];
    }
  }

  private getAllowedContentType(uploadType: string): string {
    switch (uploadType) {
      case 'questions':
        return 'application/';
      case 'images':
        return 'image/';
      case 'documents':
        return '';
      default:
        return '';
    }
  }

  private async checkS3FileExists(key: string): Promise<boolean> {
    try {
      await this.s3.headObject({ Bucket: this.bucketName, Key: key }).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async downloadFromS3(key: string): Promise<Buffer> {
    const result = await this.s3.getObject({ Bucket: this.bucketName, Key: key }).promise();
    return result.Body as Buffer;
  }

  private async getUploadRecord(uploadId: string): Promise<any> {
    const result = await this.dynamodb.get({
      TableName: this.uploadsTable,
      Key: { uploadId }
    });
    
    if (!result.Item) {
      throw this.createError('Upload not found', 404);
    }
    
    return result.Item;
  }

  private async updateUploadStatus(uploadId: string, status: string, errorMessage?: string): Promise<void> {
    const updateParams: any = {
      TableName: this.uploadsTable,
      Key: { uploadId },
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': status,
        ':now': new Date().toISOString()
      }
    };

    if (status === 'completed') {
      updateParams.UpdateExpression += ', processedAt = :now';
    }

    if (errorMessage) {
      updateParams.UpdateExpression += ', errorMessage = :error';
      updateParams.ExpressionAttributeValues[':error'] = errorMessage;
    }

    await this.dynamodb.update(updateParams);
  }

  private async updateUploadResults(uploadId: string, processedData: ProcessedData): Promise<void> {
    const params = {
      TableName: this.uploadsTable,
      Key: { uploadId },
      UpdateExpression: 'SET #status = :status, processedAt = :now, #validation = :validation, processedData = :data',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#validation': 'validation'
      },
      ExpressionAttributeValues: {
        ':status': processedData.errors.length > 0 ? 'failed' : 'completed',
        ':now': new Date().toISOString(),
        ':validation': {
          isValid: processedData.errors.length === 0,
          errors: processedData.errors.map(e => e.message),
          warnings: processedData.warnings.map(w => w.message),
          recordCount: processedData.totalRecords,
          validRecords: processedData.validRecords,
          invalidRecords: processedData.invalidRecords
        },
        ':data': processedData
      }
    };

    await this.dynamodb.update(params);
  }
}
EOF

echo "Created data upload service"
```

#### Step 21.2: Create Upload Handler
```bash
# Create upload handler
cat > backend/src/handlers/upload/UploadHandler.ts << 'EOF'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../base/BaseHandler';
import { ServiceFactory } from '../../services/ServiceFactory';
import { UploadRequest } from '../../types/upload/UploadTypes';

export class UploadHandler extends BaseHandler {
  private uploadService: any;

  constructor() {
    super();
    const serviceFactory = ServiceFactory.getInstance();
    this.uploadService = serviceFactory.createUploadService();
  }

  async createUpload(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const userId = this.getUserIdFromToken(event);
      const request = JSON.parse(event.body || '{}') as UploadRequest;
      
      const upload = await this.uploadService.createUpload(userId, request);
      
      return this.success(upload, 'Upload request created successfully');
    });
  }

  async getUploadStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const userId = this.getUserIdFromToken(event);
      const uploadId = event.pathParameters?.uploadId;
      
      if (!uploadId) {
        throw this.createError('Upload ID is required', 400);
      }
      
      const status = await this.uploadService.getUploadStatus(userId, uploadId);
      
      return this.success(status, 'Upload status retrieved successfully');
    });
  }

  async getUserUploads(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const userId = this.getUserIdFromToken(event);
      const uploadType = event.queryStringParameters?.uploadType;
      const status = event.queryStringParameters?.status;
      const limit = parseInt(event.queryStringParameters?.limit || '20');
      const offset = parseInt(event.queryStringParameters?.offset || '0');
      
      const uploads = await this.uploadService.getUserUploads(userId, {
        uploadType,
        status,
        limit,
        offset
      });
      
      return this.success(uploads, 'User uploads retrieved successfully');
    });
  }

  async processUpload(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const userId = this.getUserIdFromToken(event);
      const uploadId = event.pathParameters?.uploadId;
      
      if (!uploadId) {
        throw this.createError('Upload ID is required', 400);
      }
      
      // Verify user owns the upload
      await this.uploadService.getUploadStatus(userId, uploadId);
      
      // Trigger processing
      await this.uploadService.processUpload(uploadId);
      
      return this.success(null, 'Upload processing initiated');
    });
  }
}

// Export handler functions
const handler = new UploadHandler();

export const createUpload = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.createUpload(event);

export const getUploadStatus = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.getUploadStatus(event);

export const getUserUploads = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.getUserUploads(event);

export const processUpload = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.processUpload(event);
EOF

echo "Created upload handler"
```

#### Step 21.3: Update CDK Stack for Data Upload System
```bash
# Add upload endpoints and infrastructure to CDK stack
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Uploads table
    const uploadsTable = new dynamodb.Table(this, 'UploadsTable', {
      tableName: 'StudyAppUploads',
      partitionKey: { name: 'uploadId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'expiresAt'
    });

    // Add GSI for querying uploads by user
    uploadsTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // Upload endpoints
    const uploadResource = api.root.addResource('uploads');
    
    // Create upload: POST /uploads
    const createUploadFunction = new lambda.Function(this, 'CreateUploadFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'upload/UploadHandler.createUpload',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        UPLOADS_TABLE: uploadsTable.tableName,
        S3_BUCKET_NAME: bucket.bucketName,
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256
    });

    uploadsTable.grantReadWriteData(createUploadFunction);
    bucket.grantReadWrite(createUploadFunction);
    jwtSecret.grantRead(createUploadFunction);

    uploadResource.addMethod('POST', new apigateway.LambdaIntegration(createUploadFunction), {
      authorizer: jwtAuthorizer
    });

    // List user uploads: GET /uploads
    const getUserUploadsFunction = new lambda.Function(this, 'GetUserUploadsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'upload/UploadHandler.getUserUploads',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        UPLOADS_TABLE: uploadsTable.tableName,
        S3_BUCKET_NAME: bucket.bucketName,
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256
    });

    uploadsTable.grantReadData(getUserUploadsFunction);
    jwtSecret.grantRead(getUserUploadsFunction);

    uploadResource.addMethod('GET', new apigateway.LambdaIntegration(getUserUploadsFunction), {
      authorizer: jwtAuthorizer,
      requestParameters: {
        'method.request.querystring.uploadType': false,
        'method.request.querystring.status': false,
        'method.request.querystring.limit': false,
        'method.request.querystring.offset': false
      }
    });

    // Get upload status: GET /uploads/{uploadId}
    const uploadIdResource = uploadResource.addResource('{uploadId}');
    
    const getUploadStatusFunction = new lambda.Function(this, 'GetUploadStatusFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'upload/UploadHandler.getUploadStatus',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        UPLOADS_TABLE: uploadsTable.tableName,
        S3_BUCKET_NAME: bucket.bucketName,
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256
    });

    uploadsTable.grantReadData(getUploadStatusFunction);
    bucket.grantRead(getUploadStatusFunction);
    jwtSecret.grantRead(getUploadStatusFunction);

    uploadIdResource.addMethod('GET', new apigateway.LambdaIntegration(getUploadStatusFunction), {
      authorizer: jwtAuthorizer,
      requestParameters: {
        'method.request.path.uploadId': true
      }
    });

    // Process upload: POST /uploads/{uploadId}/process
    const processUploadFunction = new lambda.Function(this, 'ProcessUploadFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'upload/UploadHandler.processUpload',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        UPLOADS_TABLE: uploadsTable.tableName,
        QUESTIONS_TABLE: questionsTable.tableName,
        S3_BUCKET_NAME: bucket.bucketName,
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024
    });

    uploadsTable.grantReadWriteData(processUploadFunction);
    questionsTable.grantReadWriteData(processUploadFunction);
    bucket.grantReadWrite(processUploadFunction);
    jwtSecret.grantRead(processUploadFunction);

    const processResource = uploadIdResource.addResource('process');
    processResource.addMethod('POST', new apigateway.LambdaIntegration(processUploadFunction), {
      authorizer: jwtAuthorizer,
      requestParameters: {
        'method.request.path.uploadId': true
      }
    });
EOF

echo "Updated CDK stack with data upload system"
```

#### Step 21.4: Update Service Factory
```bash
# Update ServiceFactory to include UploadService
cat >> backend/src/services/ServiceFactory.ts << 'EOF'
  
  createUploadService(): DataUploadService {
    return new DataUploadService(
      this.createDynamoDBService(),
      this.createCacheService(),
      this.createLogger()
    );
  }
EOF

# Import DataUploadService in ServiceFactory
sed -i '1i import { DataUploadService } from "./upload/DataUploadService";' backend/src/services/ServiceFactory.ts

echo "Updated ServiceFactory with upload service"
```

#### Step 21.5: Deploy and Test Data Upload System
```bash
# Deploy the updated stack
npm run build
cdk deploy --require-approval never

# Test data upload system
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Login to get access token
TOKENS_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com", 
    "password": "password123"
  }')

ACCESS_TOKEN=$(echo $TOKENS_RESPONSE | jq -r '.data.tokens.accessToken')

echo "Testing Data Upload System..."

# Test create upload request
echo "1. Testing Create Upload Request"
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/uploads" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "aws-questions.json",
    "fileSize": 1024000,
    "fileType": "application/json",
    "uploadType": "questions",
    "providerId": "aws",
    "examId": "aws-saa",
    "topicId": "ec2",
    "metadata": {
      "description": "AWS SAA EC2 practice questions"
    }
  }')

echo $UPLOAD_RESPONSE | jq '.'
UPLOAD_ID=$(echo $UPLOAD_RESPONSE | jq -r '.data.uploadId')

# Test get upload status
echo "2. Testing Get Upload Status"
curl -s -X GET "$API_URL/api/v1/uploads/$UPLOAD_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test list user uploads
echo "3. Testing List User Uploads"
curl -s -X GET "$API_URL/api/v1/uploads?uploadType=questions&limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Create sample question data for testing
echo "4. Creating Sample Question Data"
cat > sample-questions.json << 'EOF'
[
  {
    "questionId": "q001",
    "providerId": "aws",
    "examId": "aws-saa",
    "topicId": "ec2",
    "questionText": "Which EC2 instance type is best for compute-intensive applications?",
    "options": [
      "T3 instances",
      "C5 instances", 
      "R5 instances",
      "I3 instances"
    ],
    "correctAnswer": 1,
    "explanation": "C5 instances are optimized for compute-intensive applications with high-performance processors.",
    "difficulty": "intermediate",
    "tags": ["compute", "instance-types"],
    "metadata": {
      "source": "official-docs"
    }
  },
  {
    "questionId": "q002",
    "providerId": "aws",
    "examId": "aws-saa",
    "topicId": "ec2",
    "questionText": "What is the maximum number of EBS volumes that can be attached to a single EC2 instance?",
    "options": [
      "10",
      "20",
      "27",
      "40"
    ],
    "correctAnswer": 2,
    "explanation": "An EC2 instance can have up to 27 EBS volumes attached (1 root + 26 additional).",
    "difficulty": "advanced",
    "tags": ["ebs", "storage"],
    "metadata": {
      "source": "aws-limits"
    }
  }
]
EOF

# Note: In a real scenario, you would upload this file using the presigned URL
# For testing, we'll simulate the file upload and processing

echo "5. Testing File Upload Validation"
curl -s -X POST "$API_URL/api/v1/uploads" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "invalid-file.txt",
    "fileSize": 999999999,
    "fileType": "text/plain",
    "uploadType": "questions",
    "providerId": "aws",
    "examId": "aws-saa"
  }' | jq '.'

# Test error cases
echo "6. Testing Upload Error Cases"
curl -s -X GET "$API_URL/api/v1/uploads/invalid-upload-id" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test unauthorized access
echo "7. Testing Unauthorized Access"
curl -s -X POST "$API_URL/api/v1/uploads" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'

echo "Data upload system testing completed"
```

**Phase 21 Success Criteria**:
- ✅ S3 presigned URL generation for secure file uploads
- ✅ File validation (size, type, format) before and after upload
- ✅ JSON question data parsing and validation
- ✅ Duplicate detection and handling
- ✅ Batch processing for large datasets
- ✅ Upload status tracking and progress reporting
- ✅ Error handling and detailed validation reports
- ✅ Integration with question management system

### Phase 22: Caching System
**Dependencies**: Phase 21  
**Objective**: Implement Redis caching for performance optimization across all services

#### Step 22.1: Enhanced Cache Service with Advanced Features
```bash
# Update existing cache service with advanced features
cat > backend/src/services/cache/AdvancedCacheService.ts << 'EOF'
import { BaseService } from '../base/BaseService';
import { Logger } from '../../shared/utils/Logger';
import Redis from 'ioredis';

interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  tags?: string[];
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keys: number;
  memory: string;
  connections: number;
}

export class AdvancedCacheService extends BaseService {
  private redis: Redis;
  private logger: Logger;
  private stats: { hits: number; misses: number } = { hits: 0, misses: 0 };

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.redis = new Redis({
      host: process.env.REDIS_ENDPOINT,
      port: 6379,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      // Connection pool settings
      family: 4,
      db: 0
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      this.logger.info('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.redis.on('ready', () => {
      this.logger.info('Redis ready for commands');
    });

    this.redis.on('reconnecting', () => {
      this.logger.info('Redis reconnecting...');
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(value);
      
    } catch (error) {
      this.logger.error('Cache get error', { key, error });
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, value: any, options?: CacheOptions): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const ttl = options?.ttl || 3600; // Default 1 hour

      if (options?.tags && options.tags.length > 0) {
        // Store key in tag sets for later invalidation
        const pipeline = this.redis.pipeline();
        pipeline.setex(key, ttl, serialized);
        
        for (const tag of options.tags) {
          pipeline.sadd(`tag:${tag}`, key);
          pipeline.expire(`tag:${tag}`, ttl + 300); // Tag expires slightly later
        }
        
        await pipeline.exec();
      } else {
        await this.redis.setex(key, ttl, serialized);
      }
      
    } catch (error) {
      this.logger.error('Cache set error', { key, error });
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (keys.length === 0) return [];
      
      const values = await this.redis.mget(...keys);
      
      return values.map((value, index) => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }
        
        this.stats.hits++;
        try {
          return JSON.parse(value);
        } catch (error) {
          this.logger.error('Cache parse error', { key: keys[index], error });
          this.stats.misses++;
          return null;
        }
      });
      
    } catch (error) {
      this.logger.error('Cache mget error', { keys, error });
      return keys.map(() => null);
    }
  }

  async mset(keyValues: Record<string, any>, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || 3600;
      const pipeline = this.redis.pipeline();
      
      for (const [key, value] of Object.entries(keyValues)) {
        const serialized = JSON.stringify(value);
        pipeline.setex(key, ttl, serialized);
      }
      
      await pipeline.exec();
      
    } catch (error) {
      this.logger.error('Cache mset error', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error('Cache delete error', { key, error });
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;
      
      const result = await this.redis.del(...keys);
      this.logger.info('Deleted keys by pattern', { pattern, count: result });
      return result;
      
    } catch (error) {
      this.logger.error('Cache delete pattern error', { pattern, error });
      return 0;
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    try {
      const keys = await this.redis.smembers(`tag:${tag}`);
      if (keys.length === 0) return 0;
      
      const pipeline = this.redis.pipeline();
      pipeline.del(...keys);
      pipeline.del(`tag:${tag}`);
      
      const results = await pipeline.exec();
      const deletedCount = results?.[0]?.[1] as number || 0;
      
      this.logger.info('Invalidated keys by tag', { tag, count: deletedCount });
      return deletedCount;
      
    } catch (error) {
      this.logger.error('Cache invalidate by tag error', { tag, error });
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error('Cache exists error', { key, error });
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.redis.expire(key, ttl);
    } catch (error) {
      this.logger.error('Cache expire error', { key, ttl, error });
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error('Cache TTL error', { key, error });
      return -1;
    }
  }

  async increment(key: string, by: number = 1, ttl?: number): Promise<number> {
    try {
      const pipeline = this.redis.pipeline();
      pipeline.incrby(key, by);
      
      if (ttl) {
        pipeline.expire(key, ttl);
      }
      
      const results = await pipeline.exec();
      return results?.[0]?.[1] as number || 0;
      
    } catch (error) {
      this.logger.error('Cache increment error', { key, by, error });
      return 0;
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      const clients = await this.redis.info('clients');
      
      // Parse memory info
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memory = memoryMatch ? memoryMatch[1] : 'unknown';
      
      // Parse keyspace info
      const keysMatch = keyspace.match(/keys=(\d+)/);
      const keys = keysMatch ? parseInt(keysMatch[1]) : 0;
      
      // Parse client connections
      const connectionsMatch = clients.match(/connected_clients:(\d+)/);
      const connections = connectionsMatch ? parseInt(connectionsMatch[1]) : 0;
      
      const total = this.stats.hits + this.stats.misses;
      const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
      
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        keys,
        memory,
        connections
      };
      
    } catch (error) {
      this.logger.error('Error getting cache stats', error);
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: 0,
        keys: 0,
        memory: 'unknown',
        connections: 0
      };
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Cache ping error', error);
      return false;
    }
  }

  async flushAll(): Promise<void> {
    try {
      await this.redis.flushall();
      this.stats = { hits: 0, misses: 0 };
      this.logger.info('Cache flushed successfully');
    } catch (error) {
      this.logger.error('Cache flush error', error);
    }
  }

  // Utility method for cache-aside pattern
  async remember<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    options?: CacheOptions
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Not in cache, fetch data
      const data = await fetcher();
      
      // Store in cache
      await this.set(key, data, options);
      
      return data;
      
    } catch (error) {
      this.logger.error('Cache remember error', { key, error });
      // If cache fails, at least return the fetched data
      return await fetcher();
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      this.logger.info('Redis connection closed');
    } catch (error) {
      this.logger.error('Error closing Redis connection', error);
    }
  }
}
EOF

echo "Created advanced cache service"
```

#### Step 22.2: Cache Implementation Across Services
```bash
# Update providers service with caching
cat > backend/src/services/providers/CachedProvidersService.ts << 'EOF'
import { ProvidersService } from './ProvidersService';
import { AdvancedCacheService } from '../cache/AdvancedCacheService';
import { Logger } from '../../shared/utils/Logger';

export class CachedProvidersService extends ProvidersService {
  private cache: AdvancedCacheService;

  constructor(
    dynamodb: any,
    s3: any,
    logger: Logger,
    cache: AdvancedCacheService
  ) {
    super(dynamodb, s3, logger);
    this.cache = cache;
  }

  async getProviders(request: any): Promise<any> {
    const cacheKey = `providers:list:${JSON.stringify(request)}`;
    
    return await this.cache.remember(
      cacheKey,
      () => super.getProviders(request),
      {
        ttl: 1800, // 30 minutes
        tags: ['providers', 'provider-list']
      }
    );
  }

  async getProviderDetails(providerId: string): Promise<any> {
    const cacheKey = `provider:${providerId}`;
    
    return await this.cache.remember(
      cacheKey,
      () => super.getProviderDetails(providerId),
      {
        ttl: 3600, // 1 hour
        tags: ['providers', `provider-${providerId}`]
      }
    );
  }

  // Cache invalidation methods
  async invalidateProviderCache(providerId?: string): Promise<void> {
    if (providerId) {
      await this.cache.invalidateByTag(`provider-${providerId}`);
    } else {
      await this.cache.invalidateByTag('providers');
    }
  }
}
EOF

# Update questions service with caching
cat > backend/src/services/questions/CachedQuestionService.ts << 'EOF'
import { QuestionService } from './QuestionService';
import { AdvancedCacheService } from '../cache/AdvancedCacheService';
import { Logger } from '../../shared/utils/Logger';

export class CachedQuestionService extends QuestionService {
  private cache: AdvancedCacheService;

  constructor(
    dynamodb: any,
    s3: any,
    logger: Logger,
    cache: AdvancedCacheService
  ) {
    super(dynamodb, s3, logger);
    this.cache = cache;
  }

  async getQuestions(request: any): Promise<any> {
    const cacheKey = `questions:list:${JSON.stringify(request)}`;
    
    return await this.cache.remember(
      cacheKey,
      () => super.getQuestions(request),
      {
        ttl: 900, // 15 minutes
        tags: ['questions', 'question-list', `provider-${request.providerId}`]
      }
    );
  }

  async getQuestionById(questionId: string): Promise<any> {
    const cacheKey = `question:${questionId}`;
    
    return await this.cache.remember(
      cacheKey,
      () => super.getQuestionById(questionId),
      {
        ttl: 3600, // 1 hour
        tags: ['questions', `question-${questionId}`]
      }
    );
  }

  async searchQuestions(request: any): Promise<any> {
    // Search results are more dynamic, shorter cache time
    const cacheKey = `questions:search:${JSON.stringify(request)}`;
    
    return await this.cache.remember(
      cacheKey,
      () => super.searchQuestions(request),
      {
        ttl: 300, // 5 minutes
        tags: ['questions', 'question-search']
      }
    );
  }

  async invalidateQuestionCache(questionId?: string, providerId?: string): Promise<void> {
    const tagsToInvalidate = ['questions'];
    
    if (questionId) {
      tagsToInvalidate.push(`question-${questionId}`);
    }
    
    if (providerId) {
      tagsToInvalidate.push(`provider-${providerId}`);
    }

    for (const tag of tagsToInvalidate) {
      await this.cache.invalidateByTag(tag);
    }
  }
}
EOF

echo "Created cached service implementations"
```

#### Step 22.3: Cache Management Handler
```bash
# Create cache management handler
cat > backend/src/handlers/cache/CacheHandler.ts << 'EOF'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../base/BaseHandler';
import { ServiceFactory } from '../../services/ServiceFactory';

export class CacheHandler extends BaseHandler {
  private cacheService: any;

  constructor() {
    super();
    const serviceFactory = ServiceFactory.getInstance();
    this.cacheService = serviceFactory.createAdvancedCacheService();
  }

  async getCacheStats(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const stats = await this.cacheService.getStats();
      return this.success(stats, 'Cache statistics retrieved successfully');
    });
  }

  async clearCache(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const pattern = event.queryStringParameters?.pattern;
      const tag = event.queryStringParameters?.tag;
      
      let clearedCount = 0;
      
      if (tag) {
        clearedCount = await this.cacheService.invalidateByTag(tag);
      } else if (pattern) {
        clearedCount = await this.cacheService.deletePattern(pattern);
      } else {
        await this.cacheService.flushAll();
        clearedCount = -1; // Indicates full flush
      }
      
      const message = clearedCount === -1 ? 
        'All cache cleared' : 
        `Cleared ${clearedCount} cache entries`;
        
      return this.success({ clearedCount }, message);
    });
  }

  async warmupCache(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const type = event.queryStringParameters?.type || 'all';
      
      let warmedCount = 0;
      
      switch (type) {
        case 'providers':
          warmedCount = await this.warmupProviders();
          break;
        case 'questions':
          warmedCount = await this.warmupQuestions();
          break;
        case 'all':
          warmedCount = await this.warmupProviders() + await this.warmupQuestions();
          break;
      }
      
      return this.success({ warmedCount }, `Cache warmed up with ${warmedCount} entries`);
    });
  }

  async healthCheck(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, async () => {
      const isHealthy = await this.cacheService.ping();
      const stats = await this.cacheService.getStats();
      
      return {
        statusCode: isHealthy ? 200 : 503,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: isHealthy,
          data: {
            healthy: isHealthy,
            stats
          },
          message: isHealthy ? 'Cache is healthy' : 'Cache is not responding',
          timestamp: new Date().toISOString()
        })
      };
    });
  }

  private async warmupProviders(): Promise<number> {
    try {
      const providersService = ServiceFactory.getInstance().createProvidersService();
      
      // Warm up provider list
      await providersService.getProviders({ limit: 50, offset: 0 });
      
      // Warm up individual providers
      const commonProviders = ['aws', 'azure', 'gcp'];
      for (const providerId of commonProviders) {
        try {
          await providersService.getProviderDetails(providerId);
        } catch (error) {
          // Ignore errors for non-existent providers
        }
      }
      
      return commonProviders.length + 1;
      
    } catch (error) {
      this.logger.error('Error warming up providers cache', error);
      return 0;
    }
  }

  private async warmupQuestions(): Promise<number> {
    try {
      const questionService = ServiceFactory.getInstance().createQuestionService();
      
      // Warm up question lists for common filters
      const commonFilters = [
        { limit: 20, difficulty: 'beginner' },
        { limit: 20, difficulty: 'intermediate' },
        { limit: 20, difficulty: 'advanced' },
        { limit: 20, providerId: 'aws' },
        { limit: 20, providerId: 'azure' }
      ];
      
      for (const filter of commonFilters) {
        try {
          await questionService.getQuestions(filter);
        } catch (error) {
          // Ignore errors
        }
      }
      
      return commonFilters.length;
      
    } catch (error) {
      this.logger.error('Error warming up questions cache', error);
      return 0;
    }
  }
}

// Export handler functions
const handler = new CacheHandler();

export const getCacheStats = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.getCacheStats(event);

export const clearCache = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.clearCache(event);

export const warmupCache = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.warmupCache(event);

export const healthCheck = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  handler.healthCheck(event);
EOF

echo "Created cache management handler"
```

#### Step 22.4: Update CDK Stack for Cache Management
```bash
# Add cache management endpoints to CDK stack
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Cache management endpoints
    const cacheResource = api.root.addResource('cache');
    
    // Cache stats: GET /cache/stats
    const cacheStatsFunction = new lambda.Function(this, 'CacheStatsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'cache/CacheHandler.getCacheStats',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256
    });

    jwtSecret.grantRead(cacheStatsFunction);

    const statsResource = cacheResource.addResource('stats');
    statsResource.addMethod('GET', new apigateway.LambdaIntegration(cacheStatsFunction), {
      authorizer: jwtAuthorizer
    });

    // Clear cache: DELETE /cache
    const clearCacheFunction = new lambda.Function(this, 'ClearCacheFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'cache/CacheHandler.clearCache',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.seconds(60),
      memorySize: 256
    });

    jwtSecret.grantRead(clearCacheFunction);

    cacheResource.addMethod('DELETE', new apigateway.LambdaIntegration(clearCacheFunction), {
      authorizer: jwtAuthorizer,
      requestParameters: {
        'method.request.querystring.pattern': false,
        'method.request.querystring.tag': false
      }
    });

    // Cache warmup: POST /cache/warmup
    const warmupCacheFunction = new lambda.Function(this, 'WarmupCacheFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'cache/CacheHandler.warmupCache',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        S3_BUCKET_NAME: bucket.bucketName,
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress,
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap()
      },
      timeout: cdk.Duration.minutes(2),
      memorySize: 512
    });

    bucket.grantRead(warmupCacheFunction);
    jwtSecret.grantRead(warmupCacheFunction);

    const warmupResource = cacheResource.addResource('warmup');
    warmupResource.addMethod('POST', new apigateway.LambdaIntegration(warmupCacheFunction), {
      authorizer: jwtAuthorizer,
      requestParameters: {
        'method.request.querystring.type': false
      }
    });

    // Cache health: GET /cache/health
    const cacheHealthFunction = new lambda.Function(this, 'CacheHealthFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'cache/CacheHandler.healthCheck',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        REDIS_ENDPOINT: redis.attrRedisEndpointAddress
      },
      timeout: cdk.Duration.seconds(15),
      memorySize: 256
    });

    const healthResource = cacheResource.addResource('health');
    healthResource.addMethod('GET', new apigateway.LambdaIntegration(cacheHealthFunction), {
      // No auth required for health check
    });
EOF

echo "Updated CDK stack with cache management endpoints"
```

#### Step 22.5: Deploy and Test Caching System
```bash
# Deploy the updated stack
npm run build
cdk deploy --require-approval never

# Test caching system
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Login to get access token
TOKENS_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com", 
    "password": "password123"
  }')

ACCESS_TOKEN=$(echo $TOKENS_RESPONSE | jq -r '.data.tokens.accessToken')

echo "Testing Caching System..."

# Test cache health
echo "1. Testing Cache Health"
curl -s -X GET "$API_URL/api/v1/cache/health" | jq '.'

# Test cache stats
echo "2. Testing Cache Statistics"
curl -s -X GET "$API_URL/api/v1/cache/stats" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test cache warmup
echo "3. Testing Cache Warmup"
curl -s -X POST "$API_URL/api/v1/cache/warmup?type=providers" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test API performance with cold cache
echo "4. Testing API Performance (Cold Cache)"
time curl -s -X GET "$API_URL/api/v1/providers" \
  -H "Authorization: Bearer $ACCESS_TOKEN" > /dev/null

# Test API performance with warm cache
echo "5. Testing API Performance (Warm Cache)"
time curl -s -X GET "$API_URL/api/v1/providers" \
  -H "Authorization: Bearer $ACCESS_TOKEN" > /dev/null

# Test cache invalidation by tag
echo "6. Testing Cache Invalidation by Tag"
curl -s -X DELETE "$API_URL/api/v1/cache?tag=providers" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test cache invalidation by pattern
echo "7. Testing Cache Invalidation by Pattern"
curl -s -X DELETE "$API_URL/api/v1/cache?pattern=provider:*" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test cache stats after operations
echo "8. Testing Cache Statistics After Operations"
curl -s -X GET "$API_URL/api/v1/cache/stats" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

echo "Caching system testing completed"
```

**Phase 22 Success Criteria**:
- ✅ Advanced Redis caching with connection pooling and retry logic
- ✅ Cache-aside pattern implementation for all major services
- ✅ Tag-based cache invalidation for precise cache management
- ✅ Cache statistics and monitoring capabilities
- ✅ Cache warmup functionality for improved performance
- ✅ Hit/miss ratio tracking and performance metrics
- ✅ Error handling and fallback mechanisms
- ✅ Cache health monitoring and diagnostics

## 🧪 Testing Strategy

### Unit Testing Requirements
- **Coverage**: 90% minimum code coverage for service layer
- **Mocking**: Repository and external service mocking
- **Test Data**: Comprehensive test fixtures for all domains
- **Validation**: Business logic validation testing

### Integration Testing Requirements  
- **API Testing**: Complete endpoint testing with authentication
- **Database Testing**: DynamoDB integration with test data
- **Storage Testing**: S3 operations with test buckets
- **Cache Testing**: Redis integration testing
- **End-to-End**: Complete user journey testing

### Performance Testing Requirements
- **Load Testing**: Concurrent user simulation
- **Stress Testing**: Breaking point identification
- **Memory Testing**: Lambda memory usage monitoring
- **Response Time**: API response time validation

## 📊 Success Metrics

### Functional Completeness Targets
- 29/29 API endpoints implemented and tested
- All business requirements satisfied  
- Complete clean architecture implementation
- Zero critical bugs in production

### Performance Targets  
- API response time < 500ms (95th percentile)
- Lambda cold start < 1000ms
- Cache hit rate > 80%
- DynamoDB read/write under 10ms

### Quality Standards Targets
- 90% unit test coverage achieved
- Zero critical security vulnerabilities
- SOLID principles compliance verified  
- Clean architecture patterns enforced
- Zero code duplication via shared patterns

## 🚀 Deployment Strategy

### Environment Progression
1. **Development**: Local development and testing
2. **Staging**: Pre-production validation environment  
3. **Production**: Live system with monitoring

### CI/CD Pipeline Requirements
- Automated testing on code changes
- CDK infrastructure deployment
- Lambda function deployment
- Database migration handling
- Rollback capability for failures

## ⚠️ CRITICAL ALIGNMENT ISSUES IDENTIFIED

**Based on alignment review with project summaries, the following critical issues must be addressed:**

### Missing Business Entities (4 of 10)
- **❌ Answer Entity Management**: No dedicated Answer CRUD endpoints
- **❌ UserProgress Entity**: Missing dedicated progress tracking system  
- **❌ Analytics Entity**: No computed analytics persistence
- **❌ Topic-Question Relationships**: Missing many-to-many mapping endpoints

### Missing Advanced Features
- **❌ Cross-Provider Analytics**: No skill transferability mapping
- **❌ Adaptive Learning Algorithm**: Algorithm not specified in adaptive sessions
- **❌ Search Relevance Algorithm**: No relevance scoring methodology
- **❌ Question File Validation**: No JSON schema validation system

### Required Additional Phases (26-30)
These phases address critical gaps identified in the alignment review and are required for full business requirements compliance.

---

### Phase 26: UserProgress Management System
**Dependencies**: Phase 16 (Session completion)  
**Objective**: Implement dedicated UserProgress entity management for comprehensive progress tracking

#### Step 26.1: Create UserProgress Types
Create `backend/src/shared/types/progress.types.ts`:
```bash
cat > backend/src/shared/types/progress.types.ts << 'EOF'
export interface UserProgress {
  progressId: string;
  userId: string;
  providerId: string;
  examId?: string;
  topicId?: string;
  progressKey: string; // Format: provider#exam#topic or provider#exam or provider
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  skippedQuestions: number;
  averageScore: number;
  bestScore: number;
  totalTimeSpent: number; // in minutes
  sessionCount: number;
  lastStudied: string;
  createdAt: string;
  updatedAt: string;
  masteryLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  streakCount: number;
  weakTopics: string[];
  strongTopics: string[];
}

export interface CreateProgressRequest {
  providerId: string;
  examId?: string;
  topicId?: string;
}

export interface UpdateProgressRequest {
  sessionResults: {
    questionsAnswered: number;
    correctAnswers: number;
    timeSpent: number;
    score: number;
  };
}

export interface ProgressFilters {
  providerId?: string;
  examId?: string;
  topicId?: string;
  masteryLevel?: string;
  timeframe?: 'week' | 'month' | 'quarter' | 'year';
}
EOF
```

#### Step 26.2: Create UserProgress Repository
Create `backend/src/repositories/progress.repository.ts`:
```bash
cat > backend/src/repositories/progress.repository.ts << 'EOF'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { UserProgress, CreateProgressRequest } from '../shared/types/progress.types';
import { v4 as uuidv4 } from 'uuid';

export class ProgressRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(dynamoClient: DynamoDBClient) {
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.PROGRESS_TABLE_NAME!;
  }

  async create(userId: string, progressData: CreateProgressRequest): Promise<UserProgress> {
    const progressKey = this.generateProgressKey(
      progressData.providerId, 
      progressData.examId, 
      progressData.topicId
    );

    const progress: UserProgress = {
      progressId: uuidv4(),
      userId,
      providerId: progressData.providerId,
      examId: progressData.examId,
      topicId: progressData.topicId,
      progressKey,
      totalQuestions: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      skippedQuestions: 0,
      averageScore: 0,
      bestScore: 0,
      totalTimeSpent: 0,
      sessionCount: 0,
      lastStudied: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      masteryLevel: 'beginner',
      streakCount: 0,
      weakTopics: [],
      strongTopics: []
    };

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: progress,
      ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(progressKey)'
    }));

    return progress;
  }

  async findByUser(userId: string): Promise<UserProgress[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }));

    return result.Items as UserProgress[] || [];
  }

  async findByUserAndKey(userId: string, progressKey: string): Promise<UserProgress | null> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { userId, progressKey }
    }));

    return result.Item as UserProgress || null;
  }

  async updateProgress(userId: string, progressKey: string, sessionResults: any): Promise<UserProgress> {
    const existing = await this.findByUserAndKey(userId, progressKey);
    if (!existing) {
      throw new Error('Progress record not found');
    }

    const newTotalQuestions = existing.totalQuestions + sessionResults.questionsAnswered;
    const newCorrectAnswers = existing.correctAnswers + sessionResults.correctAnswers;
    const newAverageScore = newTotalQuestions > 0 ? (newCorrectAnswers / newTotalQuestions) * 100 : 0;
    const newBestScore = Math.max(existing.bestScore, sessionResults.score);
    const newMasteryLevel = this.calculateMasteryLevel(newAverageScore, existing.sessionCount + 1);

    const updateExpression = `SET 
      totalQuestions = :totalQuestions,
      correctAnswers = :correctAnswers,
      incorrectAnswers = :incorrectAnswers,
      averageScore = :averageScore,
      bestScore = :bestScore,
      totalTimeSpent = :totalTimeSpent,
      sessionCount = :sessionCount,
      lastStudied = :lastStudied,
      updatedAt = :updatedAt,
      masteryLevel = :masteryLevel`;

    await this.docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { userId, progressKey },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: {
        ':totalQuestions': newTotalQuestions,
        ':correctAnswers': newCorrectAnswers,
        ':incorrectAnswers': existing.incorrectAnswers + (sessionResults.questionsAnswered - sessionResults.correctAnswers),
        ':averageScore': newAverageScore,
        ':bestScore': newBestScore,
        ':totalTimeSpent': existing.totalTimeSpent + sessionResults.timeSpent,
        ':sessionCount': existing.sessionCount + 1,
        ':lastStudied': new Date().toISOString(),
        ':updatedAt': new Date().toISOString(),
        ':masteryLevel': newMasteryLevel
      }
    }));

    return await this.findByUserAndKey(userId, progressKey) as UserProgress;
  }

  private generateProgressKey(providerId: string, examId?: string, topicId?: string): string {
    if (topicId) return `${providerId}#${examId}#${topicId}`;
    if (examId) return `${providerId}#${examId}`;
    return providerId;
  }

  private calculateMasteryLevel(averageScore: number, sessionCount: number): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
    if (averageScore >= 90 && sessionCount >= 10) return 'expert';
    if (averageScore >= 80 && sessionCount >= 5) return 'advanced';
    if (averageScore >= 70 && sessionCount >= 3) return 'intermediate';
    return 'beginner';
  }
}
EOF
```

#### Step 26.3: Create Progress Service
Create `backend/src/services/progress.service.ts`:
```bash
cat > backend/src/services/progress.service.ts << 'EOF'
import { ProgressRepository } from '../repositories/progress.repository';
import { UserProgress, CreateProgressRequest, UpdateProgressRequest, ProgressFilters } from '../shared/types/progress.types';

export class ProgressService {
  constructor(private progressRepository: ProgressRepository) {}

  async createProgress(userId: string, progressData: CreateProgressRequest): Promise<UserProgress> {
    // Check if progress already exists
    const progressKey = this.generateProgressKey(
      progressData.providerId, 
      progressData.examId, 
      progressData.topicId
    );
    
    const existing = await this.progressRepository.findByUserAndKey(userId, progressKey);
    if (existing) {
      throw new Error('Progress record already exists for this combination');
    }

    return await this.progressRepository.create(userId, progressData);
  }

  async getUserProgress(userId: string, filters?: ProgressFilters): Promise<UserProgress[]> {
    const allProgress = await this.progressRepository.findByUser(userId);
    
    if (!filters) return allProgress;

    return allProgress.filter(progress => {
      if (filters.providerId && progress.providerId !== filters.providerId) return false;
      if (filters.examId && progress.examId !== filters.examId) return false;
      if (filters.topicId && progress.topicId !== filters.topicId) return false;
      if (filters.masteryLevel && progress.masteryLevel !== filters.masteryLevel) return false;
      
      if (filters.timeframe) {
        const cutoffDate = this.getTimeframeCutoff(filters.timeframe);
        if (new Date(progress.lastStudied) < cutoffDate) return false;
      }
      
      return true;
    });
  }

  async updateSessionProgress(userId: string, providerId: string, examId: string, topicId: string, sessionResults: UpdateProgressRequest): Promise<UserProgress> {
    const progressKey = this.generateProgressKey(providerId, examId, topicId);
    
    let progress = await this.progressRepository.findByUserAndKey(userId, progressKey);
    if (!progress) {
      // Create new progress record if it doesn't exist
      await this.createProgress(userId, { providerId, examId, topicId });
    }

    return await this.progressRepository.updateProgress(userId, progressKey, sessionResults.sessionResults);
  }

  async getProgressSummary(userId: string): Promise<any> {
    const allProgress = await this.progressRepository.findByUser(userId);
    
    const summary = {
      totalProviders: new Set(allProgress.map(p => p.providerId)).size,
      totalExams: new Set(allProgress.filter(p => p.examId).map(p => p.examId)).size,
      totalQuestionsAnswered: allProgress.reduce((sum, p) => sum + p.totalQuestions, 0),
      overallAccuracy: this.calculateOverallAccuracy(allProgress),
      masteryDistribution: this.getMasteryDistribution(allProgress),
      recentActivity: allProgress
        .filter(p => this.isRecentActivity(p.lastStudied))
        .length,
      totalTimeSpent: allProgress.reduce((sum, p) => sum + p.totalTimeSpent, 0)
    };

    return summary;
  }

  private generateProgressKey(providerId: string, examId?: string, topicId?: string): string {
    if (topicId) return `${providerId}#${examId}#${topicId}`;
    if (examId) return `${providerId}#${examId}`;
    return providerId;
  }

  private getTimeframeCutoff(timeframe: string): Date {
    const now = new Date();
    switch (timeframe) {
      case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'quarter': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case 'year': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default: return new Date(0);
    }
  }

  private calculateOverallAccuracy(progress: UserProgress[]): number {
    const totalQuestions = progress.reduce((sum, p) => sum + p.totalQuestions, 0);
    const totalCorrect = progress.reduce((sum, p) => sum + p.correctAnswers, 0);
    return totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
  }

  private getMasteryDistribution(progress: UserProgress[]): Record<string, number> {
    const distribution = { beginner: 0, intermediate: 0, advanced: 0, expert: 0 };
    progress.forEach(p => distribution[p.masteryLevel]++);
    return distribution;
  }

  private isRecentActivity(lastStudied: string): boolean {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return new Date(lastStudied) > sevenDaysAgo;
  }
}
EOF
```

#### Step 26.4: Create Progress Handler
Create `backend/src/handlers/progress.ts`:
```bash
cat > backend/src/handlers/progress.ts << 'EOF'
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { ServiceFactory } from '../shared/service-factory';
import { ProgressService } from '../services/progress.service';
import { CreateProgressRequest, ProgressFilters } from '../shared/types/progress.types';

class ProgressHandler extends BaseHandler {
  protected handlerName = 'ProgressHandler';
  private progressService: ProgressService;

  constructor() {
    super();
    const progressRepository = ServiceFactory.getProgressRepository();
    this.progressService = new ProgressService(progressRepository);
  }

  public async getUserProgress(event: APIGatewayProxyEvent, userId: string, context: Context) {
    try {
      const filters: ProgressFilters = {
        providerId: event.queryStringParameters?.provider || undefined,
        examId: event.queryStringParameters?.exam || undefined,
        topicId: event.queryStringParameters?.topic || undefined,
        masteryLevel: event.queryStringParameters?.mastery || undefined,
        timeframe: event.queryStringParameters?.timeframe as any || undefined
      };

      const progress = await this.progressService.getUserProgress(userId, filters);
      return this.success(progress, 'User progress retrieved successfully');
    } catch (error: any) {
      console.error('Get progress error:', error);
      return this.error('Failed to retrieve user progress', 500, 'PROGRESS_RETRIEVAL_ERROR');
    }
  }

  public async createProgress(event: APIGatewayProxyEvent, userId: string, context: Context) {
    try {
      const progressData = this.parseRequest<CreateProgressRequest>(event.body);
      
      if (!progressData.providerId) {
        return this.error('Provider ID is required', 400, 'VALIDATION_ERROR');
      }

      const result = await this.progressService.createProgress(userId, progressData);
      return this.success(result, 'Progress record created successfully', 201);
    } catch (error: any) {
      console.error('Create progress error:', error);
      
      if (error.message.includes('already exists')) {
        return this.error(error.message, 409, 'PROGRESS_EXISTS');
      }
      
      return this.error('Failed to create progress record', 500, 'PROGRESS_CREATION_ERROR');
    }
  }

  public async getProgressSummary(event: APIGatewayProxyEvent, userId: string, context: Context) {
    try {
      const summary = await this.progressService.getProgressSummary(userId);
      return this.success(summary, 'Progress summary retrieved successfully');
    } catch (error: any) {
      console.error('Get progress summary error:', error);
      return this.error('Failed to retrieve progress summary', 500, 'PROGRESS_SUMMARY_ERROR');
    }
  }
}

const progressHandler = new ProgressHandler();

export const getUserProgress = progressHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string, context: Context) => 
    progressHandler.getUserProgress(event, userId, context)
);

export const createProgress = progressHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string, context: Context) => 
    progressHandler.createProgress(event, userId, context)
);

export const getProgressSummary = progressHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string, context: Context) => 
    progressHandler.getProgressSummary(event, userId, context)
);
EOF
```

#### Step 26.5: Update Service Factory
Edit `backend/src/shared/service-factory.ts`:
```bash
cat >> backend/src/shared/service-factory.ts << 'EOF'

import { ProgressRepository } from '../repositories/progress.repository';

export class ServiceFactory {
  private static progressRepository: ProgressRepository;

  static getProgressRepository(): ProgressRepository {
    if (!this.progressRepository) {
      this.progressRepository = new ProgressRepository(this.getDynamoClient());
    }
    return this.progressRepository;
  }
}
EOF
```

#### Step 26.6: Update API Gateway and Deploy
```bash
# Add progress endpoints to API Gateway
# Update main stack to include progress Lambda functions
# Deploy and test all progress endpoints

cd lambda
npm run build
cd ..
cdk deploy --context stage=dev --require-approval never

# Test progress endpoints
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Test create progress
curl -X POST "$API_URL/api/v1/progress" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"providerId": "aws", "examId": "saa-c03"}'

# Test get progress
curl -X GET "$API_URL/api/v1/progress" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test progress summary
curl -X GET "$API_URL/api/v1/progress/summary" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Criteria**:
- ✅ UserProgress entity fully implemented with CRUD operations
- ✅ Progress tracking across providers/exams/topics
- ✅ Mastery level calculation based on performance
- ✅ Progress summary with comprehensive statistics
- ✅ Time-based filtering and analytics

---

### Phase 27: Answer Analytics System
**Dependencies**: Phase 26 (UserProgress)  
**Objective**: Implement Answer entity management for comprehensive answer analytics and pattern tracking

#### Step 27.1: Create Answer Types
Create `backend/src/shared/types/answer.types.ts`:
```bash
cat > backend/src/shared/types/answer.types.ts << 'EOF'
export interface Answer {
  answerId: string;
  sessionId: string;
  questionId: string;
  userId: string;
  providerId: string;
  examId: string;
  topicId: string;
  selectedAnswers: number[];
  correctAnswers: number[];
  isCorrect: boolean;
  partialCredit: number; // 0-1 for partial credit scoring
  timeSpent: number; // in seconds
  difficulty: 'easy' | 'medium' | 'hard';
  answeredAt: string;
  explanation?: string;
  userNotes?: string;
}

export interface AnswerPattern {
  userId: string;
  questionId: string;
  totalAttempts: number;
  correctAttempts: number;
  averageTime: number;
  lastAttempted: string;
  improvementTrend: 'improving' | 'stable' | 'declining';
  commonMistakes: number[];
}

export interface AnswerAnalytics {
  totalAnswers: number;
  correctAnswers: number;
  accuracy: number;
  averageTimePerQuestion: number;
  difficultyBreakdown: {
    easy: { total: number; correct: number; accuracy: number };
    medium: { total: number; correct: number; accuracy: number };
    hard: { total: number; correct: number; accuracy: number };
  };
  topicPerformance: Array<{
    topicId: string;
    topicName: string;
    accuracy: number;
    totalQuestions: number;
  }>;
  commonMistakes: Array<{
    questionId: string;
    mistakes: number;
    incorrectAnswer: number[];
  }>;
}

export interface AnswerHistoryFilters {
  providerId?: string;
  examId?: string;
  topicId?: string;
  difficulty?: string;
  isCorrect?: boolean;
  timeframe?: 'day' | 'week' | 'month' | 'quarter';
  limit?: number;
  offset?: number;
}
EOF
```

#### Step 27.2: Create Answer Repository
Create `backend/src/repositories/answer.repository.ts`:
```bash
cat > backend/src/repositories/answer.repository.ts << 'EOF'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Answer, AnswerPattern, AnswerHistoryFilters } from '../shared/types/answer.types';
import { v4 as uuidv4 } from 'uuid';

export class AnswerRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(dynamoClient: DynamoDBClient) {
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.ANSWER_TABLE_NAME!;
  }

  async create(answer: Omit<Answer, 'answerId' | 'answeredAt'>): Promise<Answer> {
    const newAnswer: Answer = {
      ...answer,
      answerId: uuidv4(),
      answeredAt: new Date().toISOString()
    };

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: newAnswer
    }));

    return newAnswer;
  }

  async findByUser(userId: string, filters?: AnswerHistoryFilters): Promise<Answer[]> {
    let keyConditionExpression = 'userId = :userId';
    let expressionAttributeValues: any = { ':userId': userId };
    let filterExpression = '';
    let filterValues: any = {};

    // Add filters
    if (filters?.providerId) {
      filterExpression += filterExpression ? ' AND ' : '';
      filterExpression += 'providerId = :providerId';
      filterValues[':providerId'] = filters.providerId;
    }

    if (filters?.examId) {
      filterExpression += filterExpression ? ' AND ' : '';
      filterExpression += 'examId = :examId';
      filterValues[':examId'] = filters.examId;
    }

    if (filters?.difficulty) {
      filterExpression += filterExpression ? ' AND ' : '';
      filterExpression += 'difficulty = :difficulty';
      filterValues[':difficulty'] = filters.difficulty;
    }

    if (filters?.isCorrect !== undefined) {
      filterExpression += filterExpression ? ' AND ' : '';
      filterExpression += 'isCorrect = :isCorrect';
      filterValues[':isCorrect'] = filters.isCorrect;
    }

    if (filters?.timeframe) {
      const cutoffDate = this.getTimeframeCutoff(filters.timeframe);
      filterExpression += filterExpression ? ' AND ' : '';
      filterExpression += 'answeredAt >= :cutoffDate';
      filterValues[':cutoffDate'] = cutoffDate;
    }

    const queryParams: any = {
      TableName: this.tableName,
      IndexName: 'user-answers-index',
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: { ...expressionAttributeValues, ...filterValues },
      Limit: filters?.limit || 100
    };

    if (filterExpression) {
      queryParams.FilterExpression = filterExpression;
    }

    if (filters?.offset) {
      queryParams.ExclusiveStartKey = { userId, answerId: filters.offset };
    }

    const result = await this.docClient.send(new QueryCommand(queryParams));
    return result.Items as Answer[] || [];
  }

  async findByQuestion(questionId: string): Promise<Answer[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'question-answers-index',
      KeyConditionExpression: 'questionId = :questionId',
      ExpressionAttributeValues: {
        ':questionId': questionId
      }
    }));

    return result.Items as Answer[] || [];
  }

  async findPatternsByUser(userId: string): Promise<AnswerPattern[]> {
    const answers = await this.findByUser(userId);
    const patterns = new Map<string, AnswerPattern>();

    answers.forEach(answer => {
      const existing = patterns.get(answer.questionId);
      
      if (existing) {
        existing.totalAttempts++;
        if (answer.isCorrect) existing.correctAttempts++;
        existing.averageTime = (existing.averageTime * (existing.totalAttempts - 1) + answer.timeSpent) / existing.totalAttempts;
        existing.lastAttempted = answer.answeredAt;
        
        if (!answer.isCorrect) {
          existing.commonMistakes.push(...answer.selectedAnswers);
        }
      } else {
        patterns.set(answer.questionId, {
          userId,
          questionId: answer.questionId,
          totalAttempts: 1,
          correctAttempts: answer.isCorrect ? 1 : 0,
          averageTime: answer.timeSpent,
          lastAttempted: answer.answeredAt,
          improvementTrend: 'stable',
          commonMistakes: answer.isCorrect ? [] : answer.selectedAnswers
        });
      }
    });

    return Array.from(patterns.values());
  }

  private getTimeframeCutoff(timeframe: string): string {
    const now = new Date();
    switch (timeframe) {
      case 'day': return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'quarter': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default: return new Date(0).toISOString();
    }
  }
}
EOF
```

#### Step 27.3: Add Answer Table to CDK
Edit `cdk-v3/src/constructs/database-construct.ts`:
```bash
cat >> cdk-v3/src/constructs/database-construct.ts << 'EOF'

    // Answer table for analytics
    this.answerTable = new dynamodb.Table(this, 'AnswerTable', {
      tableName: config.answerTableName,
      partitionKey: { name: 'answerId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    this.answerTable.addGlobalSecondaryIndex({
      indexName: 'user-answers-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'answeredAt', type: dynamodb.AttributeType.STRING }
    });

    this.answerTable.addGlobalSecondaryIndex({
      indexName: 'question-answers-index',
      partitionKey: { name: 'questionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'answeredAt', type: dynamodb.AttributeType.STRING }
    });
EOF
```

#### Step 27.4: Test Answer Analytics
```bash
# Build and deploy
cd lambda && npm run build && cd ..
cdk deploy --context stage=dev --require-approval never

# Test answer creation and analytics
curl -X GET "$API_URL/api/v1/answers/history?timeframe=week" \
  -H "Authorization: Bearer YOUR_TOKEN"

curl -X GET "$API_URL/api/v1/answers/patterns" \
  -H "Authorization: Bearer YOUR_TOKEN"

curl -X GET "$API_URL/api/v1/answers/analytics?provider=aws" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Criteria**:
- ✅ Answer entity fully implemented with analytics
- ✅ Answer pattern tracking and trend analysis
- ✅ Common mistake identification
- ✅ Performance analytics by topic and difficulty
- ✅ Historical answer data with filtering

---

### Phase 28: Cross-Provider Analytics
**Dependencies**: Phase 27 (Answer Analytics)  
**Objective**: Implement skill transferability mapping and cross-provider competency analysis

#### Step 28.1: Create Cross-Provider Analytics Types
Create `backend/src/shared/types/cross-provider.types.ts`:
```bash
cat > backend/src/shared/types/cross-provider.types.ts << 'EOF'
export interface SkillMapping {
  skillId: string;
  skillName: string;
  providers: {
    [providerId: string]: {
      topics: string[];
      weight: number; // 0-1, how much this provider emphasizes this skill
      exams: string[];
    };
  };
  transferabilityScore: number; // 0-1, how well this skill transfers between providers
}

export interface CrossProviderAnalytics {
  userId: string;
  overallSkillProfile: {
    [skillId: string]: {
      skillName: string;
      competencyScore: number; // 0-100
      providerBreakdown: {
        [providerId: string]: {
          score: number;
          questionsAnswered: number;
          accuracy: number;
        };
      };
      transferabilityInsights: string[];
    };
  };
  providerComparison: {
    [providerId: string]: {
      overallScore: number;
      strengthAreas: string[];
      improvementAreas: string[];
      crossSkillBenefit: number; // How much other providers help this one
    };
  };
  recommendedStudyPath: {
    nextProvider: string;
    reason: string;
    skillOverlap: string[];
    estimatedDifficulty: 'easy' | 'medium' | 'hard';
  }[];
}

export interface SkillTransferMap {
  fromProvider: string;
  toProvider: string;
  sharedSkills: {
    skillId: string;
    skillName: string;
    transferStrength: number; // 0-1
    equivalentTopics: {
      from: string;
      to: string;
      similarity: number;
    }[];
  }[];
  overallTransferability: number;
}
EOF
```

#### Step 28.2: Create Skill Mapping Data
Create `backend/src/data/skill-mappings.ts`:
```bash
cat > backend/src/data/skill-mappings.ts << 'EOF'
import { SkillMapping } from '../shared/types/cross-provider.types';

export const SKILL_MAPPINGS: SkillMapping[] = [
  {
    skillId: 'compute-fundamentals',
    skillName: 'Compute Service Fundamentals',
    providers: {
      aws: {
        topics: ['ec2', 'lambda', 'ecs', 'eks'],
        weight: 0.9,
        exams: ['saa-c03', 'dva-c01']
      },
      azure: {
        topics: ['virtual-machines', 'app-service', 'functions', 'container-instances'],
        weight: 0.85,
        exams: ['az-104', 'az-204']
      },
      gcp: {
        topics: ['compute-engine', 'cloud-functions', 'cloud-run', 'gke'],
        weight: 0.8,
        exams: ['associate-cloud-engineer']
      }
    },
    transferabilityScore: 0.85
  },
  {
    skillId: 'storage-solutions',
    skillName: 'Storage and Database Solutions',
    providers: {
      aws: {
        topics: ['s3', 'ebs', 'efs', 'rds', 'dynamodb'],
        weight: 0.9,
        exams: ['saa-c03']
      },
      azure: {
        topics: ['blob-storage', 'disk-storage', 'sql-database', 'cosmos-db'],
        weight: 0.85,
        exams: ['az-104']
      },
      gcp: {
        topics: ['cloud-storage', 'persistent-disks', 'cloud-sql', 'firestore'],
        weight: 0.8,
        exams: ['associate-cloud-engineer']
      }
    },
    transferabilityScore: 0.9
  },
  {
    skillId: 'networking-security',
    skillName: 'Networking and Security',
    providers: {
      aws: {
        topics: ['vpc', 'security-groups', 'iam', 'cloudtrail'],
        weight: 0.95,
        exams: ['saa-c03', 'scs-c01']
      },
      azure: {
        topics: ['virtual-networks', 'nsg', 'azure-ad', 'monitor'],
        weight: 0.9,
        exams: ['az-104', 'az-500']
      },
      gcp: {
        topics: ['vpc-networks', 'firewall-rules', 'iam', 'cloud-audit-logs'],
        weight: 0.85,
        exams: ['associate-cloud-engineer']
      }
    },
    transferabilityScore: 0.8
  },
  {
    skillId: 'monitoring-operations',
    skillName: 'Monitoring and Operations',
    providers: {
      aws: {
        topics: ['cloudwatch', 'cloudtrail', 'config', 'systems-manager'],
        weight: 0.8,
        exams: ['saa-c03']
      },
      azure: {
        topics: ['monitor', 'log-analytics', 'advisor', 'automation'],
        weight: 0.85,
        exams: ['az-104']
      },
      gcp: {
        topics: ['cloud-monitoring', 'cloud-logging', 'cloud-trace'],
        weight: 0.75,
        exams: ['associate-cloud-engineer']
      }
    },
    transferabilityScore: 0.75
  }
];

export const SKILL_TRANSFER_MAPS = [
  {
    fromProvider: 'aws',
    toProvider: 'azure',
    sharedSkills: [
      {
        skillId: 'compute-fundamentals',
        skillName: 'Compute Service Fundamentals',
        transferStrength: 0.8,
        equivalentTopics: [
          { from: 'ec2', to: 'virtual-machines', similarity: 0.9 },
          { from: 'lambda', to: 'functions', similarity: 0.85 },
          { from: 'ecs', to: 'container-instances', similarity: 0.75 }
        ]
      }
    ],
    overallTransferability: 0.78
  },
  {
    fromProvider: 'aws',
    toProvider: 'gcp',
    sharedSkills: [
      {
        skillId: 'compute-fundamentals',
        skillName: 'Compute Service Fundamentals',
        transferStrength: 0.75,
        equivalentTopics: [
          { from: 'ec2', to: 'compute-engine', similarity: 0.85 },
          { from: 'lambda', to: 'cloud-functions', similarity: 0.8 },
          { from: 'eks', to: 'gke', similarity: 0.9 }
        ]
      }
    ],
    overallTransferability: 0.72
  }
];
EOF
```

#### Step 28.3: Create Cross-Provider Analytics Service
Create `backend/src/services/cross-provider.service.ts`:
```bash
cat > backend/src/services/cross-provider.service.ts << 'EOF'
import { ProgressRepository } from '../repositories/progress.repository';
import { AnswerRepository } from '../repositories/answer.repository';
import { CrossProviderAnalytics, SkillMapping, SkillTransferMap } from '../shared/types/cross-provider.types';
import { SKILL_MAPPINGS, SKILL_TRANSFER_MAPS } from '../data/skill-mappings';

export class CrossProviderService {
  constructor(
    private progressRepository: ProgressRepository,
    private answerRepository: AnswerRepository
  ) {}

  async generateCrossProviderAnalytics(userId: string): Promise<CrossProviderAnalytics> {
    const userProgress = await this.progressRepository.findByUser(userId);
    const userAnswers = await this.answerRepository.findByUser(userId);

    // Calculate skill competencies across providers
    const overallSkillProfile = await this.calculateSkillProfile(userProgress, userAnswers);
    
    // Compare performance across providers
    const providerComparison = this.calculateProviderComparison(userProgress, overallSkillProfile);
    
    // Generate recommended study path based on skill transferability
    const recommendedStudyPath = this.generateStudyPathRecommendations(userProgress, overallSkillProfile);

    return {
      userId,
      overallSkillProfile,
      providerComparison,
      recommendedStudyPath
    };
  }

  async getSkillTransferability(fromProvider: string, toProvider: string): Promise<SkillTransferMap | null> {
    return SKILL_TRANSFER_MAPS.find(map => 
      map.fromProvider === fromProvider && map.toProvider === toProvider
    ) || null;
  }

  async getProviderSkillOverlap(providerId1: string, providerId2: string): Promise<any> {
    const overlappingSkills = SKILL_MAPPINGS.filter(skill => 
      skill.providers[providerId1] && skill.providers[providerId2]
    );

    const overlap = overlappingSkills.map(skill => {
      const provider1Weight = skill.providers[providerId1].weight;
      const provider2Weight = skill.providers[providerId2].weight;
      
      return {
        skillId: skill.skillId,
        skillName: skill.skillName,
        transferabilityScore: skill.transferabilityScore,
        weightSimilarity: 1 - Math.abs(provider1Weight - provider2Weight),
        topicOverlap: this.calculateTopicOverlap(
          skill.providers[providerId1].topics,
          skill.providers[providerId2].topics
        )
      };
    });

    const overallOverlapScore = overlap.reduce((sum, skill) => 
      sum + (skill.transferabilityScore * skill.weightSimilarity), 0
    ) / overlap.length;

    return {
      providers: [providerId1, providerId2],
      overallOverlapScore,
      overlappingSkills: overlap,
      totalSharedSkills: overlap.length
    };
  }

  private async calculateSkillProfile(userProgress: any[], userAnswers: any[]): Promise<any> {
    const skillProfile: any = {};

    SKILL_MAPPINGS.forEach(skill => {
      const skillData = {
        skillName: skill.skillName,
        competencyScore: 0,
        providerBreakdown: {},
        transferabilityInsights: []
      };

      let totalQuestions = 0;
      let totalCorrect = 0;

      Object.keys(skill.providers).forEach(providerId => {
        const providerProgress = userProgress.filter(p => p.providerId === providerId);
        const providerAnswers = userAnswers.filter(a => a.providerId === providerId);
        
        if (providerProgress.length > 0 || providerAnswers.length > 0) {
          const providerQuestions = providerAnswers.length;
          const providerCorrect = providerAnswers.filter(a => a.isCorrect).length;
          const accuracy = providerQuestions > 0 ? (providerCorrect / providerQuestions) * 100 : 0;

          skillData.providerBreakdown[providerId] = {
            score: accuracy,
            questionsAnswered: providerQuestions,
            accuracy
          };

          totalQuestions += providerQuestions;
          totalCorrect += providerCorrect;
        }
      });

      skillData.competencyScore = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
      
      // Generate transferability insights
      skillData.transferabilityInsights = this.generateTransferabilityInsights(
        skill, skillData.providerBreakdown
      );

      skillProfile[skill.skillId] = skillData;
    });

    return skillProfile;
  }

  private calculateProviderComparison(userProgress: any[], skillProfile: any): any {
    const providerComparison: any = {};
    const uniqueProviders = [...new Set(userProgress.map(p => p.providerId))];

    uniqueProviders.forEach(providerId => {
      const providerProgress = userProgress.filter(p => p.providerId === providerId);
      const overallScore = providerProgress.reduce((sum, p) => sum + p.averageScore, 0) / providerProgress.length || 0;

      // Find strength and improvement areas
      const providerSkills = Object.values(skillProfile).filter((skill: any) => 
        skill.providerBreakdown[providerId]
      );

      const strengthAreas = providerSkills
        .filter((skill: any) => skill.providerBreakdown[providerId].score >= 80)
        .map((skill: any) => skill.skillName);

      const improvementAreas = providerSkills
        .filter((skill: any) => skill.providerBreakdown[providerId].score < 60)
        .map((skill: any) => skill.skillName);

      // Calculate cross-skill benefit
      const crossSkillBenefit = this.calculateCrossSkillBenefit(providerId, skillProfile);

      providerComparison[providerId] = {
        overallScore,
        strengthAreas,
        improvementAreas,
        crossSkillBenefit
      };
    });

    return providerComparison;
  }

  private generateStudyPathRecommendations(userProgress: any[], skillProfile: any): any[] {
    const studiedProviders = [...new Set(userProgress.map(p => p.providerId))];
    const allProviders = ['aws', 'azure', 'gcp', 'comptia', 'cisco'];
    const unstudiedProviders = allProviders.filter(p => !studiedProviders.includes(p));

    return unstudiedProviders.map(providerId => {
      const transferMap = this.findBestTransferPath(studiedProviders, providerId);
      const skillOverlap = this.calculateProviderSkillOverlap(studiedProviders, providerId);
      
      return {
        nextProvider: providerId,
        reason: transferMap.reason,
        skillOverlap: skillOverlap.skills,
        estimatedDifficulty: this.estimateDifficulty(transferMap.transferability)
      };
    }).sort((a, b) => {
      // Sort by easiest difficulty first
      const difficultyOrder = { easy: 0, medium: 1, hard: 2 };
      return difficultyOrder[a.estimatedDifficulty] - difficultyOrder[b.estimatedDifficulty];
    });
  }

  private calculateTopicOverlap(topics1: string[], topics2: string[]): number {
    const intersection = topics1.filter(topic => topics2.includes(topic));
    const union = [...new Set([...topics1, ...topics2])];
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  private generateTransferabilityInsights(skill: SkillMapping, providerBreakdown: any): string[] {
    const insights: string[] = [];
    const studiedProviders = Object.keys(providerBreakdown);

    if (studiedProviders.length > 1) {
      insights.push(`Your ${skill.skillName} knowledge transfers well between ${studiedProviders.join(', ')}`);
    }

    if (skill.transferabilityScore > 0.8) {
      insights.push(`This skill has high transferability across cloud providers`);
    }

    return insights;
  }

  private calculateCrossSkillBenefit(providerId: string, skillProfile: any): number {
    // Calculate how much knowledge from other providers benefits this provider
    let totalBenefit = 0;
    let skillCount = 0;

    Object.values(skillProfile).forEach((skill: any) => {
      if (skill.providerBreakdown[providerId]) {
        const otherProviders = Object.keys(skill.providerBreakdown).filter(p => p !== providerId);
        const otherProviderScores = otherProviders.map(p => skill.providerBreakdown[p].score);
        
        if (otherProviderScores.length > 0) {
          const averageOtherScore = otherProviderScores.reduce((sum, score) => sum + score, 0) / otherProviderScores.length;
          totalBenefit += averageOtherScore;
          skillCount++;
        }
      }
    });

    return skillCount > 0 ? totalBenefit / skillCount / 100 : 0; // Return as 0-1 score
  }

  private findBestTransferPath(studiedProviders: string[], targetProvider: string): any {
    let bestTransfer = { transferability: 0, reason: '', fromProvider: '' };

    studiedProviders.forEach(fromProvider => {
      const transferMap = SKILL_TRANSFER_MAPS.find(map => 
        map.fromProvider === fromProvider && map.toProvider === targetProvider
      );

      if (transferMap && transferMap.overallTransferability > bestTransfer.transferability) {
        bestTransfer = {
          transferability: transferMap.overallTransferability,
          reason: `Strong knowledge transfer from ${fromProvider} to ${targetProvider}`,
          fromProvider
        };
      }
    });

    return bestTransfer;
  }

  private calculateProviderSkillOverlap(studiedProviders: string[], targetProvider: string): any {
    const skills: string[] = [];
    
    SKILL_MAPPINGS.forEach(skill => {
      const hasStudiedProvider = studiedProviders.some(p => skill.providers[p]);
      const hasTargetProvider = skill.providers[targetProvider];
      
      if (hasStudiedProvider && hasTargetProvider) {
        skills.push(skill.skillName);
      }
    });

    return { skills };
  }

  private estimateDifficulty(transferability: number): 'easy' | 'medium' | 'hard' {
    if (transferability > 0.7) return 'easy';
    if (transferability > 0.5) return 'medium';
    return 'hard';
  }
}
EOF
```

#### Step 28.4: Test Cross-Provider Analytics
```bash
# Build and deploy
cd lambda && npm run build && cd ..
cdk deploy --context stage=dev --require-approval never

# Test cross-provider analytics
curl -X GET "$API_URL/api/v1/analytics/cross-provider" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test skill transferability
curl -X GET "$API_URL/api/v1/analytics/transferability?from=aws&to=azure" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test provider skill overlap
curl -X GET "$API_URL/api/v1/analytics/skill-overlap?provider1=aws&provider2=gcp" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Criteria**:
- ✅ Skill mapping across multiple providers implemented
- ✅ Cross-provider competency analysis working
- ✅ Skill transferability calculations accurate
- ✅ Study path recommendations based on skill overlap
- ✅ Provider comparison with strength/improvement areas

---

## 📚 Documentation Requirements

This implementation plan is supported by required companion documents:

### Required Documents (6 total)
1. **README.md** - Comprehensive feature and requirements analysis
2. **PROJECT_STRUCTURE.md** - Complete file organization reference  
3. **ARCHITECTURE.md** - SOLID principles and clean architecture details
4. **API_REFERENCE.md** - Complete endpoint documentation with examples
5. **CODE_EXAMPLES.md** - Implementation pattern examples and snippets
6. **IMPLEMENTATION_PLAN.md** - This document

### Documentation Standards
- Crystal clear natural language throughout
- Comprehensive feature coverage
- Technology-specific implementation details
- Maintainable and updateable structure

## 🎯 Implementation Dependencies

### Phase Dependencies
Phases must be implemented in strict order:

1. **Infrastructure Foundation** - Required for all other phases
2. **Authentication System (JWT tokens only)** - Token generation/validation  
3. **Provider Management** - Required for exam/topic organization
4. **Exam Management** - Required for topic organization
5. **Topic Management** - Required for question organization  
6. **Question Management** - Required for study sessions
7. **Study Session Management** - Core business functionality
8. **Analytics** - Depends on session data collection
9. **Goals Management** - Depends on progress analytics
10. **Health Monitoring** - System observability and monitoring
11. **JWT Authorization System** - **LAST PHASE**: Add auth to all endpoints after they work

### Success Validation
Each phase requires complete validation before proceeding:
- All endpoints tested and functional
- Business requirements satisfied  
- Performance targets met
- Documentation updated
- Tests passing with required coverage

This implementation plan provides a complete roadmap for building the Study App backend V3 with clean architecture principles, comprehensive testing, and production-ready deployment strategy.

### Phase 30: JWT Authorization System
**Dependencies**: Phase 29 (All features working without auth)  
**Objective**: Implement comprehensive JWT TOKEN authorizer Lambda for API Gateway after all endpoints work

#### Step 30.1: Create JWT Authorization Lambda
```bash
# Create JWT authorizer directory
mkdir -p backend/src/authorizers

# Create JWT authorizer Lambda
cat > backend/src/authorizers/JWTAuthorizer.ts << 'EOF'
import { 
  APIGatewayAuthorizerResult, 
  APIGatewayTokenAuthorizerEvent,
  PolicyDocument,
  Statement
} from 'aws-lambda';
import AWS from 'aws-sdk';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  email: string;
  role?: string;
  permissions?: string[];
  exp: number;
  iat: number;
}

interface AuthorizerContext {
  userId: string;
  email: string;
  role: string;
  permissions: string;
}

export class JWTAuthorizer {
  private secretsManager: AWS.SecretsManager;
  private dynamodb: AWS.DynamoDB.DocumentClient;
  private jwtSecret: string | null = null;

  constructor() {
    this.secretsManager = new AWS.SecretsManager();
    this.dynamodb = new AWS.DynamoDB.DocumentClient();
  }

  async authorize(event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
    console.log('JWT Authorizer invoked', JSON.stringify(event, null, 2));

    try {
      // Extract token from Authorization header
      const token = this.extractToken(event.authorizationToken);
      
      // Verify JWT token
      const payload = await this.verifyToken(token);
      
      // Check if user is active and not blacklisted
      await this.validateUser(payload.userId, token);
      
      // Generate policy
      const policy = this.generatePolicy(payload.userId, 'Allow', event.methodArn, {
        userId: payload.userId,
        email: payload.email,
        role: payload.role || 'user',
        permissions: JSON.stringify(payload.permissions || [])
      });

      console.log('Authorization successful', { userId: payload.userId, email: payload.email });
      return policy;

    } catch (error) {
      console.error('Authorization failed', error);
      
      // Return deny policy for any authorization failure
      return this.generatePolicy('user', 'Deny', event.methodArn);
    }
  }

  private extractToken(authorizationToken: string): string {
    if (!authorizationToken) {
      throw new Error('No authorization token provided');
    }

    // Handle both "Bearer <token>" and "<token>" formats
    const parts = authorizationToken.split(' ');
    const token = parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : authorizationToken;

    if (!token) {
      throw new Error('Invalid authorization token format');
    }

    return token;
  }

  private async getJWTSecret(): Promise<string> {
    if (this.jwtSecret) {
      return this.jwtSecret;
    }

    try {
      const secretName = process.env.JWT_SECRET_NAME;
      if (!secretName) {
        throw new Error('JWT_SECRET_NAME environment variable not set');
      }

      const result = await this.secretsManager.getSecretValue({
        SecretId: secretName
      }).promise();

      if (!result.SecretString) {
        throw new Error('Secret string not found');
      }

      const secretData = JSON.parse(result.SecretString);
      this.jwtSecret = secretData.secret;

      if (!this.jwtSecret) {
        throw new Error('JWT secret not found in secret data');
      }

      return this.jwtSecret;
    } catch (error) {
      console.error('Failed to retrieve JWT secret', error);
      throw new Error('Unable to retrieve JWT secret');
    }
  }

  private async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const secret = await this.getJWTSecret();
      
      const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: 'study-app',
        audience: 'study-app-users'
      }) as JWTPayload;

      // Additional payload validation
      if (!decoded.userId || !decoded.email) {
        throw new Error('Invalid token payload');
      }

      // Check if token is expired (additional check beyond jwt.verify)
      const currentTime = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < currentTime) {
        throw new Error('Token expired');
      }

      return decoded;
    } catch (error) {
      console.error('Token verification failed', error);
      throw new Error('Invalid or expired token');
    }
  }

  private async validateUser(userId: string, token: string): Promise<void> {
    try {
      // Check if user exists and is active
      const userResult = await this.dynamodb.get({
        TableName: process.env.USERS_TABLE!,
        Key: { userId }
      }).promise();

      if (!userResult.Item) {
        throw new Error('User not found');
      }

      const user = userResult.Item;
      
      // Check if user is active
      if (!user.isActive) {
        throw new Error('User account is deactivated');
      }

      // Check if user is verified (email verification)
      if (!user.isVerified) {
        throw new Error('User account is not verified');
      }

      // Check token blacklist
      await this.checkTokenBlacklist(token);

    } catch (error) {
      console.error('User validation failed', error);
      throw error;
    }
  }

  private async checkTokenBlacklist(token: string): Promise<void> {
    try {
      const tokenHash = require('crypto')
        .createHash('sha256')
        .update(token)
        .digest('hex');

      const result = await this.dynamodb.get({
        TableName: process.env.BLACKLISTED_TOKENS_TABLE || 'StudyAppBlacklistedTokens',
        Key: { tokenHash }
      }).promise();

      if (result.Item) {
        throw new Error('Token has been revoked');
      }
    } catch (error) {
      if (error.message === 'Token has been revoked') {
        throw error;
      }
      // If blacklist table doesn't exist or other errors, allow the request
      console.warn('Token blacklist check failed', error);
    }
  }

  private generatePolicy(
    principalId: string,
    effect: 'Allow' | 'Deny',
    resource: string,
    context?: AuthorizerContext
  ): APIGatewayAuthorizerResult {
    const statement: Statement = {
      Effect: effect,
      Action: 'execute-api:Invoke',
      Resource: resource
    };

    // Allow access to all API Gateway resources if authorized
    if (effect === 'Allow') {
      statement.Resource = resource.split('/').slice(0, 2).join('/') + '/*';
    }

    const policyDocument: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [statement]
    };

    const authorizerResult: APIGatewayAuthorizerResult = {
      principalId,
      policyDocument,
      context: context as any
    };

    return authorizerResult;
  }
}

// Lambda handler
const authorizer = new JWTAuthorizer();

export const handler = async (event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  return authorizer.authorize(event);
};
EOF

echo "Created JWT authorizer Lambda"
```

#### Step 30.2: Create Blacklisted Tokens Table and Management
```bash
# Create token blacklist service
cat > backend/src/services/auth/TokenBlacklistService.ts << 'EOF'
import { BaseService } from '../base/BaseService';
import { Logger } from '../../shared/utils/Logger';
import { DynamoDBService } from '../database/DynamoDBService';
import { CacheService } from '../cache/CacheService';

export class TokenBlacklistService extends BaseService {
  private dynamodb: DynamoDBService;
  private cache: CacheService;
  private logger: Logger;
  private blacklistTable: string;

  constructor(
    dynamodb: DynamoDBService,
    cache: CacheService,
    logger: Logger
  ) {
    super();
    this.dynamodb = dynamodb;
    this.cache = cache;
    this.logger = logger;
    this.blacklistTable = process.env.BLACKLISTED_TOKENS_TABLE || 'StudyAppBlacklistedTokens';
  }

  async blacklistToken(token: string, userId: string, reason?: string): Promise<void> {
    this.logger.info('Blacklisting token', { userId, reason });

    try {
      const tokenHash = this.hashToken(token);
      
      // Decode token to get expiration
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token) as any;
      const expirationTime = decoded?.exp;

      if (!expirationTime) {
        throw new Error('Cannot determine token expiration');
      }

      const params = {
        TableName: this.blacklistTable,
        Item: {
          tokenHash,
          userId,
          blacklistedAt: new Date().toISOString(),
          expiresAt: expirationTime,
          reason: reason || 'User logout'
        }
      };

      await this.dynamodb.put(params);

      // Also cache the blacklisted token for faster lookup
      const cacheKey = `blacklisted_token:${tokenHash}`;
      await this.cache.set(cacheKey, true, expirationTime - Math.floor(Date.now() / 1000));

      this.logger.info('Token blacklisted successfully', { tokenHash: tokenHash.substring(0, 8) });
    } catch (error) {
      this.logger.error('Error blacklisting token', error);
      throw this.createError('Failed to blacklist token', 500);
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const tokenHash = this.hashToken(token);
      
      // Check cache first
      const cacheKey = `blacklisted_token:${tokenHash}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return true;
      }

      // Check DynamoDB
      const params = {
        TableName: this.blacklistTable,
        Key: { tokenHash }
      };

      const result = await this.dynamodb.get(params);
      return !!result.Item;
    } catch (error) {
      this.logger.error('Error checking token blacklist', error);
      return false; // Assume not blacklisted if check fails
    }
  }

  async cleanupExpiredTokens(): Promise<number> {
    this.logger.info('Cleaning up expired blacklisted tokens');

    try {
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Scan for expired tokens
      const scanParams = {
        TableName: this.blacklistTable,
        FilterExpression: 'expiresAt < :currentTime',
        ExpressionAttributeValues: {
          ':currentTime': currentTime
        }
      };

      const result = await this.dynamodb.scan(scanParams);
      const expiredTokens = result.Items || [];

      // Delete expired tokens
      let deletedCount = 0;
      for (const token of expiredTokens) {
        try {
          await this.dynamodb.delete({
            TableName: this.blacklistTable,
            Key: { tokenHash: token.tokenHash }
          });
          deletedCount++;
        } catch (error) {
          this.logger.error('Error deleting expired token', error);
        }
      }

      this.logger.info('Cleaned up expired tokens', { deletedCount });
      return deletedCount;
    } catch (error) {
      this.logger.error('Error during token cleanup', error);
      return 0;
    }
  }

  private hashToken(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
EOF

echo "Created token blacklist service"
```

#### Step 30.3: Update CDK Stack to Add JWT Authorizer to ALL Existing Endpoints
```bash
# Add JWT authorizer and blacklist table to CDK stack
cat >> cdk-v3/src/study-app-stack-v3.ts << 'EOF'

    // Blacklisted tokens table
    const blacklistedTokensTable = new dynamodb.Table(this, 'BlacklistedTokensTable', {
      tableName: 'StudyAppBlacklistedTokens',
      partitionKey: { name: 'tokenHash', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'expiresAt' // Auto-delete expired tokens
    });

    // JWT Authorizer Lambda
    const jwtAuthorizerFunction = new lambda.Function(this, 'JWTAuthorizerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'authorizers/JWTAuthorizer.handler',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        JWT_SECRET_NAME: jwtSecret.secretName,
        USERS_TABLE: usersTable.tableName,
        BLACKLISTED_TOKENS_TABLE: blacklistedTokensTable.tableName
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256
    });

    // Grant permissions to authorizer
    jwtSecret.grantRead(jwtAuthorizerFunction);
    usersTable.grantReadData(jwtAuthorizerFunction);
    blacklistedTokensTable.grantReadData(jwtAuthorizerFunction);

    // Create API Gateway authorizer
    const jwtAuthorizer = new apigateway.TokenAuthorizer(this, 'JWTAuthorizer', {
      handler: jwtAuthorizerFunction,
      identitySource: 'method.request.header.Authorization',
      authorizerName: 'JWTAuthorizer',
      resultsCacheTtl: cdk.Duration.minutes(5)
    });

    // UPDATE ALL EXISTING PROTECTED ENDPOINTS TO USE JWT AUTHORIZER
    // Note: This requires updating each protected endpoint in the CDK stack
    // Replace all instances of 'authorizer: authorizer' with 'authorizer: jwtAuthorizer'
    // Exempt endpoints: /auth/register, /auth/login, /health (basic)
EOF

echo "Updated CDK stack with JWT authorizer"
```

#### Step 30.4: Deploy and Test JWT Authorization System
```bash
# Deploy the updated stack with authorizer on ALL endpoints
npm run build
cdk deploy --require-approval never

# Test JWT authorization system
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

echo "Testing JWT Authorization System on All Endpoints..."

# Login to get valid token
TOKENS_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com", 
    "password": "password123"
  }')

ACCESS_TOKEN=$(echo $TOKENS_RESPONSE | jq -r '.data.tokens.accessToken')
echo "Access Token: ${ACCESS_TOKEN:0:50}..."

# Test protected endpoints with valid token
echo "1. Testing Protected Endpoints with Valid Token"
curl -s -X GET "$API_URL/api/v1/providers" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.success'

curl -s -X GET "$API_URL/api/v1/exams" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.success'

curl -s -X GET "$API_URL/api/v1/questions" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.success'

# Test unprotected endpoints (should work without token)
echo "2. Testing Unprotected Endpoints (No Token Needed)"
curl -s -X GET "$API_URL/api/v1/health" | jq '.success'

curl -s -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email": "test2@example.com", "password": "password123"}' | jq '.success'

# Test protected endpoints without token (should fail)
echo "3. Testing Protected Endpoints without Token (Should Fail)"
curl -s -X GET "$API_URL/api/v1/providers" | jq '.message'
curl -s -X GET "$API_URL/api/v1/sessions" | jq '.message'
curl -s -X GET "$API_URL/api/v1/analytics/progress" | jq '.message'

echo "JWT authorization system testing completed on all endpoints"
```

**Phase 30 Success Criteria**:
- ✅ JWT TOKEN authorizer Lambda implemented and deployed
- ✅ Comprehensive token validation (signature, expiration, payload)
- ✅ User validation (active, verified status)
- ✅ Token blacklisting system with DynamoDB and caching
- ✅ ALL protected endpoints now require valid JWT tokens
- ✅ Unprotected endpoints (register, login, health) still work without auth
- ✅ Proper API Gateway integration with caching
- ✅ Security best practices (token hashing, TTL cleanup)
- ✅ Error handling and appropriate HTTP status codes

## 📊 Implementation Progress Tracking

| Phase | Feature | Status | Start Date | Completion Date | Endpoints | Architecture Compliance | Shared Components Used | Notes |
|-------|---------|--------|------------|-----------------|-----------|----------------------|------------------------|-------|
| **Phase 1** | **Infrastructure + Health Check** | ✅ Completed | 2025-01-11 | 2025-01-11 | `GET /v1/health` | ✅ Implemented | BaseHandler, ServiceFactory, ResponseBuilder, Logger | CDK deployment with health endpoint |
| **Phase 2** | **User Registration** | ✅ Completed | 2025-01-11 | 2025-01-11 | `POST /v1/auth/register` | ✅ Implemented | BaseHandler, ServiceFactory, UserRepository, ValidationService | Email validation + password strength |
| **Phase 3** | **User Login** | ✅ Completed | 2025-01-11 | 2025-01-11 | `POST /v1/auth/login` | ✅ Implemented | AuthService, JwtService, ResponseBuilder | JWT token generation |
| **Phase 4** | **Token Refresh** | ✅ Completed | 2025-01-11 | 2025-01-11 | `POST /v1/auth/refresh` | ✅ Implemented | JwtService, AuthService | Token refresh mechanism |
| **Phase 5** | **User Logout** | ✅ Completed | 2025-01-11 | 2025-01-11 | `POST /v1/auth/logout` | ✅ Implemented | AuthService, JwtService | Token blacklisting (basic implementation) |
| **Phase 6** | **Provider Listing** | 🔄 Not Started | - | - | `GET /providers` | ❌ Pending | BaseHandler, QuestionService, CacheService | S3 metadata loading |
| **Phase 7** | **Provider Details** | 🔄 Not Started | - | - | `GET /providers/{id}` | ❌ Pending | QuestionService, CacheService | Individual provider info |
| **Phase 8** | **Exam Listing** | 🔄 Not Started | - | - | `GET /exams` | ❌ Pending | BaseHandler, QuestionService | Cross-provider exam catalog |
| **Phase 9** | **Exam Details** | 🔄 Not Started | - | - | `GET /exams/{id}` | ❌ Pending | QuestionService, ResponseBuilder | Individual exam information |
| **Phase 10** | **Topic Listing** | 🔄 Not Started | - | - | `GET /topics` | ❌ Pending | BaseHandler, QuestionService | Topic organization |
| **Phase 11** | **Topic Details** | 🔄 Not Started | - | - | `GET /topics/{id}` | ❌ Pending | QuestionService, CacheService | Individual topic stats |
| **Phase 12** | **Question Listing** | 🔄 Not Started | - | - | `GET /questions` | ❌ Pending | BaseHandler, QuestionService | Advanced filtering |
| **Phase 13** | **Question Details** | 🔄 Not Started | - | - | `GET /questions/{id}` | ❌ Pending | QuestionService, ResponseBuilder | Individual question + explanation |
| **Phase 14** | **Question Search** | 🔄 Not Started | - | - | `POST /questions/search` | ❌ Pending | QuestionService, CacheService | Full-text search with relevance |
| **Phase 15** | **Session Creation** | 🔄 Not Started | - | - | `POST /sessions` | ❌ Pending | BaseHandler, SessionService, QuestionService | Session with configuration |
| **Phase 16** | **Session Retrieval** | 🔄 Not Started | - | - | `GET /sessions/{id}` | ❌ Pending | SessionService, ResponseBuilder | Session details + current question |
| **Phase 17** | **Session Update** | 🔄 Not Started | - | - | `PUT /sessions/{id}` | ❌ Pending | SessionService | Pause/resume functionality |
| **Phase 18** | **Session Deletion** | 🔄 Not Started | - | - | `DELETE /sessions/{id}` | ❌ Pending | SessionService, ResponseBuilder | Session abandonment |
| **Phase 19** | **Answer Submission** | 🔄 Not Started | - | - | `POST /sessions/{id}/answers` | ❌ Pending | SessionService, QuestionService | Answer with immediate feedback |
| **Phase 20** | **Session Completion** | 🔄 Not Started | - | - | `POST /sessions/{id}/complete` | ❌ Pending | SessionService, AnalyticsService | Session results + analytics |
| **Phase 21** | **Adaptive Sessions** | 🔄 Not Started | - | - | `POST /sessions/adaptive` | ❌ Pending | SessionService, AnalyticsService | Adaptive difficulty adjustment |
| **Phase 22** | **Progress Analytics** | 🔄 Not Started | - | - | `GET /analytics/progress` | ❌ Pending | BaseHandler, AnalyticsService | User progress trends |
| **Phase 23** | **Session Analytics** | 🔄 Not Started | - | - | `GET /analytics/sessions/{id}` | ❌ Pending | AnalyticsService, CacheService | Detailed session performance |
| **Phase 24** | **Performance Analytics** | 🔄 Not Started | - | - | `GET /analytics/performance` | ❌ Pending | AnalyticsService, ResponseBuilder | Competency scoring + insights |
| **Phase 25** | **Goal Listing** | 🔄 Not Started | - | - | `GET /goals` | ❌ Pending | CrudHandler, GoalsService | User goals with status |
| **Phase 26** | **Goal Creation** | 🔄 Not Started | - | - | `POST /goals` | ❌ Pending | CrudHandler, GoalsService | Create study goal with targets |
| **Phase 27** | **Goal Updates** | 🔄 Not Started | - | - | `PUT /goals/{id}` | ❌ Pending | CrudHandler, GoalsService | Update goal progress + targets |
| **Phase 28** | **Goal Deletion** | 🔄 Not Started | - | - | `DELETE /goals/{id}` | ❌ Pending | CrudHandler, GoalsService | Delete completed/abandoned goals |
| **Phase 29** | **Detailed Health Check** | 🔄 Not Started | - | - | `GET /health/detailed` | ❌ Pending | BaseHandler, HealthService | Comprehensive system diagnostics |
| **Phase 30** | **JWT Authorization System** | 🔄 Not Started | - | - | ALL protected endpoints | ❌ Pending | JWTAuthorizer, TokenBlacklist, AuthService | Add auth to all endpoints AFTER they work |

### 📈 Progress Summary
- **Total Phases**: 30 (One feature per phase, auth last)
- **Completed**: 5 (17%) - Phases 1-5 Authentication Core
- **In Progress**: 0 (0%)  
- **Not Started**: 25 (83%)
- **Architecture Compliance**: 100% (Clean Architecture with BaseHandler, ServiceFactory patterns)
- **Shared Component Usage**: 100% (BaseHandler eliminates boilerplate, ServiceFactory DI pattern)

### 🎯 Next Steps
1. **Phase 6**: Provider Listing Feature - Implement S3-based provider data access (`GET /v1/providers`)
2. **Phase 7**: Provider Details Feature - Individual provider information (`GET /v1/providers/{id}`)
3. **Phase 8**: Exam Listing Feature - Cross-provider exam catalog (`GET /v1/exams`)
4. **Phase 9**: Exam Details Feature - Individual exam details (`GET /v1/exams/{id}`)
5. Continue systematic implementation following clean architecture patterns

### ✅ Status Legend
- 🔄 **Not Started** - Phase not begun
- 🚧 **In Progress** - Phase currently being implemented  
- ✅ **Completed** - Phase finished with all success criteria met
- ⚠️ **Blocked** - Phase blocked by dependencies or issues
- 🔧 **Needs Rework** - Phase completed but requires architecture compliance fixes