import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackConfig } from '../shared/stack-config';
import { ApiGatewayProps } from '../shared/common-props';

export interface ApiGatewayConstructProps extends ApiGatewayProps {
  readonly lambdaFunctions: { [key: string]: cdk.aws_lambda.Function };
}

export class ApiGatewayConstruct extends Construct {
  public readonly restApi: cdk.aws_apigateway.RestApi;

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

    // Authorization will be implemented in a future phase

    // API version 1 routes
    const v1 = this.restApi.root.addResource('v1');

    // Health endpoints under v1 for consistency
    const healthResource = v1.addResource('health');
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

    // Auth endpoints with proper sub-paths
    const authResource = v1.addResource('auth');
    const authLambda = props.lambdaFunctions.auth;
    const authIntegration = new cdk.aws_apigateway.LambdaIntegration(authLambda, {
      proxy: true,
      allowTestInvoke: !config.isProduction,
    });

    // Auth sub-resources (all public - no authorization)
    const authSubPaths = ['register', 'login', 'refresh', 'logout', 'verify'];
    authSubPaths.forEach(subPath => {
      const subResource = authResource.addResource(subPath);
      subResource.addMethod('POST', authIntegration);
      if (subPath === 'verify') {
        subResource.addMethod('GET', authIntegration); // GET for token verification
      }
    });

    // Providers endpoints with special handling
    const providersResource = v1.addResource('providers');
    const providersLambda = props.lambdaFunctions.providers;
    const providersIntegration = new cdk.aws_apigateway.LambdaIntegration(providersLambda, {
      proxy: true,
      allowTestInvoke: !config.isProduction,
    });

    // Provider endpoints
    providersResource.addMethod('GET', providersIntegration);
    providersResource.addMethod('POST', providersIntegration);

    // Add {id} resource for individual provider operations
    const providerIdResource = providersResource.addResource('{id}');
    providerIdResource.addMethod('GET', providersIntegration);
    providerIdResource.addMethod('PUT', providersIntegration);
    providerIdResource.addMethod('DELETE', providersIntegration);

    // Add provider sub-resources BEFORE {providerId} to avoid conflicts
    const providerCacheResource = providersResource.addResource('cache');
    const providerRefreshResource = providerCacheResource.addResource('refresh');
    providerRefreshResource.addMethod('POST', providersIntegration);

    const providerRecommendationsResource = providersResource.addResource('recommendations');
    const personalizedRecommendationsResource = providerRecommendationsResource.addResource('personalized');
    personalizedRecommendationsResource.addMethod('POST', providersIntegration);

    // Provider-specific sub-resources after {providerId}
    const providerIdRoadmapsResource = providerIdResource.addResource('roadmaps');
    providerIdRoadmapsResource.addMethod('GET', providersIntegration);
    
    const providerIdRecommendationsResource = providerIdResource.addResource('recommendations');
    const studyPathsResource = providerIdRecommendationsResource.addResource('study-paths');
    studyPathsResource.addMethod('POST', providersIntegration);
    
    const providerIdResourcesResource = providerIdResource.addResource('resources');
    providerIdResourcesResource.addMethod('GET', providersIntegration);

    // Provider-specific exams endpoint (for exam service)
    const providerExamsResource = providerIdResource.addResource('exams');
    const examsLambda = props.lambdaFunctions.exams;
    providerExamsResource.addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(examsLambda, {
      proxy: true,
      allowTestInvoke: !config.isProduction,
    }));

    // Exams endpoints with special handling - Phase 8
    const examsResource = v1.addResource('exams');
    const examsIntegration = new cdk.aws_apigateway.LambdaIntegration(examsLambda, {
      proxy: true,
      allowTestInvoke: !config.isProduction,
    });

    // Main exams endpoints
    examsResource.addMethod('GET', examsIntegration);

    // Add exam sub-resources BEFORE {id} to avoid conflicts
    const examSearchResource = examsResource.addResource('search');
    examSearchResource.addMethod('GET', examsIntegration);

    const examCompareResource = examsResource.addResource('compare');
    examCompareResource.addMethod('POST', examsIntegration);

    const examCacheResource = examsResource.addResource('cache');
    const examRefreshResource = examCacheResource.addResource('refresh');
    examRefreshResource.addMethod('POST', examsIntegration);

    // Add {id} resource for individual exam operations AFTER specific sub-resources
    const examIdResource = examsResource.addResource('{id}');
    examIdResource.addMethod('GET', examsIntegration);

    // Other endpoint configurations (simplified placeholders)
    const placeholderConfigs = [
      { resource: 'topics', methods: ['GET'] },
      { resource: 'questions', methods: ['GET', 'POST'] },
      { resource: 'sessions', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
      { resource: 'analytics', methods: ['GET', 'POST'] },
      { resource: 'goals', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    ];

    // Create placeholder endpoints
    placeholderConfigs.forEach(({ resource, methods }) => {
      const apiResource = v1.addResource(resource);
      const lambda = props.lambdaFunctions[resource];
      
      methods.forEach(method => {
        const integration = new cdk.aws_apigateway.LambdaIntegration(lambda, {
          proxy: true,
          allowTestInvoke: !config.isProduction,
        });

        apiResource.addMethod(method, integration);
      });

      // Add {id} resource for individual resource operations
      const idResource = apiResource.addResource('{id}');
      ['GET', 'PUT', 'DELETE'].forEach(method => {
        idResource.addMethod(method, new cdk.aws_apigateway.LambdaIntegration(lambda, {
          proxy: true,
        }));
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