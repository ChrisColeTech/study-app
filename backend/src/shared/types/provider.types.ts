// Provider types for Study App V3 Backend

export interface Provider {
  id: string;
  name: string;
  fullName: string;
  description: string;
  status: ProviderStatus;
  website: string;
  logoUrl: string;
  category: ProviderCategory;
  certifications: Certification[];
  metadata: ProviderMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface Certification {
  id: string;
  name: string;
  fullName: string;
  code: string;
  description: string;
  level: CertificationLevel;
  status: CertificationStatus;
  examCode: string;
  passingScore?: number;
  maxScore?: number;
  duration: number; // minutes
  questionCount?: number;
  cost?: number;
  validityPeriod?: number; // months
  prerequisites?: string[];
  topics: string[];
  skillsValidated: string[];
  examFormat: ExamFormat;
  languages: string[];
  retakePolicy?: string;
  studyResources?: StudyResource[];
  metadata: CertificationMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface StudyResource {
  type: ResourceType;
  title: string;
  url: string;
  description?: string;
  isFree: boolean;
  provider: string;
}

export interface ProviderMetadata {
  headquarters?: string;
  founded?: number;
  industry?: string;
  specialization?: string[];
  marketShare?: string;
  popularCertifications?: string[];
  difficultyRating?: number; // 1-5 scale
  jobMarketDemand?: string; // high, medium, low
  averageSalary?: string;
  careerPaths?: string[];
  customFields?: Record<string, any>;
}

export interface CertificationMetadata {
  difficultyLevel?: number; // 1-5 scale
  popularityRank?: number;
  passRate?: number; // percentage
  marketDemand?: string; // high, medium, low
  salaryImpact?: string;
  jobRoles?: string[];
  industries?: string[];
  nextStepCertifications?: string[];
  studyTimeRecommended?: number; // hours
  handsOnExperience?: boolean;
  customFields?: Record<string, any>;
}

export enum ProviderStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated',
  COMING_SOON = 'coming_soon'
}

export enum CertificationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  RETIRED = 'retired',
  BETA = 'beta',
  COMING_SOON = 'coming_soon'
}

export enum ProviderCategory {
  CLOUD = 'cloud',
  NETWORKING = 'networking',
  SECURITY = 'security',
  DATABASE = 'database',
  PROGRAMMING = 'programming',
  PROJECT_MANAGEMENT = 'project_management',
  GENERAL_IT = 'general_it',
  VENDOR_SPECIFIC = 'vendor_specific'
}

export enum CertificationLevel {
  FOUNDATIONAL = 'foundational',
  ASSOCIATE = 'associate',
  PROFESSIONAL = 'professional',
  EXPERT = 'expert',
  SPECIALTY = 'specialty',
  MASTER = 'master'
}

export enum ExamFormat {
  MULTIPLE_CHOICE = 'multiple_choice',
  MULTIPLE_SELECT = 'multiple_select',
  DRAG_DROP = 'drag_drop',
  SIMULATION = 'simulation',
  PRACTICAL = 'practical',
  MIXED = 'mixed'
}

export enum ResourceType {
  OFFICIAL_GUIDE = 'official_guide',
  TRAINING_COURSE = 'training_course',
  PRACTICE_EXAM = 'practice_exam',
  VIDEO_COURSE = 'video_course',
  BOOK = 'book',
  WHITEPAPER = 'whitepaper',
  DOCUMENTATION = 'documentation',
  COMMUNITY_FORUM = 'community_forum',
  BLOG_POST = 'blog_post',
  WEBINAR = 'webinar'
}

// Request/Response types
export interface GetProvidersRequest {
  category?: ProviderCategory;
  status?: ProviderStatus;
  search?: string;
  includeInactive?: boolean;
}

export interface GetProvidersResponse {
  providers: Provider[];
  total: number;
  filters: {
    categories: ProviderCategory[];
    statuses: ProviderStatus[];
  };
}

export interface GetProviderRequest {
  id: string;
  includeCertifications?: boolean;
}

export interface GetProviderResponse {
  provider: Provider;
}

// Phase 7: Enhanced Provider Details Types

export interface CertificationRoadmap {
  id: string;
  name: string;
  description: string;
  providerId: string;
  certificationIds: string[];
  estimatedTimeMonths: number;
  difficultyLevel: number; // 1-5 scale
  prerequisites: string[];
  careerOutcomes: string[];
  salaryRange: string;
  learningPath: LearningPathStep[];
  metadata: RoadmapMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface LearningPathStep {
  id: string;
  name: string;
  description: string;
  certificationId?: string;
  estimatedHours: number;
  order: number;
  isOptional: boolean;
  prerequisites: string[];
  resources: StudyResource[];
  skills: string[];
}

export interface StudyPathRecommendation {
  id: string;
  name: string;
  description: string;
  recommendedFor: string[];
  providerId: string;
  certifications: CertificationRecommendation[];
  totalTimeMonths: number;
  totalCost: number;
  difficultyLevel: number;
  careerGoals: string[];
  marketDemand: string;
  salaryImpact: string;
  confidenceScore: number; // 0-1 based on user preferences match
}

export interface CertificationRecommendation {
  certification: Certification;
  priority: number; // 1-5, 1 being highest priority
  reasoning: string;
  prerequisitesMet: boolean;
  estimatedTimeToReady: number; // hours
  recommendedStudyPlan: StudyPlanItem[];
}

export interface StudyPlanItem {
  id: string;
  title: string;
  type: StudyPlanItemType;
  estimatedHours: number;
  week: number;
  isRequired: boolean;
  resources: StudyResource[];
  description: string;
}

export interface UserLearningPreferences {
  careerGoals: string[];
  experienceLevel: ExperienceLevel;
  timeCommitmentWeekly: number; // hours per week
  budgetLimit?: number;
  preferredProviders: string[];
  avoidedProviders: string[];
  learningStyle: LearningStyle[];
  industryFocus: string[];
  currentSkills: string[];
  targetSkills: string[];
  timeframe: string; // "3months", "6months", "1year", "flexible"
}

export interface ProviderResource {
  id: string;
  title: string;
  type: ResourceType;
  category: ResourceCategory;
  providerId: string;
  certificationIds: string[];
  url: string;
  description: string;
  isFree: boolean;
  cost?: number;
  language: string;
  estimatedTime?: number; // hours or minutes depending on type
  difficulty: number; // 1-5
  rating?: number; // user ratings 1-5
  reviewCount?: number;
  lastUpdated: string;
  tags: string[];
  metadata: ResourceMetadata;
}

export interface RoadmapMetadata {
  popularityRank?: number;
  successRate?: number; // percentage of people who complete the roadmap
  averageCompletionTime?: number; // months
  jobPlacementRate?: number; // percentage
  industry?: string[];
  jobRoles?: string[];
  customFields?: Record<string, any>;
}

export interface ResourceMetadata {
  author?: string;
  publisher?: string;
  format?: string; // "video", "text", "interactive", "pdf"
  duration?: string; // for videos/courses
  pageCount?: number; // for books/documents
  version?: string;
  prerequisites?: string[];
  customFields?: Record<string, any>;
}

export enum StudyPlanItemType {
  READING = 'reading',
  VIDEO = 'video',
  PRACTICE_EXAM = 'practice_exam',
  HANDS_ON_LAB = 'hands_on_lab',
  PROJECT = 'project',
  REVIEW = 'review',
  ASSESSMENT = 'assessment'
}

export enum ExperienceLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export enum LearningStyle {
  VISUAL = 'visual',
  AUDITORY = 'auditory',
  KINESTHETIC = 'kinesthetic',
  READING_WRITING = 'reading_writing',
  PRACTICAL = 'practical',
  THEORETICAL = 'theoretical'
}

export enum ResourceCategory {
  OFFICIAL_DOCUMENTATION = 'official_documentation',
  TRAINING_MATERIAL = 'training_material',
  PRACTICE_RESOURCE = 'practice_resource',
  COMMUNITY_CONTENT = 'community_content',
  CERTIFICATION_GUIDE = 'certification_guide',
  EXAM_PREPARATION = 'exam_preparation',
  HANDS_ON_EXPERIENCE = 'hands_on_experience'
}

// Phase 7: Enhanced Request/Response Types

export interface GetCertificationRoadmapRequest {
  providerId: string;
  roadmapId?: string;
  userPreferences?: UserLearningPreferences;
}

export interface GetCertificationRoadmapResponse {
  roadmaps: CertificationRoadmap[];
  personalizedRecommendations?: StudyPathRecommendation[];
}

export interface GetStudyPathRecommendationsRequest {
  providerId: string;
  userPreferences: UserLearningPreferences;
  includeAlternativeProviders?: boolean;
}

export interface GetStudyPathRecommendationsResponse {
  recommendations: StudyPathRecommendation[];
  alternativeProviders?: StudyPathRecommendation[];
  totalRecommendations: number;
}

export interface GetProviderResourcesRequest {
  providerId: string;
  certificationId?: string;
  category?: ResourceCategory;
  type?: ResourceType;
  isFree?: boolean;
  maxCost?: number;
  language?: string;
  limit?: number;
  offset?: number;
}

export interface GetProviderResourcesResponse {
  resources: ProviderResource[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  filters: {
    categories: ResourceCategory[];
    types: ResourceType[];
    languages: string[];
    costRange: { min: number; max: number };
  };
}

export interface GetPersonalizedRecommendationsRequest {
  providerId?: string;
  userPreferences: UserLearningPreferences;
  maxRecommendations?: number;
}

export interface GetPersonalizedRecommendationsResponse {
  studyPaths: StudyPathRecommendation[];
  certificationPriorities: CertificationRecommendation[];
  recommendedResources: ProviderResource[];
  estimatedTimeline: {
    shortTerm: StudyPathRecommendation[]; // 3-6 months
    mediumTerm: StudyPathRecommendation[]; // 6-12 months
    longTerm: StudyPathRecommendation[]; // 1+ years
  };
}

// Service interfaces
export interface IProviderService {
  getProviders(request: GetProvidersRequest): Promise<GetProvidersResponse>;
  getProvider(request: GetProviderRequest): Promise<GetProviderResponse>;
  refreshCache(): Promise<void>;
  // Phase 7: Enhanced provider details methods
  getCertificationRoadmaps(request: GetCertificationRoadmapRequest): Promise<GetCertificationRoadmapResponse>;
  getStudyPathRecommendations(request: GetStudyPathRecommendationsRequest): Promise<GetStudyPathRecommendationsResponse>;
  getProviderResources(request: GetProviderResourcesRequest): Promise<GetProviderResourcesResponse>;
  getPersonalizedRecommendations(request: GetPersonalizedRecommendationsRequest): Promise<GetPersonalizedRecommendationsResponse>;
}