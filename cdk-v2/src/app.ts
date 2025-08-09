#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StudyAppV2Stack } from './stacks/study-app-v2-stack';
import { StackConfig } from './types';

const app = new cdk.App();

// Get configuration from context or environment
const stage = app.node.tryGetContext('stage') || process.env.CDK_STAGE || 'dev';
const region = app.node.tryGetContext('region') || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const account = app.node.tryGetContext('account') || process.env.CDK_ACCOUNT;

// Validate required parameters
if (!account) {
  throw new Error('Account ID is required. Set CDK_ACCOUNT environment variable or pass --context account=123456789012');
}

// Stack configuration
const config: StackConfig = {
  stage: stage,
  region: region,
  account: account,
  appName: 'StudyApp',
  version: '2.0.0'
};

// Create the main stack
new StudyAppV2Stack(app, `StudyAppStackV2-${stage}`, {
  config,
  env: {
    account: config.account,
    region: config.region
  },
  description: `Study App V2 - Complete rewrite with working TOKEN authorization (${stage})`,
  tags: {
    Project: 'StudyApp',
    Version: 'V2',
    Stage: stage,
    ManagedBy: 'CDK'
  }
});

app.synth();