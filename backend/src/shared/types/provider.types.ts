// =======================================================
// PROVIDER DOMAIN TYPES - STUDY APP V3 BACKEND
// =======================================================
// This file contains provider-specific types for API requests/responses
// and business operations. Core Provider entity is defined in domain.types.ts

import { Provider, Exam, EntityMetadata, StatusType } from './domain.types';

// =======================================================
// PROVIDER CLASSIFICATION ENUMS
// =======================================================

/**
 * Provider categories for classification
 */
export enum ProviderCategory {
  CLOUD = 'cloud',
  NETWORK = 'network',
  SECURITY = 'security',
  DATABASE = 'database',
  DEVELOPER = 'developer',
  PROJECT_MANAGEMENT = 'project_management',
  OTHER = 'other'
}

/**
 * Certification levels for skill classification
 */
export enum CertificationLevel {
  FOUNDATIONAL = 'foundational',
  ASSOCIATE = 'associate', 
  PROFESSIONAL = 'professional',
  EXPERT = 'expert',
  SPECIALTY = 'specialty'
}

/**
 * Exam format types
 */
export enum ExamFormat {
  MULTIPLE_CHOICE = 'multiple_choice',
  PRACTICAL = 'practical',
  SIMULATION = 'simulation',
  MIXED = 'mixed'
}

/**
 * Study resource types
 */
export enum ResourceType {
  OFFICIAL_GUIDE = 'official_guide',
  PRACTICE_EXAM = 'practice_exam',
  VIDEO_COURSE = 'video_course',
  DOCUMENTATION = 'documentation',
  WHITEPAPER = 'whitepaper',
  HANDS_ON_LAB = 'hands_on_lab',
  COMMUNITY = 'community'
}

// =======================================================
// PROVIDER METADATA AND EXTENDED TYPES
// =======================================================

/**
 * Extended metadata for provider management
 */
export interface ProviderMetadata extends EntityMetadata {
  headquarters?: string;
  founded?: string;
  employeeCount?: string;
  marketCap?: string;
  industry?: string;
  tags?: string[];
  popularityRank?: number;
  customFields?: Record<string, any>;
}

/**
 * Enhanced Provider entity with extended metadata
 * Uses the core Provider from domain.types.ts but adds provider-specific fields
 */
export interface EnhancedProvider extends Provider {
  fullName: string;
  status: StatusType;
  website: string;
  logoUrl: string;
  category: ProviderCategory;
  certifications: Certification[];
  metadata: ProviderMetadata;
}

/**
 * Certification within a provider (extends core Exam)
 */
export interface Certification extends Exam {
  fullName: string;
  level: CertificationLevel;
  examCode: string;
  maxScore?: number;
  questionCount?: number;
  cost?: number;
  validityPeriod?: number; // months
  prerequisites?: string[];
  skillsValidated: string[];
  examFormat: ExamFormat;
  languages: string[];
  retakePolicy?: string;
  studyResources?: StudyResource[];
  metadata: CertificationMetadata;
}

/**
 * Study resource for certification preparation
 */
export interface StudyResource {
  type: ResourceType;
  title: string;
  url: string;
  description?: string;
  isFree: boolean;
  rating?: number;
  reviewCount?: number;
}

/**
 * Extended metadata for certification management
 */
export interface CertificationMetadata extends EntityMetadata {
  difficultyLevel?: number; // 1-5 scale
  popularityRank?: number;
  marketDemand?: string; // high, medium, low
  jobRoles?: string[];
  industries?: string[];
  averageSalaryIncrease?: number; // percentage
  studyTimeRecommended?: number; // hours
  customFields?: Record<string, any>;
}

// =======================================================
// PROVIDER API REQUEST/RESPONSE TYPES
// =======================================================

/**
 * Request parameters for listing providers
 */
export interface GetProvidersRequest {
  category?: ProviderCategory;
  status?: StatusType;
  search?: string;
  includeInactive?: boolean;
  includeCertifications?: boolean;
  sortBy?: 'name' | 'popularity' | 'created';
  limit?: number;
  offset?: number;
}

/**
 * Response format for provider listing
 */
export interface GetProvidersResponse {
  providers: EnhancedProvider[];
  total: number;
  filters: {
    categories: ProviderCategory[];
    statuses: StatusType[];
  };
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Request parameters for getting a specific provider
 */
export interface GetProviderRequest {
  providerId?: string;
  id?: string; // Alternative identifier for backward compatibility
  includeCertifications?: boolean;
  includeInactive?: boolean;
}

/**
 * Response format for single provider details
 */
export interface GetProviderResponse {
  provider: EnhancedProvider;
}

// =======================================================
// SERVICE INTERFACE
// =======================================================

/**
 * Provider service interface for business operations
 */
export interface IProviderService {
  getProviders(request: GetProvidersRequest): Promise<GetProvidersResponse>;
  getProvider(request: GetProviderRequest): Promise<GetProviderResponse>;
  refreshCache(): Promise<void>;
}

// =======================================================
// BACKWARD COMPATIBILITY
// =======================================================
// Re-export core Provider types for convenience

export type { Provider, Exam } from './domain.types';

/** @deprecated Use StatusType instead */
export type ProviderStatus = StatusType;

/** @deprecated Use StatusType instead */
export type CertificationStatus = StatusType;
// Re-export StatusType as enum for value access in filters and handlers
export { StatusType as ProviderStatusEnum } from './domain.types';
