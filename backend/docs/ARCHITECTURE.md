# System Architecture - Multi-Exam Certification Study Platform Backend

## 🏗️ Architecture Overview

The Multi-Exam Certification Study Platform backend is designed as a high-performance, local JSON-based study system that processes certification questions from multiple providers (AWS, Azure, GCP, CompTIA, Cisco) without external API dependencies. The architecture emphasizes fast data access, intelligent caching, and scalable multi-provider support.

**Core Philosophy**: Local-first data processing with provider-agnostic design patterns, ensuring fast performance, complete data control, and unlimited offline capability.

## 🎯 Architectural Principles

### **1. Local Data First**
- **JSON File Storage**: All question data stored as organized JSON files
- **No External Dependencies**: Zero reliance on external provider APIs
- **Fast Access**: Direct file system operations with intelligent caching
- **Complete Control**: Full control over data format, structure, and access patterns

### **2. Provider Agnostic Design**
- **Universal Data Models**: Common question/exam interfaces across all providers
- **Pluggable Providers**: Easy addition of new certification providers
- **Consistent APIs**: Unified REST endpoints regardless of underlying provider
- **Cross-Provider Features**: Sessions and analytics that work across multiple providers

### **3. Performance-Centric**
- **Multi-Layer Caching**: Redis caching with intelligent cache warming
- **Lazy Loading**: Load question data only when needed
- **Concurrent Processing**: Parallel file operations and request handling
- **Optimized Data Structures**: Efficient in-memory representations

### **4. SOLID Principles Implementation**

#### **Single Responsibility Principle**
```typescript
// Each service has a focused responsibility
class QuestionService {
  // Only handles question processing and filtering
  async getFilteredQuestions(filters: QuestionFilters): Promise<Question[]>
}

class FileSystemService {
  // Only handles file operations
  async readQuestionFile(filePath: string): Promise<RawQuestionData>
}

class CacheService {
  // Only handles caching operations
  async cacheQuestions(key: string, questions: Question[]): Promise<void>
}
```

#### **Open/Closed Principle**
```typescript
// Abstract base for extensibility
abstract class BaseProvider {
  abstract loadQuestions(examCode: string): Promise<Question[]>
  abstract getExamMetadata(examCode: string): Promise<ExamMetadata>
}

// Extend for new providers without modifying existing code
class AWSProvider extends BaseProvider {
  async loadQuestions(examCode: string): Promise<Question[]> {
    return this.fileSystemService.loadQuestions('aws', examCode)
  }
}

class AzureProvider extends BaseProvider {
  async loadQuestions(examCode: string): Promise<Question[]> {
    return this.fileSystemService.loadQuestions('azure', examCode)
  }
}
```

#### **Liskov Substitution Principle**
```typescript
// Any provider can be substituted without breaking functionality
interface IProviderService {
  getProvider(providerId: string): BaseProvider
  getAllProviders(): BaseProvider[]
}

// All providers implement the same interface
class ProviderFactory {
  createProvider(providerId: string): BaseProvider {
    switch (providerId) {
      case 'aws': return new AWSProvider()
      case 'azure': return new AzureProvider()
      case 'gcp': return new GCPProvider()
      default: throw new Error('Unknown provider')
    }
  }
}
```

#### **Interface Segregation Principle**
```typescript
// Focused interfaces for specific needs
interface IQuestionReader {
  readQuestions(provider: string, exam: string): Promise<Question[]>
}

interface IQuestionFilter {
  filterByTopic(questions: Question[], topic: string): Question[]
  filterByDifficulty(questions: Question[], difficulty: string): Question[]
}

interface IQuestionCache {
  cacheQuestions(key: string, questions: Question[]): Promise<void>
  getCachedQuestions(key: string): Promise<Question[] | null>
}
```

#### **Dependency Inversion Principle**
```typescript
// High-level modules depend on abstractions
class StudySessionService {
  constructor(
    private questionService: IQuestionService,
    private cacheService: ICacheService,
    private progressService: IProgressService
  ) {}
  
  async createSession(config: SessionConfig): Promise<StudySession> {
    // Depends on abstractions, not concrete implementations
    const questions = await this.questionService.getQuestions(config.filters)
    await this.cacheService.cacheSession(sessionId, session)
    return session
  }
}
```

## 🏛️ System Architecture Layers

### **1. Presentation Layer - HTTP API**

#### **REST API Design**
```typescript
// RESTful endpoints with consistent patterns
app.use('/api/v1/providers', providerRoutes)      // Provider management
app.use('/api/v1/exams', examRoutes)              // Exam information
app.use('/api/v1/questions', questionRoutes)      // Question retrieval
app.use('/api/v1/sessions', sessionRoutes)        // Study sessions
app.use('/api/v1/analytics', analyticsRoutes)     // Progress analytics
```

#### **Middleware Stack**
```typescript
// Layered middleware for cross-cutting concerns
app.use(helmet())                    // Security headers
app.use(cors(corsConfig))           // CORS handling
app.use(compression())              // Response compression
app.use(rateLimit(rateLimitConfig)) // Rate limiting
app.use(authMiddleware)             // Authentication
app.use(validationMiddleware)       // Input validation
app.use(errorHandler)               // Error handling
```

#### **Response Standardization**
```typescript
// Consistent API response format
interface APIResponse<T> {
  success: boolean
  data: T
  message?: string
  pagination?: PaginationInfo
  timestamp: string
}
```

### **2. Application Layer - Business Logic**

#### **Service Layer Architecture**
```typescript
// Domain-driven service organization
class StudySessionService {
  constructor(
    private questionService: QuestionService,
    private userService: UserService,
    private analyticsService: AnalyticsService,
    private cacheService: CacheService
  ) {}

  async createMultiProviderSession(
    userId: string,
    providers: string[],
    config: SessionConfig
  ): Promise<StudySession> {
    // Cross-provider session creation logic
    const questions = await this.questionService.getQuestionsFromProviders(providers, config)
    const session = await this.createSession(userId, questions, config)
    await this.cacheService.cacheSession(session.id, session)
    return session
  }
}
```

#### **Cross-Provider Analytics**
```typescript
class CrossProviderAnalyticsService {
  async getProgressComparison(userId: string): Promise<CrossProviderProgress> {
    const awsProgress = await this.getProviderProgress(userId, 'aws')
    const azureProgress = await this.getProviderProgress(userId, 'azure')
    const gcpProgress = await this.getProviderProgress(userId, 'gcp')
    
    return {
      providers: { aws: awsProgress, azure: azureProgress, gcp: gcpProgress },
      transferableSkills: this.identifyTransferableSkills([awsProgress, azureProgress, gcpProgress]),
      recommendations: this.generateCrossProviderRecommendations(userId)
    }
  }
}
```

### **3. Data Access Layer - File System Operations**

#### **File System Service**
```typescript
class FileSystemService {
  private readonly dataBasePath: string
  private readonly cache = new Map<string, any>()
  
  async loadQuestionSet(provider: string, examCode: string): Promise<QuestionSet> {
    const filePath = path.join(this.dataBasePath, provider, examCode, 'questions.json')
    
    // Security: Validate file path to prevent directory traversal
    if (!this.isValidPath(filePath)) {
      throw new SecurityError('Invalid file path')
    }
    
    // Performance: Check cache first
    const cacheKey = `${provider}:${examCode}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }
    
    // Load and validate data
    const rawData = await fs.readFile(filePath, 'utf-8')
    const questionSet = JSON.parse(rawData)
    await this.validateQuestionSet(questionSet)
    
    // Cache for future use
    this.cache.set(cacheKey, questionSet)
    return questionSet
  }
  
  private async validateQuestionSet(data: any): Promise<void> {
    const validationResult = this.questionSchema.validate(data)
    if (validationResult.error) {
      throw new ValidationError('Invalid question data format', validationResult.error)
    }
  }
}
```

#### **Provider Data Organization**
```typescript
class ProviderService {
  async getAllProviders(): Promise<ExamProvider[]> {
    const providersPath = path.join(this.dataPath, 'providers')
    const providerDirs = await fs.readdir(providersPath)
    
    const providers = await Promise.all(
      providerDirs.map(async (dir) => {
        const metadataPath = path.join(providersPath, dir, 'metadata.json')
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
        return this.transformToProvider(dir, metadata)
      })
    )
    
    return providers.filter(provider => provider.isActive)
  }
  
  async getProviderExams(providerId: string): Promise<Exam[]> {
    const providerPath = path.join(this.dataPath, 'providers', providerId)
    const examDirs = await fs.readdir(providerPath)
    
    return Promise.all(
      examDirs
        .filter(dir => dir !== 'metadata.json')
        .map(examDir => this.loadExamMetadata(providerId, examDir))
    )
  }
}
```

### **4. Persistence Layer - Database & Cache**

#### **Database Schema (PostgreSQL)**
```sql
-- User management and authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Study sessions (no question content stored)
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  provider VARCHAR(50) NOT NULL,
  exam_code VARCHAR(50) NOT NULL,
  session_type VARCHAR(20) NOT NULL,
  config JSONB NOT NULL,
  progress JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  INDEX (user_id, provider),
  INDEX (status, started_at)
);

-- User progress tracking across providers
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  provider VARCHAR(50) NOT NULL,
  exam_code VARCHAR(50) NOT NULL,
  topic VARCHAR(100) NOT NULL,
  questions_answered INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  accuracy DECIMAL(5,2) COMPUTED (correct_answers::decimal / questions_answered * 100),
  last_studied_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider, exam_code, topic)
);

-- Question statistics (no actual questions stored)
CREATE TABLE question_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  exam_code VARCHAR(50) NOT NULL,
  question_hash VARCHAR(64) NOT NULL, -- Hash of question content
  times_answered INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  average_time_seconds DECIMAL(8,2),
  difficulty_rating DECIMAL(3,2),
  last_answered_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider, exam_code, question_hash)
);
```

#### **Redis Caching Strategy**
```typescript
class CacheService {
  // L1: Question data cache (30 minutes TTL)
  async cacheQuestions(provider: string, examCode: string, questions: Question[]): Promise<void> {
    const key = `questions:${provider}:${examCode}`
    await this.redis.setex(key, 1800, JSON.stringify(questions))
  }
  
  // L2: User session cache (2 hour TTL)
  async cacheSession(sessionId: string, session: StudySession): Promise<void> {
    const key = `session:${sessionId}`
    await this.redis.setex(key, 7200, JSON.stringify(session))
  }
  
  // L3: Analytics cache (1 hour TTL)
  async cacheUserAnalytics(userId: string, analytics: UserAnalytics): Promise<void> {
    const key = `analytics:${userId}`
    await this.redis.setex(key, 3600, JSON.stringify(analytics))
  }
  
  // Cache warming for popular content
  async warmCache(): Promise<void> {
    const popularProviders = ['aws', 'azure', 'gcp']
    const popularExams = ['saa-c03', 'az-104', 'ace']
    
    for (const provider of popularProviders) {
      for (const exam of popularExams) {
        if (this.providerService.hasExam(provider, exam)) {
          const questions = await this.questionService.loadQuestions(provider, exam)
          await this.cacheQuestions(provider, exam, questions)
        }
      }
    }
  }
}
```

## 🔄 Data Flow Architecture

### **Question Processing Pipeline**
```
JSON File → Validation → Parsing → Transform → Cache → API Response
    ↓           ↓          ↓         ↓         ↓         ↓
File System → Schema → Question → Standard → Redis → HTTP JSON
              Check    Objects    Format     Cache
```

### **Study Session Flow**
```
Session Request → Authentication → Question Selection → Data Loading → Processing → Response
       ↓               ↓               ↓                ↓              ↓           ↓
   Validation → JWT Check → Algorithm → File System → Transform → JSON API
                           Logic        + Cache         + Cache
```

### **Cross-Provider Analytics Flow**
```
Analytics Request → User Progress → Provider Data → Aggregation → Insights → Response
        ↓               ↓             ↓             ↓           ↓          ↓
    Authentication → Database → File System → Processing → AI Logic → JSON API
                     Query      + Cache        + Cache
```

## 🚀 Performance Architecture

### **Multi-Layer Caching Strategy**

#### **Layer 1: Application Cache (In-Memory)**
```typescript
class ApplicationCache {
  private readonly cache = new Map<string, CachedItem>()
  private readonly maxSize = 1000
  private readonly ttl = 300000 // 5 minutes
  
  set<T>(key: string, value: T): void {
    // LRU eviction when cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: this.ttl
    })
  }
  
  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item || Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }
    return item.value as T
  }
}
```

#### **Layer 2: Redis Cache (Distributed)**
```typescript
class DistributedCache {
  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key)
    return cached ? JSON.parse(cached) : null
  }
  
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value))
  }
  
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern)
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
  }
}
```

### **Concurrent Processing**
```typescript
class ConcurrentQuestionProcessor {
  async processMultipleProviders(
    providers: string[],
    examCodes: string[],
    filters: QuestionFilters
  ): Promise<Question[]> {
    // Process providers concurrently
    const providerPromises = providers.map(provider =>
      Promise.all(
        examCodes.map(examCode =>
          this.questionService.getQuestions(provider, examCode, filters)
        )
      )
    )
    
    const providerResults = await Promise.all(providerPromises)
    
    // Flatten and combine results
    return providerResults
      .flat(2)
      .sort((a, b) => this.calculateRelevanceScore(b) - this.calculateRelevanceScore(a))
  }
  
  private calculateRelevanceScore(question: Question): number {
    // Scoring algorithm for question relevance
    let score = 0
    score += question.difficulty === 'intermediate' ? 10 : 5
    score += question.tags.length * 2
    score += question.references?.length * 3 || 0
    return score
  }
}
```

## 🔒 Security Architecture

### **Input Validation and Sanitization**
```typescript
class SecurityService {
  validateFilePath(filePath: string): boolean {
    // Prevent directory traversal attacks
    const normalizedPath = path.normalize(filePath)
    const basePath = path.resolve(this.dataBasePath)
    const fullPath = path.resolve(basePath, normalizedPath)
    
    return fullPath.startsWith(basePath) && !normalizedPath.includes('..')
  }
  
  sanitizeUserInput(input: any): any {
    if (typeof input === 'string') {
      return input.trim().replace(/<script[^>]*>.*?<\/script>/gi, '')
    }
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeUserInput(item))
    }
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeUserInput(value)
      }
      return sanitized
    }
    return input
  }
}
```

### **Authentication and Authorization**
```typescript
class AuthenticationService {
  async authenticateToken(token: string): Promise<User | null> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload
      const user = await this.userRepository.findById(payload.userId)
      
      if (!user || !user.isActive) {
        return null
      }
      
      // Check if token is blacklisted
      const isBlacklisted = await this.redis.get(`blacklist:${token}`)
      if (isBlacklisted) {
        return null
      }
      
      return user
    } catch (error) {
      return null
    }
  }
  
  async authorize(user: User, resource: string, action: string): Promise<boolean> {
    // Role-based access control
    const permissions = await this.getUserPermissions(user)
    return permissions.some(permission =>
      permission.resource === resource && permission.actions.includes(action)
    )
  }
}
```

## 📊 Monitoring and Observability

### **Performance Monitoring**
```typescript
class PerformanceMonitor {
  async trackFileOperation<T>(
    operation: string,
    filePath: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = process.hrtime.bigint()
    const startMemory = process.memoryUsage()
    
    try {
      const result = await fn()
      
      const endTime = process.hrtime.bigint()
      const endMemory = process.memoryUsage()
      const duration = Number(endTime - startTime) / 1000000 // Convert to ms
      
      await this.recordMetric({
        operation,
        filePath,
        duration,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        success: true,
        timestamp: new Date()
      })
      
      return result
    } catch (error) {
      await this.recordMetric({
        operation,
        filePath,
        error: error.message,
        success: false,
        timestamp: new Date()
      })
      throw error
    }
  }
}
```

### **Health Checks**
```typescript
class HealthCheckService {
  async performHealthCheck(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkFileSystem(),
      this.checkMemoryUsage(),
      this.checkDiskSpace()
    ])
    
    const results = checks.map((check, index) => ({
      name: ['database', 'redis', 'filesystem', 'memory', 'disk'][index],
      status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      message: check.status === 'fulfilled' ? check.value : check.reason.message,
      timestamp: new Date()
    }))
    
    const overallStatus = results.every(result => result.status === 'healthy')
      ? 'healthy'
      : 'unhealthy'
    
    return { overallStatus, checks: results }
  }
}
```

This architecture provides a comprehensive, scalable, and maintainable foundation for a multi-exam certification study platform that efficiently processes local JSON data while maintaining high performance, security, and reliability standards.