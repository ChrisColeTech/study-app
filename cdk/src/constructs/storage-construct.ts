import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { StorageProps } from '../types/stack-types';

export class StorageConstruct extends Construct {
  public readonly dataBucket: s3.Bucket;
  public readonly frontendBucket: s3.Bucket;
  public readonly buckets: Record<string, s3.Bucket>;

  constructor(scope: Construct, id: string, props: StorageProps) {
    super(scope, id);

    // Data bucket for question data storage
    this.dataBucket = new s3.Bucket(this, 'DataBucket', {
      bucketName: props.dataBucketName,
      versioned: props.stage === 'prod',
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Use RETAIN for production
      autoDeleteObjects: true, // Only for non-prod
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // Restrict in production
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
    });

    // Frontend hosting bucket
    this.frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: props.frontendBucketName,
      versioned: props.stage === 'prod',
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Use RETAIN for production
      autoDeleteObjects: true, // Only for non-prod
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPA routing support
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'], // Restrict in production
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
    });

    this.buckets = {
      data: this.dataBucket,
      frontend: this.frontendBucket,
    };

    // Output bucket names
    new cdk.CfnOutput(this, 'DataBucketName', {
      value: this.dataBucket.bucketName,
      description: 'S3 bucket for question data',
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.frontendBucket.bucketName,
      description: 'S3 bucket for frontend hosting',
    });

    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: this.frontendBucket.bucketWebsiteUrl,
      description: 'Website URL for frontend bucket',
    });
  }
}