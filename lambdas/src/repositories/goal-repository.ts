import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import AWSClients from '../shared/aws-clients';
import { StudyGoal } from '../types';

export default class GoalRepository {
  private tableName: string;

  constructor() {
    this.tableName = process.env.MAIN_TABLE_NAME!;
    if (!this.tableName) {
      throw new Error('MAIN_TABLE_NAME environment variable not set');
    }
  }

  async create(goal: StudyGoal): Promise<void> {
    const client = AWSClients.getDynamoClient();
    
    await client.send(new PutCommand({
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

  async findByIdAndUser(goalId: string, userId: string): Promise<StudyGoal | null> {
    const client = AWSClients.getDynamoClient();
    
    const response = await client.send(new GetCommand({
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
    return goal as StudyGoal;
  }

  async findByUser(userId: string, limit: number = 20): Promise<StudyGoal[]> {
    const client = AWSClients.getDynamoClient();
    
    const response = await client.send(new QueryCommand({
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
      return goal as StudyGoal;
    });
  }

  async update(goalId: string, userId: string, updates: Partial<StudyGoal>): Promise<void> {
    const client = AWSClients.getDynamoClient();
    
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};
    
    Object.keys(updates).forEach((key, index) => {
      updateExpression.push(`#attr${index} = :val${index}`);
      expressionAttributeNames[`#attr${index}`] = key;
      expressionAttributeValues[`:val${index}`] = updates[key as keyof StudyGoal];
    });

    await client.send(new UpdateCommand({
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

  async delete(goalId: string, userId: string): Promise<void> {
    const client = AWSClients.getDynamoClient();
    
    await client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: `GOAL#${goalId}`,
      },
    }));
  }

  async findByProviderAndExam(
    provider: string, 
    exam: string, 
    limit: number = 10
  ): Promise<StudyGoal[]> {
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
      const { PK, SK, GSI2PK, GSI2SK, ...goal } = item;
      return goal as StudyGoal;
    });
  }
}