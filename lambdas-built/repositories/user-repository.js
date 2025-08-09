"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const aws_clients_1 = __importDefault(require("../shared/aws-clients"));
class UserRepository {
    constructor() {
        this.tableName = process.env.MAIN_TABLE_NAME;
        if (!this.tableName) {
            throw new Error('MAIN_TABLE_NAME environment variable not set');
        }
    }
    async create(user) {
        const client = aws_clients_1.default.getDynamoClient();
        await client.send(new lib_dynamodb_1.PutCommand({
            TableName: this.tableName,
            Item: {
                PK: `USER#${user.userId}`,
                SK: `PROFILE`,
                GSI1PK: `EMAIL#${user.email}`,
                GSI1SK: `USER#${user.userId}`,
                ...user,
            },
            ConditionExpression: 'attribute_not_exists(PK)',
        }));
    }
    async findById(userId) {
        const client = aws_clients_1.default.getDynamoClient();
        const response = await client.send(new lib_dynamodb_1.GetCommand({
            TableName: this.tableName,
            Key: {
                PK: `USER#${userId}`,
                SK: `PROFILE`,
            },
        }));
        if (!response.Item) {
            return null;
        }
        const { PK, SK, GSI1PK, GSI1SK, ...user } = response.Item;
        return user;
    }
    async findByEmail(email) {
        const client = aws_clients_1.default.getDynamoClient();
        const response = await client.send(new lib_dynamodb_1.QueryCommand({
            TableName: this.tableName,
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :email',
            ExpressionAttributeValues: {
                ':email': `EMAIL#${email}`,
            },
            Limit: 1,
        }));
        if (!response.Items || response.Items.length === 0) {
            return null;
        }
        const { PK, SK, GSI1PK, GSI1SK, ...user } = response.Items[0];
        return user;
    }
    async update(userId, updates) {
        const client = aws_clients_1.default.getDynamoClient();
        const updateExpression = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        Object.keys(updates).forEach((key, index) => {
            updateExpression.push(`#attr${index} = :val${index}`);
            expressionAttributeNames[`#attr${index}`] = key;
            expressionAttributeValues[`:val${index}`] = updates[key];
        });
        updateExpression.push(`#updatedAt = :updatedAt`);
        expressionAttributeNames[`#updatedAt`] = 'updatedAt';
        expressionAttributeValues[`:updatedAt`] = new Date().toISOString();
        await client.send(new lib_dynamodb_1.UpdateCommand({
            TableName: this.tableName,
            Key: {
                PK: `USER#${userId}`,
                SK: `PROFILE`,
            },
            UpdateExpression: `SET ${updateExpression.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        }));
    }
}
exports.default = UserRepository;
//# sourceMappingURL=user-repository.js.map