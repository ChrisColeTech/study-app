import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseConstruct } from '../constructs/database-construct';
import { StorageConstruct } from '../constructs/storage-construct';
import { LambdaConstruct } from '../constructs/lambda-construct';
import { ApiConstruct } from '../constructs/api-construct';
import { CloudFrontConstruct } from '../constructs/cloudfront-construct';
import { 
  StackConfig, 
  DatabaseConfig, 
  S3Config, 
  LambdaConfig, 
  ApiGatewayConfig, 
  CloudFrontConfig 
} from '../types';

export interface StudyAppV2StackProps extends cdk.StackProps {
  config: StackConfig;
}

export class StudyAppV2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StudyAppV2StackProps) {
    super(scope, id, props);

    const { config } = props;

    // Configuration objects
    const databaseConfig: DatabaseConfig = {
      tableName: 'StudyAppV2',
      billingMode: 'PAY_PER_REQUEST',
      pointInTimeRecovery: config.stage === 'prod',
      encryption: true
    };

    const s3Config: S3Config = {
      versioning: config.stage === 'prod',
      publicReadAccess: false,
      blockPublicAccess: true,
      encryption: 'AES256',
      lifecycleRules: config.stage === 'prod'
    };

    const lambdaConfig: LambdaConfig = {
      runtime: 'nodejs20.x',
      timeout: 30,
      memorySize: 512,
      architecture: 'arm64',
      environment: {
        NODE_ENV: config.stage === 'prod' ? 'production' : 'development'
      }
    };

    const apiGatewayConfig: ApiGatewayConfig = {
      throttleRateLimit: config.stage === 'prod' ? 1000 : 100,
      throttleBurstLimit: config.stage === 'prod' ? 2000 : 200,
      stage: config.stage,
      corsEnabled: true,
      authorizerConfig: {
        type: 'TOKEN', // Using TOKEN instead of problematic REQUEST
        identitySource: 'method.request.header.Authorization',
        resultsCacheTtl: 300
      }
    };

    const cloudFrontConfig: CloudFrontConfig = {
      priceClass: 'PriceClass_100',
      cachingEnabled: true,
      compressionEnabled: true,
      httpVersion: 'http2and3',
      originRequestPolicy: {
        name: `StudyAppV2-OriginPolicy-${config.stage}`,
        headerBehavior: 'all', // CRITICAL: Forward all headers including JWT
        queryStringBehavior: 'all',
        cookieBehavior: 'all'
      }
    };

    // Create constructs in dependency order
    
    // 1. Storage (no dependencies)
    const storage = new StorageConstruct(this, 'Storage-V2', {
      stage: config.stage,
      config: s3Config
    });

    // 2. Database (no dependencies)
    const database = new DatabaseConstruct(this, 'Database-V2', {
      stage: config.stage,
      config: databaseConfig
    });

    // 3. Lambda functions (depends on database and storage)
    const lambda = new LambdaConstruct(this, 'Lambda-V2', {
      stage: config.stage,
      config: lambdaConfig,
      tables: {
        usersTable: database.usersTable,
        sessionsTable: database.sessionsTable,
        goalsTable: database.goalsTable,
        analyticsTable: database.analyticsTable
      },
      dataBucket: storage.dataBucket
    });

    // 4. API Gateway (depends on Lambda)
    const api = new ApiConstruct(this, 'API-V2', {
      stage: config.stage,
      config: apiGatewayConfig,
      functions: {
        authorizerFunction: lambda.authorizerFunction,
        authFunction: lambda.authFunction,
        providerFunction: lambda.providerFunction,
        examFunction: lambda.examFunction,
        questionFunction: lambda.questionFunction,
        sessionFunction: lambda.sessionFunction,
        goalFunction: lambda.goalFunction,
        analyticsFunction: lambda.analyticsFunction,
        healthFunction: lambda.healthFunction
      }
    });

    // 5. CloudFront (depends on API Gateway and Static Bucket)
    const cloudfront = new CloudFrontConstruct(this, 'CloudFront-V2', {
      stage: config.stage,
      config: cloudFrontConfig,
      api: api.api,
      staticBucket: storage.staticBucket
    });

    // Stack-level outputs
    new cdk.CfnOutput(this, 'Stack-Info-V2', {
      value: JSON.stringify({
        stackName: this.stackName,
        region: this.region,
        account: this.account,
        stage: config.stage,
        version: config.version,
        deployedAt: new Date().toISOString()
      }),
      description: 'Study App V2 Stack Information'
    });

    // Environment URLs for easy reference
    new cdk.CfnOutput(this, 'Environment-URLs-V2', {
      value: JSON.stringify({
        apiUrl: api.api.url,
        cloudFrontUrl: `https://${cloudfront.distribution.distributionDomainName}`,
        staticWebsiteUrl: storage.staticBucket.bucketWebsiteUrl
      }),
      description: 'Study App V2 Environment URLs'
    });

    // Resource identifiers for CI/CD
    new cdk.CfnOutput(this, 'Resource-IDs-V2', {
      value: JSON.stringify({
        apiId: api.api.restApiId,
        distributionId: cloudfront.distribution.distributionId,
        dataBucket: storage.dataBucket.bucketName,
        staticBucket: storage.staticBucket.bucketName,
        usersTable: database.usersTable.tableName,
        sessionsTable: database.sessionsTable.tableName,
        goalsTable: database.goalsTable.tableName,
        analyticsTable: database.analyticsTable.tableName
      }),
      description: 'Study App V2 Resource Identifiers'
    });

    // Add tags to all resources
    cdk.Tags.of(this).add('Project', 'StudyApp');
    cdk.Tags.of(this).add('Version', 'V2');
    cdk.Tags.of(this).add('Stage', config.stage);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('CreatedBy', 'Claude-Code');
    cdk.Tags.of(this).add('Architecture', 'Serverless');
  }
}