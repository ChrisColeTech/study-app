import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { S3Config } from '../types';

export interface StorageConstructProps {
  stage: string;
  config: S3Config;
}

export class StorageConstruct extends Construct {
  public readonly dataBucket: s3.Bucket;
  public readonly staticBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageConstructProps) {
    super(scope, id);

    // Data Bucket for study materials - V2 with new logical ID
    this.dataBucket = new s3.Bucket(this, 'Data-Bucket-V2', {
      bucketName: `studyappv2-data-${props.stage}-${cdk.Stack.of(this).account}`,
      versioned: props.config.versioning,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: props.config.encryption === 'KMS' 
        ? s3.BucketEncryption.KMS_MANAGED 
        : s3.BucketEncryption.S3_MANAGED,
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.stage !== 'prod',
      
      // Lifecycle rules for cost optimization
      lifecycleRules: props.config.lifecycleRules ? [
        {
          id: 'V2-Data-Lifecycle',
          enabled: true,
          expiration: cdk.Duration.days(365), // Delete after 1 year
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30)
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90)
            }
          ]
        }
      ] : undefined,

      // CORS configuration for web access
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
          allowedOrigins: ['*'], // Configure specific origins in production
          allowedHeaders: ['*'],
          maxAge: 3600
        }
      ],

      // Server access logging
      serverAccessLogsBucket: props.stage === 'prod' ? new s3.Bucket(this, 'Access-Logs-Bucket-V2', {
        bucketName: `studyappv2-access-logs-${props.stage}-${cdk.Stack.of(this).account}`,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        lifecycleRules: [{
          id: 'DeleteOldLogs',
          enabled: true,
          expiration: cdk.Duration.days(90)
        }]
      }) : undefined
    });

    // Static Assets Bucket for frontend - V2 with new logical ID
    this.staticBucket = new s3.Bucket(this, 'Static-Bucket-V2', {
      bucketName: `studyappv2-static-${props.stage}-${cdk.Stack.of(this).account}`,
      versioned: false,
      publicReadAccess: true, // For CloudFront access
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        blockPublicPolicy: false,
        ignorePublicAcls: true,
        restrictPublicBuckets: false
      }),
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.stage !== 'prod',
      
      // Website configuration
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',

      // CORS configuration
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600
        }
      ]
    });

    // Bucket policy for CloudFront access to static bucket
    this.staticBucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'CloudFront-Access-V2',
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      actions: ['s3:GetObject'],
      resources: [`${this.staticBucket.bucketArn}/*`]
    }));

    // Create folder structure in data bucket
    this.createDataBucketStructure();

    // Output bucket information
    new cdk.CfnOutput(this, 'Data-Bucket-Name-V2', {
      value: this.dataBucket.bucketName,
      exportName: `StudyAppV2-DataBucket-${props.stage}`
    });

    new cdk.CfnOutput(this, 'Static-Bucket-Name-V2', {
      value: this.staticBucket.bucketName,
      exportName: `StudyAppV2-StaticBucket-${props.stage}`
    });

    new cdk.CfnOutput(this, 'Static-Website-URL-V2', {
      value: this.staticBucket.bucketWebsiteUrl,
      exportName: `StudyAppV2-StaticWebsiteURL-${props.stage}`
    });
  }

  private createDataBucketStructure() {
    // Create logical folder structure via deployment
    const folders = [
      'providers/',
      'providers/aws/',
      'providers/azure/',
      'providers/gcp/',
      'questions/',
      'questions/aws/',
      'questions/azure/',
      'questions/gcp/',
      'exports/',
      'uploads/',
      'temp/'
    ];

    // Note: Actual folder creation would be done via custom resource or initial deployment script
    // This is documented for reference
  }
}