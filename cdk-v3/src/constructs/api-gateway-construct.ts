import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackConfig } from '../shared/stack-config';
import { ApiGatewayProps } from '../shared/common-props';

export interface ApiGatewayConstructProps extends ApiGatewayProps {
  readonly lambdaFunctions: { [key: string]: cdk.aws_lambda.Function };
}

export class ApiGatewayConstruct extends Construct {
  public readonly restApi: cdk.aws_apigateway.RestApi;
  public readonly tokenAuthorizer: cdk.aws_apigateway.TokenAuthorizer;

  constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    const config = StackConfig.getConfig(props.environment);

    // Create REST API
    this.restApi = new cdk.aws_apigateway.RestApi(this, 'StudyAppApi', {
      restApiName: StackConfig.getResourceName('api', props.environment),
      description: `Study App V3 API - ${props.environment} environment`,
      endpointConfiguration: {
        types: [cdk.aws_apigateway.EndpointType.REGIONAL],
      },
      deployOptions: {
        stageName: props.environment,
        throttlingRateLimit: config.apiThrottleRateLimit,
        throttlingBurstLimit: config.apiThrottleBurstLimit,
        loggingLevel: config.isProduction ? 
          cdk.aws_apigateway.MethodLoggingLevel.ERROR : 
          cdk.aws_apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: !config.isProduction,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: config.isProduction ? 
          ['https://study-app-v3.com'] : // Replace with actual domain
          ['*'],
        allowMethods: cdk.aws_apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Create TOKEN authorizer for protected endpoints (placeholder for Phase 2)
    this.tokenAuthorizer = new cdk.aws_apigateway.TokenAuthorizer(this, 'TokenAuthorizer', {
      handler: props.lambdaFunctions.auth, // Will be properly implemented in Phase 2
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // Health endpoint (public - no authorization required)
    const healthResource = this.restApi.root.addResource('health');
    healthResource.addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(
      props.lambdaFunctions.health,
      {
        proxy: true,
        allowTestInvoke: !config.isProduction,
      }
    ));

    // System status endpoint (public)
    healthResource.addResource('status').addMethod('GET', 
      new cdk.aws_apigateway.LambdaIntegration(props.lambdaFunctions.health, {
        proxy: true,
        allowTestInvoke: !config.isProduction,
      })
    );

    // API version 1 routes
    const v1 = this.restApi.root.addResource('v1');

    // Phase 1: Minimal endpoint structure for future implementation
    const endpointConfigs = [
      { resource: 'auth', methods: ['POST', 'GET', 'PUT', 'DELETE'] },
      { resource: 'providers', methods: ['GET'] },
      { resource: 'exams', methods: ['GET'] },
      { resource: 'topics', methods: ['GET'] },
      { resource: 'questions', methods: ['GET', 'POST'] },
      { resource: 'sessions', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
      { resource: 'analytics', methods: ['GET', 'POST'] },
      { resource: 'goals', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    ];

    // Create placeholder endpoints
    endpointConfigs.forEach(({ resource, methods }) => {
      const apiResource = v1.addResource(resource);
      const lambda = props.lambdaFunctions[resource];
      
      methods.forEach(method => {
        const integration = new cdk.aws_apigateway.LambdaIntegration(lambda, {
          proxy: true,
          allowTestInvoke: !config.isProduction,
        });

        // Apply authorization based on endpoint
        const methodOptions: cdk.aws_apigateway.MethodOptions = {
          authorizer: resource === 'providers' || resource === 'exams' || resource === 'topics' || resource === 'auth' ? 
            undefined : // Public endpoints (including auth for registration/login)
            this.tokenAuthorizer, // Protected endpoints
        };

        apiResource.addMethod(method, integration, methodOptions);
      });

      // Add {id} resource for individual resource operations
      const idResource = apiResource.addResource('{id}');
      ['GET', 'PUT', 'DELETE'].forEach(method => {
        idResource.addMethod(method, new cdk.aws_apigateway.LambdaIntegration(lambda, {
          proxy: true,
        }), {
          authorizer: resource === 'providers' || resource === 'exams' || resource === 'topics' || resource === 'auth' ? 
            undefined : this.tokenAuthorizer, // Auth endpoints should also be public
        });
      });
    });

    // Output API URL
    new cdk.CfnOutput(scope, 'ApiUrl', {
      value: this.restApi.url,
      description: 'Study App V3 REST API URL',
    });

    new cdk.CfnOutput(scope, 'ApiId', {
      value: this.restApi.restApiId,
      description: 'Study App V3 REST API ID',
    });
  }
}