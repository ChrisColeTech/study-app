import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackConfig } from '../shared/stack-config';
import { DatabaseProps } from '../shared/common-props';

export class DatabaseConstruct extends Construct {
  public readonly usersTable: cdk.aws_dynamodb.Table;
  public readonly studySessionsTable: cdk.aws_dynamodb.Table;
  public readonly userProgressTable: cdk.aws_dynamodb.Table;
  public readonly goalsTable: cdk.aws_dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    const config = StackConfig.getConfig(props.environment);
    const removalPolicy = config.isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // Users Table with email GSI
    this.usersTable = new cdk.aws_dynamodb.Table(this, 'UsersTable', {
      tableName: StackConfig.getResourceName('users', props.environment),
      partitionKey: {
        name: 'userId',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.isProduction,
      removalPolicy,
      stream: cdk.aws_dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for email lookup
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: {
        name: 'email',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
    });

    // Study Sessions Table with userId GSI
    this.studySessionsTable = new cdk.aws_dynamodb.Table(this, 'StudySessionsTable', {
      tableName: StackConfig.getResourceName('study-sessions', props.environment),
      partitionKey: {
        name: 'sessionId',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.isProduction,
      removalPolicy,
    });

    // GSI for user session lookup
    this.studySessionsTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: {
        name: 'userId',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
    });

    // User Progress Table (V2 - with progressKey)
    this.userProgressTable = new cdk.aws_dynamodb.Table(this, 'UserProgressTableV2', {
      tableName: StackConfig.getResourceName('user-progress', props.environment),
      partitionKey: {
        name: 'userId',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'progressKey',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.isProduction,
      removalPolicy,
    });

    // Goals Table  
    this.goalsTable = new cdk.aws_dynamodb.Table(this, 'GoalsTable', {
      tableName: StackConfig.getResourceName('goals', props.environment),
      partitionKey: {
        name: 'goalId',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.isProduction,
      removalPolicy,
    });

    // GSI for user goals lookup
    this.goalsTable.addGlobalSecondaryIndex({
      indexName: 'UserGoalsIndex',
      partitionKey: {
        name: 'userId',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
    });

    // Output table names for reference
    new cdk.CfnOutput(scope, 'UsersTableName', {
      value: this.usersTable.tableName,
      description: 'Users DynamoDB table name',
    });

    new cdk.CfnOutput(scope, 'StudySessionsTableName', {
      value: this.studySessionsTable.tableName,
      description: 'Study Sessions DynamoDB table name',
    });

    new cdk.CfnOutput(scope, 'UserProgressTableName', {
      value: this.userProgressTable.tableName,
      description: 'User Progress DynamoDB table name',
    });

    new cdk.CfnOutput(scope, 'GoalsTableName', {
      value: this.goalsTable.tableName,
      description: 'Goals DynamoDB table name',
    });
  }
}