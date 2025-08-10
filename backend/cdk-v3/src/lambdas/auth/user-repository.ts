import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  UpdateCommand, 
  QueryCommand 
} from '@aws-sdk/lib-dynamodb';
import { User, DynamoDBUser } from './types';

export class UserRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-2'
    });
    
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false
      }
    });
    
    this.tableName = process.env.USERS_TABLE_NAME || 'study-app-v3-dev-users';
    console.log(`UserRepository initialized with table: ${this.tableName}`);
  }

  async createUser(user: User): Promise<void> {
    console.log(`Creating user in DynamoDB: ${user.userId}`);
    
    try {
      const dynamoUser: DynamoDBUser = {
        ...user,
        GSI1PK: `EMAIL#${user.email}`, // For email index
        GSI1SK: user.email
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: dynamoUser,
        ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(GSI1PK)'
      });

      await this.docClient.send(command);
      console.log(`User created successfully: ${user.userId}`);
      
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error(`User with email ${user.email} already exists`);
      }
      
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    console.log(`Getting user by ID: ${userId}`);
    
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { userId }
      });

      const result = await this.docClient.send(command);
      
      if (!result.Item) {
        console.log(`User not found: ${userId}`);
        return null;
      }

      return this.toDomainUser(result.Item as DynamoDBUser);
      
    } catch (error: any) {
      console.error('Error getting user by ID:', error);
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    console.log(`Getting user by email: ${email}`);
    
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email.toLowerCase().trim()
        }
      });

      const result = await this.docClient.send(command);
      
      if (!result.Items || result.Items.length === 0) {
        console.log(`User not found by email: ${email}`);
        return null;
      }

      // Should only have one user per email
      if (result.Items.length > 1) {
        console.warn(`Multiple users found with email: ${email}`);
      }

      return this.toDomainUser(result.Items[0] as DynamoDBUser);
      
    } catch (error: any) {
      console.error('Error getting user by email:', error);
      throw new Error(`Failed to get user by email: ${error.message}`);
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    console.log(`Updating user: ${userId}`, updates);
    
    try {
      // Build update expression dynamically
      const updateExpressions: string[] = [];
      const expressionAttributeNames: { [key: string]: string } = {};
      const expressionAttributeValues: { [key: string]: any } = {};

      Object.entries(updates).forEach(([key, value], index) => {
        const nameKey = `#attr${index}`;
        const valueKey = `:val${index}`;
        
        updateExpressions.push(`${nameKey} = ${valueKey}`);
        expressionAttributeNames[nameKey] = key;
        expressionAttributeValues[valueKey] = value;
      });

      // Always update the updatedAt field
      if (!updates.updatedAt) {
        const nameKey = `#updatedAt`;
        const valueKey = `:updatedAt`;
        updateExpressions.push(`${nameKey} = ${valueKey}`);
        expressionAttributeNames[nameKey] = 'updatedAt';
        expressionAttributeValues[valueKey] = new Date().toISOString();
      }

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(userId)' // Ensure user exists
      });

      await this.docClient.send(command);
      console.log(`User updated successfully: ${userId}`);
      
    } catch (error: any) {
      console.error('Error updating user:', error);
      
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error(`User not found: ${userId}`);
      }
      
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    console.log(`Deleting user: ${userId}`);
    
    try {
      // For now, we'll implement soft delete by setting isActive to false
      // In a production system, you might want to handle this differently
      await this.updateUser(userId, { 
        isActive: false, 
        updatedAt: new Date().toISOString() 
      });
      
      console.log(`User soft deleted: ${userId}`);
      
    } catch (error: any) {
      console.error('Error deleting user:', error);
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  async checkUserExists(email: string): Promise<boolean> {
    console.log(`Checking if user exists: ${email}`);
    
    try {
      const user = await this.getUserByEmail(email);
      return user !== null;
      
    } catch (error: any) {
      console.error('Error checking user existence:', error);
      throw new Error(`Failed to check user existence: ${error.message}`);
    }
  }

  // Health check method to verify database connectivity
  async healthCheck(): Promise<{ status: string; responseTime: number }> {
    const startTime = Date.now();
    
    try {
      // Try to get a non-existent item to test connectivity
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { userId: 'health-check-non-existent' }
      });

      await this.docClient.send(command);
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime
      };
      
    } catch (error: any) {
      console.error('Database health check failed:', error);
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'unhealthy',
        responseTime
      };
    }
  }

  private toDomainUser(dynamoUser: DynamoDBUser): User {
    // Remove DynamoDB-specific fields when converting to domain model
    const { GSI1PK, GSI1SK, ...user } = dynamoUser;
    return user;
  }

  // Utility method for batch operations (for future use)
  async batchGetUsers(userIds: string[]): Promise<User[]> {
    console.log(`Batch getting users: ${userIds.length} users`);
    
    // This would be implemented for bulk operations
    // For now, just get them individually
    const users: User[] = [];
    
    for (const userId of userIds) {
      try {
        const user = await this.getUserById(userId);
        if (user) {
          users.push(user);
        }
      } catch (error) {
        console.warn(`Failed to get user ${userId}:`, error);
        // Continue with other users
      }
    }
    
    return users;
  }

  // Method to get users by status for admin operations (future use)
  async getUsersByStatus(isActive: boolean, limit: number = 50): Promise<User[]> {
    console.log(`Getting users by status: ${isActive ? 'active' : 'inactive'}`);
    
    try {
      // This would require a GSI on isActive status
      // For now, this is a placeholder for future implementation
      console.log('getUsersByStatus not fully implemented - requires additional GSI');
      return [];
      
    } catch (error: any) {
      console.error('Error getting users by status:', error);
      throw new Error(`Failed to get users by status: ${error.message}`);
    }
  }
}