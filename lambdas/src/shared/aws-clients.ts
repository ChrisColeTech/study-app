import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

class AWSClients {
  private static dynamoClient: DynamoDBDocumentClient;
  private static s3Client: S3Client;
  private static secretsClient: SecretsManagerClient;

  static getDynamoClient(): DynamoDBDocumentClient {
    if (!this.dynamoClient) {
      const client = new DynamoDBClient({
        region: process.env.AWS_REGION || 'us-east-2',
        maxAttempts: 3,
      });
      this.dynamoClient = DynamoDBDocumentClient.from(client);
    }
    return this.dynamoClient;
  }

  static getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-2',
        maxAttempts: 3,
      });
    }
    return this.s3Client;
  }

  static getSecretsClient(): SecretsManagerClient {
    if (!this.secretsClient) {
      this.secretsClient = new SecretsManagerClient({
        region: process.env.AWS_REGION || 'us-east-2',
        maxAttempts: 3,
      });
    }
    return this.secretsClient;
  }
}

export default AWSClients;