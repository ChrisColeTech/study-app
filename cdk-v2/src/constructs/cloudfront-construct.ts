import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CloudFrontConfig } from '../types';

export interface CloudFrontConstructProps {
  stage: string;
  config: CloudFrontConfig;
  api: apigateway.RestApi;
  staticBucket?: s3.Bucket;
}

export class CloudFrontConstruct extends Construct {
  public readonly distribution: cloudfront.Distribution;
  public readonly originRequestPolicy: cloudfront.OriginRequestPolicy;
  public readonly cachePolicy: cloudfront.CachePolicy;

  constructor(scope: Construct, id: string, props: CloudFrontConstructProps) {
    super(scope, id);

    // Custom Origin Request Policy - V2 with new logical ID
    // This FIXES the JWT header truncation issue from V1
    this.originRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'Origin-Request-Policy-V2', {
      originRequestPolicyName: `StudyAppV2-OriginPolicy-${props.stage}`,
      comment: 'V2 Origin request policy with full header forwarding for JWT tokens',
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.all(), // Forward ALL headers
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.all()
    });

    // Custom Cache Policy - V2 with new logical ID
    this.cachePolicy = new cloudfront.CachePolicy(this, 'Cache-Policy-V2', {
      cachePolicyName: `StudyAppV2-CachePolicy-${props.stage}`,
      comment: 'V2 Cache policy for API responses with auth headers',
      defaultTtl: cdk.Duration.minutes(5),
      maxTtl: cdk.Duration.hours(24),
      minTtl: cdk.Duration.seconds(0),
      // Include Authorization header in cache key for proper caching
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization', 'Content-Type'),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      enableAcceptEncodingBrotli: true,
      enableAcceptEncodingGzip: true
    });

    // API Gateway Origin with domain name
    const apiOrigin = new origins.RestApiOrigin(props.api, {
      customHeaders: {
        'X-CloudFront-Version': 'V2'
      }
    });

    // CloudFront Distribution - V2 with new logical ID
    this.distribution = new cloudfront.Distribution(this, 'CloudFront-Distribution-V2', {
      comment: `StudyApp V2 CloudFront Distribution - ${props.stage}`,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      enabled: true,
      enableIpv6: true,
      
      // API behavior (default)
      defaultBehavior: {
        origin: apiOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: this.cachePolicy,
        originRequestPolicy: this.originRequestPolicy,
        compress: true,
        
        // Use managed CORS response headers policy
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT
      },

      // Additional behaviors for static assets if S3 bucket provided
      additionalBehaviors: props.staticBucket ? {
        '/static/*': {
          origin: new origins.S3Origin(props.staticBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true
        }
      } : undefined,

      // Error responses
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5)
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5)
        }
      ]
    });

    // Output CloudFront information
    new cdk.CfnOutput(this, 'CloudFront-URL-V2', {
      value: `https://${this.distribution.distributionDomainName}`,
      exportName: `StudyAppV2-CloudFront-URL-${props.stage}`
    });

    new cdk.CfnOutput(this, 'CloudFront-Distribution-ID-V2', {
      value: this.distribution.distributionId,
      exportName: `StudyAppV2-CloudFront-ID-${props.stage}`
    });
  }
}