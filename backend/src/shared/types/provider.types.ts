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

// Service interfaces
export interface IProviderService {
  getProviders(request: GetProvidersRequest): Promise<GetProvidersResponse>;
  getProvider(request: GetProviderRequest): Promise<GetProviderResponse>;
  refreshCache(): Promise<void>;
}