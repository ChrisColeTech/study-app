### Phase 13: Question Search Feature
**Dependencies**: Phase 12  
**Objective**: Implement full-text search for questions with relevance scoring and advanced filtering

#### Step 13.1: Create Search Types
Create `backend/src/shared/types/search.types.ts`:
```bash
cat > backend/src/shared/types/search.types.ts << 'EOF'
export interface SearchRequest {
  query: string;
  filters?: {
    examIds?: string[];
    providerIds?: string[];
    topics?: string[];
    difficulties?: string[];
    types?: string[];
  };
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'relevance' | 'difficulty' | 'topic' | 'exam';
    sortOrder?: 'asc' | 'desc';
    includeExplanations?: boolean;
  };
}

export interface SearchResult {
  question: Question;
  relevanceScore: number;
  highlights: {
    field: string;
    snippet: string;
  }[];
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  searchTime: number;
  suggestions: string[];
  facets: {
    exams: { id: string; name: string; count: number }[];
    providers: { id: string; name: string; count: number }[];
    topics: { name: string; count: number }[];
    difficulties: { level: string; count: number }[];
  };
}
EOF
```

#### Step 13.2: Implement Search Service
Create `backend/src/services/search.service.ts`:
```bash
cat > backend/src/services/search.service.ts << 'EOF'
import { SearchRequest, SearchResponse, SearchResult } from '../shared/types/search.types';
import { Question } from '../shared/types/question.types';
import { S3Repository } from '../repositories/s3.repository';
import { CacheService } from './cache.service';
import { Logger } from '../shared/utils/logger';

export class SearchService {
  private s3Repository: S3Repository;
  private cacheService: CacheService;
  private logger: Logger;

  constructor(s3Repository: S3Repository, cacheService: CacheService) {
    this.s3Repository = s3Repository;
    this.cacheService = cacheService;
    this.logger = new Logger('SearchService');
  }

  async searchQuestions(request: SearchRequest): Promise<SearchResponse> {
    const startTime = Date.now();
    
    try {
      // Generate cache key
      const cacheKey = `search:${JSON.stringify(request)}`;
      
      // Check cache first
      const cached = await this.cacheService.get<SearchResponse>(cacheKey);
      if (cached) {
        this.logger.info('Search results served from cache', { query: request.query });
        return cached;
      }

      // Load all questions based on filters
      const allQuestions = await this.loadFilteredQuestions(request.filters);
      
      // Perform search
      const searchResults = this.performFullTextSearch(allQuestions, request);
      
      // Apply sorting
      const sortedResults = this.applySorting(searchResults, request.options?.sortBy, request.options?.sortOrder);
      
      // Apply pagination
      const paginatedResults = this.applyPagination(sortedResults, request.options?.offset, request.options?.limit);
      
      // Generate facets
      const facets = this.generateFacets(allQuestions, request.query);
      
      // Generate suggestions
      const suggestions = this.generateSuggestions(request.query, allQuestions);
      
      const response: SearchResponse = {
        results: paginatedResults,
        totalCount: searchResults.length,
        searchTime: Date.now() - startTime,
        suggestions,
        facets
      };

      // Cache results for 5 minutes
      await this.cacheService.set(cacheKey, response, 300);
      
      this.logger.info('Search completed', { 
        query: request.query, 
        resultsCount: response.results.length,
        totalCount: response.totalCount,
        searchTime: response.searchTime
      });

      return response;
    } catch (error) {
      this.logger.error('Search failed', error as Error, { query: request.query });
      throw new Error('Search operation failed');
    }
  }

  private async loadFilteredQuestions(filters?: SearchRequest['filters']): Promise<Question[]> {
    // Get all questions from S3
    const allQuestions = await this.s3Repository.getAllQuestions();
    
    if (!filters) {
      return allQuestions;
    }

    return allQuestions.filter(question => {
      if (filters.examIds && !filters.examIds.includes(question.examId)) return false;
      if (filters.providerIds && !filters.providerIds.includes(question.providerId)) return false;
      if (filters.topics && !filters.topics.includes(question.topic)) return false;
      if (filters.difficulties && !filters.difficulties.includes(question.difficulty)) return false;
      if (filters.types && !filters.types.includes(question.questionType)) return false;
      return true;
    });
  }

  private performFullTextSearch(questions: Question[], request: SearchRequest): SearchResult[] {
    const query = request.query.toLowerCase().trim();
    const queryWords = query.split(/\s+/);
    
    return questions.map(question => {
      const relevanceScore = this.calculateRelevance(question, query, queryWords);
      const highlights = this.generateHighlights(question, queryWords);
      
      return {
        question,
        relevanceScore,
        highlights
      };
    }).filter(result => result.relevanceScore > 0);
  }

  private calculateRelevance(question: Question, query: string, queryWords: string[]): number {
    let score = 0;
    const searchableText = [
      question.questionText,
      question.topic,
      question.subtopic || '',
      question.explanation,
      ...(question.metadata.tags || []),
      ...(question.options || [])
    ].join(' ').toLowerCase();

    // Exact phrase match (highest score)
    if (searchableText.includes(query)) {
      score += 100;
    }

    // Individual word matches
    queryWords.forEach(word => {
      if (searchableText.includes(word)) {
        score += 10;
      }
      
      // Bonus for matches in question text
      if (question.questionText.toLowerCase().includes(word)) {
        score += 20;
      }
      
      // Bonus for matches in topic
      if (question.topic.toLowerCase().includes(word)) {
        score += 15;
      }
      
      // Bonus for matches in tags
      if (question.metadata.tags.some(tag => tag.toLowerCase().includes(word))) {
        score += 5;
      }
    });

    // Difficulty bonus (prefer intermediate questions)
    if (question.difficulty === 'intermediate') {
      score += 5;
    }

    return score;
  }

  private generateHighlights(question: Question, queryWords: string[]): SearchResult['highlights'] {
    const highlights: SearchResult['highlights'] = [];
    
    // Check question text
    const questionHighlight = this.createHighlight('questionText', question.questionText, queryWords);
    if (questionHighlight) highlights.push(questionHighlight);
    
    // Check explanation
    const explanationHighlight = this.createHighlight('explanation', question.explanation, queryWords);
    if (explanationHighlight) highlights.push(explanationHighlight);
    
    // Check options
    question.options?.forEach((option, index) => {
      const optionHighlight = this.createHighlight(`option_${index}`, option, queryWords);
      if (optionHighlight) highlights.push(optionHighlight);
    });

    return highlights.slice(0, 3); // Limit to 3 highlights
  }

  private createHighlight(field: string, text: string, queryWords: string[]): SearchResult['highlights'][0] | null {
    const lowerText = text.toLowerCase();
    
    for (const word of queryWords) {
      const index = lowerText.indexOf(word.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + word.length + 50);
        let snippet = text.substring(start, end);
        
        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';
        
        // Highlight the matching word
        const regex = new RegExp(`(${word})`, 'gi');
        snippet = snippet.replace(regex, '<mark>$1</mark>');
        
        return { field, snippet };
      }
    }
    
    return null;
  }

  private applySorting(results: SearchResult[], sortBy?: string, sortOrder?: string): SearchResult[] {
    const order = sortOrder === 'desc' ? -1 : 1;
    
    return results.sort((a, b) => {
      switch (sortBy) {
        case 'difficulty':
          const difficultyOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3 };
          return order * (difficultyOrder[a.question.difficulty as keyof typeof difficultyOrder] - 
                         difficultyOrder[b.question.difficulty as keyof typeof difficultyOrder]);
        case 'topic':
          return order * a.question.topic.localeCompare(b.question.topic);
        case 'exam':
          return order * a.question.examName.localeCompare(b.question.examName);
        case 'relevance':
        default:
          return order * (b.relevanceScore - a.relevanceScore);
      }
    });
  }

  private applyPagination(results: SearchResult[], offset = 0, limit = 20): SearchResult[] {
    return results.slice(offset, offset + limit);
  }

  private generateFacets(questions: Question[], query: string): SearchResponse['facets'] {
    const examMap = new Map<string, { id: string; name: string; count: number }>();
    const providerMap = new Map<string, { id: string; name: string; count: number }>();
    const topicMap = new Map<string, { name: string; count: number }>();
    const difficultyMap = new Map<string, { level: string; count: number }>();

    questions.forEach(q => {
      // Exams
      const examKey = q.examId;
      if (examMap.has(examKey)) {
        examMap.get(examKey)!.count++;
      } else {
        examMap.set(examKey, { id: q.examId, name: q.examName, count: 1 });
      }

      // Providers
      const providerKey = q.providerId;
      if (providerMap.has(providerKey)) {
        providerMap.get(providerKey)!.count++;
      } else {
        providerMap.set(providerKey, { id: q.providerId, name: q.providerName, count: 1 });
      }

      // Topics
      if (topicMap.has(q.topic)) {
        topicMap.get(q.topic)!.count++;
      } else {
        topicMap.set(q.topic, { name: q.topic, count: 1 });
      }

      // Difficulties
      if (difficultyMap.has(q.difficulty)) {
        difficultyMap.get(q.difficulty)!.count++;
      } else {
        difficultyMap.set(q.difficulty, { level: q.difficulty, count: 1 });
      }
    });

    return {
      exams: Array.from(examMap.values()).sort((a, b) => b.count - a.count),
      providers: Array.from(providerMap.values()).sort((a, b) => b.count - a.count),
      topics: Array.from(topicMap.values()).sort((a, b) => b.count - a.count),
      difficulties: Array.from(difficultyMap.values()).sort((a, b) => b.count - a.count)
    };
  }

  private generateSuggestions(query: string, questions: Question[]): string[] {
    const suggestions = new Set<string>();
    const queryLower = query.toLowerCase();
    
    // Add similar topics
    questions.forEach(q => {
      if (q.topic.toLowerCase().includes(queryLower)) {
        suggestions.add(q.topic);
      }
      
      // Add related tags
      q.metadata.tags.forEach(tag => {
        if (tag.toLowerCase().includes(queryLower)) {
          suggestions.add(tag);
        }
      });
    });

    return Array.from(suggestions).slice(0, 5);
  }
}
EOF
```

#### Step 13.3: Add Search Handler
Add to `backend/src/handlers/questions.ts`:
```bash
# Add import for search
sed -i '1i import { SearchRequest } from "../shared/types/search.types";' backend/src/handlers/questions.ts
sed -i '2i import { SearchService } from "../services/search.service";' backend/src/handlers/questions.ts

# Add search method to QuestionHandler class
cat >> backend/src/handlers/questions.ts << 'EOF'

export const search = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const handler = new BaseHandler('QuestionSearch');
  
  return handler.handleRequest(event, async (parsedEvent) => {
    // Validate request body
    if (!parsedEvent.body) {
      throw new ValidationError('Request body is required');
    }

    const searchRequest = JSON.parse(parsedEvent.body) as SearchRequest;
    
    // Validate search query
    if (!searchRequest.query || searchRequest.query.trim().length < 2) {
      throw new ValidationError('Query must be at least 2 characters long');
    }

    // Initialize services
    const serviceFactory = new ServiceFactory();
    const s3Repository = serviceFactory.createS3Repository();
    const cacheService = serviceFactory.createCacheService();
    const searchService = new SearchService(s3Repository, cacheService);

    // Perform search
    const searchResponse = await searchService.searchQuestions(searchRequest);

    return ResponseBuilder.success(searchResponse, 'Search completed successfully');
  });
};
EOF
```

#### Step 13.4: Update API Gateway for Search
Edit `lib/constructs/api-gateway-construct.ts`:
```bash
# Add search endpoint to questions resource
sed -i '/questions.addResource.'\''list'\''./a\      questions.addResource('\''search'\'').addMethod('\''POST'\'', new apigateway.LambdaIntegration(props.questionsSearchFunction!));' lib/constructs/api-gateway-construct.ts

# Add function parameter
sed -i 's/questionsListFunction?: lambda.Function;/questionsListFunction?: lambda.Function;\n  questionsSearchFunction?: lambda.Function;/' lib/constructs/api-gateway-construct.ts
```

#### Step 13.5: Update Main Stack
Edit `lib/study-app-stack-v3.ts`:
```bash
# Add questions search Lambda
cat >> lib/study-app-stack-v3.ts << 'EOF'

    // Create questions search Lambda
    const questionsSearchLambda = new LambdaConstruct(this, 'QuestionsSearchLambda', {
      functionName: `StudyAppV3-QuestionsSearch-${stage}`,
      handlerPath: 'questions.search',
      environment: {
        ...commonEnv,
        CACHE_TTL: '300' // 5 minutes cache for search
      }
    });

    // Grant permissions
    database.userTable.grantReadData(questionsSearchLambda.function);
    storage.dataBucket.grantRead(questionsSearchLambda.function);
    cache.redisCluster.connections.allowDefaultPortFrom(questionsSearchLambda.function);
EOF

# Update API Gateway construction
sed -i 's/questionsListFunction: questionsListLambda.function/questionsListFunction: questionsListLambda.function,\n      questionsSearchFunction: questionsSearchLambda.function/' lib/study-app-stack-v3.ts
```

#### Step 13.6: Build and Deploy
```bash
# Build Lambda functions
cd lambda
npm run build

# Return to CDK directory and deploy
cd ..
cdk deploy --context stage=dev --require-approval never
```

#### Step 13.7: Test Question Search Endpoint
```bash
# Get API URL
export API_URL=$(aws cloudformation describe-stacks --stack-name StudyAppStackV3 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Test basic search
curl -X POST "$API_URL/api/v1/questions/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "query": "network security",
    "options": {
      "limit": 10,
      "sortBy": "relevance"
    }
  }' | jq '.'

# Test search with filters
curl -X POST "$API_URL/api/v1/questions/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "query": "encryption",
    "filters": {
      "difficulties": ["intermediate", "advanced"],
      "topics": ["Security"]
    },
    "options": {
      "limit": 5,
      "includeExplanations": true,
      "sortBy": "difficulty",
      "sortOrder": "desc"
    }
  }' | jq '.'

# Test empty search (should return validation error)
curl -X POST "$API_URL/api/v1/questions/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "query": ""
  }' | jq '.'

# Verify response format
echo "Verifying search response includes:"
echo "- results array with relevanceScore"
echo "- totalCount number"
echo "- searchTime in milliseconds"
echo "- suggestions array"
echo "- facets with counts"
```

**Phase 13 Success Criteria**:
- ✅ Full-text search across question content, topics, and metadata
- ✅ Relevance scoring with configurable ranking factors
- ✅ Advanced filtering by exam, provider, topic, difficulty, type
- ✅ Flexible sorting options (relevance, difficulty, topic, exam)
- ✅ Search result highlighting with snippet generation
- ✅ Faceted search with count aggregations
- ✅ Query suggestions based on available content
- ✅ Performance optimization with intelligent caching
- ✅ Proper pagination and result limiting
- ✅ Input validation and error handling
- ✅ Response format matches SearchResponse type

### Phase 14: Session Creation Feature
**Dependencies**: Phase 13  
**Objective**: Implement study session creation with configuration, question selection, and randomization

#### Step 14.1: Create Session Types
Create `backend/src/shared/types/session.types.ts`:
```bash
cat > backend/src/shared/types/session.types.ts << 'EOF'
export interface SessionConfig {
  examId?: string;
  providerId?: string;
  topics?: string[];
  difficulties?: string[];
  questionTypes?: string[];
  questionCount: number;
  timeLimit?: number; // in minutes
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showExplanations?: 'never' | 'after_answer' | 'after_session';
  allowReview?: boolean;
  isAdaptive?: boolean;
}

export interface SessionQuestion {
  questionId: string;
  question: Question;
  order: number;
  userAnswer?: string[];
  isCorrect?: boolean;
  answeredAt?: string;
  timeSpent?: number;
}

export interface Session {
  sessionId: string;
  userId: string;
  config: SessionConfig;
  status: 'created' | 'in_progress' | 'paused' | 'completed' | 'abandoned';
  questions: SessionQuestion[];
  currentQuestionIndex: number;
  score: {
    correct: number;
    incorrect: number;
    unanswered: number;
    percentage: number;
  };
  timing: {
    startedAt?: string;
    lastActivityAt: string;
    completedAt?: string;
    totalTimeSpent: number; // in seconds
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    tags: string[];
  };
}

export interface CreateSessionRequest {
  config: SessionConfig;
  metadata?: {
    tags?: string[];
    description?: string;
  };
}

export interface SessionResponse {
  session: Session;
  currentQuestion?: Question;
  progress: {
    questionsAnswered: number;
    totalQuestions: number;
    timeRemaining?: number;
    estimatedCompletion?: string;
  };
}
EOF
```

#### Step 14.2: Implement Question Selection Service
Create `backend/src/services/question-selection.service.ts`:
```bash
cat > backend/src/services/question-selection.service.ts << 'EOF'
import { Question } from '../shared/types/question.types';
import { SessionConfig } from '../shared/types/session.types';
import { S3Repository } from '../repositories/s3.repository';
import { Logger } from '../shared/utils/logger';

export class QuestionSelectionService {
  private s3Repository: S3Repository;
  private logger: Logger;

  constructor(s3Repository: S3Repository) {
    this.s3Repository = s3Repository;
    this.logger = new Logger('QuestionSelectionService');
  }

  async selectQuestions(config: SessionConfig): Promise<Question[]> {
    try {
      // Load all available questions
      let questions = await this.loadFilteredQuestions(config);
      
      // Apply difficulty distribution if adaptive
      if (config.isAdaptive) {
        questions = this.applyAdaptiveDifficulty(questions, config);
      }
      
      // Randomize selection
      const selectedQuestions = this.randomizeSelection(questions, config.questionCount);
      
      // Shuffle questions if requested
      if (config.shuffleQuestions) {
        this.shuffleArray(selectedQuestions);
      }
      
      // Shuffle options within each question if requested
      if (config.shuffleOptions) {
        selectedQuestions.forEach(question => this.shuffleQuestionOptions(question));
      }

      this.logger.info('Questions selected for session', {
        totalAvailable: questions.length,
        selected: selectedQuestions.length,
        config: config
      });

      return selectedQuestions;
    } catch (error) {
      this.logger.error('Question selection failed', error as Error, { config });
      throw new Error('Failed to select questions for session');
    }
  }

  private async loadFilteredQuestions(config: SessionConfig): Promise<Question[]> {
    let questions = await this.s3Repository.getAllQuestions();
    
    // Apply filters
    if (config.examId) {
      questions = questions.filter(q => q.examId === config.examId);
    }
    
    if (config.providerId) {
      questions = questions.filter(q => q.providerId === config.providerId);
    }
    
    if (config.topics && config.topics.length > 0) {
      questions = questions.filter(q => config.topics!.includes(q.topic));
    }
    
    if (config.difficulties && config.difficulties.length > 0) {
      questions = questions.filter(q => config.difficulties!.includes(q.difficulty));
    }
    
    if (config.questionTypes && config.questionTypes.length > 0) {
      questions = questions.filter(q => config.questionTypes!.includes(q.questionType));
    }

    return questions;
  }

  private applyAdaptiveDifficulty(questions: Question[], config: SessionConfig): Question[] {
    // For adaptive sessions, ensure a good mix of difficulties
    const difficultyDistribution = {
      'beginner': 0.3,
      'intermediate': 0.5,
      'advanced': 0.2
    };

    const groupedByDifficulty = this.groupQuestionsByDifficulty(questions);
    const adaptiveQuestions: Question[] = [];

    Object.entries(difficultyDistribution).forEach(([difficulty, ratio]) => {
      const questionsForDifficulty = groupedByDifficulty[difficulty] || [];
      const count = Math.floor(config.questionCount * ratio);
      
      if (questionsForDifficulty.length > 0) {
        const selected = this.randomizeSelection(questionsForDifficulty, 
          Math.min(count, questionsForDifficulty.length));
        adaptiveQuestions.push(...selected);
      }
    });

    // Fill remaining slots with any available questions
    const remaining = config.questionCount - adaptiveQuestions.length;
    if (remaining > 0) {
      const unusedQuestions = questions.filter(q => 
        !adaptiveQuestions.some(aq => aq.questionId === q.questionId));
      const additional = this.randomizeSelection(unusedQuestions, remaining);
      adaptiveQuestions.push(...additional);
    }

    return adaptiveQuestions;
  }

  private groupQuestionsByDifficulty(questions: Question[]): { [key: string]: Question[] } {
    return questions.reduce((groups, question) => {
      const difficulty = question.difficulty;
      if (!groups[difficulty]) {
        groups[difficulty] = [];
      }
      groups[difficulty].push(question);
      return groups;
    }, {} as { [key: string]: Question[] });
  }

  private randomizeSelection(questions: Question[], count: number): Question[] {
    if (questions.length <= count) {
      return [...questions];
    }

    const shuffled = [...questions];
    this.shuffleArray(shuffled);
    return shuffled.slice(0, count);
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  private shuffleQuestionOptions(question: Question): void {
    if (!question.options || question.options.length <= 1) {
      return;
    }

    // Create mapping to track correct answers
    const originalOptions = [...question.options];
    const correctIndices = question.correctAnswers.map(answer => 
      originalOptions.findIndex(option => option === answer));

    // Shuffle options
    this.shuffleArray(question.options);

    // Update correct answers based on new positions
    question.correctAnswers = correctIndices.map(oldIndex => {
      const originalOption = originalOptions[oldIndex];
      const newIndex = question.options!.findIndex(option => option === originalOption);
      return question.options![newIndex];
    });
  }

  estimateCompletionTime(questionCount: number, averageTimePerQuestion = 90): number {
    // Return estimated completion time in seconds
    return questionCount * averageTimePerQuestion;
  }
}
EOF
```

[Content continues with Phases 15 and 16 abbreviated due to length limits]

### Phase 15: Session Management Feature
**Dependencies**: Phase 14  
**Objective**: Implement session updates, pause/resume, and deletion functionality

[Steps 15.1-15.6 with session management implementation...]

**Phase 15 Success Criteria**:
- ✅ Complete session lifecycle management (create, update, pause, resume, delete)
- ✅ Proper status transition validation and enforcement
- ✅ Session listing with filtering, pagination, and sorting
- ✅ Audit trail with version tracking and timestamps
- ✅ Soft delete for abandoned sessions (audit purposes)
- ✅ Access control ensuring users can only manage their own sessions
- ✅ Error handling for invalid operations and state transitions
- ✅ Performance optimization for session queries
- ✅ Comprehensive session metadata and tracking
- ✅ RESTful API design with proper HTTP methods

### Phase 16: Session Answers & Completion Feature
**Dependencies**: Phase 15  
**Objective**: Implement answer submission with immediate feedback, progress tracking, and session completion with analytics

[Steps 16.1-16.7 with answer processing and completion implementation...]

**Phase 16 Success Criteria**:
- ✅ Complete answer processing for all question types (multiple-choice, multiple-select)
- ✅ Immediate feedback with explanations and hints
- ✅ Partial credit calculation for multiple-select questions
- ✅ Real-time progress tracking with time management
- ✅ Session completion with comprehensive analytics
- ✅ Performance analysis by topic and difficulty
- ✅ Grade calculation and mastery level assessment
- ✅ Personalized recommendations and next steps
- ✅ Adaptive difficulty adjustment framework
- ✅ Comprehensive completion summary with actionable insights
- ✅ Input validation and error handling
- ✅ Session state validation and access control