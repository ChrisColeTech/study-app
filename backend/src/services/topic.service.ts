// Topic service for Study App V3 Backend

import {
  Topic,
  GetTopicsRequest,
  GetTopicsResponse,
  GetTopicRequest,
  GetTopicResponse,
  ITopicService,
} from '../shared/types/topic.types';
import { ITopicRepository } from '../repositories/topic.repository';
import { createLogger } from '../shared/logger';
import { BaseService } from '../shared/base-service';

// Re-export the interface for ServiceFactory
export type { ITopicService };

export class TopicService extends BaseService implements ITopicService {
  constructor(private topicRepository: ITopicRepository) {
    super();
  }

  /**
   * Get all topics with optional filtering
   */
  async getTopics(request: GetTopicsRequest): Promise<GetTopicsResponse> {
    this.logger.info('Getting topics', {
      provider: request.provider,
      exam: request.exam,
      category: request.category,
      search: request.search,
      level: request.level,
    });

    try {
      // Get topics from repository based on filters
      let allTopics: Topic[];

      if (request.provider) {
        allTopics = await this.topicRepository.findByProvider(request.provider);
      } else if (request.exam) {
        allTopics = await this.topicRepository.findByExam(request.exam);
      } else {
        const result = await this.topicRepository.findAll();
        allTopics = result.items;
      }

      // Apply filters
      let filteredTopics = allTopics;

      // Apply additional filters that weren't handled by repository methods
      if (request.category) {
        filteredTopics = filteredTopics.filter(t =>
          t.category?.toLowerCase().includes(request.category!.toLowerCase())
        );
      }

      // Filter by level
      if (request.level) {
        filteredTopics = filteredTopics.filter(
          t => t.level?.toLowerCase() === request.level!.toLowerCase()
        );
      }

      // Filter by exam if not already filtered by repository
      if (request.exam && !request.provider) {
        const searchLower = request.exam.toLowerCase();
        filteredTopics = filteredTopics.filter(
          t =>
            t.examId?.toLowerCase() === searchLower ||
            t.examName?.toLowerCase().includes(searchLower) ||
            (t.examCode && t.examCode.toLowerCase().includes(searchLower))
        );
      }

      // Apply search filter
      if (request.search) {
        const searchLower = request.search.toLowerCase();
        filteredTopics = filteredTopics.filter(
          t =>
            t.name.toLowerCase().includes(searchLower) ||
            (t.description && t.description.toLowerCase().includes(searchLower)) ||
            t.providerName.toLowerCase().includes(searchLower) ||
            t.examName.toLowerCase().includes(searchLower) ||
            t.skillsValidated.some(skill => skill.toLowerCase().includes(searchLower))
        );
      }

      // Sort by provider, then exam, then topic name for consistent ordering
      filteredTopics.sort((a, b) => {
        if (a.providerName !== b.providerName) {
          return a.providerName.localeCompare(b.providerName);
        }
        if (a.examName !== b.examName) {
          return a.examName.localeCompare(b.examName);
        }
        return a.name.localeCompare(b.name);
      });

      // Get available filter options from all topics
      const availableProviders = [...new Set(allTopics.map(t => t.providerId))].sort();
      const availableExams = [...new Set(allTopics.map(t => t.examId))].sort();
      const availableCategories = [
        ...new Set(allTopics.map(t => t.category).filter((cat): cat is string => Boolean(cat))),
      ].sort();
      const availableLevels = [...new Set(allTopics.map(t => t.level))].sort();

      const response: GetTopicsResponse = {
        topics: filteredTopics,
        total: filteredTopics.length,
        filters: {
          providers: availableProviders,
          exams: availableExams,
          categories: availableCategories,
          levels: availableLevels,
        },
      };

      this.logger.info('Topics retrieved successfully', {
        total: response.total,
        filtered: filteredTopics.length,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to get topics', error as Error);
      throw new Error('Failed to retrieve topics');
    }
  }

  /**
   * Get a single topic by ID with optional context
   */
  async getTopic(request: GetTopicRequest): Promise<GetTopicResponse> {
    this.logger.info('Getting topic by ID', {
      id: request.id,
      includeProvider: request.includeProvider,
      includeExam: request.includeExam,
    });

    try {
      // Get topic from repository
      const topic = await this.topicRepository.findById(request.id);

      if (!topic) {
        this.logger.warn('Topic not found', { id: request.id });
        throw new Error(`Topic with ID ${request.id} not found`);
      }

      // Build response with topic data
      const response: GetTopicResponse = {
        topic,
      };

      // Add provider context if requested
      if (request.includeProvider) {
        response.providerContext = {
          id: topic.providerId,
          name: topic.providerName,
          category: topic.category || 'other',
          status: 'active',
        };
      }

      // Add exam context if requested
      if (request.includeExam) {
        response.examContext = {
          id: topic.examId,
          name: topic.examName,
          code: topic.examCode || topic.examId,
          level: topic.level,
          fullName: topic.examName,
          skillsValidated: topic.skillsValidated || [],
        };
      }

      // Add basic stats (could be enhanced with real data)
      response.stats = {
        estimatedStudyTime: topic.metadata?.studyTimeRecommended ?? 0,
      };

      // Add difficulty distribution if available
      if (topic.metadata?.difficultyLevel !== undefined) {
        response.stats.difficultyDistribution = { [topic.metadata.difficultyLevel.toString()]: 1 };
      }

      this.logger.info('Topic retrieved successfully', { id: request.id });
      return response;
    } catch (error) {
      this.logger.error('Failed to get topic', error as Error, { id: request.id });
      throw error;
    }
  }

  /**
   * Refresh topic cache (admin operation)
   */
  async refreshCache(): Promise<void> {
    this.logger.info('Refreshing topic cache');

    try {
      this.topicRepository.clearCache();

      // Warm up the cache by loading all topics
      await this.topicRepository.findAll();

      this.logger.info('Topic cache refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh topic cache', error as Error);
      throw error;
    }
  }
}
