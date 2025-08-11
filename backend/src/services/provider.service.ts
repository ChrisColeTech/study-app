// Provider service for Study App V3 Backend

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { 
  Provider, 
  GetProvidersRequest, 
  GetProvidersResponse, 
  GetProviderRequest, 
  GetProviderResponse, 
  IProviderService,
  ProviderCategory,
  ProviderStatus,
  // Phase 7: Enhanced provider detail types
  GetCertificationRoadmapRequest,
  GetCertificationRoadmapResponse,
  GetStudyPathRecommendationsRequest,
  GetStudyPathRecommendationsResponse,
  GetProviderResourcesRequest,
  GetProviderResourcesResponse,
  GetPersonalizedRecommendationsRequest,
  GetPersonalizedRecommendationsResponse,
  CertificationRoadmap,
  StudyPathRecommendation,
  ProviderResource,
  CertificationRecommendation,
  UserLearningPreferences,
  ExperienceLevel,
  ResourceCategory,
  ResourceType,
  StudyPlanItem,
  StudyPlanItemType,
  LearningPathStep
} from '../shared/types/provider.types';

// Re-export the interface for ServiceFactory
export type { IProviderService };
import { createLogger } from '../shared/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class ProviderService implements IProviderService {
  private logger = createLogger({ component: 'ProviderService' });
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
   * Get all providers with optional filtering
   */
  async getProviders(request: GetProvidersRequest): Promise<GetProvidersResponse> {
    this.logger.info('Getting providers', { 
      category: request.category, 
      status: request.status,
      search: request.search,
      includeInactive: request.includeInactive 
    });

    try {
      // Get all providers from cache or S3
      const allProviders = await this.getAllProviders();

      // Apply filters
      let filteredProviders = allProviders;

      // Filter by status
      if (request.status) {
        filteredProviders = filteredProviders.filter(p => p.status === request.status);
      }

      // Filter by category
      if (request.category) {
        filteredProviders = filteredProviders.filter(p => p.category === request.category);
      }

      // Filter out inactive providers unless explicitly requested
      if (!request.includeInactive) {
        filteredProviders = filteredProviders.filter(p => p.status === ProviderStatus.ACTIVE);
      }

      // Apply search filter
      if (request.search) {
        const searchLower = request.search.toLowerCase();
        filteredProviders = filteredProviders.filter(p => 
          p.name.toLowerCase().includes(searchLower) ||
          p.fullName.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
        );
      }

      // Sort by name for consistent ordering
      filteredProviders.sort((a, b) => a.name.localeCompare(b.name));

      // Get available filter options
      const availableCategories = [...new Set(allProviders.map(p => p.category))];
      const availableStatuses = [...new Set(allProviders.map(p => p.status))];

      const response: GetProvidersResponse = {
        providers: filteredProviders,
        total: filteredProviders.length,
        filters: {
          categories: availableCategories,
          statuses: availableStatuses
        }
      };

      this.logger.info('Providers retrieved successfully', { 
        total: response.total,
        filtered: filteredProviders.length 
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get providers', error as Error);
      throw new Error('Failed to retrieve providers');
    }
  }

  /**
   * Get a specific provider by ID
   */
  async getProvider(request: GetProviderRequest): Promise<GetProviderResponse> {
    this.logger.info('Getting provider', { id: request.id, includeCertifications: request.includeCertifications });

    try {
      const cacheKey = `provider:${request.id}`;
      
      // Check cache first
      const cached = this.getFromCache<Provider>(cacheKey);
      if (cached) {
        this.logger.debug('Provider retrieved from cache', { id: request.id });
        
        const provider = request.includeCertifications === false ? 
          { ...cached, certifications: [] } : 
          cached;

        return { provider };
      }

      // Load from S3
      const provider = await this.loadProviderFromS3(request.id);

      // Cache the result
      this.setCache(cacheKey, provider);

      // Filter certifications if requested
      const responseProvider = request.includeCertifications === false ? 
        { ...provider, certifications: [] } : 
        provider;

      this.logger.info('Provider retrieved successfully', { 
        id: request.id,
        name: provider.name,
        certificationsCount: provider.certifications.length
      });

      return { provider: responseProvider };

    } catch (error) {
      this.logger.error('Failed to get provider', error as Error, { id: request.id });
      
      if ((error as any).name === 'NoSuchKey' || (error as Error).message.includes('does not exist')) {
        throw new Error(`Provider '${request.id}' not found`);
      }
      
      throw new Error('Failed to retrieve provider');
    }
  }

  /**
   * Refresh the provider cache
   */
  async refreshCache(): Promise<void> {
    this.logger.info('Refreshing provider cache');

    try {
      // Clear existing cache
      this.cache.clear();

      // Pre-load all providers
      await this.getAllProviders();

      this.logger.info('Provider cache refreshed successfully');

    } catch (error) {
      this.logger.error('Failed to refresh cache', error as Error);
      throw new Error('Failed to refresh provider cache');
    }
  }

  /**
   * Get all providers from cache or S3
   */
  private async getAllProviders(): Promise<Provider[]> {
    const cacheKey = 'providers:all';

    // Check cache first
    const cached = this.getFromCache<Provider[]>(cacheKey);
    if (cached) {
      this.logger.debug('All providers retrieved from cache');
      return cached;
    }

    // Load all providers from S3
    const providers = await this.loadAllProvidersFromS3();

    // Cache the results
    this.setCache(cacheKey, providers);

    this.logger.info('All providers loaded from S3', { count: providers.length });

    return providers;
  }

  /**
   * Load all providers from S3
   */
  private async loadAllProvidersFromS3(): Promise<Provider[]> {
    this.logger.debug('Loading all providers from S3');

    try {
      // List all provider files in S3
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.PROVIDERS_PREFIX,
        MaxKeys: 100 // Should be enough for providers
      });

      const listResponse = await this.s3Client.send(listCommand);
      
      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        this.logger.warn('No provider files found in S3');
        return [];
      }

      // Load each provider file
      const providers: Provider[] = [];
      
      for (const item of listResponse.Contents) {
        if (!item.Key || !item.Key.endsWith('.json')) continue;

        try {
          const providerId = item.Key.replace(this.PROVIDERS_PREFIX, '').replace('.json', '');
          const provider = await this.loadProviderFromS3(providerId);
          providers.push(provider);
        } catch (error) {
          this.logger.warn('Failed to load provider file', { key: item.Key, error: (error as Error).message });
          // Continue loading other providers
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
    this.logger.debug('Loading provider from S3', { id: providerId });

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

      // Validate that the provider has required fields
      if (!provider.id || !provider.name || !provider.status) {
        throw new Error(`Invalid provider data in ${key}: missing required fields`);
      }

      // Ensure the ID matches the filename
      if (provider.id !== providerId) {
        this.logger.warn('Provider ID mismatch', { 
          fileId: providerId, 
          dataId: provider.id,
          key 
        });
        // Use the filename ID as authoritative
        provider.id = providerId;
      }

      this.logger.debug('Provider loaded successfully', { 
        id: provider.id,
        name: provider.name,
        certificationsCount: provider.certifications?.length || 0
      });

      return provider;

    } catch (error) {
      this.logger.error('Failed to load provider from S3', error as Error, { id: providerId });
      throw error;
    }
  }

  /**
   * Get data from cache if not expired
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
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

  /**
   * Phase 7: Get certification roadmaps for a provider
   */
  async getCertificationRoadmaps(request: GetCertificationRoadmapRequest): Promise<GetCertificationRoadmapResponse> {
    this.logger.info('Getting certification roadmaps', { 
      providerId: request.providerId,
      roadmapId: request.roadmapId,
      hasUserPreferences: !!request.userPreferences
    });

    try {
      // Get the provider to ensure it exists
      const provider = await this.loadProviderFromS3(request.providerId);
      
      // Generate roadmaps based on provider certifications
      const roadmaps = this.generateCertificationRoadmaps(provider);
      
      // Filter by specific roadmap ID if requested
      const filteredRoadmaps = request.roadmapId ? 
        roadmaps.filter(r => r.id === request.roadmapId) : 
        roadmaps;

      // Generate personalized recommendations if user preferences provided
      let personalizedRecommendations: StudyPathRecommendation[] | undefined;
      if (request.userPreferences) {
        personalizedRecommendations = this.generatePersonalizedStudyPaths(
          provider,
          request.userPreferences
        );
      }

      const response: GetCertificationRoadmapResponse = {
        roadmaps: filteredRoadmaps
      };
      
      if (personalizedRecommendations) {
        response.personalizedRecommendations = personalizedRecommendations;
      }

      this.logger.info('Certification roadmaps retrieved successfully', { 
        providerId: request.providerId,
        roadmapsCount: filteredRoadmaps.length,
        hasPersonalized: !!personalizedRecommendations
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get certification roadmaps', error as Error, { providerId: request.providerId });
      throw new Error('Failed to retrieve certification roadmaps');
    }
  }

  /**
   * Phase 7: Get study path recommendations based on user preferences
   */
  async getStudyPathRecommendations(request: GetStudyPathRecommendationsRequest): Promise<GetStudyPathRecommendationsResponse> {
    this.logger.info('Getting study path recommendations', { 
      providerId: request.providerId,
      includeAlternatives: request.includeAlternativeProviders
    });

    try {
      // Get the primary provider
      const provider = await this.loadProviderFromS3(request.providerId);
      
      // Generate recommendations for the primary provider
      const recommendations = this.generatePersonalizedStudyPaths(
        provider,
        request.userPreferences
      );

      // Get alternative provider recommendations if requested
      let alternativeProviders: StudyPathRecommendation[] = [];
      if (request.includeAlternativeProviders) {
        const allProviders = await this.getAllProviders();
        const otherProviders = allProviders.filter(p => p.id !== request.providerId);
        
        for (const otherProvider of otherProviders.slice(0, 2)) { // Limit to 2 alternatives
          const altRecommendations = this.generatePersonalizedStudyPaths(
            otherProvider,
            request.userPreferences
          );
          alternativeProviders.push(...altRecommendations.slice(0, 1)); // 1 per provider
        }
      }

      const response: GetStudyPathRecommendationsResponse = {
        recommendations,
        totalRecommendations: recommendations.length
      };
      
      if (alternativeProviders.length > 0) {
        response.alternativeProviders = alternativeProviders;
      }

      this.logger.info('Study path recommendations retrieved successfully', { 
        providerId: request.providerId,
        recommendationsCount: recommendations.length,
        alternativesCount: alternativeProviders.length
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get study path recommendations', error as Error, { providerId: request.providerId });
      throw new Error('Failed to retrieve study path recommendations');
    }
  }

  /**
   * Phase 7: Get provider-specific resources and learning materials
   */
  async getProviderResources(request: GetProviderResourcesRequest): Promise<GetProviderResourcesResponse> {
    this.logger.info('Getting provider resources', { 
      providerId: request.providerId,
      certificationId: request.certificationId,
      category: request.category,
      type: request.type
    });

    try {
      // Get the provider to ensure it exists
      const provider = await this.loadProviderFromS3(request.providerId);
      
      // Generate resources based on provider certifications and study resources
      const allResources = this.generateProviderResources(provider);
      
      // Apply filters
      let filteredResources = allResources;
      
      if (request.certificationId) {
        filteredResources = filteredResources.filter(r => 
          r.certificationIds.includes(request.certificationId!)
        );
      }
      
      if (request.category) {
        filteredResources = filteredResources.filter(r => r.category === request.category);
      }
      
      if (request.type) {
        filteredResources = filteredResources.filter(r => r.type === request.type);
      }
      
      if (request.isFree !== undefined) {
        filteredResources = filteredResources.filter(r => r.isFree === request.isFree);
      }
      
      if (request.maxCost !== undefined) {
        filteredResources = filteredResources.filter(r => 
          r.isFree || (r.cost && r.cost <= request.maxCost!)
        );
      }
      
      if (request.language) {
        filteredResources = filteredResources.filter(r => r.language === request.language);
      }

      // Apply pagination
      const limit = request.limit || 20;
      const offset = request.offset || 0;
      const paginatedResources = filteredResources.slice(offset, offset + limit);
      
      // Get available filter options
      const availableCategories = [...new Set(allResources.map(r => r.category))];
      const availableTypes = [...new Set(allResources.map(r => r.type))];
      const availableLanguages = [...new Set(allResources.map(r => r.language))];
      const costs = allResources.filter(r => r.cost).map(r => r.cost!);
      const costRange = costs.length > 0 ? 
        { min: Math.min(...costs), max: Math.max(...costs) } :
        { min: 0, max: 0 };

      const response: GetProviderResourcesResponse = {
        resources: paginatedResources,
        total: filteredResources.length,
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < filteredResources.length
        },
        filters: {
          categories: availableCategories,
          types: availableTypes,
          languages: availableLanguages,
          costRange
        }
      };

      this.logger.info('Provider resources retrieved successfully', { 
        providerId: request.providerId,
        total: response.total,
        returned: paginatedResources.length
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get provider resources', error as Error, { providerId: request.providerId });
      throw new Error('Failed to retrieve provider resources');
    }
  }

  /**
   * Phase 7: Get personalized recommendations based on user preferences
   */
  async getPersonalizedRecommendations(request: GetPersonalizedRecommendationsRequest): Promise<GetPersonalizedRecommendationsResponse> {
    this.logger.info('Getting personalized recommendations', { 
      providerId: request.providerId,
      maxRecommendations: request.maxRecommendations
    });

    try {
      let providers: Provider[];
      
      if (request.providerId) {
        // Get specific provider
        const provider = await this.loadProviderFromS3(request.providerId);
        providers = [provider];
      } else {
        // Get all providers if no specific provider requested
        providers = await this.getAllProviders();
        // Filter by user preferences if they have preferred providers
        if (request.userPreferences.preferredProviders.length > 0) {
          providers = providers.filter(p => 
            request.userPreferences.preferredProviders.includes(p.id)
          );
        }
        // Remove avoided providers
        if (request.userPreferences.avoidedProviders.length > 0) {
          providers = providers.filter(p => 
            !request.userPreferences.avoidedProviders.includes(p.id)
          );
        }
      }

      // Generate study paths for each provider
      const allStudyPaths: StudyPathRecommendation[] = [];
      const allCertificationPriorities: CertificationRecommendation[] = [];
      const allRecommendedResources: ProviderResource[] = [];

      for (const provider of providers.slice(0, 3)) { // Limit to top 3 providers
        const studyPaths = this.generatePersonalizedStudyPaths(provider, request.userPreferences);
        const certPriorities = this.generateCertificationRecommendations(provider, request.userPreferences);
        const resources = this.generateProviderResources(provider).slice(0, 5); // Top 5 per provider

        allStudyPaths.push(...studyPaths);
        allCertificationPriorities.push(...certPriorities);
        allRecommendedResources.push(...resources);
      }

      // Sort and limit results
      const maxRecs = request.maxRecommendations || 10;
      const sortedStudyPaths = allStudyPaths
        .sort((a, b) => b.confidenceScore - a.confidenceScore)
        .slice(0, maxRecs);

      // Categorize by timeframe
      const estimatedTimeline = {
        shortTerm: sortedStudyPaths.filter(sp => sp.totalTimeMonths <= 6),
        mediumTerm: sortedStudyPaths.filter(sp => sp.totalTimeMonths > 6 && sp.totalTimeMonths <= 12),
        longTerm: sortedStudyPaths.filter(sp => sp.totalTimeMonths > 12)
      };

      const response: GetPersonalizedRecommendationsResponse = {
        studyPaths: sortedStudyPaths,
        certificationPriorities: allCertificationPriorities
          .sort((a, b) => a.priority - b.priority)
          .slice(0, maxRecs),
        recommendedResources: allRecommendedResources
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, maxRecs),
        estimatedTimeline
      };

      this.logger.info('Personalized recommendations retrieved successfully', { 
        providerId: request.providerId,
        studyPathsCount: response.studyPaths.length,
        certificationPrioritiesCount: response.certificationPriorities.length,
        resourcesCount: response.recommendedResources.length
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get personalized recommendations', error as Error, { 
        providerId: request.providerId 
      });
      throw new Error('Failed to retrieve personalized recommendations');
    }
  }

  /**
   * Generate certification roadmaps based on provider data
   */
  private generateCertificationRoadmaps(provider: Provider): CertificationRoadmap[] {
    const roadmaps: CertificationRoadmap[] = [];
    
    // Generate a foundational path
    const foundationalCerts = provider.certifications.filter(c => c.level === 'foundational');
    if (foundationalCerts.length > 0) {
      roadmaps.push(this.createRoadmap(
        'foundational-path',
        'Foundational Learning Path',
        `Start your ${provider.name} journey with foundational certifications`,
        provider,
        foundationalCerts
      ));
    }

    // Generate an associate path
    const associateCerts = provider.certifications.filter(c => c.level === 'associate');
    if (associateCerts.length > 0) {
      roadmaps.push(this.createRoadmap(
        'associate-path',
        'Associate Learning Path',
        `Build expertise with ${provider.name} associate-level certifications`,
        provider,
        associateCerts
      ));
    }

    // Generate a professional path
    const professionalCerts = provider.certifications.filter(c => c.level === 'professional');
    if (professionalCerts.length > 0) {
      roadmaps.push(this.createRoadmap(
        'professional-path',
        'Professional Learning Path',
        `Advance your career with ${provider.name} professional certifications`,
        provider,
        professionalCerts
      ));
    }

    return roadmaps;
  }

  /**
   * Create a certification roadmap from certifications
   */
  private createRoadmap(
    id: string, 
    name: string, 
    description: string, 
    provider: Provider, 
    certifications: any[]
  ): CertificationRoadmap {
    const estimatedTimeMonths = Math.ceil(
      certifications.reduce((total, cert) => 
        total + (cert.metadata?.studyTimeRecommended || 60), 0
      ) / (40 * 4) // Assuming 40 hours per month study time
    );

    const learningPath: LearningPathStep[] = certifications.map((cert, index) => ({
      id: `step-${cert.id}`,
      name: `${cert.name} Certification`,
      description: cert.description,
      certificationId: cert.id,
      estimatedHours: cert.metadata?.studyTimeRecommended || 60,
      order: index + 1,
      isOptional: false,
      prerequisites: cert.prerequisites || [],
      resources: cert.studyResources || [],
      skills: cert.skillsValidated || []
    }));

    return {
      id: `${provider.id}-${id}`,
      name,
      description,
      providerId: provider.id,
      certificationIds: certifications.map(c => c.id),
      estimatedTimeMonths,
      difficultyLevel: Math.max(...certifications.map(c => c.metadata?.difficultyLevel || 3)),
      prerequisites: [],
      careerOutcomes: provider.metadata.careerPaths || [],
      salaryRange: provider.metadata.averageSalary || 'Varies',
      learningPath,
      metadata: {
        popularityRank: 1,
        successRate: 75,
        averageCompletionTime: estimatedTimeMonths,
        jobPlacementRate: 85,
        industry: ['Technology'],
        jobRoles: provider.metadata.careerPaths || []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate personalized study path recommendations
   */
  private generatePersonalizedStudyPaths(
    provider: Provider, 
    preferences: UserLearningPreferences
  ): StudyPathRecommendation[] {
    const recommendations: StudyPathRecommendation[] = [];
    
    // Filter certifications based on user preferences
    const suitableCerts = provider.certifications.filter(cert => {
      // Match experience level
      if (preferences.experienceLevel === ExperienceLevel.BEGINNER) {
        return cert.level === 'foundational';
      } else if (preferences.experienceLevel === ExperienceLevel.INTERMEDIATE) {
        return cert.level === 'associate' || cert.level === 'foundational';
      } else if (preferences.experienceLevel === ExperienceLevel.ADVANCED) {
        return cert.level === 'professional' || cert.level === 'associate';
      } else {
        return cert.level === 'expert' || cert.level === 'professional';
      }
    });

    if (suitableCerts.length > 0) {
      const totalCost = suitableCerts.reduce((sum, cert) => sum + (cert.cost || 0), 0);
      const totalTimeMonths = Math.ceil(
        suitableCerts.reduce((sum, cert) => 
          sum + (cert.metadata?.studyTimeRecommended || 60), 0
        ) / (preferences.timeCommitmentWeekly * 4)
      );

      // Calculate confidence score based on preference matching
      let confidenceScore = 0.5; // Base score
      
      // Boost if provider is preferred
      if (preferences.preferredProviders.includes(provider.id)) {
        confidenceScore += 0.3;
      }
      
      // Boost if career goals match
      const matchingGoals = preferences.careerGoals.filter(goal => 
        provider.metadata.careerPaths?.some(path => 
          path.toLowerCase().includes(goal.toLowerCase())
        )
      );
      confidenceScore += Math.min(matchingGoals.length * 0.1, 0.2);
      
      // Ensure confidence score is between 0 and 1
      confidenceScore = Math.min(Math.max(confidenceScore, 0), 1);

      const certificationRecommendations = suitableCerts.map((cert, index) => ({
        certification: cert,
        priority: index + 1,
        reasoning: `Matches your ${preferences.experienceLevel} experience level`,
        prerequisitesMet: true,
        estimatedTimeToReady: cert.metadata?.studyTimeRecommended || 60,
        recommendedStudyPlan: this.generateStudyPlan(cert)
      }));

      recommendations.push({
        id: `${provider.id}-personalized`,
        name: `Personalized ${provider.name} Learning Path`,
        description: `Customized learning path based on your preferences and experience level`,
        recommendedFor: [preferences.experienceLevel],
        providerId: provider.id,
        certifications: certificationRecommendations,
        totalTimeMonths,
        totalCost,
        difficultyLevel: Math.max(...suitableCerts.map(c => c.metadata?.difficultyLevel || 3)),
        careerGoals: preferences.careerGoals,
        marketDemand: provider.metadata.jobMarketDemand || 'medium',
        salaryImpact: provider.metadata.averageSalary || 'Varies',
        confidenceScore
      });
    }

    return recommendations;
  }

  /**
   * Generate certification recommendations with priorities
   */
  private generateCertificationRecommendations(
    provider: Provider,
    preferences: UserLearningPreferences
  ): CertificationRecommendation[] {
    return provider.certifications.map((cert, index) => ({
      certification: cert,
      priority: index + 1,
      reasoning: `Popular ${provider.name} certification for your career goals`,
      prerequisitesMet: true,
      estimatedTimeToReady: cert.metadata?.studyTimeRecommended || 60,
      recommendedStudyPlan: this.generateStudyPlan(cert)
    }));
  }

  /**
   * Generate study plan for a certification
   */
  private generateStudyPlan(certification: any): StudyPlanItem[] {
    const studyPlan: StudyPlanItem[] = [];
    const totalWeeks = Math.ceil((certification.metadata?.studyTimeRecommended || 60) / 10);

    // Week 1-2: Foundation reading
    studyPlan.push({
      id: `${certification.id}-week1`,
      title: 'Foundation Reading and Overview',
      type: StudyPlanItemType.READING,
      estimatedHours: 10,
      week: 1,
      isRequired: true,
      resources: certification.studyResources?.filter((r: any) => r.type === 'official_guide') || [],
      description: 'Build foundational knowledge through official documentation'
    });

    // Middle weeks: Video training and hands-on practice
    for (let week = 2; week <= totalWeeks - 2; week++) {
      studyPlan.push({
        id: `${certification.id}-week${week}`,
        title: `Training and Practice - Week ${week}`,
        type: StudyPlanItemType.VIDEO,
        estimatedHours: 8,
        week,
        isRequired: true,
        resources: certification.studyResources?.filter((r: any) => r.type === 'training_course') || [],
        description: 'Video training and hands-on practice exercises'
      });
    }

    // Final weeks: Practice exams and review
    studyPlan.push({
      id: `${certification.id}-final`,
      title: 'Practice Exams and Final Review',
      type: StudyPlanItemType.PRACTICE_EXAM,
      estimatedHours: 12,
      week: totalWeeks,
      isRequired: true,
      resources: certification.studyResources?.filter((r: any) => r.type === 'practice_exam') || [],
      description: 'Take practice exams and review weak areas'
    });

    return studyPlan;
  }

  /**
   * Generate provider resources from certification study resources
   */
  private generateProviderResources(provider: Provider): ProviderResource[] {
    const resources: ProviderResource[] = [];
    
    provider.certifications.forEach(cert => {
      cert.studyResources?.forEach((resource, index) => {
        const providerResource: ProviderResource = {
          id: `${provider.id}-${cert.id}-resource-${index}`,
          title: resource.title,
          type: resource.type,
          category: this.mapResourceTypeToCategory(resource.type),
          providerId: provider.id,
          certificationIds: [cert.id],
          url: resource.url,
          description: resource.description || '',
          isFree: resource.isFree,
          language: 'English', // Default language
          difficulty: cert.metadata?.difficultyLevel || 3,
          lastUpdated: new Date().toISOString(),
          tags: cert.topics || [],
          metadata: {
            publisher: resource.provider,
            format: 'online'
          }
        };
        
        // Only set optional properties if they have values
        if (!resource.isFree) {
          providerResource.cost = 150; // Default cost for paid resources
        }
        
        providerResource.rating = 4.2; // Default rating
        providerResource.reviewCount = 150;
        
        resources.push(providerResource);
      });
    });

    return resources;
  }

  /**
   * Map resource type to category
   */
  private mapResourceTypeToCategory(type: ResourceType): ResourceCategory {
    switch (type) {
      case ResourceType.OFFICIAL_GUIDE:
        return ResourceCategory.OFFICIAL_DOCUMENTATION;
      case ResourceType.TRAINING_COURSE:
      case ResourceType.VIDEO_COURSE:
        return ResourceCategory.TRAINING_MATERIAL;
      case ResourceType.PRACTICE_EXAM:
        return ResourceCategory.PRACTICE_RESOURCE;
      case ResourceType.BOOK:
        return ResourceCategory.CERTIFICATION_GUIDE;
      case ResourceType.DOCUMENTATION:
      case ResourceType.WHITEPAPER:
        return ResourceCategory.OFFICIAL_DOCUMENTATION;
      case ResourceType.COMMUNITY_FORUM:
      case ResourceType.BLOG_POST:
        return ResourceCategory.COMMUNITY_CONTENT;
      case ResourceType.WEBINAR:
        return ResourceCategory.TRAINING_MATERIAL;
      default:
        return ResourceCategory.TRAINING_MATERIAL;
    }
  }

  /**
   * Get cache statistics (useful for monitoring)
   */
  public getCacheStats(): {
    size: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}