import * as cdk from 'aws-cdk-lib';

export interface BaseConstructProps {
  readonly environment: string;
}

export interface LambdaProps extends BaseConstructProps {
  readonly timeout?: cdk.Duration;
  readonly memorySize?: number;
  readonly runtime?: cdk.aws_lambda.Runtime;
  readonly architecture?: cdk.aws_lambda.Architecture;
  readonly logRetention?: cdk.aws_logs.RetentionDays;
  readonly environmentVariables?: { [key: string]: string };
}

export interface DatabaseProps extends BaseConstructProps {
  readonly billingMode?: cdk.aws_dynamodb.BillingMode;
  readonly pointInTimeRecovery?: boolean;
  readonly removalPolicy?: cdk.RemovalPolicy;
}

export interface StorageProps extends BaseConstructProps {
  readonly versioned?: boolean;
  readonly publicReadAccess?: boolean;
  readonly removalPolicy?: cdk.RemovalPolicy;
}

export interface ApiGatewayProps extends BaseConstructProps {
  readonly throttleRateLimit?: number;
  readonly throttleBurstLimit?: number;
  readonly enableCors?: boolean;
  readonly defaultCorsPreflightOptions?: cdk.aws_apigateway.CorsOptions;
}

export interface MonitoringProps extends BaseConstructProps {
  readonly enableDetailed?: boolean;
  readonly alarmNotificationEmails?: string[];
}