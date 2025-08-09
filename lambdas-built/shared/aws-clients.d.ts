import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
declare class AWSClients {
    private static dynamoClient;
    private static s3Client;
    private static secretsClient;
    static getDynamoClient(): DynamoDBDocumentClient;
    static getS3Client(): S3Client;
    static getSecretsClient(): SecretsManagerClient;
}
export default AWSClients;
//# sourceMappingURL=aws-clients.d.ts.map