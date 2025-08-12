// Topic repository for S3 operations

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Topic } from '../shared/types/topic.types';
import { ServiceConfig } from '../shared/service-factory';
import { S3BaseRepository } from './base.repository';
import { IListRepository } from '../shared/types/repository.types';
import { createLogger } from '../shared/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * TopicCacheManager - Handles caching operations for topic data
 */
class TopicCacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
  private logger = createLogger({ component: 'TopicCacheManager' });

  /**
   * Get data from cache if it exists and is not expired
   */
  getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry) {
      const now = Date.now();
      if (now - entry.timestamp < entry.ttl) {
        return entry.data;
      } else {
        // Cache expired, remove it
        this.cache.delete(key);
        this.logger.debug('Cache entry expired and removed', { key });
      }
    }
    return null;
  }

  /**
   * Store data in cache with TTL
   */
  setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    });
    this.logger.debug('Data cached successfully', { key });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Topic cache cleared');
  }

  /**
   * Generate cache keys for different topic queries
   */
  generateCacheKey(type: 'all' | 'byId' | 'byExam' | 'byProvider', identifier?: string): string {
    switch (type) {
      case 'all':
        return 'all-topics';
      case 'byId':
        return `topic-${identifier}`;
      case 'byExam':
        return `topics-exam-${identifier}`;
      case 'byProvider':
        return `topics-provider-${identifier}`;
      default:
        return `topics-${type}-${identifier || 'unknown'}`;
    }
  }
}

/**
 * TopicMetadataGenerator - Handles topic metadata, categorization, and mapping logic
 */
class TopicMetadataGenerator {
  private logger = createLogger({ component: 'TopicMetadataGenerator' });

  /**
   * Map topic names to categories
   */
  mapTopicToCategory(topicName: string): string {
    const categoryMap: Record<string, string> = {
      'Storage Services': 'storage',
      'Compute Services': 'compute',
      'Monitoring & Management': 'management',
      'Messaging & Integration': 'integration',
      'Databases': 'database',
      'Networking & Content Delivery': 'networking',
      'Security & Identity': 'security'
    };
    return categoryMap[topicName] || 'general';
  }

  /**
   * Get provider display name
   */
  getProviderName(providerId: string): string {
    const providerNames: Record<string, string> = {
      'aws': 'Amazon Web Services',
      'azure': 'Microsoft Azure',
      'gcp': 'Google Cloud Platform',
      'cisco': 'Cisco',
      'comptia': 'CompTIA'
    };
    return providerNames[providerId] || providerId.toUpperCase();
  }

  /**
   * Get exam display name
   */
  getExamName(examId: string): string {
    const examNames: Record<string, string> = {
      'saa-c03': 'Solutions Architect Associate',
      'saa-c02': 'Solutions Architect Associate',
      'dva-c01': 'Developer Associate',
      'soa-c02': 'SysOps Administrator Associate'
    };
    return examNames[examId] || examId.toUpperCase();
  }

  /**
   * Infer topic level from exam
   */
  inferTopicLevel(topicName: string, examId: string): string {
    if (examId.includes('associate')) return 'associate';
    if (examId.includes('professional')) return 'professional';
    if (examId.includes('specialty')) return 'specialty';
    if (examId.includes('foundational')) return 'foundational';
    
    // Default mapping based on exam patterns
    if (examId.includes('saa') || examId.includes('dva') || examId.includes('soa')) return 'associate';
    
    return 'foundational';
  }

  /**
   * Extract relevant skills from topic name
   */
  extractSkills(topicName: string): string[] {
    const skillsMap: Record<string, string[]> = {
      'Storage Services': ['S3', 'EBS', 'EFS', 'Storage Gateway', 'Data lifecycle management'],
      'Compute Services': ['EC2', 'Lambda', 'ECS', 'Auto Scaling', 'Load Balancing'],
      'Monitoring & Management': ['CloudWatch', 'CloudTrail', 'Config', 'Systems Manager'],
      'Messaging & Integration': ['SQS', 'SNS', 'EventBridge', 'API Gateway'],
      'Databases': ['RDS', 'DynamoDB', 'Aurora', 'ElastiCache', 'Redshift'],
      'Networking & Content Delivery': ['VPC', 'CloudFront', 'Route 53', 'Direct Connect'],
      'Security & Identity': ['IAM', 'KMS', 'Cognito', 'WAF', 'Shield']
    };
    return skillsMap[topicName] || [topicName];
  }

  /**
   * Map difficulty level (1-5 scale)
   */
  mapDifficultyLevel(topicName: string): number {
    const difficultyMap: Record<string, number> = {
      'Storage Services': 3,
      'Compute Services': 4,
      'Monitoring & Management': 3,
      'Messaging & Integration': 4,
      'Databases': 4,
      'Networking & Content Delivery': 5,
      'Security & Identity': 5
    };
    return difficultyMap[topicName] || 3;
  }

  /**
   * Assess market demand
   */
  assessMarketDemand(topicName: string): string {
    const demandMap: Record<string, string> = {
      'Storage Services': 'high',
      'Compute Services': 'high',
      'Monitoring & Management': 'medium',
      'Messaging & Integration': 'high',
      'Databases': 'high',
      'Networking & Content Delivery': 'medium',
      'Security & Identity': 'high'
    };
    return demandMap[topicName] || 'medium';
  }

  /**
   * Get relevant job roles
   */
  getRelevantJobRoles(topicName: string): string[] {
    const jobRolesMap: Record<string, string[]> = {
      'Storage Services': ['Solutions Architect', 'Cloud Engineer', 'DevOps Engineer'],
      'Compute Services': ['Solutions Architect', 'Cloud Engineer', 'DevOps Engineer', 'Software Developer'],
      'Monitoring & Management': ['DevOps Engineer', 'Site Reliability Engineer', 'Cloud Operations'],
      'Messaging & Integration': ['Solutions Architect', 'Integration Developer', 'API Developer'],
      'Databases': ['Database Administrator', 'Data Engineer', 'Solutions Architect'],
      'Networking & Content Delivery': ['Network Engineer', 'Solutions Architect', 'Cloud Engineer'],
      'Security & Identity': ['Security Engineer', 'Solutions Architect', 'Compliance Officer']
    };
    return jobRolesMap[topicName] || ['Cloud Professional'];
  }

  /**
   * Get relevant industries
   */
  getRelevantIndustries(topicName: string): string[] {
    return ['Technology', 'Financial Services', 'Healthcare', 'E-commerce', 'Media', 'Government'];
  }

  /**
   * Estimate study time based on question count
   */
  estimateStudyTime(questionCount: number): number {
    // Estimate 30 minutes per 10 questions + base study time
    const baseHours = 8;
    const questionHours = Math.ceil(questionCount / 10) * 0.5;
    return baseHours + questionHours;
  }
}

/**
 * TopicDataTransformer - Handles data transformation and topic creation logic
 */
class TopicDataTransformer {
  private logger = createLogger({ component: 'TopicDataTransformer' });
  private metadataGenerator: TopicMetadataGenerator;

  constructor() {
    this.metadataGenerator = new TopicMetadataGenerator();
  }

  /**
   * Load topics from a question file (extract topics from question data)
   */
  async loadTopicsFromQuestionFile(s3Client: S3Client, bucketName: string, key: string): Promise<Topic[]> {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: key
      });

      const result = await s3Client.send(getCommand);
      
      if (result.Body) {
        const content = await result.Body.transformToString();
        const questionData = JSON.parse(content);
        
        // Extract provider and exam info from file path
        const pathParts = key.split('/');
        const providerId = pathParts[1] || 'unknown';
        const examId = pathParts[2] || 'unknown';
        
        // Extract unique topics from question data
        const topicsMap = new Map<string, any>();
        
        // First, get topic statistics from metadata if available
        if (questionData.metadata?.topic_statistics) {
          Object.entries(questionData.metadata.topic_statistics).forEach(([topicName, stats]: [string, any]) => {
            topicsMap.set(topicName, {
              name: topicName,
              questionCount: stats.total_questions || stats.answered_questions || 0,
              coverage: stats.coverage_percentage || 0
            });
          });
        }
        
        // Then, extract topics from individual questions
        if (questionData.study_data && Array.isArray(questionData.study_data)) {
          questionData.study_data.forEach((item: any) => {
            const topic = item.question?.topic || item.topic;
            if (topic && typeof topic === 'string') {
              if (!topicsMap.has(topic)) {
                topicsMap.set(topic, { name: topic, questionCount: 1 });
              } else {
                const existing = topicsMap.get(topic);
                existing.questionCount = (existing.questionCount || 0) + 1;
              }
            }
          });
        }
        
        // Transform to Topic objects
        const topics: Topic[] = Array.from(topicsMap.entries()).map(([topicName, data]) => 
          this.transformToTopic(topicName, data, providerId, examId, questionData.metadata)
        );
        
        this.logger.debug(`Extracted ${topics.length} topics from ${key}`);
        return topics;
      }
      return [];
    } catch (error) {
      if ((error as any).name === 'NoSuchKey') {
        return []; // File doesn't exist
      }
      throw error;
    }
  }

  /**
   * Transform topic data to Topic format
   */
  transformToTopic(topicName: string, data: any, providerId: string, examId: string, metadata?: any): Topic {
    const topicId = `${providerId}-${examId}-${topicName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    
    return {
      id: topicId,
      name: topicName,
      category: this.metadataGenerator.mapTopicToCategory(topicName),
      providerId,
      providerName: this.metadataGenerator.getProviderName(providerId),
      examId,
      examName: this.metadataGenerator.getExamName(examId),
      examCode: examId.toUpperCase(),
      level: this.metadataGenerator.inferTopicLevel(topicName, examId),
      description: `${topicName} topics for ${examId.toUpperCase()} certification`,
      skillsValidated: this.metadataGenerator.extractSkills(topicName),
      metadata: {
        difficultyLevel: this.metadataGenerator.mapDifficultyLevel(topicName),
        marketDemand: this.metadataGenerator.assessMarketDemand(topicName),
        jobRoles: this.metadataGenerator.getRelevantJobRoles(topicName),
        industries: this.metadataGenerator.getRelevantIndustries(topicName),
        studyTimeRecommended: this.metadataGenerator.estimateStudyTime(data.questionCount || 0),
        customFields: {
          questionCount: data.questionCount || 0,
          coverage: data.coverage,
          extractedFrom: 'question-data'
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Validate topic data structure
   */
  isValidTopic(data: any): boolean {
    return data && 
           typeof data.id === 'string' &&
           typeof data.name === 'string' &&
           typeof data.examId === 'string';
  }
}

export interface ITopicRepository extends IListRepository<Topic, any> {
  /**
   * Find all topics
   * @param filters - Optional filtering parameters
   * @returns Promise<Topic[]> - All topics
   * @throws RepositoryError
   */
  findAll(filters?: any): Promise<Topic[]>;

  /**
   * Find topic by ID
   * @param topicId - Topic identifier
   * @returns Promise<Topic | null> - Topic if found
   * @throws RepositoryError
   */
  findById(topicId: string): Promise<Topic | null>;

  /**
   * Find topics by exam
   * @param examId - Exam identifier
   * @returns Promise<Topic[]> - Topics for exam
   * @throws RepositoryError
   */
  findByExam(examId: string): Promise<Topic[]>;

  /**
   * Find topics by provider
   * @param providerId - Provider identifier
   * @returns Promise<Topic[]> - Topics for provider
   * @throws RepositoryError
   */
  findByProvider(providerId: string): Promise<Topic[]>;

  /**
   * Clear repository cache
   */
  clearCache(): void;
}

export class TopicRepository extends S3BaseRepository implements ITopicRepository {
  private s3Client: S3Client;
  
  // Helper class instances for delegation
  private cacheManager: TopicCacheManager;
  private dataTransformer: TopicDataTransformer;
  private metadataGenerator: TopicMetadataGenerator;
  
  constructor(s3Client: S3Client, config: ServiceConfig) {
    super('TopicRepository', config, config.s3.bucketName);
    this.s3Client = s3Client;
    
    // Initialize helper classes
    this.cacheManager = new TopicCacheManager();
    this.dataTransformer = new TopicDataTransformer();
    this.metadataGenerator = new TopicMetadataGenerator();
  }

  /**
   * Perform health check operation for S3 connectivity
   */
  protected async performHealthCheck(): Promise<void> {
    await this.s3Client.send(new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: 'questions/',
      MaxKeys: 1
    }));
  }

  /**
   * Get all topics from S3 (extracted from question files)
   */
  async findAll(): Promise<Topic[]> {
    return this.executeWithErrorHandling('findAll', async () => {
      const cacheKey = this.cacheManager.generateCacheKey('all');
      
      // Check cache first
      const cached = this.cacheManager.getFromCache<Topic[]>(cacheKey);
      if (cached) {
        this.logger.debug('Topics retrieved from cache');
        return cached;
      }

      this.logger.info('Loading all topics from S3', { bucket: this.bucketName });

      // List all question files to extract topics from
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: 'questions/',
        MaxKeys: 1000
      });

      const listResult = await this.s3Client.send(listCommand);
      const allTopics: Topic[] = [];

      if (listResult.Contents) {
        // Find all questions.json files
        const questionFiles = listResult.Contents.filter(obj => 
          obj.Key && 
          obj.Key.endsWith('/questions.json')
        );

        this.logger.info('Found question files to extract topics from', { count: questionFiles.length });

        // Load each question file and extract topics using data transformer
        for (const file of questionFiles) {
          if (file.Key) {
            try {
              const topics = await this.dataTransformer.loadTopicsFromQuestionFile(
                this.s3Client, 
                this.bucketName, 
                file.Key
              );
              allTopics.push(...topics);
            } catch (error) {
              this.logger.warn('Failed to load topics from question file', { 
                file: file.Key,
                error: (error as Error).message
              });
            }
          }
        }
      }

      // Cache the results
      this.cacheManager.setCache(cacheKey, allTopics);
      
      this.logger.info('Topics loaded successfully', { 
        totalTopics: allTopics.length
      });

      return allTopics;
    });
  }

  /**
   * Find a specific topic by ID
   */
  async findById(topicId: string): Promise<Topic | null> {
    return this.executeWithErrorHandling('findById', async () => {
      this.validateRequired({ topicId }, 'findById');
      
      const cacheKey = this.cacheManager.generateCacheKey('byId', topicId);
      
      // Check cache first
      const cached = this.cacheManager.getFromCache<Topic>(cacheKey);
      if (cached) {
        this.logger.debug('Topic retrieved from cache', { topicId });
        return cached;
      }

      // Load all topics and find the specific one
      const allTopics = await this.findAll();
      const topic = allTopics.find(t => t.id === topicId);

      if (topic) {
        // Cache the result
        this.cacheManager.setCache(cacheKey, topic);
        this.logger.debug('Topic found', { topicId });
        return topic;
      } else {
        this.logger.warn('Topic not found', { topicId });
        return null;
      }
    }, { topicId });
  }

  /**
   * Find topics by exam
   */
  async findByExam(examId: string): Promise<Topic[]> {
    return this.executeWithErrorHandling('findByExam', async () => {
      this.validateRequired({ examId }, 'findByExam');
      
      const cacheKey = this.cacheManager.generateCacheKey('byExam', examId);
      
      // Check cache first
      const cached = this.cacheManager.getFromCache<Topic[]>(cacheKey);
      if (cached) {
        this.logger.debug('Topics retrieved from cache', { examId });
        return cached;
      }

      const allTopics = await this.findAll();
      const examTopics = allTopics.filter(topic => topic.examId === examId);

      // Cache the results
      this.cacheManager.setCache(cacheKey, examTopics);
      
      this.logger.info('Topics by exam loaded successfully', { 
        examId,
        totalTopics: examTopics.length
      });

      return examTopics;
    }, { examId });
  }

  /**
   * Find topics by provider
   */
  async findByProvider(providerId: string): Promise<Topic[]> {
    return this.executeWithErrorHandling('findByProvider', async () => {
      this.validateRequired({ providerId }, 'findByProvider');
      
      const cacheKey = this.cacheManager.generateCacheKey('byProvider', providerId);
      
      // Check cache first
      const cached = this.cacheManager.getFromCache<Topic[]>(cacheKey);
      if (cached) {
        this.logger.debug('Topics retrieved from cache', { providerId });
        return cached;
      }

      this.logger.info('Loading topics by provider from S3', { providerId, bucket: this.bucketName });

      // List question files for this provider
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `questions/${providerId}/`,
        MaxKeys: 1000
      });

      const listResult = await this.s3Client.send(listCommand);
      const topics: Topic[] = [];

      if (listResult.Contents) {
        const questionFiles = listResult.Contents.filter(obj => 
          obj.Key && 
          obj.Key.endsWith('/questions.json')
        );

        // Load each question file and extract topics for this provider using data transformer
        for (const file of questionFiles) {
          if (file.Key) {
            try {
              const providerTopics = await this.dataTransformer.loadTopicsFromQuestionFile(
                this.s3Client, 
                this.bucketName, 
                file.Key
              );
              topics.push(...providerTopics);
            } catch (error) {
              this.logger.warn('Failed to load topics from question file', { 
                file: file.Key,
                error: (error as Error).message
              });
            }
          }
        }
      }

      // Cache the results
      this.cacheManager.setCache(cacheKey, topics);
      
      this.logger.info('Topics loaded successfully', { 
        providerId,
        totalTopics: topics.length
      });

      return topics;
    }, { providerId });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cacheManager.clearCache();
    this.logger.info('Topic repository cache cleared');
  }

  /**
   * Refresh cache from source
   */
  async refreshCache(): Promise<void> {
    return this.executeWithErrorHandling('refreshCache', async () => {
      this.clearCache();
      this.logger.info('Topic repository cache refreshed');
    });
  }
}