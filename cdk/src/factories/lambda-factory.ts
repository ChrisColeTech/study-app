import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { LambdaProps } from '../types/stack-types';

export class LambdaFactory {
  static createFunction(scope: Construct, id: string, props: LambdaProps): lambda.Function {
    const func = new lambda.Function(scope, id, {
      functionName: `study-app-${props.functionName}-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: props.handler,
      code: lambda.Code.fromAsset('../lambdas/dist'),
      memorySize: props.memorySize || 512,
      timeout: cdk.Duration.seconds(props.timeout || 30),
      environment: {
        NODE_ENV: props.stage,
        STAGE: props.stage,
        ...props.environment,
      },
      logRetention: props.stage === 'prod' 
        ? logs.RetentionDays.ONE_MONTH 
        : logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
      reservedConcurrentExecutions: props.stage === 'prod' ? undefined : 10,
    });

    return func;
  }

  static createAuthFunction(scope: Construct, props: LambdaProps): lambda.Function {
    return this.createFunction(scope, 'AuthFunction', {
      ...props,
      functionName: 'auth-handler',
      handler: 'handlers/auth-handler.handler',
      memorySize: 256,
      timeout: 10,
    });
  }

  static createQuestionFunction(scope: Construct, props: LambdaProps): lambda.Function {
    return this.createFunction(scope, 'QuestionFunction', {
      ...props,
      functionName: 'question-handler',
      handler: 'handlers/question-handler.handler',
      memorySize: 512,
      timeout: 30,
    });
  }

  static createSessionFunction(scope: Construct, props: LambdaProps): lambda.Function {
    return this.createFunction(scope, 'SessionFunction', {
      ...props,
      functionName: 'session-handler',
      handler: 'handlers/session-handler.handler',
      memorySize: 512,
      timeout: 30,
    });
  }

  static createProviderFunction(scope: Construct, props: LambdaProps): lambda.Function {
    return this.createFunction(scope, 'ProviderFunction', {
      ...props,
      functionName: 'provider-handler',
      handler: 'handlers/provider-handler.handler',
      memorySize: 256,
      timeout: 15,
    });
  }

  static createAnalyticsFunction(scope: Construct, props: LambdaProps): lambda.Function {
    return this.createFunction(scope, 'AnalyticsFunction', {
      ...props,
      functionName: 'analytics-handler',
      handler: 'handlers/analytics-handler.handler',
      memorySize: 512,
      timeout: 30,
    });
  }

  static createRecommendationFunction(scope: Construct, props: LambdaProps): lambda.Function {
    return this.createFunction(scope, 'RecommendationFunction', {
      ...props,
      functionName: 'recommendation-handler',
      handler: 'handlers/recommendation-handler.handler',
      memorySize: 512,
      timeout: 30,
    });
  }

  static createAuthorizerFunction(scope: Construct, props: LambdaProps): lambda.Function {
    return this.createFunction(scope, 'AuthorizerFunction', {
      ...props,
      functionName: 'authorizer',
      handler: 'handlers/authorizer.handler',
      memorySize: 128,
      timeout: 5,
    });
  }
}