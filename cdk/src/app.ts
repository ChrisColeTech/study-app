#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { StudyAppStack } from './stacks/study-app-stack';

const app = new cdk.App();

// Get stage and account from environment variables
const stage = process.env.STAGE || 'dev';
const account = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.AWS_REGION || 'us-east-2';

if (!account) {
  throw new Error('AWS_ACCOUNT_ID environment variable is required');
}

new StudyAppStack(app, `StudyAppStack-${stage}`, {
  stackName: `StudyAppStack-${stage}`,
  stage,
  env: {
    account,
    region,
  },
  description: `Study App serverless infrastructure for ${stage} environment`,
  tags: {
    Environment: stage,
    Project: 'StudyApp',
    ManagedBy: 'CDK',
  },
});

app.synth();