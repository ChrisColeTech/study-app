// CDK Type Definitions for Study App V3

import * as cdk from 'aws-cdk-lib';

export interface StackEnvironment {
  account?: string;
  region?: string;
}

export interface LambdaFunctionMap {
  [key: string]: cdk.aws_lambda.Function;
}

export interface DatabaseTables {
  usersTable: cdk.aws_dynamodb.Table;
  studySessionsTable: cdk.aws_dynamodb.Table;
  userProgressTable: cdk.aws_dynamodb.Table;
  goalsTable: cdk.aws_dynamodb.Table;
}

export interface StorageBuckets {
  questionDataBucket: cdk.aws_s3.Bucket;
  assetsBucket: cdk.aws_s3.Bucket;
}

export interface ApiGatewayResources {
  restApi: cdk.aws_apigateway.RestApi;
  tokenAuthorizer: cdk.aws_apigateway.TokenAuthorizer;
}

export interface MonitoringResources {
  logGroup: cdk.aws_logs.LogGroup;
  dashboard: cdk.aws_cloudwatch.Dashboard;
}

// Environment-specific configuration types
export interface EnvironmentSettings {
  environment: 'dev' | 'staging' | 'prod';
  isProduction: boolean;
  lambdaSettings: {
    timeout: number;
    memorySize: number;
  };
  apiSettings: {
    throttleRateLimit: number;
    throttleBurstLimit: number;
  };
  databaseSettings: {
    billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
    pointInTimeRecovery: boolean;
  };
  storageSettings: {
    versioned: boolean;
    encryption: boolean;
  };
  logSettings: {
    retentionDays: number;
    level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  };
}