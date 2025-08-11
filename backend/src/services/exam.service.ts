// Exam service for Study App V3 Backend - Phase 8: Exam Listing Feature

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { 
  Exam,
  ExamCategory,
  ExamStatus,
  MarketDemand,
  SalaryImpact,
  ExamSortOption,
  SortOrder,
  ListExamsRequest,
  ListExamsResponse,
  GetExamRequest,
  GetExamResponse,
  SearchExamsRequest,
  SearchExamsResponse,
  CompareExamsRequest,
  CompareExamsResponse,
  GetProviderExamsRequest,
  GetProviderExamsResponse,
  IExamService,
  ExamSearchCriteria,
  ExamFilters,
  ExamAggregations,
  ExamComparison,
  ExamComparisonMatrix,
  ExamComparisonRecommendation,
  EXAM_ERROR_CODES
} from '../shared/types/exam.types';

import { 
  Provider, 
  Certification,
  CertificationLevel,
  ExamFormat,
  ResourceType 
} from '../shared/types/provider.types';

import { createLogger } from '../shared/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Re-export the interface for ServiceFactory
export type { IExamService };

export class ExamService implements IExamService {
  private logger = createLogger({ component: 'ExamService' });
  private s3Client: S3Client;
  private bucketName: string;
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly PROVIDERS_PREFIX = 'providers/';

  constructor(s3Client: S3Client, bucketName: string) {
    this.s3Client = s3Client;
    this.bucketName = bucketName;
  }

  /**
   * List all exams with filtering and search capabilities
   */
  async listExams(request: ListExamsRequest): Promise<ListExamsResponse> {
    this.logger.info('Listing exams', { 
      search: request.search,
      includeInactive: request.includeInactive 
    });

    try {
      // Get all exams from providers
      const allExams = await this.getAllExams();

      // Apply filters
      let filteredExams = this.applyFilters(allExams, request.search, request.includeInactive);

      // Apply sorting
      if (request.search?.sortBy) {
        filteredExams = this.sortExams(filteredExams, request.search.sortBy, request.search.sortOrder);
      }

      // Apply pagination
      const limit = request.search?.limit || 50;
      const offset = request.search?.offset || 0;
      const paginatedExams = filteredExams.slice(offset, offset + limit);

      // Generate filters and aggregations
      const filters = this.generateFilters(allExams);
      const aggregations = this.generateAggregations(filteredExams);

      const response: ListExamsResponse = {
        exams: paginatedExams,
        total: filteredExams.length,
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < filteredExams.length
        },
        filters,
        aggregations
      };

      this.logger.info('Exams listed successfully', { 
        total: response.total,
        returned: paginatedExams.length,
        hasMore: response.pagination.hasMore
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to list exams', error as Error);
      throw new Error('Failed to retrieve exams');
    }
  }

  /**
   * Get detailed exam information
   */
  async getExam(request: GetExamRequest): Promise<GetExamResponse> {
    this.logger.info('Getting exam details', { 
      id: request.id,
      includeQuestions: request.includeQuestions,
      includeResources: request.includeResources 
    });

    try {
      const allExams = await this.getAllExams();
      const exam = allExams.find(e => e.id === request.id);

      if (!exam) {
        throw new Error(`Exam '${request.id}' not found`);
      }

      // Find similar exams (same provider, similar level/category)
      const similarExams = this.findSimilarExams(exam, allExams);

      // Find prerequisite chain
      const prerequisiteChain = this.findPrerequisiteChain(exam, allExams);

      // Find next step exams
      const nextStepExams = this.findNextStepExams(exam, allExams);

      const response: GetExamResponse = {
        exam,
        similarExams: similarExams.slice(0, 5), // Top 5 similar
        prerequisiteChain,
        nextStepExams: nextStepExams.slice(0, 5) // Top 5 next steps
      };

      // Add question stats if available and requested
      if (request.includeQuestions) {
        response.questionStats = await this.getQuestionStats(exam);
      }

      this.logger.info('Exam details retrieved successfully', { 
        id: request.id,
        name: exam.name,
        similarCount: similarExams.length
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get exam details', error as Error, { id: request.id });
      
      if ((error as Error).message.includes('not found')) {
        throw error;
      }
      
      throw new Error('Failed to retrieve exam details');
    }
  }

  /**
   * Search exams with advanced text search
   */
  async searchExams(request: SearchExamsRequest): Promise<SearchExamsResponse> {
    const startTime = Date.now();
    this.logger.info('Searching exams', { 
      query: request.query,
      fuzzySearch: request.fuzzySearch 
    });

    try {
      const allExams = await this.getAllExams();
      
      // Perform text search
      let searchResults = this.performTextSearch(allExams, request.query, request.fuzzySearch);

      // Apply additional filters if provided
      if (request.filters) {
        searchResults = this.applyFilters(searchResults, request.filters, false);
      }

      // Sort by relevance/score (most relevant first)
      searchResults = this.sortByRelevance(searchResults, request.query);

      const searchTime = Date.now() - startTime;
      const suggestions = this.generateSearchSuggestions(request.query, allExams);

      const response: SearchExamsResponse = {
        exams: searchResults,
        searchMetadata: {
          query: request.query,
          totalResults: searchResults.length,
          searchTime,
          suggestions
        },
        filters: this.generateFilters(allExams)
      };

      this.logger.info('Exam search completed', { 
        query: request.query,
        results: searchResults.length,
        searchTime 
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to search exams', error as Error, { query: request.query });
      throw new Error('Failed to search exams');
    }
  }

  /**
   * Compare multiple exams
   */
  async compareExams(request: CompareExamsRequest): Promise<CompareExamsResponse> {
    this.logger.info('Comparing exams', { 
      examIds: request.examIds,
      criteriaCount: request.comparisonCriteria?.length 
    });

    if (request.examIds.length < 2) {
      throw new Error('At least 2 exams are required for comparison');
    }

    if (request.examIds.length > 10) {
      throw new Error('Cannot compare more than 10 exams at once');
    }

    try {
      const allExams = await this.getAllExams();
      const examsToCompare = request.examIds.map(id => {
        const exam = allExams.find(e => e.id === id);
        if (!exam) {
          throw new Error(`Exam '${id}' not found`);
        }
        return exam;
      });

      const comparison = this.generateExamComparison(examsToCompare);

      const response: CompareExamsResponse = {
        comparison,
        metadata: {
          comparisonDate: new Date().toISOString(),
          criteriaUsed: request.comparisonCriteria || []
        }
      };

      this.logger.info('Exam comparison completed', { 
        examCount: examsToCompare.length,
        bestOverall: comparison.recommendations.bestOverall
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to compare exams', error as Error, { examIds: request.examIds });
      
      if ((error as Error).message.includes('not found')) {
        throw error;
      }
      
      throw new Error('Failed to compare exams');
    }
  }

  /**
   * Get exams for a specific provider
   */
  async getProviderExams(request: GetProviderExamsRequest): Promise<GetProviderExamsResponse> {
    this.logger.info('Getting provider exams', { 
      providerId: request.providerId,
      filters: request.filters 
    });

    try {
      const allExams = await this.getAllExams();
      const providerExams = allExams.filter(e => e.providerId === request.providerId);

      if (providerExams.length === 0) {
        // Check if provider exists
        const providers = await this.getAllProviders();
        const provider = providers.find(p => p.id === request.providerId);
        if (!provider) {
          throw new Error(`Provider '${request.providerId}' not found`);
        }
      }

      // Apply additional filters if provided
      let filteredExams = request.filters ? 
        this.applyFilters(providerExams, request.filters, false) : 
        providerExams;

      // Get provider info
      const providers = await this.getAllProviders();
      const provider = providers.find(p => p.id === request.providerId);

      const response: GetProviderExamsResponse = {
        provider: {
          id: provider?.id || request.providerId,
          name: provider?.name || request.providerId,
          fullName: provider?.fullName || request.providerId
        },
        exams: filteredExams,
        total: filteredExams.length,
        certificationPaths: this.generateCertificationPaths(filteredExams)
      };

      this.logger.info('Provider exams retrieved successfully', { 
        providerId: request.providerId,
        total: response.total 
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get provider exams', error as Error, { providerId: request.providerId });
      
      if ((error as Error).message.includes('not found')) {
        throw error;
      }
      
      throw new Error('Failed to retrieve provider exams');
    }
  }

  /**
   * Refresh exam cache
   */
  async refreshExamCache(): Promise<void> {
    this.logger.info('Refreshing exam cache');

    try {
      // Clear existing cache
      this.cache.clear();

      // Pre-load all exams
      await this.getAllExams();

      this.logger.info('Exam cache refreshed successfully');

    } catch (error) {
      this.logger.error('Failed to refresh exam cache', error as Error);
      throw new Error('Failed to refresh exam cache');
    }
  }

  /**
   * Get all exams by converting provider certifications to exam format
   */
  private async getAllExams(): Promise<Exam[]> {
    const cacheKey = 'exams:all';

    // Check cache first
    const cached = this.getFromCache<Exam[]>(cacheKey);
    if (cached) {
      this.logger.debug('All exams retrieved from cache');
      return cached;
    }

    // Load providers and convert certifications to exams
    const providers = await this.getAllProviders();
    const exams: Exam[] = [];

    for (const provider of providers) {
      for (const cert of provider.certifications) {
        const exam = this.convertCertificationToExam(provider, cert);
        exams.push(exam);
      }
    }

    // Cache the results
    this.setCache(cacheKey, exams);

    this.logger.info('All exams loaded and converted', { count: exams.length });

    return exams;
  }

  /**
   * Get all providers from S3
   */
  private async getAllProviders(): Promise<Provider[]> {
    const cacheKey = 'providers:all';

    // Check cache first
    const cached = this.getFromCache<Provider[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Load all providers from S3
    const providers = await this.loadAllProvidersFromS3();

    // Cache the results
    this.setCache(cacheKey, providers);

    return providers;
  }

  /**
   * Load all providers from S3 (similar to provider service)
   */
  private async loadAllProvidersFromS3(): Promise<Provider[]> {
    this.logger.debug('Loading all providers from S3');

    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.PROVIDERS_PREFIX,
        MaxKeys: 100
      });

      const listResponse = await this.s3Client.send(listCommand);
      
      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        this.logger.warn('No provider files found in S3');
        return [];
      }

      const providers: Provider[] = [];
      
      for (const item of listResponse.Contents) {
        if (!item.Key || !item.Key.endsWith('.json')) continue;

        try {
          const providerId = item.Key.replace(this.PROVIDERS_PREFIX, '').replace('.json', '');
          const provider = await this.loadProviderFromS3(providerId);
          providers.push(provider);
        } catch (error) {
          this.logger.warn('Failed to load provider file', { key: item.Key, error: (error as Error).message });
        }
      }

      return providers;

    } catch (error) {
      this.logger.error('Failed to load providers from S3', error as Error);
      throw new Error('Failed to load providers from storage');
    }
  }

  /**
   * Load a specific provider from S3
   */
  private async loadProviderFromS3(providerId: string): Promise<Provider> {
    try {
      const key = `${this.PROVIDERS_PREFIX}${providerId}.json`;
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error(`Provider file ${key} has no content`);
      }

      const content = await response.Body.transformToString();
      const provider: Provider = JSON.parse(content);

      if (!provider.id || !provider.name || !provider.status) {
        throw new Error(`Invalid provider data in ${key}: missing required fields`);
      }

      if (provider.id !== providerId) {
        provider.id = providerId;
      }

      return provider;

    } catch (error) {
      this.logger.error('Failed to load provider from S3', error as Error, { id: providerId });
      throw error;
    }
  }

  /**
   * Convert provider certification to exam format
   */
  private convertCertificationToExam(provider: Provider, cert: Certification): Exam {
    return {
      id: `${provider.id}-${cert.id}`,
      providerId: provider.id,
      providerName: provider.name,
      name: cert.name,
      fullName: cert.fullName,
      code: cert.code,
      description: cert.description,
      level: cert.level,
      status: this.mapCertificationStatus(cert.status),
      examCode: cert.examCode,
      passingScore: cert.passingScore || 700,
      maxScore: cert.maxScore || 1000,
      duration: cert.duration,
      questionCount: cert.questionCount || 65,
      cost: cert.cost || 150,
      validityPeriod: cert.validityPeriod || 36,
      prerequisites: cert.prerequisites || [],
      topics: cert.topics,
      skillsValidated: cert.skillsValidated,
      examFormat: cert.examFormat,
      languages: cert.languages,
      retakePolicy: cert.retakePolicy || 'Standard retake policy applies',
      studyResources: cert.studyResources?.map(resource => ({
        type: resource.type,
        title: resource.title,
        url: resource.url,
        description: resource.description || 'Study resource',
        isFree: resource.isFree,
        provider: resource.provider,
        cost: 0, // Default cost for resources
        rating: 4.0 // Default rating
      })) || [],
      metadata: {
        category: this.mapProviderCategory(provider.category),
        difficultyLevel: cert.metadata.difficultyLevel || 3,
        popularityRank: cert.metadata.popularityRank || 1,
        passRate: cert.metadata.passRate || 70,
        marketDemand: this.mapMarketDemand(cert.metadata.marketDemand),
        salaryImpact: this.mapSalaryImpact(cert.metadata.salaryImpact),
        jobRoles: cert.metadata.jobRoles || [],
        industries: cert.metadata.industries || [],
        nextStepExams: cert.metadata.nextStepCertifications?.map(id => `${provider.id}-${id}`) || [],
        studyTimeRecommended: cert.metadata.studyTimeRecommended || 40,
        handsOnExperience: cert.metadata.handsOnExperience || false,
        customFields: cert.metadata.customFields || {}
      },
      createdAt: cert.createdAt,
      updatedAt: cert.updatedAt
    };
  }

  /**
   * Map certification status to exam status
   */
  private mapCertificationStatus(status: string): ExamStatus {
    const mapping: Record<string, ExamStatus> = {
      'active': ExamStatus.ACTIVE,
      'inactive': ExamStatus.INACTIVE,
      'retired': ExamStatus.RETIRED,
      'beta': ExamStatus.BETA,
      'coming_soon': ExamStatus.COMING_SOON
    };
    return mapping[status] || ExamStatus.ACTIVE;
  }

  /**
   * Map provider category to exam category
   */
  private mapProviderCategory(category: string): ExamCategory {
    const mapping: Record<string, ExamCategory> = {
      'cloud': ExamCategory.CLOUD,
      'networking': ExamCategory.NETWORKING,
      'security': ExamCategory.SECURITY,
      'database': ExamCategory.DATABASE,
      'programming': ExamCategory.PROGRAMMING,
      'project_management': ExamCategory.PROJECT_MANAGEMENT,
      'general_it': ExamCategory.GENERAL_IT,
      'vendor_specific': ExamCategory.VENDOR_SPECIFIC
    };
    return mapping[category] || ExamCategory.GENERAL_IT;
  }

  /**
   * Map market demand string to enum
   */
  private mapMarketDemand(demand?: string): MarketDemand {
    if (!demand) return MarketDemand.MEDIUM;
    
    const mapping: Record<string, MarketDemand> = {
      'very_high': MarketDemand.VERY_HIGH,
      'high': MarketDemand.HIGH,
      'medium': MarketDemand.MEDIUM,
      'low': MarketDemand.LOW,
      'emerging': MarketDemand.EMERGING
    };
    return mapping[demand] || MarketDemand.MEDIUM;
  }

  /**
   * Map salary impact string to enum
   */
  private mapSalaryImpact(impact?: string): SalaryImpact {
    if (!impact) return SalaryImpact.MEDIUM;
    
    const mapping: Record<string, SalaryImpact> = {
      'very_high': SalaryImpact.VERY_HIGH,
      'high': SalaryImpact.HIGH,
      'medium': SalaryImpact.MEDIUM,
      'low': SalaryImpact.LOW,
      'entry_level': SalaryImpact.ENTRY_LEVEL,
      'entry-level': SalaryImpact.ENTRY_LEVEL
    };
    return mapping[impact] || SalaryImpact.MEDIUM;
  }

  // Additional private helper methods will continue in next part due to length...

  /**
   * Get data from cache if not expired
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set data in cache with TTL
   */
  private setCache<T>(key: string, data: T, ttl: number = this.CACHE_TTL): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };

    this.cache.set(key, entry);
  }

  // Placeholder methods - will be implemented based on requirements
  private applyFilters(exams: Exam[], criteria?: ExamSearchCriteria, includeInactive?: boolean): Exam[] {
    let filtered = exams;

    // Filter by status
    if (!includeInactive) {
      filtered = filtered.filter(e => e.status === ExamStatus.ACTIVE);
    }

    if (!criteria) return filtered;

    // Apply search criteria filters
    if (criteria.providerId) {
      filtered = filtered.filter(e => e.providerId === criteria.providerId);
    }

    if (criteria.providerIds?.length) {
      filtered = filtered.filter(e => criteria.providerIds!.includes(e.providerId));
    }

    if (criteria.category) {
      filtered = filtered.filter(e => e.metadata.category === criteria.category);
    }

    if (criteria.level) {
      filtered = filtered.filter(e => e.level === criteria.level);
    }

    if (criteria.difficulty) {
      filtered = filtered.filter(e => 
        e.metadata.difficultyLevel >= criteria.difficulty!.min && 
        e.metadata.difficultyLevel <= criteria.difficulty!.max
      );
    }

    if (criteria.costRange && criteria.costRange.min !== undefined && criteria.costRange.max !== undefined) {
      filtered = filtered.filter(e => {
        const cost = e.cost || 0;
        return cost >= criteria.costRange!.min && cost <= criteria.costRange!.max;
      });
    }

    return filtered;
  }

  private sortExams(exams: Exam[], sortBy: ExamSortOption, sortOrder: SortOrder = SortOrder.ASC): Exam[] {
    const sorted = [...exams];
    
    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case ExamSortOption.NAME:
          comparison = a.name.localeCompare(b.name);
          break;
        case ExamSortOption.PROVIDER:
          comparison = a.providerName.localeCompare(b.providerName);
          break;
        case ExamSortOption.DIFFICULTY:
          comparison = a.metadata.difficultyLevel - b.metadata.difficultyLevel;
          break;
        case ExamSortOption.COST:
          comparison = (a.cost || 0) - (b.cost || 0);
          break;
        case ExamSortOption.DURATION:
          comparison = a.duration - b.duration;
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }

      return sortOrder === SortOrder.DESC ? -comparison : comparison;
    });

    return sorted;
  }

  private generateFilters(exams: Exam[]): ExamFilters {
    // Generate dynamic filters based on available data
    const providers = [...new Set(exams.map(e => ({ id: e.providerId, name: e.providerName })))];
    const categories = [...new Set(exams.map(e => e.metadata.category))];
    const levels = [...new Set(exams.map(e => e.level))];

    return {
      providers: providers.map(p => ({ ...p, count: exams.filter(e => e.providerId === p.id).length })),
      categories: categories.map(c => ({ category: c, count: exams.filter(e => e.metadata.category === c).length })),
      levels: levels.map(l => ({ level: l, count: exams.filter(e => e.level === l).length })),
      difficulties: [1, 2, 3, 4, 5].map(d => ({ difficulty: d, count: exams.filter(e => e.metadata.difficultyLevel === d).length })),
      costRanges: [
        { range: '$0-$100', min: 0, max: 100, count: exams.filter(e => (e.cost || 0) <= 100).length },
        { range: '$100-$300', min: 100, max: 300, count: exams.filter(e => (e.cost || 0) > 100 && (e.cost || 0) <= 300).length },
        { range: '$300+', min: 300, max: 9999, count: exams.filter(e => (e.cost || 0) > 300).length }
      ],
      durationRanges: [
        { range: '0-2 hours', min: 0, max: 120, count: exams.filter(e => e.duration <= 120).length },
        { range: '2-4 hours', min: 120, max: 240, count: exams.filter(e => e.duration > 120 && e.duration <= 240).length },
        { range: '4+ hours', min: 240, max: 9999, count: exams.filter(e => e.duration > 240).length }
      ],
      languages: [...new Set(exams.flatMap(e => e.languages))],
      formats: [...new Set(exams.map(e => e.examFormat))],
      marketDemands: [...new Set(exams.map(e => e.metadata.marketDemand))]
    };
  }

  private generateAggregations(exams: Exam[]): ExamAggregations {
    const activeExams = exams.filter(e => e.status === ExamStatus.ACTIVE);
    
    return {
      totalExams: exams.length,
      activeExams: activeExams.length,
      averageCost: exams.reduce((sum, e) => sum + (e.cost || 0), 0) / exams.length,
      averageDuration: exams.reduce((sum, e) => sum + e.duration, 0) / exams.length,
      averageDifficulty: exams.reduce((sum, e) => sum + e.metadata.difficultyLevel, 0) / exams.length,
      mostPopularProvider: this.getMostFrequent(exams.map(e => e.providerId)),
      mostPopularCategory: this.getMostFrequent(exams.map(e => e.metadata.category)),
      mostPopularLevel: this.getMostFrequent(exams.map(e => e.level))
    };
  }

  private getMostFrequent<T>(arr: T[]): T {
    const frequency: Map<T, number> = new Map();
    arr.forEach(item => frequency.set(item, (frequency.get(item) || 0) + 1));
    
    let maxCount = 0;
    let mostFrequent = arr[0];
    
    frequency.forEach((count, item) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = item;
      }
    });
    
    return mostFrequent;
  }

  // Placeholder implementations for other methods
  private performTextSearch(exams: Exam[], query: string, fuzzy?: boolean): Exam[] {
    const queryLower = query.toLowerCase();
    return exams.filter(exam => 
      exam.name.toLowerCase().includes(queryLower) ||
      exam.fullName.toLowerCase().includes(queryLower) ||
      exam.description.toLowerCase().includes(queryLower) ||
      exam.topics.some(topic => topic.toLowerCase().includes(queryLower)) ||
      exam.skillsValidated.some(skill => skill.toLowerCase().includes(queryLower))
    );
  }

  private sortByRelevance(exams: Exam[], query: string): Exam[] {
    // Simple relevance scoring - can be enhanced
    return exams.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a, query);
      const scoreB = this.calculateRelevanceScore(b, query);
      return scoreB - scoreA;
    });
  }

  private calculateRelevanceScore(exam: Exam, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    if (exam.name.toLowerCase().includes(queryLower)) score += 10;
    if (exam.fullName.toLowerCase().includes(queryLower)) score += 8;
    if (exam.description.toLowerCase().includes(queryLower)) score += 5;
    
    exam.topics.forEach(topic => {
      if (topic.toLowerCase().includes(queryLower)) score += 3;
    });

    return score;
  }

  private generateSearchSuggestions(query: string, exams: Exam[]): string[] {
    // Simple suggestion generation - return common topics/skills
    const commonTerms = new Set<string>();
    
    exams.forEach(exam => {
      exam.topics.forEach(topic => commonTerms.add(topic));
      exam.skillsValidated.forEach(skill => commonTerms.add(skill));
    });

    return Array.from(commonTerms)
      .filter(term => term.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5);
  }

  private findSimilarExams(exam: Exam, allExams: Exam[]): Exam[] {
    return allExams
      .filter(e => e.id !== exam.id)
      .filter(e => 
        e.providerId === exam.providerId || 
        e.metadata.category === exam.metadata.category ||
        e.level === exam.level
      )
      .sort((a, b) => {
        // Sort by similarity score
        const scoreA = this.calculateSimilarityScore(exam, a);
        const scoreB = this.calculateSimilarityScore(exam, b);
        return scoreB - scoreA;
      });
  }

  private calculateSimilarityScore(exam1: Exam, exam2: Exam): number {
    let score = 0;
    
    if (exam1.providerId === exam2.providerId) score += 5;
    if (exam1.metadata.category === exam2.metadata.category) score += 3;
    if (exam1.level === exam2.level) score += 3;
    if (Math.abs(exam1.metadata.difficultyLevel - exam2.metadata.difficultyLevel) <= 1) score += 2;
    
    return score;
  }

  private findPrerequisiteChain(exam: Exam, allExams: Exam[]): Exam[] {
    // Find exams that are prerequisites for this exam
    return exam.prerequisites
      .map(prereq => allExams.find(e => e.name.includes(prereq) || e.code.includes(prereq)))
      .filter(Boolean) as Exam[];
  }

  private findNextStepExams(exam: Exam, allExams: Exam[]): Exam[] {
    return exam.metadata.nextStepExams
      .map(nextId => allExams.find(e => e.id === nextId))
      .filter(Boolean) as Exam[];
  }

  private generateExamComparison(exams: Exam[]): ExamComparison {
    const matrix: ExamComparisonMatrix = {
      difficulty: {},
      cost: {},
      duration: {},
      passRate: {},
      marketDemand: {},
      prerequisites: {},
      jobOpportunities: {}
    };

    exams.forEach(exam => {
      matrix.difficulty[exam.id] = exam.metadata.difficultyLevel;
      matrix.cost[exam.id] = exam.cost || 0;
      matrix.duration[exam.id] = exam.duration;
      matrix.passRate[exam.id] = exam.metadata.passRate || 0;
      matrix.marketDemand[exam.id] = exam.metadata.marketDemand;
      matrix.prerequisites[exam.id] = exam.prerequisites;
      matrix.jobOpportunities[exam.id] = exam.metadata.jobRoles.length;
    });

    const recommendations: ExamComparisonRecommendation = {
      bestOverall: this.findBestOverall(exams),
      easiest: this.findEasiest(exams),
      mostAffordable: this.findMostAffordable(exams),
      highestDemand: this.findHighestDemand(exams),
      bestForBeginner: this.findBestForBeginner(exams),
      reasoning: {}
    };

    // Generate reasoning for each exam
    exams.forEach(exam => {
      recommendations.reasoning[exam.id] = this.generateReasoningForExam(exam, exams);
    });

    return {
      exams,
      comparisonMatrix: matrix,
      recommendations
    };
  }

  private findBestOverall(exams: Exam[]): string {
    return exams.reduce((best, current) => {
      const bestScore = this.calculateOverallScore(best);
      const currentScore = this.calculateOverallScore(current);
      return currentScore > bestScore ? current : best;
    }).id;
  }

  private calculateOverallScore(exam: Exam): number {
    let score = 0;
    
    // Higher market demand = higher score
    const demandScore = {
      [MarketDemand.VERY_HIGH]: 5,
      [MarketDemand.HIGH]: 4,
      [MarketDemand.MEDIUM]: 3,
      [MarketDemand.LOW]: 2,
      [MarketDemand.EMERGING]: 3
    };
    score += demandScore[exam.metadata.marketDemand] || 3;
    
    // Higher pass rate = higher score (if available)
    if (exam.metadata.passRate) {
      score += (exam.metadata.passRate / 100) * 3;
    }
    
    // More job opportunities = higher score
    score += Math.min(exam.metadata.jobRoles.length * 0.5, 3);
    
    return score;
  }

  private findEasiest(exams: Exam[]): string {
    return exams.reduce((easiest, current) => 
      current.metadata.difficultyLevel < easiest.metadata.difficultyLevel ? current : easiest
    ).id;
  }

  private findMostAffordable(exams: Exam[]): string {
    return exams.reduce((cheapest, current) => 
      (current.cost || 0) < (cheapest.cost || 0) ? current : cheapest
    ).id;
  }

  private findHighestDemand(exams: Exam[]): string {
    const demandRank = {
      [MarketDemand.VERY_HIGH]: 5,
      [MarketDemand.HIGH]: 4,
      [MarketDemand.EMERGING]: 3,
      [MarketDemand.MEDIUM]: 2,
      [MarketDemand.LOW]: 1
    };

    return exams.reduce((highest, current) => {
      const highestRank = demandRank[highest.metadata.marketDemand];
      const currentRank = demandRank[current.metadata.marketDemand];
      return currentRank > highestRank ? current : highest;
    }).id;
  }

  private findBestForBeginner(exams: Exam[]): string {
    return exams
      .filter(e => e.level === CertificationLevel.FOUNDATIONAL || e.metadata.difficultyLevel <= 2)
      .reduce((best, current) => 
        current.metadata.difficultyLevel < best.metadata.difficultyLevel ? current : best
      )?.id || exams[0]?.id;
  }

  private generateReasoningForExam(exam: Exam, allExams: Exam[]): string {
    const reasons = [];
    
    if (exam.metadata.difficultyLevel <= 2) {
      reasons.push('Good for beginners');
    }
    
    if (exam.metadata.marketDemand === MarketDemand.HIGH || exam.metadata.marketDemand === MarketDemand.VERY_HIGH) {
      reasons.push('High market demand');
    }
    
    if ((exam.cost || 0) < 150) {
      reasons.push('Affordable option');
    }
    
    if (exam.metadata.passRate && exam.metadata.passRate > 80) {
      reasons.push('High pass rate');
    }

    return reasons.join(', ') || 'Standard certification option';
  }

  private generateCertificationPaths(exams: Exam[]) {
    // Generate logical learning paths based on difficulty and prerequisites
    const paths = [];
    
    // Basic path: foundational -> associate -> professional
    const foundational = exams.filter(e => e.level === CertificationLevel.FOUNDATIONAL);
    const associate = exams.filter(e => e.level === CertificationLevel.ASSOCIATE);
    const professional = exams.filter(e => e.level === CertificationLevel.PROFESSIONAL);
    
    if (foundational.length && associate.length) {
      paths.push({
        id: 'standard-path',
        name: 'Standard Certification Path',
        description: 'Progress from foundational to professional level',
        examIds: [
          ...foundational.map(e => e.id),
          ...associate.slice(0, 2).map(e => e.id),
          ...professional.slice(0, 1).map(e => e.id)
        ],
        estimatedTimeMonths: 12,
        totalCost: foundational.reduce((sum, e) => sum + (e.cost || 0), 0) + 
                  associate.slice(0, 2).reduce((sum, e) => sum + (e.cost || 0), 0) +
                  (professional[0]?.cost || 0),
        difficulty: 3
      });
    }

    return paths;
  }

  private async getQuestionStats(exam: Exam) {
    // Placeholder for question statistics
    // This would integrate with actual question data when available
    return {
      totalQuestions: exam.questionCount || 0,
      questionsByTopic: exam.topics.reduce((acc, topic) => {
        acc[topic] = Math.floor(Math.random() * 20) + 5; // Mock data
        return acc;
      }, {} as { [topic: string]: number }),
      difficultyDistribution: {
        'Easy': 30,
        'Medium': 50,
        'Hard': 20
      },
      formatDistribution: {
        [exam.examFormat]: 100
      }
    };
  }
}