// Topic types for Study App V3 Backend

export interface Topic {
  id: string;
  name: string;
  category?: string;
  providerId: string;
  providerName: string;
  examId: string;
  examName: string;
  examCode: string;
  level: string;
  description?: string;
  skillsValidated: string[];
  metadata: TopicMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface TopicMetadata {
  difficultyLevel?: number; // 1-5 scale
  popularityRank?: number;
  marketDemand?: string; // high, medium, low
  jobRoles?: string[];
  industries?: string[];
  studyTimeRecommended?: number; // hours
  customFields?: Record<string, any>;
}

// Request/Response types
export interface GetTopicsRequest {
  provider?: string;
  exam?: string;
  category?: string;
  search?: string;
  level?: string;
}

export interface GetTopicsResponse {
  topics: Topic[];
  total: number;
  filters: {
    providers: string[];
    exams: string[];
    categories: string[];
    levels: string[];
  };
}

// Service interfaces
export interface ITopicService {
  getTopics(request: GetTopicsRequest): Promise<GetTopicsResponse>;
}