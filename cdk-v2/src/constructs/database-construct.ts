import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseConfig } from '../types';

export interface DatabaseConstructProps {
  stage: string;
  config: DatabaseConfig;
}

export class DatabaseConstruct extends Construct {
  public readonly usersTable: dynamodb.Table;
  public readonly sessionsTable: dynamodb.Table;
  public readonly goalsTable: dynamodb.Table;
  public readonly analyticsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
    super(scope, id);

    // Users Table - V2 with new logical ID
    this.usersTable = new dynamodb.Table(this, 'Users-Table-V2', {
      tableName: `StudyAppV2-Users-${props.stage}`,
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: props.config.pointInTimeRecovery,
      encryption: props.config.encryption ? dynamodb.TableEncryption.AWS_MANAGED : undefined,
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for email-based user lookup
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: {
        name: 'email',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // Sessions Table - V2 with new logical ID
    this.sessionsTable = new dynamodb.Table(this, 'Sessions-Table-V2', {
      tableName: `StudyAppV2-Sessions-${props.stage}`,
      partitionKey: {
        name: 'sessionId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: props.config.pointInTimeRecovery,
      encryption: props.config.encryption ? dynamodb.TableEncryption.AWS_MANAGED : undefined,
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      // TTL for session cleanup
      timeToLiveAttribute: 'expiresAt'
    });

    // Add GSI for user-based session queries
    this.sessionsTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // Goals Table - V2 with new logical ID
    this.goalsTable = new dynamodb.Table(this, 'Goals-Table-V2', {
      tableName: `StudyAppV2-Goals-${props.stage}`,
      partitionKey: {
        name: 'goalId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: props.config.pointInTimeRecovery,
      encryption: props.config.encryption ? dynamodb.TableEncryption.AWS_MANAGED : undefined,
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for user-based goal queries
    this.goalsTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // Analytics Table - V2 with new logical ID  
    this.analyticsTable = new dynamodb.Table(this, 'Analytics-Table-V2', {
      tableName: `StudyAppV2-Analytics-${props.stage}`,
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: props.config.pointInTimeRecovery,
      encryption: props.config.encryption ? dynamodb.TableEncryption.AWS_MANAGED : undefined,
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      // TTL for analytics data cleanup (1 year)
      timeToLiveAttribute: 'expiresAt'
    });

    // Output table names for Lambda environment variables
    new cdk.CfnOutput(this, 'Users-Table-Name-V2', {
      value: this.usersTable.tableName,
      exportName: `StudyAppV2-Users-Table-${props.stage}`
    });

    new cdk.CfnOutput(this, 'Sessions-Table-Name-V2', {
      value: this.sessionsTable.tableName,
      exportName: `StudyAppV2-Sessions-Table-${props.stage}`
    });

    new cdk.CfnOutput(this, 'Goals-Table-Name-V2', {
      value: this.goalsTable.tableName,
      exportName: `StudyAppV2-Goals-Table-${props.stage}`
    });

    new cdk.CfnOutput(this, 'Analytics-Table-Name-V2', {
      value: this.analyticsTable.tableName,
      exportName: `StudyAppV2-Analytics-Table-${props.stage}`
    });
  }
}