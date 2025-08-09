"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
class AWSClients {
    static getDynamoClient() {
        if (!this.dynamoClient) {
            const client = new client_dynamodb_1.DynamoDBClient({
                region: process.env.AWS_REGION || 'us-east-2',
                maxAttempts: 3,
            });
            this.dynamoClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
        }
        return this.dynamoClient;
    }
    static getS3Client() {
        if (!this.s3Client) {
            this.s3Client = new client_s3_1.S3Client({
                region: process.env.AWS_REGION || 'us-east-2',
                maxAttempts: 3,
            });
        }
        return this.s3Client;
    }
    static getSecretsClient() {
        if (!this.secretsClient) {
            this.secretsClient = new client_secrets_manager_1.SecretsManagerClient({
                region: process.env.AWS_REGION || 'us-east-2',
                maxAttempts: 3,
            });
        }
        return this.secretsClient;
    }
}
exports.default = AWSClients;
//# sourceMappingURL=aws-clients.js.map