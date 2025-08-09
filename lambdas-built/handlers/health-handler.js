"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const response_builder_1 = require("../shared/response-builder");
const aws_clients_1 = __importDefault(require("../shared/aws-clients"));
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const handler = async (event) => {
    try {
        const { httpMethod, resource } = event;
        // Handle OPTIONS request for CORS
        if (httpMethod === 'OPTIONS') {
            return response_builder_1.ResponseBuilder.success('', 200);
        }
        switch (`${httpMethod} ${resource}`) {
            case 'GET /api/v1/health':
                return await handleBasicHealth(event);
            case 'GET /api/v1/health/detailed':
                return await handleDetailedHealth(event);
            default:
                return response_builder_1.ResponseBuilder.notFound('Route not found');
        }
    }
    catch (error) {
        console.error('Health handler error:', error);
        return response_builder_1.ResponseBuilder.error(error instanceof Error ? error.message : 'Internal server error');
    }
};
exports.handler = handler;
async function handleBasicHealth(event) {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            environment: process.env.STAGE || 'unknown',
        };
        return response_builder_1.ResponseBuilder.success(health);
    }
    catch (error) {
        return response_builder_1.ResponseBuilder.error('Health check failed', 503);
    }
}
async function handleDetailedHealth(event) {
    const checks = {
        overall: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.STAGE || 'unknown',
        services: {
            dynamodb: { status: 'unknown', responseTime: 0 },
            s3: { status: 'unknown', responseTime: 0 },
            secrets: { status: 'unknown', responseTime: 0 },
        },
        system: {
            memory: {
                used: process.memoryUsage().heapUsed,
                total: process.memoryUsage().heapTotal,
                percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
            },
            uptime: process.uptime(),
        },
    };
    // Test DynamoDB connection
    try {
        const startTime = Date.now();
        const dynamoClient = aws_clients_1.default.getDynamoClient();
        // Try to describe the table (lightweight operation)
        await dynamoClient.send({
            name: 'DescribeTableCommand',
            input: { TableName: process.env.MAIN_TABLE_NAME },
        });
        checks.services.dynamodb.status = 'healthy';
        checks.services.dynamodb.responseTime = Date.now() - startTime;
    }
    catch (error) {
        console.error('DynamoDB health check failed:', error);
        checks.services.dynamodb.status = 'unhealthy';
        checks.overall = 'unhealthy';
    }
    // Test S3 connection
    try {
        const startTime = Date.now();
        const s3Client = aws_clients_1.default.getS3Client();
        // Try to list objects (lightweight operation)
        await s3Client.send({
            name: 'ListObjectsV2Command',
            input: {
                Bucket: process.env.DATA_BUCKET_NAME,
                MaxKeys: 1,
            },
        });
        checks.services.s3.status = 'healthy';
        checks.services.s3.responseTime = Date.now() - startTime;
    }
    catch (error) {
        console.error('S3 health check failed:', error);
        checks.services.s3.status = 'unhealthy';
        checks.overall = 'unhealthy';
    }
    // Test Secrets Manager connection
    try {
        const startTime = Date.now();
        const secretsClient = aws_clients_1.default.getSecretsClient();
        await secretsClient.send(new client_secrets_manager_1.GetSecretValueCommand({
            SecretId: process.env.JWT_SECRET_NAME,
        }));
        checks.services.secrets.status = 'healthy';
        checks.services.secrets.responseTime = Date.now() - startTime;
    }
    catch (error) {
        console.error('Secrets Manager health check failed:', error);
        checks.services.secrets.status = 'unhealthy';
        checks.overall = 'unhealthy';
    }
    // Return appropriate status code
    const statusCode = checks.overall === 'healthy' ? 200 : 503;
    return response_builder_1.ResponseBuilder.success(checks, statusCode);
}
//# sourceMappingURL=health-handler.js.map