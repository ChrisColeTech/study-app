import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { AuthProps } from '../types/stack-types';

export class AuthConstruct extends Construct {
  public readonly jwtSecret: secretsmanager.Secret;
  public readonly secrets: Record<string, secretsmanager.Secret>;

  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id);

    // JWT secret for authentication
    this.jwtSecret = new secretsmanager.Secret(this, 'JWTSecret', {
      secretName: props.secretName,
      description: `JWT secret for Study App ${props.stage} environment`,
      generateSecretString: {
        secretStringTemplate: '{}',
        generateStringKey: 'jwt_secret',
        passwordLength: 64,
        excludeCharacters: '"@/\\',
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Use RETAIN for production
    });

    this.secrets = {
      jwt: this.jwtSecret,
    };

    // Output secret ARN
    new cdk.CfnOutput(this, 'JWTSecretArn', {
      value: this.jwtSecret.secretArn,
      description: 'JWT secret ARN',
    });
  }
}