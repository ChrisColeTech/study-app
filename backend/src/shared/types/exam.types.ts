// Exam types for Study App V3 Backend - Phase 8: Exam Listing Feature

import { CertificationLevel, ExamFormat, ResourceType } from './provider.types';

// Core Exam Interface (based on provider certifications)
export interface Exam {
  id: string;
  providerId: string;
  providerName: string;
  name: string;
  fullName: string;
  code: string;
  description: string;
  level: CertificationLevel;
  status: ExamStatus;
  examCode: string;
  passingScore: number;
  maxScore: number;
  duration: number; // minutes
  questionCount: number;
  cost: number;
  validityPeriod: number; // months
  prerequisites: string[];
  topics: string[];
  skillsValidated: string[];
  examFormat: ExamFormat;
  languages: string[];
  retakePolicy: string;
  studyResources: ExamResource[];
  metadata: ExamMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface ExamResource {
  type: ResourceType;
  title: string;
  url: string;
  description: string;
  isFree: boolean;
  provider: string;
  cost: number;
  estimatedHours?: number;
  rating: number;
}

export interface ExamMetadata {
  category: ExamCategory;
  difficultyLevel: number; // 1-5 scale
  popularityRank: number;
  passRate: number; // percentage
  marketDemand: MarketDemand;
  salaryImpact: SalaryImpact;
  jobRoles: string[];
  industries: string[];
  nextStepExams: string[];
  studyTimeRecommended: number; // hours
  handsOnExperience: boolean;
  averageAttempts?: number;
  seasonalDemand?: string[];
  customFields: Record<string, any>;
}

// Exam comparison interface for multi-exam comparison
export interface ExamComparison {
  exams: Exam[];
  comparisonMatrix: ExamComparisonMatrix;
  recommendations: ExamComparisonRecommendation;
}

export interface ExamComparisonMatrix {
  difficulty: { [examId: string]: number };
  cost: { [examId: string]: number };
  duration: { [examId: string]: number };
  passRate: { [examId: string]: number };
  marketDemand: { [examId: string]: string };
  prerequisites: { [examId: string]: string[] };
  jobOpportunities: { [examId: string]: number };
}

export interface ExamComparisonRecommendation {
  bestOverall: string;
  easiest: string;
  mostAffordable: string;
  highestDemand: string;
  bestForBeginner: string;
  reasoning: { [examId: string]: string };
}

// Search and filtering interfaces
export interface ExamSearchCriteria {
  query?: string; // Search in name, description, topics
  providerId?: string;
  providerIds?: string[];
  category?: ExamCategory;
  categories?: ExamCategory[];
  level?: CertificationLevel;
  levels?: CertificationLevel[];
  difficulty?: DifficultyRange;
  costRange?: CostRange;
  durationRange?: DurationRange;
  languages?: string[];
  marketDemand?: MarketDemand;
  salaryImpact?: SalaryImpact;
  handsOnRequired?: boolean;
  format?: ExamFormat;
  formats?: ExamFormat[];
  status?: ExamStatus;
  hasPrerequisites?: boolean;
  industries?: string[];
  jobRoles?: string[];
  sortBy?: ExamSortOption;
  sortOrder?: SortOrder;
  limit?: number;
  offset?: number;
}

export interface DifficultyRange {
  min: number;
  max: number;
}

export interface CostRange {
  min: number;
  max: number;
}

export interface DurationRange {
  min: number; // minutes
  max: number; // minutes
}

// Enums
export enum ExamStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  RETIRED = 'retired',
  BETA = 'beta',
  COMING_SOON = 'coming_soon',
  UPDATED = 'updated'
}

export enum ExamCategory {
  CLOUD = 'cloud',
  NETWORKING = 'networking',
  SECURITY = 'security',
  DATABASE = 'database',
  PROGRAMMING = 'programming',
  PROJECT_MANAGEMENT = 'project_management',
  GENERAL_IT = 'general_it',
  VENDOR_SPECIFIC = 'vendor_specific',
  AI_ML = 'ai_ml',
  DATA_ANALYTICS = 'data_analytics',
  DEVOPS = 'devops',
  INFRASTRUCTURE = 'infrastructure'
}

export enum MarketDemand {
  VERY_HIGH = 'very_high',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  EMERGING = 'emerging'
}

export enum SalaryImpact {
  VERY_HIGH = 'very_high',
  HIGH = 'high', 
  MEDIUM = 'medium',
  LOW = 'low',
  ENTRY_LEVEL = 'entry_level'
}

export enum ExamSortOption {
  NAME = 'name',
  PROVIDER = 'provider',
  DIFFICULTY = 'difficulty',
  COST = 'cost',
  DURATION = 'duration',
  POPULARITY = 'popularity',
  PASS_RATE = 'pass_rate',
  MARKET_DEMAND = 'market_demand',
  SALARY_IMPACT = 'salary_impact',
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at'
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

// Request/Response Types
export interface ListExamsRequest {
  search?: ExamSearchCriteria;
  includeInactive?: boolean;
}

export interface ListExamsResponse {
  exams: Exam[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  filters: ExamFilters;
  aggregations: ExamAggregations;
}

export interface GetExamRequest {
  id: string;
  includeQuestions?: boolean;
  includeResources?: boolean;
}

export interface GetExamResponse {
  exam: Exam;
  similarExams?: Exam[];
  prerequisiteChain?: Exam[];
  nextStepExams?: Exam[];
  questionStats?: QuestionStats;
}

export interface SearchExamsRequest {
  query: string;
  filters?: ExamSearchCriteria;
  fuzzySearch?: boolean;
}

export interface SearchExamsResponse {
  exams: Exam[];
  searchMetadata: {
    query: string;
    totalResults: number;
    searchTime: number;
    suggestions?: string[];
  };
  filters: ExamFilters;
}

export interface CompareExamsRequest {
  examIds: string[];
  comparisonCriteria?: ExamComparisonCriteria[];
}

export interface CompareExamsResponse {
  comparison: ExamComparison;
  metadata: {
    comparisonDate: string;
    criteriaUsed: ExamComparisonCriteria[];
  };
}

export interface GetProviderExamsRequest {
  providerId: string;
  filters?: ExamSearchCriteria;
}

export interface GetProviderExamsResponse {
  provider: {
    id: string;
    name: string;
    fullName: string;
  };
  exams: Exam[];
  total: number;
  certificationPaths: CertificationPath[];
}

// Supporting interfaces
export interface ExamFilters {
  providers: ProviderFilter[];
  categories: CategoryFilter[];
  levels: LevelFilter[];
  difficulties: DifficultyFilter[];
  costRanges: CostFilter[];
  durationRanges: DurationFilter[];
  languages: string[];
  formats: ExamFormat[];
  marketDemands: MarketDemand[];
}

export interface ProviderFilter {
  id: string;
  name: string;
  count: number;
}

export interface CategoryFilter {
  category: ExamCategory;
  count: number;
}

export interface LevelFilter {
  level: CertificationLevel;
  count: number;
}

export interface DifficultyFilter {
  difficulty: number;
  count: number;
}

export interface CostFilter {
  range: string;
  min: number;
  max: number;
  count: number;
}

export interface DurationFilter {
  range: string;
  min: number;
  max: number;
  count: number;
}

export interface ExamAggregations {
  totalExams: number;
  activeExams: number;
  averageCost: number;
  averageDuration: number;
  averageDifficulty: number;
  mostPopularProvider: string;
  mostPopularCategory: ExamCategory;
  mostPopularLevel: CertificationLevel;
}

export interface QuestionStats {
  totalQuestions: number;
  questionsByTopic: { [topic: string]: number };
  difficultyDistribution: { [difficulty: string]: number };
  formatDistribution: { [format: string]: number };
}

export interface CertificationPath {
  id: string;
  name: string;
  description: string;
  examIds: string[];
  estimatedTimeMonths: number;
  totalCost: number;
  difficulty: number;
}

export enum ExamComparisonCriteria {
  COST = 'cost',
  DIFFICULTY = 'difficulty',
  DURATION = 'duration',
  PASS_RATE = 'pass_rate',
  MARKET_DEMAND = 'market_demand',
  PREREQUISITES = 'prerequisites',
  JOB_OPPORTUNITIES = 'job_opportunities',
  STUDY_TIME = 'study_time'
}

// Service interface
export interface IExamService {
  listExams(request: ListExamsRequest): Promise<ListExamsResponse>;
  getExam(request: GetExamRequest): Promise<GetExamResponse>;
  searchExams(request: SearchExamsRequest): Promise<SearchExamsResponse>;
  compareExams(request: CompareExamsRequest): Promise<CompareExamsResponse>;
  getProviderExams(request: GetProviderExamsRequest): Promise<GetProviderExamsResponse>;
  refreshExamCache(): Promise<void>;
}

// Error types
export interface ExamError {
  code: string;
  message: string;
  details?: any;
}

export const EXAM_ERROR_CODES = {
  EXAM_NOT_FOUND: 'EXAM_NOT_FOUND',
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
  INVALID_SEARCH_CRITERIA: 'INVALID_SEARCH_CRITERIA',
  INVALID_COMPARISON_REQUEST: 'INVALID_COMPARISON_REQUEST',
  TOO_MANY_EXAMS_TO_COMPARE: 'TOO_MANY_EXAMS_TO_COMPARE',
  CACHE_ERROR: 'CACHE_ERROR'
} as const;