"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const aws_clients_1 = __importDefault(require("../shared/aws-clients"));
class GoalRepository {
    constructor() {
        this.tableName = process.env.MAIN_TABLE_NAME;
        if (!this.tableName) {
            throw new Error('MAIN_TABLE_NAME environment variable not set');
        }
    }
    async create(goal) {
        const client = aws_clients_1.default.getDynamoClient();
        await client.send(new lib_dynamodb_1.PutCommand({
            TableName: this.tableName,
            Item: {
                PK: `USER#${goal.userId}`,
                SK: `GOAL#${goal.goalId}`,
                GSI2PK: `${goal.provider}#${goal.exam}`,
                GSI2SK: goal.targetDate,
                ...goal,
            },
        }));
    }
    async findByIdAndUser(goalId, userId) {
        const client = aws_clients_1.default.getDynamoClient();
        const response = await client.send(new lib_dynamodb_1.GetCommand({
            TableName: this.tableName,
            Key: {
                PK: `USER#${userId}`,
                SK: `GOAL#${goalId}`,
            },
        }));
        if (!response.Item) {
            return null;
        }
        const { PK, SK, GSI2PK, GSI2SK, ...goal } = response.Item;
        return goal;
    }
    async findByUser(userId, limit = 20) {
        const client = aws_clients_1.default.getDynamoClient();
        const response = await client.send(new lib_dynamodb_1.QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'PK = :userId AND begins_with(SK, :goalPrefix)',
            ExpressionAttributeValues: {
                ':userId': `USER#${userId}`,
                ':goalPrefix': 'GOAL#',
            },
            ScanIndexForward: false, // Get most recent first
            Limit: limit,
        }));
        if (!response.Items) {
            return [];
        }
        return response.Items.map(item => {
            const { PK, SK, GSI2PK, GSI2SK, ...goal } = item;
            return goal;
        });
    }
    async update(goalId, userId, updates) {
        const client = aws_clients_1.default.getDynamoClient();
        const updateExpression = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        Object.keys(updates).forEach((key, index) => {
            updateExpression.push(`#attr${index} = :val${index}`);
            expressionAttributeNames[`#attr${index}`] = key;
            expressionAttributeValues[`:val${index}`] = updates[key];
        });
        await client.send(new lib_dynamodb_1.UpdateCommand({
            TableName: this.tableName,
            Key: {
                PK: `USER#${userId}`,
                SK: `GOAL#${goalId}`,
            },
            UpdateExpression: `SET ${updateExpression.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        }));
    }
    async delete(goalId, userId) {
        const client = aws_clients_1.default.getDynamoClient();
        await client.send(new lib_dynamodb_1.DeleteCommand({
            TableName: this.tableName,
            Key: {
                PK: `USER#${userId}`,
                SK: `GOAL#${goalId}`,
            },
        }));
    }
    async findByProviderAndExam(provider, exam, limit = 10) {
        const client = aws_clients_1.default.getDynamoClient();
        const response = await client.send(new lib_dynamodb_1.QueryCommand({
            TableName: this.tableName,
            IndexName: 'GSI2',
            KeyConditionExpression: 'GSI2PK = :providerExam',
            ExpressionAttributeValues: {
                ':providerExam': `${provider}#${exam}`,
            },
            ScanIndexForward: false,
            Limit: limit,
        }));
        if (!response.Items) {
            return [];
        }
        return response.Items.map(item => {
            const { PK, SK, GSI2PK, GSI2SK, ...goal } = item;
            return goal;
        });
    }
}
exports.default = GoalRepository;
//# sourceMappingURL=goal-repository.js.map