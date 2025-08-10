import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackConfig } from '../shared/stack-config';
import { StorageProps } from '../shared/common-props';

export class StorageConstruct extends Construct {
  public readonly questionDataBucket: cdk.aws_s3.Bucket;
  public readonly assetsBucket: cdk.aws_s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageProps) {
    super(scope, id);

    const config = StackConfig.getConfig(props.environment);
    const removalPolicy = config.isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // Question Data Bucket - stores question JSON files organized by provider/exam
    this.questionDataBucket = new cdk.aws_s3.Bucket(this, 'QuestionDataBucket', {
      bucketName: StackConfig.getResourceName('question-data', props.environment),
      versioned: config.isProduction,
      publicReadAccess: false,
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
          enabled: true,
        },
      ],
      removalPolicy,
      autoDeleteObjects: !config.isProduction,
    });

    // Assets Bucket - stores static assets, images, etc.
    this.assetsBucket = new cdk.aws_s3.Bucket(this, 'AssetsBucket', {
      bucketName: StackConfig.getResourceName('assets', props.environment),
      versioned: false,
      publicReadAccess: true, // For serving static assets
      blockPublicAccess: new cdk.aws_s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedMethods: [
            cdk.aws_s3.HttpMethods.GET,
            cdk.aws_s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      removalPolicy,
      autoDeleteObjects: !config.isProduction,
    });

    // Create folder structure in question data bucket
    // TODO: Add folder structure initialization in Phase 2
    // new cdk.aws_s3_deployment.BucketDeployment(this, 'QuestionDataFolders', {
    //   sources: [
    //     cdk.aws_s3_deployment.Source.data('README.txt', 'Question data folder structure initialized')
    //   ],
    //   destinationBucket: this.questionDataBucket,
    //   destinationKeyPrefix: 'aws/saa-c03/',
    // });

    // Output bucket names for reference
    new cdk.CfnOutput(scope, 'QuestionDataBucketName', {
      value: this.questionDataBucket.bucketName,
      description: 'Question data S3 bucket name',
    });

    new cdk.CfnOutput(scope, 'AssetsBucketName', {
      value: this.assetsBucket.bucketName,
      description: 'Assets S3 bucket name',
    });
  }
}