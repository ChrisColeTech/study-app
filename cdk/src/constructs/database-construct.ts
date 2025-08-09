import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { DatabaseProps } from '../types/stack-types';

export class DatabaseConstruct extends Construct {
  public readonly mainTable: dynamodb.Table;
  public readonly cacheTable: dynamodb.Table;
  public readonly tables: Record<string, dynamodb.Table>;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    // Main table for users, sessions, and progress data
    this.mainTable = new dynamodb.Table(this, 'MainTable', {
      tableName: props.mainTableName,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Use RETAIN for production
      pointInTimeRecovery: props.stage === 'prod',
      timeToLiveAttribute: 'ttl',
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for user lookup by email
    this.mainTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // GSI for session lookup by provider/exam
    this.mainTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
    });

    // Cache table for frequently accessed data
    this.cacheTable = new dynamodb.Table(this, 'CacheTable', {
      tableName: props.cacheTableName,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });

    this.tables = {
      main: this.mainTable,
      cache: this.cacheTable,
    };

    // Output table names
    new cdk.CfnOutput(this, 'MainTableName', {
      value: this.mainTable.tableName,
      description: 'Main DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'CacheTableName', {
      value: this.cacheTable.tableName,
      description: 'Cache DynamoDB table name',
    });
  }
}