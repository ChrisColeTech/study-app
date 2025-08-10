import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaConfig } from '../types';

export interface LambdaConstructProps {
  stage: string;
  config: LambdaConfig;
  tables: {
    usersTable: dynamodb.Table;
    sessionsTable: dynamodb.Table;
    goalsTable: dynamodb.Table;
    analyticsTable: dynamodb.Table;
  };
  dataBucket?: s3.Bucket;
}

export class LambdaConstruct extends Construct {
  public readonly authFunction: lambda.Function;
  public readonly providerFunction: lambda.Function;
  public readonly examFunction: lambda.Function;
  public readonly questionFunction: lambda.Function;
  public readonly sessionFunction: lambda.Function;
  public readonly goalFunction: lambda.Function;
  public readonly analyticsFunction: lambda.Function;
  public readonly healthFunction: lambda.Function;
  public readonly authorizerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    // Common Lambda environment variables
    const commonEnvironment = {
      STAGE: props.stage,
      REGION: cdk.Stack.of(this).region,
      USERS_TABLE: props.tables.usersTable.tableName,
      SESSIONS_TABLE: props.tables.sessionsTable.tableName,
      GOALS_TABLE: props.tables.goalsTable.tableName,
      ANALYTICS_TABLE: props.tables.analyticsTable.tableName,
      DATA_BUCKET: props.dataBucket?.bucketName || '',
      LOG_LEVEL: props.stage === 'prod' ? 'INFO' : 'DEBUG',
      JWT_SECRET: 'your-jwt-secret', // TODO: Move to Parameter Store
      ACCESS_TOKEN_EXPIRES_IN: '2h', // Extended for comprehensive testing
      REFRESH_TOKEN_EXPIRES_IN: '7d', // Explicit refresh token expiration
      ...props.config.environment
    };

    // Common Lambda configuration
    const commonConfig = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(props.config.timeout),
      memorySize: props.config.memorySize,
      environment: commonEnvironment,
      logRetention: logs.RetentionDays.ONE_WEEK,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_229_0
    };

    // Token Authorizer Function - V2 with new logical ID
    this.authorizerFunction = new lambda.Function(this, 'Authorizer-Function-V2', {
      ...commonConfig,
      functionName: `StudyAppV2-Authorizer-${props.stage}`,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas-v2/bundles/token-authorizer'),
      description: 'V2 JWT Token Authorizer for API Gateway'
    });

    // Auth Handler Function - V2 with new logical ID
    this.authFunction = new lambda.Function(this, 'Auth-Function-V2', {
      ...commonConfig,
      functionName: `StudyAppV2-Auth-${props.stage}`,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas-v2/bundles/auth-handler'),
      description: 'V2 Authentication and user management'
    });

    // Provider Handler Function - V2 with new logical ID
    this.providerFunction = new lambda.Function(this, 'Provider-Function-V2', {
      ...commonConfig,
      functionName: `StudyAppV2-Provider-${props.stage}`,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas-v2/bundles/provider-handler'),
      description: 'V2 Provider data management'
    });

    // Exam Handler Function - V2 with dedicated logical ID (proper separation of concerns)
    this.examFunction = new lambda.Function(this, 'Exam-Function-V2', {
      ...commonConfig,
      functionName: `StudyAppV2-Exam-${props.stage}`,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas-v2/bundles/exam-handler'),
      description: 'V2 Exam data management and topics'
    });

    // Question Handler Function - V2 with new logical ID
    this.questionFunction = new lambda.Function(this, 'Question-Function-V2', {
      ...commonConfig,
      functionName: `StudyAppV2-Question-${props.stage}`,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas-v2/bundles/question-handler'),
      description: 'V2 Question management and retrieval'
    });

    // Session Handler Function - V2 with new logical ID
    this.sessionFunction = new lambda.Function(this, 'Session-Function-V2', {
      ...commonConfig,
      functionName: `StudyAppV2-Session-${props.stage}`,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas-v2/bundles/session-handler'),
      description: 'V2 Study session management'
    });

    // Goal Handler Function - V2 with new logical ID
    this.goalFunction = new lambda.Function(this, 'Goal-Function-V2', {
      ...commonConfig,
      functionName: `StudyAppV2-Goal-${props.stage}`,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas-v2/bundles/goal-handler'),
      description: 'V2 Study goal tracking and management'
    });

    // Analytics Handler Function - V2 with new logical ID
    this.analyticsFunction = new lambda.Function(this, 'Analytics-Function-V2', {
      ...commonConfig,
      functionName: `StudyAppV2-Analytics-${props.stage}`,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas-v2/bundles/analytics-handler'),
      description: 'V2 Analytics and performance tracking'
    });

    // Health Check Function - V2 with new logical ID
    this.healthFunction = new lambda.Function(this, 'Health-Function-V2', {
      ...commonConfig,
      functionName: `StudyAppV2-Health-${props.stage}`,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas-v2/bundles/health-handler'),
      description: 'V2 Health check endpoint'
    });

    // Grant DynamoDB permissions to all functions
    const functions = [
      this.authFunction,
      this.providerFunction,
      this.questionFunction,
      this.sessionFunction,
      this.goalFunction,
      this.analyticsFunction
    ];

    functions.forEach(func => {
      props.tables.usersTable.grantReadWriteData(func);
      props.tables.sessionsTable.grantReadWriteData(func);
      props.tables.goalsTable.grantReadWriteData(func);
      props.tables.analyticsTable.grantReadWriteData(func);

      // Grant S3 permissions if bucket exists
      if (props.dataBucket) {
        props.dataBucket.grantReadWrite(func);
      }

      // Add CloudWatch Logs permissions
      func.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents'
        ],
        resources: [`arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:*`]
      }));
    });

    // Special permissions for authorizer function
    this.authorizerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: [`arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:*`]
    }));

    // Output function ARNs
    new cdk.CfnOutput(this, 'Authorizer-Function-Arn-V2', {
      value: this.authorizerFunction.functionArn,
      exportName: `StudyAppV2-Authorizer-Arn-${props.stage}`
    });
  }
}