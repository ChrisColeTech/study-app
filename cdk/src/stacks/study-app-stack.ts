import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

import { DatabaseConstruct } from '../constructs/database-construct';
import { StorageConstruct } from '../constructs/storage-construct';
import { AuthConstruct } from '../constructs/auth-construct';
import { LambdaFactory } from '../factories/lambda-factory';
import { ApiFactory } from '../factories/api-factory';
import { StudyAppStackProps } from '../types/stack-types';

export class StudyAppStack extends cdk.Stack {
  public readonly database: DatabaseConstruct;
  public readonly storage: StorageConstruct;
  public readonly auth: AuthConstruct;
  public readonly api: apigateway.RestApi;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: StudyAppStackProps) {
    super(scope, id, props);

    const { stage } = props;
    const account = this.account;

    // Create constructs
    this.database = new DatabaseConstruct(this, 'Database', {
      stage,
      mainTableName: `study-app-main-${stage}`,
      cacheTableName: `study-app-cache-${stage}`,
    });

    this.storage = new StorageConstruct(this, 'Storage', {
      stage,
      dataBucketName: `study-app-data-${stage}-${account}`,
      frontendBucketName: `study-app-frontend-${stage}-${account}`,
    });

    this.auth = new AuthConstruct(this, 'Auth', {
      stage,
      secretName: `study-app-jwt-secret-${stage}`,
    });

    // Common Lambda environment variables
    const commonEnv = {
      MAIN_TABLE_NAME: this.database.mainTable.tableName,
      CACHE_TABLE_NAME: this.database.cacheTable.tableName,
      DATA_BUCKET_NAME: this.storage.dataBucket.bucketName,
      JWT_SECRET_NAME: this.auth.jwtSecret.secretName,
      STAGE: stage,
    };

    // Create Lambda functions using factory
    const authFunction = LambdaFactory.createAuthFunction(this, {
      stage,
      functionName: 'auth-handler',
      handler: 'handlers/auth-handler.handler',
      environment: commonEnv,
    });

    const questionFunction = LambdaFactory.createQuestionFunction(this, {
      stage,
      functionName: 'question-handler',
      handler: 'handlers/question-handler.handler',
      environment: commonEnv,
    });

    const sessionFunction = LambdaFactory.createSessionFunction(this, {
      stage,
      functionName: 'session-handler',
      handler: 'handlers/session-handler.handler',
      environment: commonEnv,
    });

    const providerFunction = LambdaFactory.createProviderFunction(this, {
      stage,
      functionName: 'provider-handler',
      handler: 'handlers/provider-handler.handler',
      environment: commonEnv,
    });

    const analyticsFunction = LambdaFactory.createAnalyticsFunction(this, {
      stage,
      functionName: 'analytics-handler',
      handler: 'handlers/analytics-handler.handler',
      environment: commonEnv,
    });

    const recommendationFunction = LambdaFactory.createRecommendationFunction(this, {
      stage,
      functionName: 'recommendation-handler',
      handler: 'handlers/recommendation-handler.handler',
      environment: commonEnv,
    });

    const authorizerFunction = LambdaFactory.createAuthorizerFunction(this, {
      stage,
      functionName: 'authorizer',
      handler: 'handlers/authorizer.handler',
      environment: {
        JWT_SECRET_NAME: this.auth.jwtSecret.secretName,
        STAGE: stage,
      },
    });

    // Grant permissions to Lambda functions
    this.grantPermissions(authFunction, questionFunction, sessionFunction, 
                         providerFunction, analyticsFunction, recommendationFunction, authorizerFunction);

    // Create API Gateway
    this.api = ApiFactory.createRestApi(this, 'API', `study-app-api-${stage}`);

    const authorizer = ApiFactory.createAuthorizer(
      this, 'Authorizer', this.api, authorizerFunction
    );

    const validator = ApiFactory.createRequestValidator(
      this, 'RequestValidator', this.api
    );

    // Create API routes
    this.createApiRoutes(authorizer, validator, {
      authFunction,
      questionFunction,
      sessionFunction,
      providerFunction,
      analyticsFunction,
      recommendationFunction,
    });

    // Create CloudFront distribution
    this.distribution = this.createCloudFrontDistribution();

    // Output important values
    this.createOutputs();
  }

  private grantPermissions(...functions: any[]) {
    functions.forEach(func => {
      // DynamoDB permissions
      this.database.mainTable.grantReadWriteData(func);
      this.database.cacheTable.grantReadWriteData(func);

      // S3 permissions
      this.storage.dataBucket.grantRead(func);
      this.storage.frontendBucket.grantRead(func);

      // Secrets Manager permissions
      this.auth.jwtSecret.grantRead(func);
    });
  }

  private createApiRoutes(authorizer: apigateway.IAuthorizer, validator: apigateway.IRequestValidator, functions: any) {
    const v1 = this.api.root.addResource('api').addResource('v1');

    // Auth routes (no authorization required)
    const auth = v1.addResource('auth');
    ApiFactory.addRoute(auth.addResource('register'), 'POST', functions.authFunction, undefined, validator);
    ApiFactory.addRoute(auth.addResource('login'), 'POST', functions.authFunction, undefined, validator);
    ApiFactory.addRoute(auth.addResource('refresh'), 'POST', functions.authFunction, undefined, validator);
    ApiFactory.addRoute(auth.addResource('logout'), 'POST', functions.authFunction, authorizer);

    // Provider routes (authorization required)
    const providers = v1.addResource('providers');
    ApiFactory.addRoute(providers, 'GET', functions.providerFunction, authorizer);
    ApiFactory.addRoute(providers.addResource('{providerId}'), 'GET', functions.providerFunction, authorizer);
    ApiFactory.addRoute(providers.addResource('{providerId}').addResource('exams'), 'GET', functions.providerFunction, authorizer);

    // Question routes (authorization required)  
    const questions = v1.addResource('questions');
    ApiFactory.addRoute(questions, 'GET', functions.questionFunction, authorizer);
    ApiFactory.addRoute(questions.addResource('search'), 'POST', functions.questionFunction, authorizer, validator);
    ApiFactory.addRoute(questions.addResource('{questionId}'), 'GET', functions.questionFunction, authorizer);

    // Session routes (authorization required)
    const sessions = v1.addResource('sessions');
    ApiFactory.addRoute(sessions, 'POST', functions.sessionFunction, authorizer, validator);
    ApiFactory.addRoute(sessions, 'GET', functions.sessionFunction, authorizer);
    ApiFactory.addRoute(sessions.addResource('{sessionId}'), 'GET', functions.sessionFunction, authorizer);
    ApiFactory.addRoute(sessions.addResource('{sessionId}'), 'PUT', functions.sessionFunction, authorizer, validator);
    ApiFactory.addRoute(sessions.addResource('{sessionId}'), 'DELETE', functions.sessionFunction, authorizer);
    ApiFactory.addRoute(sessions.addResource('{sessionId}').addResource('answers'), 'POST', functions.sessionFunction, authorizer, validator);
    ApiFactory.addRoute(sessions.addResource('adaptive'), 'POST', functions.sessionFunction, authorizer, validator);

    // Analytics routes (authorization required)
    const analytics = v1.addResource('analytics');
    ApiFactory.addRoute(analytics.addResource('progress'), 'GET', functions.analyticsFunction, authorizer);
    ApiFactory.addRoute(analytics.addResource('sessions').addResource('{sessionId}'), 'GET', functions.analyticsFunction, authorizer);
    ApiFactory.addRoute(analytics.addResource('performance'), 'GET', functions.analyticsFunction, authorizer);

    // Recommendation routes (authorization required)
    ApiFactory.addRoute(v1.addResource('recommendations'), 'GET', functions.recommendationFunction, authorizer);
  }

  private createCloudFrontDistribution(): cloudfront.Distribution {
    return new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.storage.frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.RestApiOrigin(this.api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPA routing support
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });
  }

  private createOutputs() {
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront distribution URL',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
    });
  }
}