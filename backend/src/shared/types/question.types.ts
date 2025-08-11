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

// Service interface
export interface IQuestionService {
  getQuestions(request: GetQuestionsRequest): Promise<GetQuestionsResponse>;
}