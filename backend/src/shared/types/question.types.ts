// Question types for Study App V3 Backend
// Phase 12: Question Listing Feature

export interface Question {
  questionId: string;
  providerId: string;
  examId: string;
  topicId?: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  tags?: string[];
  metadata: QuestionMetadata;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuestionMetadata {
  source?: string;
  authorId?: string;
  reviewStatus?: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  language?: string;
  estimatedTime?: number; // seconds
  skillLevel?: string;
  bloomsLevel?: BloomsLevel;
  cognitiveLoad?: CognitiveLoad;
  customFields?: Record<string, any>;
}

export enum QuestionDifficulty {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate', 
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  MULTIPLE_SELECT = 'multiple_select',
  TRUE_FALSE = 'true_false',
  FILL_IN_THE_BLANK = 'fill_in_the_blank',
  DRAG_AND_DROP = 'drag_and_drop',
  SCENARIO = 'scenario',
  SIMULATION = 'simulation'
}

export enum ReviewStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived'
}

export enum BloomsLevel {
  REMEMBER = 'remember',
  UNDERSTAND = 'understand',
  APPLY = 'apply',
  ANALYZE = 'analyze',
  EVALUATE = 'evaluate',
  CREATE = 'create'
}

export enum CognitiveLoad {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

// Request/Response types for Question Listing
export interface GetQuestionsRequest {
  provider?: string;
  exam?: string;
  topic?: string;
  difficulty?: QuestionDifficulty;
  type?: QuestionType;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  includeExplanations?: boolean;
  includeMetadata?: boolean;
}

export interface GetQuestionsResponse {
  questions: Question[];
  total: number;
  filters: {
    providers: string[];
    exams: string[];
    topics: string[];
    difficulties: QuestionDifficulty[];
    types: QuestionType[];
    tags: string[];
  };
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Request/Response types for Question Details (Phase 13)
export interface GetQuestionRequest {
  questionId: string;
  includeExplanation?: boolean;
  includeMetadata?: boolean;
}

export interface GetQuestionResponse {
  question: Question;
}

// Request/Response types for Question Search (Phase 14)
export interface SearchQuestionsRequest {
  query: string;
  provider?: string;
  exam?: string;
  topic?: string;
  difficulty?: QuestionDifficulty;
  type?: QuestionType;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: SearchSortOption;
  includeExplanations?: boolean;
  includeMetadata?: boolean;
  highlightMatches?: boolean;
}

export interface SearchQuestionsResponse {
  questions: SearchQuestionResult[];
  total: number;
  query: string;
  searchTime: number; // milliseconds
  filters: {
    providers: string[];
    exams: string[];
    topics: string[];
    difficulties: QuestionDifficulty[];
    types: QuestionType[];
    tags: string[];
  };
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface SearchQuestionResult extends Question {
  relevanceScore: number; // 0-1 relevance score
  highlights?: SearchHighlights; // Highlighted matching terms
}

export interface SearchHighlights {
  questionText?: string[];
  options?: string[];
  explanation?: string[];
  tags?: string[];
}

export enum SearchSortOption {
  RELEVANCE = 'relevance',
  DIFFICULTY_ASC = 'difficulty_asc',
  DIFFICULTY_DESC = 'difficulty_desc',
  CREATED_ASC = 'created_asc',
  CREATED_DESC = 'created_desc'
}

// Service interface
export interface IQuestionService {
  getQuestions(request: GetQuestionsRequest): Promise<GetQuestionsResponse>;
  getQuestion(request: GetQuestionRequest): Promise<GetQuestionResponse>;
  searchQuestions(request: SearchQuestionsRequest): Promise<SearchQuestionsResponse>;
}