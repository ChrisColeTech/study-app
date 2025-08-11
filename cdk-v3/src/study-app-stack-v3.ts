import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseConstruct } from './constructs/database-construct';
import { StorageConstruct } from './constructs/storage-construct';
import { LambdaConstruct } from './constructs/lambda-construct';
import { ApiGatewayConstruct } from './constructs/api-gateway-construct';
import { MonitoringConstruct } from './constructs/monitoring-construct';

export interface StudyAppStackV3Props extends cdk.StackProps {
  environment: string;
}

export class StudyAppStackV3 extends cdk.Stack {
  public readonly database: DatabaseConstruct;
  public readonly storage: StorageConstruct;
  public readonly lambdas: LambdaConstruct;
  public readonly api: ApiGatewayConstruct;
  public readonly monitoring: MonitoringConstruct;

  constructor(scope: Construct, id: string, props: StudyAppStackV3Props) {
    super(scope, id, props);

    // Create database infrastructure (DynamoDB tables)
    this.database = new DatabaseConstruct(this, 'Database', {
      environment: props.environment,
    });

    // Create storage infrastructure (S3 buckets)
    this.storage = new StorageConstruct(this, 'Storage', {
      environment: props.environment,
    });

    // Create Lambda functions
    this.lambdas = new LambdaConstruct(this, 'Lambdas', {
      environment: props.environment,
      usersTable: this.database.usersTable,
      studySessionsTable: this.database.studySessionsTable,
      userProgressTable: this.database.userProgressTable,
      goalsTable: this.database.goalsTable,
      questionDataBucket: this.storage.questionDataBucket,
      assetsBucket: this.storage.assetsBucket,
    });

    // Create API Gateway with Lambda integrations
    this.api = new ApiGatewayConstruct(this, 'Api', {
      environment: props.environment,
      lambdaFunctions: this.lambdas.functions,
    });

    // Create monitoring and logging infrastructure
    this.monitoring = new MonitoringConstruct(this, 'Monitoring', {
      environment: props.environment,
      api: this.api.restApi,
      lambdaFunctions: this.lambdas.functions,
    });

    // Stack outputs for reference
    new cdk.CfnOutput(this, 'StudyAppApiUrl', {
      value: this.api.restApi.url,
      description: 'Study App V3 API Gateway URL',
      exportName: `StudyAppV3-${props.environment}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'StudyAppQuestionBucket', {
      value: this.storage.questionDataBucket.bucketName,
      description: 'Question data S3 bucket name',
      exportName: `StudyAppV3-${props.environment}-QuestionBucket`,
    });
  }
}