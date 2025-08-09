import { PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import AWSClients from '../shared/aws-clients';
import { User } from '../types';

export default class UserRepository {
  private tableName: string;

  constructor() {
    this.tableName = process.env.MAIN_TABLE_NAME!;
    if (!this.tableName) {
      throw new Error('MAIN_TABLE_NAME environment variable not set');
    }
  }

  async create(user: User): Promise<void> {
    const client = AWSClients.getDynamoClient();
    
    await client.send(new PutCommand({
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

  async findById(userId: string): Promise<User | null> {
    const client = AWSClients.getDynamoClient();
    
    const response = await client.send(new GetCommand({
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
    return user as User;
  }

  async findByEmail(email: string): Promise<User | null> {
    const client = AWSClients.getDynamoClient();
    
    const response = await client.send(new QueryCommand({
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
    return user as User;
  }

  async update(userId: string, updates: Partial<User>): Promise<void> {
    const client = AWSClients.getDynamoClient();
    
    const updateExpression = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};
    
    Object.keys(updates).forEach((key, index) => {
      updateExpression.push(`#attr${index} = :val${index}`);
      expressionAttributeNames[`#attr${index}`] = key;
      expressionAttributeValues[`:val${index}`] = updates[key as keyof User];
    });

    updateExpression.push(`#updatedAt = :updatedAt`);
    expressionAttributeNames[`#updatedAt`] = 'updatedAt';
    expressionAttributeValues[`:updatedAt`] = new Date().toISOString();

    await client.send(new UpdateCommand({
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