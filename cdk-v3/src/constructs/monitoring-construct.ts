import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackConfig } from '../shared/stack-config';
import { MonitoringProps } from '../shared/common-props';

export interface MonitoringConstructProps extends MonitoringProps {
  readonly api: cdk.aws_apigateway.RestApi;
  readonly lambdaFunctions: { [key: string]: cdk.aws_lambda.Function };
}

export class MonitoringConstruct extends Construct {
  public readonly logGroup: cdk.aws_logs.LogGroup;
  public readonly dashboard: cdk.aws_cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringConstructProps) {
    super(scope, id);

    const config = StackConfig.getConfig(props.environment);

    // Create centralized log group for application logs
    this.logGroup = new cdk.aws_logs.LogGroup(this, 'AppLogGroup', {
      logGroupName: `/aws/study-app-v3/${props.environment}`,
      retention: config.logRetentionDays as cdk.aws_logs.RetentionDays,
      removalPolicy: config.isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create CloudWatch Dashboard
    this.dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'StudyAppDashboard', {
      dashboardName: StackConfig.getResourceName('dashboard', props.environment),
    });

    // API Gateway metrics
    const apiWidget = new cdk.aws_cloudwatch.GraphWidget({
      title: 'API Gateway Metrics',
      left: [
        new cdk.aws_cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Count',
          dimensionsMap: {
            ApiName: props.api.restApiName,
            Stage: props.environment,
          },
          statistic: 'Sum',
        }),
        new cdk.aws_cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '4XXError',
          dimensionsMap: {
            ApiName: props.api.restApiName,
            Stage: props.environment,
          },
          statistic: 'Sum',
        }),
        new cdk.aws_cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '5XXError',
          dimensionsMap: {
            ApiName: props.api.restApiName,
            Stage: props.environment,
          },
          statistic: 'Sum',
        }),
      ],
      right: [
        new cdk.aws_cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Latency',
          dimensionsMap: {
            ApiName: props.api.restApiName,
            Stage: props.environment,
          },
          statistic: 'Average',
        }),
      ],
    });

    this.dashboard.addWidgets(apiWidget);

    // Lambda function metrics
    const lambdaMetrics = Object.entries(props.lambdaFunctions).map(([name, fn]) => {
      return new cdk.aws_cloudwatch.GraphWidget({
        title: `${name} Lambda Metrics`,
        left: [
          fn.metricInvocations(),
          fn.metricErrors(),
        ],
        right: [
          fn.metricDuration(),
        ],
      });
    });

    this.dashboard.addWidgets(...lambdaMetrics);

    // Create alarms for critical metrics
    this.createAlarms(props);

    // Output dashboard URL
    new cdk.CfnOutput(scope, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${cdk.Stack.of(this).region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }

  private createAlarms(props: MonitoringConstructProps): void {
    const config = StackConfig.getConfig(props.environment);
    
    // API Gateway 5XX errors alarm
    new cdk.aws_cloudwatch.Alarm(this, 'Api5XXErrorsAlarm', {
      alarmName: StackConfig.getResourceName('api-5xx-errors', props.environment),
      metric: new cdk.aws_cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: props.api.restApiName,
          Stage: props.environment,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: config.isProduction ? 5 : 10,
      evaluationPeriods: 2,
      comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Health function error alarm
    if (props.lambdaFunctions.health) {
      new cdk.aws_cloudwatch.Alarm(this, 'HealthFunctionErrorsAlarm', {
        alarmName: StackConfig.getResourceName('health-function-errors', props.environment),
        metric: props.lambdaFunctions.health.metricErrors({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 2,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }
  }
}