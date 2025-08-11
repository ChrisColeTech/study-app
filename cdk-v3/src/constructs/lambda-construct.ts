import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackConfig } from '../shared/stack-config';
import { LambdaProps } from '../shared/common-props';

export interface LambdaConstructProps extends LambdaProps {
  readonly usersTable: cdk.aws_dynamodb.Table;
  readonly studySessionsTable: cdk.aws_dynamodb.Table;
  readonly userProgressTable: cdk.aws_dynamodb.Table;
  readonly goalsTable: cdk.aws_dynamodb.Table;
  readonly questionDataBucket: cdk.aws_s3.Bucket;
  readonly assetsBucket: cdk.aws_s3.Bucket;
}

export class LambdaConstruct extends Construct {
  public readonly functions: { [key: string]: cdk.aws_lambda.Function } = {};
  public readonly healthFunction: cdk.aws_lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    const config = StackConfig.getConfig(props.environment);
    
    // Common Lambda configuration
    const lambdaProps = {
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      architecture: cdk.aws_lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(config.lambdaTimeout),
      memorySize: config.lambdaMemorySize,
      logRetention: config.logRetentionDays as cdk.aws_logs.RetentionDays,
      environment: {
        NODE_ENV: props.environment,
        USERS_TABLE_NAME: props.usersTable.tableName,
        STUDY_SESSIONS_TABLE_NAME: props.studySessionsTable.tableName,
        USER_PROGRESS_TABLE_NAME: props.userProgressTable.tableName,
        GOALS_TABLE_NAME: props.goalsTable.tableName,
        QUESTION_DATA_BUCKET_NAME: props.questionDataBucket.bucketName,
        ASSETS_BUCKET_NAME: props.assetsBucket.bucketName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        JWT_SECRET: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production',
        JWT_EXPIRES_IN: '24h',
        JWT_REFRESH_EXPIRES_IN: '7d',
      },
    };

    // Health Lambda Function - Phase 1 implementation
    this.healthFunction = new cdk.aws_lambda.Function(this, 'HealthFunction', {
      ...lambdaProps,
      functionName: StackConfig.getResourceName('health', props.environment),
      description: 'Study App V3 Health Monitoring Lambda',
      code: cdk.aws_lambda.Code.fromAsset('../backend/dist/bundled'),
      handler: 'health.handler',
    });

    // Store health function in functions map
    this.functions['health'] = this.healthFunction;

    // Grant necessary permissions to health function
    props.usersTable.grantReadData(this.healthFunction);
    props.studySessionsTable.grantReadData(this.healthFunction);
    props.questionDataBucket.grantRead(this.healthFunction);

    // Auth Lambda Function - Phase 3 implementation with full functionality
    const authFunction = new cdk.aws_lambda.Function(this, 'AuthFunction', {
      ...lambdaProps,
      functionName: StackConfig.getResourceName('auth', props.environment),
      description: 'Study App V3 Auth Lambda - Phase 3 Implementation',
      code: cdk.aws_lambda.Code.fromAsset('../backend/dist/bundled'),
      handler: 'auth.handler',
    });
    this.functions['auth'] = authFunction;

    // Grant DynamoDB permissions to auth function
    props.usersTable.grantReadWriteData(authFunction);

    // Placeholder functions for future phases - minimal implementation
    const placeholderFunctionNames = [
      'providers', 
      'exams',
      'topics',
      'questions',
      'sessions',
      'analytics',
      'goals'
    ];

    placeholderFunctionNames.forEach(name => {
      const fn = new cdk.aws_lambda.Function(this, `${name}Function`, {
        ...lambdaProps,
        functionName: StackConfig.getResourceName(name, props.environment),
        code: cdk.aws_lambda.Code.fromInline(`
          exports.handler = async (event) => {
            return {
              statusCode: 501,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
              },
              body: JSON.stringify({
                message: '${name} endpoint not implemented yet - Phase 2+',
                timestamp: new Date().toISOString(),
                path: event.path || '/${name}'
              })
            };
          };
        `),
        handler: 'index.handler',
      });

      this.functions[name] = fn;
    });

    // Output function names
    new cdk.CfnOutput(scope, 'HealthFunctionName', {
      value: this.healthFunction.functionName,
      description: 'Health Lambda function name',
    });
  }
}