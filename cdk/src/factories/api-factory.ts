import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { ApiRouteProps } from '../types/stack-types';

export class ApiFactory {
  static createRestApi(scope: Construct, id: string, apiName: string, stage: string): apigateway.RestApi {
    return new apigateway.RestApi(scope, id, {
      restApiName: apiName,
      description: 'Study App REST API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Restrict in production
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
        ],
        maxAge: cdk.Duration.hours(1),
      },
      deployOptions: {
        stageName: stage,
        tracingEnabled: true,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    });
  }

  static createAuthorizer(
    scope: Construct,
    id: string,
    api: apigateway.RestApi,
    authorizerFunction: lambda.Function
  ): apigateway.RequestAuthorizer {
    return new apigateway.RequestAuthorizer(scope, id, {
      handler: authorizerFunction,
      identitySources: ['method.request.header.Authorization'],
      resultsCacheTtl: cdk.Duration.minutes(5),
      authorizerName: 'StudyAppAuthorizer',
    });
  }

  static addRoute(
    resource: apigateway.Resource,
    method: string,
    handler: lambda.Function,
    authorizer?: apigateway.IAuthorizer,
    requestValidator?: apigateway.IRequestValidator
  ): apigateway.Method {
    return resource.addMethod(method, new apigateway.LambdaIntegration(handler), {
      authorizer,
      requestValidator,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
          },
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '401',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });
  }

  static createRequestValidator(
    scope: Construct,
    id: string,
    api: apigateway.RestApi
  ): apigateway.RequestValidator {
    return new apigateway.RequestValidator(scope, id, {
      restApi: api,
      validateRequestBody: true,
      validateRequestParameters: true,
    });
  }
}