import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Logger } from '../shared/logger';

/**
 * S3 Service - Handles all S3 operations for study data
 * Provides methods for loading providers, questions, and managing data files
 */
export class S3Service {
  private client: S3Client;
  private logger: Logger;
  private readonly bucketName: string;
  private readonly region: string;

  constructor() {
    this.logger = new Logger('S3Service');
    this.bucketName = process.env.DATA_BUCKET || 'study-app-data';
    this.region = process.env.AWS_REGION || 'us-east-1';
    
    this.client = new S3Client({
      region: this.region,
    });

    this.logger.info('S3Service initialized', {
      bucketName: this.bucketName,
      region: this.region
    });
  }

  /**
   * Get JSON object from S3
   */
  async getJsonObject<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Fetching object from S3', { key, bucket: this.bucketName });

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        this.logger.warn('Empty response body from S3', { key });
        return null;
      }

      const bodyString = await response.Body.transformToString();
      const data = JSON.parse(bodyString);
      
      this.logger.perf('S3 getJsonObject', Date.now() - startTime, { 
        key, 
        sizeBytes: bodyString.length 
      });
      
      return data;
    } catch (error) {
      this.logger.error('Failed to get object from S3', {
        key,
        bucket: this.bucketName,
        error: error instanceof Error ? error.message : error
      });
      
      // Return null for not found, throw for other errors
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Put JSON object to S3
   */
  async putJsonObject<T>(key: string, data: T): Promise<void> {
    const startTime = Date.now();
    
    try {
      const jsonString = JSON.stringify(data, null, 2);
      
      this.logger.debug('Putting object to S3', { key, sizeBytes: jsonString.length });

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: jsonString,
        ContentType: 'application/json',
        ServerSideEncryption: 'AES256'
      });

      await this.client.send(command);
      
      this.logger.perf('S3 putJsonObject', Date.now() - startTime, { 
        key, 
        sizeBytes: jsonString.length 
      });
      
      this.logger.info('Successfully uploaded object to S3', { key });
    } catch (error) {
      this.logger.error('Failed to put object to S3', {
        key,
        bucket: this.bucketName,
        error: error instanceof Error ? error.message : error
      });
      
      throw error;
    }
  }

  /**
   * List objects with a prefix
   */
  async listObjects(prefix: string): Promise<string[]> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Listing objects from S3', { prefix });

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: 1000
      });

      const response = await this.client.send(command);
      const keys = (response.Contents || [])
        .map(obj => obj.Key)
        .filter((key): key is string => key !== undefined);
      
      this.logger.perf('S3 listObjects', Date.now() - startTime, { 
        prefix, 
        count: keys.length 
      });
      
      return keys;
    } catch (error) {
      this.logger.error('Failed to list objects from S3', {
        prefix,
        bucket: this.bucketName,
        error: error instanceof Error ? error.message : error
      });
      
      throw error;
    }
  }

  /**
   * Check if an object exists
   */
  async objectExists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return false;
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get the configured bucket name
   */
  getBucketName(): string {
    return this.bucketName;
  }
}