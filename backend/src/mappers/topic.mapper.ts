// Dedicated mapper for topic data transformations
// Standardized transformation patterns for topic-related data objects

import {
  Topic,
  GetTopicsResponse,
  GetTopicResponse
} from '../shared/types/topic.types';

/**
 * TopicMapper - Dedicated mapper for topic data transformations
 * 
 * Provides standardized transformation patterns for topic-related data objects
 * with consistent response formatting and filter option extraction.
 * 
 * @responsibilities
 * - Transform topic objects to response formats
 * - Create topic collection responses with filters
 * - Extract filter options from topic collections
 * - Handle topic sorting and organization
 */
/**
 * TopicMapper - Dedicated mapper for topic data transformations
 * 
 * Provides standardized transformation patterns for topic-related data objects
 * with consistent response formatting and filter option extraction.
 * 
 * @responsibilities
 * - Transform topic objects to response formats
 * - Create topic collection responses with filters
 * - Extract filter options from topic collections
 * - Handle topic sorting and organization
 */
export class TopicMapper {
  /**
   * Create GetTopicResponse from topic object
   * 
   * @param topic - Topic domain object
   * @param includeProvider - Whether to include provider context
   * @param includeExam - Whether to include exam context
   * @returns Formatted single topic response
   */
  static toGetTopicResponse(
    topic: Topic,
    includeProvider?: boolean,
    includeExam?: boolean
  ): GetTopicResponse {
    const response: GetTopicResponse = {
      topic,
    };

    if (includeProvider) {
      response.providerContext = {
        id: topic.providerId,
        name: topic.providerName,
        category: topic.category || 'other',
        status: 'active',
      };
    }

    if (includeExam) {
      response.examContext = {
        id: topic.examId,
        name: topic.examName,
        level: topic.level || 'associate',
        code: topic.examId, // Use examId as code
        fullName: topic.examName,
        skillsValidated: [], // Default empty array
      };
    }

    return response;
  }

  /**
   * Create GetTopicsResponse with filters
   * 
   * @param topics - Array of topic objects
   * @param total - Total number of topics
   * @param filters - Available filter options
   * @returns Complete GetTopicsResponse
   */
  static toGetTopicsResponse(
    topics: Topic[],
    total: number,
    filters: {
      providers: string[];
      exams: string[];
      categories: string[];
      levels: string[];
    }
  ): GetTopicsResponse {
    return {
      topics,
      total,
      filters,
    };
  }

  /**
   * Extract available filter options from topic collection
   * 
   * @param topics - Array of all topics
   * @returns Filter options object
   */
  static extractFilterOptions(topics: Topic[]): {
    providers: string[];
    exams: string[];
    categories: string[];
    levels: string[];
  } {
    const providers = [...new Set(topics.map(t => t.providerId))].sort();
    const exams = [...new Set(topics.map(t => t.examId))].sort();
    const categories = [
      ...new Set(topics.map(t => t.category).filter((cat): cat is string => Boolean(cat)))
    ].sort();
    const levels = [...new Set(topics.map(t => t.level))].sort();

    return {
      providers,
      exams,
      categories,
      levels,
    };
  }

  /**
   * Sort topics by provider, exam, and name
   * 
   * @param topics - Array of topics to sort
   * @returns Sorted topic array
   */
  static sortTopics(topics: Topic[]): Topic[] {
    return topics.sort((a, b) => {
      // Sort by provider name first
      if (a.providerName !== b.providerName) {
        return a.providerName.localeCompare(b.providerName);
      }
      
      // Then by exam name
      if (a.examName !== b.examName) {
        return a.examName.localeCompare(b.examName);
      }
      
      // Finally by topic name
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Group topics by provider
   * 
   * @param topics - Array of topics
   * @returns Map of providerId to topics array
   */
  static groupTopicsByProvider(topics: Topic[]): Map<string, Topic[]> {
    const grouped = new Map<string, Topic[]>();
    
    for (const topic of topics) {
      const existing = grouped.get(topic.providerId) || [];
      existing.push(topic);
      grouped.set(topic.providerId, existing);
    }
    
    return grouped;
  }

  /**
   * Group topics by exam
   * 
   * @param topics - Array of topics
   * @returns Map of examId to topics array
   */
  static groupTopicsByExam(topics: Topic[]): Map<string, Topic[]> {
    const grouped = new Map<string, Topic[]>();
    
    for (const topic of topics) {
      const existing = grouped.get(topic.examId) || [];
      existing.push(topic);
      grouped.set(topic.examId, existing);
    }
    
    return grouped;
  }

  /**
   * Create topic breadcrumb navigation
   * 
   * @param topic - Topic object
   * @returns Breadcrumb array
   */
  static createTopicBreadcrumb(topic: Topic): Array<{name: string, id?: string}> {
    return [
      { name: topic.providerName, id: topic.providerId },
      { name: topic.examName, id: topic.examId },
      { name: topic.name, id: topic.id },
    ];
  }

  /**
   * Calculate topic complexity score based on level
   * 
   * @param level - Topic level string
   * @returns Complexity score (1-5)
   */
  static calculateComplexityScore(level: string): number {
    const complexityMap: Record<string, number> = {
      foundational: 1,
      associate: 2,
      professional: 4,
      specialty: 3,
      expert: 5,
    };

    return complexityMap[level?.toLowerCase()] || 2;
  }

  /**
   * Format topic hierarchy path
   * 
   * @param topic - Topic object
   * @returns Hierarchy path string
   */
  static formatTopicHierarchy(topic: Topic): string {
    return `${topic.providerName} > ${topic.examName} > ${topic.name}`;
  }
}