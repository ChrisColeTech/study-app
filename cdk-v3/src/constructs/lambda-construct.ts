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

    // Provider Lambda Function - Phase 6 implementation
    const providerFunction = new cdk.aws_lambda.Function(this, 'ProviderFunction', {
      ...lambdaProps,
      functionName: StackConfig.getResourceName('provider', props.environment),
      description: 'Study App V3 Provider Lambda - Phase 6 Implementation',
      code: cdk.aws_lambda.Code.fromAsset('../backend/dist/bundled'),
      handler: 'provider.handler',
    });
    this.functions['providers'] = providerFunction;

    // Grant S3 permissions to provider function
    props.questionDataBucket.grantRead(providerFunction);

    // Exam Lambda Function - Phase 8 implementation
    const examFunction = new cdk.aws_lambda.Function(this, 'ExamFunction', {
      ...lambdaProps,
      functionName: StackConfig.getResourceName('exam', props.environment),
      description: 'Study App V3 Exam Lambda - Phase 8 Implementation',
      code: cdk.aws_lambda.Code.fromAsset('../backend/dist/bundled'),
      handler: 'exam.handler',
    });
    this.functions['exams'] = examFunction;

    // Grant S3 permissions to exam function
    props.questionDataBucket.grantRead(examFunction);

    // Topic Lambda Function - Phase 10 implementation
    const topicFunction = new cdk.aws_lambda.Function(this, 'TopicFunction', {
      ...lambdaProps,
      functionName: StackConfig.getResourceName('topic', props.environment),
      description: 'Study App V3 Topic Lambda - Phase 10 Implementation',
      code: cdk.aws_lambda.Code.fromAsset('../backend/dist/bundled'),
      handler: 'topic.handler',
    });
    this.functions['topics'] = topicFunction;

    // Grant S3 permissions to topic function
    props.questionDataBucket.grantRead(topicFunction);

    // Question Lambda Function - Phase 12 implementation
    const questionFunction = new cdk.aws_lambda.Function(this, 'QuestionFunction', {
      ...lambdaProps,
      functionName: StackConfig.getResourceName('question', props.environment),
      description: 'Study App V3 Question Lambda - Phase 12 Implementation',
      code: cdk.aws_lambda.Code.fromAsset('../backend/dist/bundled'),
      handler: 'question.handler',
    });
    this.functions['questions'] = questionFunction;

    // Grant S3 permissions to question function
    props.questionDataBucket.grantRead(questionFunction);

    // Session Lambda Function - Phase 15/16 implementation
    const sessionFunction = new cdk.aws_lambda.Function(this, 'SessionFunction', {
      ...lambdaProps,
      functionName: StackConfig.getResourceName('session', props.environment),
      description: 'Study App V3 Session Lambda - Phase 15/16 Implementation',
      code: cdk.aws_lambda.Code.fromAsset('../backend/dist/bundled'),
      handler: 'session.handler',
    });
    this.functions['sessions'] = sessionFunction;

    // Grant DynamoDB permissions to session function
    props.studySessionsTable.grantReadWriteData(sessionFunction);
    // Also grant access to question data for session creation
    props.questionDataBucket.grantRead(sessionFunction);

    // Goals Lambda Function - Phase 18 implementation
    const goalsFunction = new cdk.aws_lambda.Function(this, 'GoalsFunction', {
      ...lambdaProps,
      functionName: StackConfig.getResourceName('goals-v2', props.environment),
      description: 'Study App V3 Goals Lambda - Phase 18 Implementation',
      code: cdk.aws_lambda.Code.fromAsset('../backend/dist/bundled'),
      handler: 'goals.handler',
    });
    this.functions['goals'] = goalsFunction;

    // Grant DynamoDB permissions to goals function
    props.goalsTable.grantReadWriteData(goalsFunction);

    // Placeholder functions for future phases - minimal implementation
    const placeholderFunctionNames = [
      'analytics'
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