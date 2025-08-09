import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiGatewayConfig } from '../types';

export interface ApiConstructProps {
  stage: string;
  config: ApiGatewayConfig;
  functions: {
    authorizerFunction: lambda.Function;
    authFunction: lambda.Function;
    providerFunction: lambda.Function;
    questionFunction: lambda.Function;
    sessionFunction: lambda.Function;
    goalFunction: lambda.Function;
    analyticsFunction: lambda.Function;
    healthFunction: lambda.Function;
  };
}

export class ApiConstruct extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly authorizer: apigateway.TokenAuthorizer;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    // API Gateway CloudWatch Log Group - V2 with new logical ID
    const logGroup = new logs.LogGroup(this, 'API-Logs-V2', {
      logGroupName: `/aws/apigateway/StudyAppV2-${props.stage}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // API Gateway Rest API - V2 with new logical ID
    this.api = new apigateway.RestApi(this, 'API-Gateway-V2', {
      restApiName: `StudyAppV2-API-${props.stage}`,
      description: 'Study App V2 API Gateway with TOKEN authorization',
      deployOptions: {
        stageName: props.config.stage,
        throttlingRateLimit: props.config.throttleRateLimit,
        throttlingBurstLimit: props.config.throttleBurstLimit,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true
        }),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true
      },
      defaultCorsPreflightOptions: props.config.corsEnabled ? {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
          'X-Auth-Token'
        ],
        allowCredentials: true
      } : undefined
    });

    // TOKEN Authorizer - V2 with new logical ID (avoiding REQUEST type)
    this.authorizer = new apigateway.TokenAuthorizer(this, 'Token-Authorizer-V2', {
      authorizerName: `StudyAppV2-Authorizer-${props.stage}`,
      handler: props.functions.authorizerFunction,
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.seconds(props.config.authorizerConfig.resultsCacheTtl),
      validationRegex: '^Bearer [-0-9A-Za-z\\.]+$'
    });

    // Create API resources and methods
    this.createApiResources(props);

    // Output API information
    new cdk.CfnOutput(this, 'API-Gateway-URL-V2', {
      value: this.api.url,
      exportName: `StudyAppV2-API-URL-${props.stage}`
    });

    new cdk.CfnOutput(this, 'API-Gateway-ID-V2', {
      value: this.api.restApiId,
      exportName: `StudyAppV2-API-ID-${props.stage}`
    });
  }

  private createApiResources(props: ApiConstructProps) {
    // API version prefix
    const v1 = this.api.root.addResource('api').addResource('v1');

    // Health endpoint (no auth required)
    const health = v1.addResource('health');
    health.addMethod('GET', new apigateway.LambdaIntegration(props.functions.healthFunction), {
      operationName: 'GetHealth'
    });

    // Auth endpoints (no auth required)
    const auth = v1.addResource('auth');
    auth.addMethod('POST', new apigateway.LambdaIntegration(props.functions.authFunction), {
      operationName: 'AuthenticateUser'
    });

    // Protected endpoints (require TOKEN authorization)
    const authOptions = {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM
    };

    // Providers endpoint
    const providers = v1.addResource('providers');
    providers.addMethod('GET', new apigateway.LambdaIntegration(props.functions.providerFunction), {
      ...authOptions,
      operationName: 'GetProviders'
    });

    // Questions endpoint
    const questions = v1.addResource('questions');
    questions.addMethod('GET', new apigateway.LambdaIntegration(props.functions.questionFunction), {
      ...authOptions,
      operationName: 'GetQuestions'
    });

    // Sessions endpoint
    const sessions = v1.addResource('sessions');
    sessions.addMethod('GET', new apigateway.LambdaIntegration(props.functions.sessionFunction), {
      ...authOptions,
      operationName: 'GetSessions'
    });
    sessions.addMethod('POST', new apigateway.LambdaIntegration(props.functions.sessionFunction), {
      ...authOptions,
      operationName: 'CreateSession'
    });

    // Session by ID
    const sessionById = sessions.addResource('{sessionId}');
    sessionById.addMethod('GET', new apigateway.LambdaIntegration(props.functions.sessionFunction), {
      ...authOptions,
      operationName: 'GetSession'
    });
    sessionById.addMethod('PUT', new apigateway.LambdaIntegration(props.functions.sessionFunction), {
      ...authOptions,
      operationName: 'UpdateSession'
    });
    sessionById.addMethod('DELETE', new apigateway.LambdaIntegration(props.functions.sessionFunction), {
      ...authOptions,
      operationName: 'DeleteSession'
    });

    // Goals endpoint
    const goals = v1.addResource('goals');
    goals.addMethod('GET', new apigateway.LambdaIntegration(props.functions.goalFunction), {
      ...authOptions,
      operationName: 'GetGoals'
    });
    goals.addMethod('POST', new apigateway.LambdaIntegration(props.functions.goalFunction), {
      ...authOptions,
      operationName: 'CreateGoal'
    });

    // Goal by ID
    const goalById = goals.addResource('{goalId}');
    goalById.addMethod('GET', new apigateway.LambdaIntegration(props.functions.goalFunction), {
      ...authOptions,
      operationName: 'GetGoal'
    });
    goalById.addMethod('PUT', new apigateway.LambdaIntegration(props.functions.goalFunction), {
      ...authOptions,
      operationName: 'UpdateGoal'
    });
    goalById.addMethod('DELETE', new apigateway.LambdaIntegration(props.functions.goalFunction), {
      ...authOptions,
      operationName: 'DeleteGoal'
    });

    // Analytics endpoint
    const analytics = v1.addResource('analytics');
    analytics.addMethod('GET', new apigateway.LambdaIntegration(props.functions.analyticsFunction), {
      ...authOptions,
      operationName: 'GetAnalytics'
    });
    analytics.addMethod('POST', new apigateway.LambdaIntegration(props.functions.analyticsFunction), {
      ...authOptions,
      operationName: 'RecordAnalytics'
    });
  }
}