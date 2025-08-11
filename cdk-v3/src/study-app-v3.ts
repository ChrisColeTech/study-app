#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StudyAppStackV3 } from './study-app-stack-v3';

const app = new cdk.App();

// Get environment configuration
const environment = app.node.tryGetContext('environment') || 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1';

// Environment-specific stack naming
const stackName = `StudyAppV3-${environment}`;

new StudyAppStackV3(app, stackName, {
  env: { 
    account,
    region 
  },
  environment,
  description: `Study App V3 Backend Infrastructure - ${environment} environment`,
  tags: {
    Project: 'StudyAppV3',
    Environment: environment,
    Owner: 'StudyAppTeam',
    ManagedBy: 'CDK'
  }
});

app.synth();