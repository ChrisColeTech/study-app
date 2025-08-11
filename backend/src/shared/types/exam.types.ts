// Exam types for Study App V3 Backend
// Phase 8: Exam Listing Feature

export interface Exam {
  examId: string;
  examName: string;
  examCode: string;
  providerId: string;
  providerName: string;
  description: string;
  level: 'foundational' | 'associate' | 'professional' | 'specialty' | 'expert';
  duration: number | undefined; // minutes
  questionCount: number;
  passingScore: number | undefined;
  topics: string[];
  isActive: boolean;
  metadata: {
    lastUpdated: string;
    examUrl: string | undefined;
    cost: string | undefined;
    validityPeriod: number | undefined; // months
    retakePolicy: string | undefined;
    languages: string[] | undefined;
  };
}

export interface GetExamsRequest {
  provider?: string;
  category?: string;
  level?: string;
  search?: string;
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export interface GetExamsResponse {
  exams: Exam[];
  total: number;
  filters: {
    providers: string[];
    categories: string[];
    levels: string[];
  };
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface IExamService {
  getExams(request: GetExamsRequest): Promise<GetExamsResponse>;
}