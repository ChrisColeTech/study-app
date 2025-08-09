// Common types for Study App V2 Infrastructure

export interface StackConfig {
  stage: string;
  region: string;
  account: string;
  appName: string;
  version: string;
}

export interface DatabaseConfig {
  tableName: string;
  billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
  pointInTimeRecovery: boolean;
  encryption: boolean;
}

export interface LambdaConfig {
  runtime: string;
  timeout: number;
  memorySize: number;
  architecture: string;
  environment: Record<string, string>;
}

export interface ApiGatewayConfig {
  throttleRateLimit: number;
  throttleBurstLimit: number;
  stage: string;
  corsEnabled: boolean;
  authorizerConfig: {
    type: 'TOKEN' | 'REQUEST' | 'COGNITO';
    identitySource?: string;
    resultsCacheTtl: number;
  };
}

export interface CloudFrontConfig {
  priceClass: 'PriceClass_100' | 'PriceClass_200' | 'PriceClass_All';
  cachingEnabled: boolean;
  compressionEnabled: boolean;
  httpVersion: string;
  originRequestPolicy: {
    name: string;
    headerBehavior: 'all' | 'allowList' | 'none';
    queryStringBehavior: 'all' | 'allowList' | 'none';
    cookieBehavior: 'all' | 'allowList' | 'none';
  };
}

export interface S3Config {
  versioning: boolean;
  publicReadAccess: boolean;
  blockPublicAccess: boolean;
  encryption: 'AES256' | 'KMS';
  lifecycleRules: boolean;
}