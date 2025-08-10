export interface EnvironmentConfig {
  readonly environment: string;
  readonly isProduction: boolean;
  readonly lambdaTimeout: number;
  readonly lambdaMemorySize: number;
  readonly apiThrottleRateLimit: number;
  readonly apiThrottleBurstLimit: number;
  readonly dynamoDbBillingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
  readonly logRetentionDays: number;
}

export class StackConfig {
  public static getConfig(environment: string): EnvironmentConfig {
    switch (environment.toLowerCase()) {
      case 'prod':
      case 'production':
        return {
          environment: 'prod',
          isProduction: true,
          lambdaTimeout: 30,
          lambdaMemorySize: 1024,
          apiThrottleRateLimit: 1000,
          apiThrottleBurstLimit: 2000,
          dynamoDbBillingMode: 'PAY_PER_REQUEST',
          logRetentionDays: 90,
        };
      
      case 'staging':
      case 'stage':
        return {
          environment: 'staging',
          isProduction: false,
          lambdaTimeout: 30,
          lambdaMemorySize: 512,
          apiThrottleRateLimit: 100,
          apiThrottleBurstLimit: 200,
          dynamoDbBillingMode: 'PAY_PER_REQUEST',
          logRetentionDays: 30,
        };
      
      case 'dev':
      case 'development':
      default:
        return {
          environment: 'dev',
          isProduction: false,
          lambdaTimeout: 30,
          lambdaMemorySize: 256,
          apiThrottleRateLimit: 50,
          apiThrottleBurstLimit: 100,
          dynamoDbBillingMode: 'PAY_PER_REQUEST',
          logRetentionDays: 14,
        };
    }
  }

  public static getResourceName(baseName: string, environment: string): string {
    return `study-app-v3-${environment}-${baseName}`;
  }
}