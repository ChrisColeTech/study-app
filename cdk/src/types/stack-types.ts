import * as cdk from 'aws-cdk-lib';

export interface StudyAppStackProps extends cdk.StackProps {
  stage: string;
}

export interface ConstructProps {
  stage: string;
}

export interface LambdaProps extends ConstructProps {
  functionName: string;
  handler: string;
  environment?: Record<string, string>;
  memorySize?: number;
  timeout?: number;
}

export interface ApiRouteProps {
  method: string;
  path: string;
  functionName: string;
  requireAuth?: boolean;
}

export interface DatabaseProps extends ConstructProps {
  mainTableName: string;
  cacheTableName: string;
}

export interface StorageProps extends ConstructProps {
  dataBucketName: string;
  frontendBucketName: string;
}

export interface AuthProps extends ConstructProps {
  secretName: string;
}

export interface ApiGatewayProps extends ConstructProps {
  apiName: string;
  lambdas: any;
  authorizerFunction: any;
}

export interface FrontendProps extends ConstructProps {
  api: any;
  frontendBucket: any;
}

export interface MonitoringProps extends ConstructProps {
  // Add monitoring specific props as needed
}