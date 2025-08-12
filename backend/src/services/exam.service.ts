// Exam service for Study App V3 Backend
// Phase 8: Exam Listing Feature

import { 
  Exam, 
  GetExamsRequest, 
  GetExamsResponse, 
  GetExamRequest,
  GetExamResponse,
  IExamService
} from '../shared/types/exam.types';
import { IExamRepository } from '../repositories/exam.repository';
import { createLogger } from '../shared/logger';
import { BaseService } from '../shared/base-service';

export class ExamService extends BaseService implements IExamService {
  constructor(private examRepository: IExamRepository) {
    super();
  }

  /**
   * Get all exams with optional filtering
   */
  async getExams(request: GetExamsRequest): Promise<GetExamsResponse> {
    this.logger.info('Getting exams', { 
      provider: request.provider,
      category: request.category,
      level: request.level,
      search: request.search,
      includeInactive: request.includeInactive 
    });

    try {
      // Get all exams from repository
      const allExams = await this.examRepository.findAll();

      // Apply filters
      let filteredExams = allExams;

      // Filter by provider
      if (request.provider) {
        filteredExams = filteredExams.filter(e => 
          e.providerId.toLowerCase() === request.provider!.toLowerCase()
        );
      }

      // Filter by category
      if (request.category) {
        filteredExams = await this.examRepository.findByCategory(request.category);
      }

      // Filter by level
      if (request.level) {
        if (request.category) {
          // If already filtered by category, apply level filter to those results
          filteredExams = filteredExams.filter(e => 
            e.level.toLowerCase() === request.level!.toLowerCase()
          );
        } else {
          filteredExams = await this.examRepository.findByLevel(request.level);
        }
      }

      // Filter out inactive exams unless explicitly requested
      if (!request.includeInactive) {
        filteredExams = filteredExams.filter(e => e.isActive);
      }

      // Apply search filter
      if (request.search) {
        const searchLower = request.search.toLowerCase();
        filteredExams = filteredExams.filter(e => 
          e.examName.toLowerCase().includes(searchLower) ||
          e.examCode.toLowerCase().includes(searchLower) ||
          e.description.toLowerCase().includes(searchLower) ||
          e.providerName.toLowerCase().includes(searchLower) ||
          (e.topics && e.topics.some(topic => topic.toLowerCase().includes(searchLower)))
        );
      }

      // Sort by provider name, then by level, then by exam name
      filteredExams.sort((a, b) => {
        const providerCompare = a.providerName.localeCompare(b.providerName);
        if (providerCompare !== 0) return providerCompare;
        
        const levelOrder = ['foundational', 'associate', 'professional', 'specialty', 'expert'];
        const levelCompare = levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level);
        if (levelCompare !== 0) return levelCompare;
        
        return a.examName.localeCompare(b.examName);
      });

      // Apply pagination
      const limit = Math.min(request.limit || 50, 100); // Max 100 results
      const offset = request.offset || 0;
      const paginatedExams = filteredExams.slice(offset, offset + limit);
      const hasMore = offset + limit < filteredExams.length;

      // Get available filter options from all exams
      const availableProviders = [...new Set(allExams.map(e => e.providerId))];
      const availableCategories = [...new Set(allExams.map(e => this.getCategoryFromProvider(e.providerId)))].filter(Boolean);
      const availableLevels = [...new Set(allExams.map(e => e.level))];

      const response: GetExamsResponse = {
        exams: paginatedExams,
        total: filteredExams.length,
        filters: {
          providers: availableProviders.sort(),
          categories: availableCategories.sort(),
          levels: availableLevels.sort()
        },
        pagination: {
          limit,
          offset,
          hasMore
        }
      };

      this.logger.info('Exams retrieved successfully', { 
        total: response.total,
        returned: paginatedExams.length,
        hasMore
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get exams', error as Error);
      throw new Error('Failed to retrieve exams');
    }
  }

  /**
   * Get a specific exam by ID
   */
  async getExam(examId: string, request: GetExamRequest): Promise<GetExamResponse> {
    this.logger.info('Getting exam by ID', { 
      examId,
      includeProvider: request.includeProvider
    });

    try {
      // Get exam from repository
      const exam = await this.examRepository.findById(examId);

      if (!exam) {
        this.logger.warn('Exam not found', { examId });
        throw new Error('Exam not found');
      }

      const response: GetExamResponse = {
        exam
      };

      // Include provider details if requested
      if (request.includeProvider) {
        // Provider details are already included in the exam object from the repository
        response.provider = {
          id: exam.providerId,
          name: exam.providerName,
          fullName: exam.providerName,
          description: '',
          website: '',
          category: exam.category || 'other'
        };
      }

      this.logger.info('Exam retrieved successfully', { 
        examId,
        examName: exam.examName,
        providerId: exam.providerId,
        includeProvider: request.includeProvider
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get exam', error as Error, { examId });
      
      if ((error as Error).message === 'Exam not found') {
        throw error; // Re-throw for 404 handling
      }
      
      throw new Error('Failed to retrieve exam');
    }
  }

  /**
   * Get category from provider ID (helper method)
   */
  private getCategoryFromProvider(providerId: string): string {
    // Map common provider IDs to categories
    const categoryMap: Record<string, string> = {
      'aws': 'cloud',
      'azure': 'cloud',
      'gcp': 'cloud',
      'cisco': 'networking',
      'comptia': 'general'
    };
    
    return categoryMap[providerId.toLowerCase()] || 'other';
  }

  /**
   * Refresh exam cache (admin operation)
   */
  async refreshCache(): Promise<void> {
    this.logger.info('Refreshing exam cache');

    try {
      this.examRepository.clearCache();
      
      // Warm up the cache by loading all exams
      await this.examRepository.findAll();
      
      this.logger.info('Exam cache refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh exam cache', error as Error);
      throw error;
    }
  }
}

// Re-export the interface for ServiceFactory
export type { IExamService };