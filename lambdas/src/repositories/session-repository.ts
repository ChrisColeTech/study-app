import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import AWSClients from '../shared/aws-clients';
import { StudySession } from '../types';

export default class SessionRepository {
  private tableName: string;

  constructor() {
    this.tableName = process.env.MAIN_TABLE_NAME!;
    if (!this.tableName) {
      throw new Error('MAIN_TABLE_NAME environment variable not set');
    }
  }

  async create(session: StudySession): Promise<void> {
    const client = AWSClients.getDynamoClient();
    
    await client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `USER#${session.userId}`,
        SK: `SESSION#${session.sessionId}`,
        GSI2PK: `${session.provider}#${session.exam}`,
        GSI2SK: session.createdAt,
        ...session,
      },
    }));
  }

  async findByIdAndUser(sessionId: string, userId: string): Promise<StudySession | null> {
    const client = AWSClients.getDynamoClient();
    
    const response = await client.send(new GetCommand({
      TableName: this.tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: `SESSION#${sessionId}`,
      },
    }));

    if (!response.Item) {
      return null;
    }

    const { PK, SK, GSI2PK, GSI2SK, ...session } = response.Item;
    return session as StudySession;
  }

  async findByUser(userId: string, limit: number = 10): Promise<StudySession[]> {
    const client = AWSClients.getDynamoClient();
    
    const response = await client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :userId AND begins_with(SK, :sessionPrefix)',
      ExpressionAttributeValues: {
        ':userId': `USER#${userId}`,
        ':sessionPrefix': 'SESSION#',
      },
      ScanIndexForward: false, // Get most recent first
      Limit: limit,
    }));

    if (!response.Items) {
      return [];
    }

    return response.Items.map(item => {
      const { PK, SK, GSI2PK, GSI2SK, ...session } = item;
      return session as StudySession;
    });
  }

  async update(sessionId: string, userId: string, updates: Partial<StudySession>): Promise<void> {
    const client = AWSClients.getDynamoClient();
    
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};
    
    Object.keys(updates).forEach((key, index) => {
      updateExpression.push(`#attr${index} = :val${index}`);
      expressionAttributeNames[`#attr${index}`] = key;
      expressionAttributeValues[`:val${index}`] = updates[key as keyof StudySession];
    });

    await client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: `SESSION#${sessionId}`,
      },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    }));
  }

  async delete(sessionId: string, userId: string): Promise<void> {
    const client = AWSClients.getDynamoClient();
    
    await client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: `SESSION#${sessionId}`,
      },
    }));
  }

  async findByProviderAndExam(
    provider: string, 
    exam: string, 
    limit: number = 10
  ): Promise<StudySession[]> {
    const client = AWSClients.getDynamoClient();
    
    const response = await client.send(new QueryCommand({
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
      const { PK, SK, GSI2PK, GSI2SK, ...session } = item;
      return session as StudySession;
    });
  }
}