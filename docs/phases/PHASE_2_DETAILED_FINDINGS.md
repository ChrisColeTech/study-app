# Phase 2: Extract All Requirements - Detailed Findings

**Started**: 2025-08-10  
**Status**: IN PROGRESS

---

## Phase 2.1: Business Entities Identification

### Task 1: List all business entities mentioned in documentation

**Source**: Comprehensive review of 22 backend-relevant documents from Phase 1

**Business Entities Identified**:
1. **User** - Authentication and user management
2. **Provider** - Certification providers (AWS, Azure, GCP, CompTIA, Cisco)
3. **Exam** - Certification exams within providers
4. **Topic** - Study topics that can span multiple exams
5. **Question** - Study questions stored in JSON files
6. **StudySession** - User study attempts and progress
7. **Answer** - User responses during study sessions
8. **UserProgress** - Progress tracking across providers/exams/topics
9. **Goal** - User-defined study targets
10. **Analytics** - Computed performance insights

### Task 2: Define the properties and attributes of each entity

#### **User Entity**
- `userId` (UUID, primary key)
- `email` (string, unique, authentication)
- `passwordHash` (string, bcrypt hashed)
- `firstName` (string)
- `lastName` (string)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- `isActive` (boolean)
- `preferences` (JSON object)

#### **Provider Entity**
- `providerId` (string, primary key) - "aws", "azure", "gcp", "comptia", "cisco"
- `providerName` (string) - "Amazon Web Services", "Microsoft Azure", etc.
- `description` (string)
- `logoUrl` (string)
- `websiteUrl` (string)
- `examCount` (integer)
- `isActive` (boolean)
- `metadata` (JSON object)

#### **Exam Entity**
- `examId` (string, primary key) - "saa-c03", "az-900", "ace", etc.
- `examName` (string) - "AWS Solutions Architect Associate"
- `examCode` (string) - "SAA-C03"
- `providerId` (string, references Provider)
- `description` (string)
- `duration` (integer, minutes)
- `questionCount` (integer)
- `passingScore` (integer, percentage)
- `difficulty` (string) - "beginner", "intermediate", "advanced"
- `topicIds` (array of strings)
- `isActive` (boolean)
- `metadata` (JSON object)

#### **Topic Entity**
- `topicId` (string, primary key) - "storage", "compute", "networking", etc.
- `topicName` (string) - "Storage Services", "Compute Services"
- `description` (string)
- `parentTopicId` (string, optional for subtopics)
- `examIds` (array of strings, which exams include this topic)
- `questionCount` (integer)
- `difficulty` (string)
- `metadata` (JSON object)

#### **Question Entity**
- `questionId` (string, primary key)
- `questionText` (string, markdown supported)
- `questionType` (string) - "single_choice", "multiple_choice", "select_all"
- `options` (array of strings)
- `correctAnswers` (array of integers, option indices)
- `explanation` (string, markdown supported)
- `topicIds` (array of strings)
- `examId` (string)
- `providerId` (string)
- `difficulty` (string)
- `keywords` (array of strings)
- `metadata` (JSON object)

#### **StudySession Entity**
- `sessionId` (UUID, primary key)
- `userId` (UUID, references User)
- `sessionType` (string) - "regular", "cross_provider", "adaptive"
- `providerIds` (array of strings)
- `examIds` (array of strings)
- `topicIds` (array of strings, optional filtering)
- `questionCount` (integer)
- `status` (string) - "active", "completed", "abandoned"
- `startedAt` (timestamp)
- `completedAt` (timestamp, optional)
- `currentQuestionIndex` (integer)
- `answers` (JSON array of answer objects)
- `score` (float, percentage)
- `timeSpent` (integer, seconds)
- `metadata` (JSON object)

#### **Answer Entity** (Embedded in StudySession)
- `questionId` (string)
- `selectedAnswers` (array of integers, option indices selected by user)
- `correctAnswers` (array of integers, correct option indices)
- `isCorrect` (boolean)
- `timeSpent` (integer, seconds on this question)
- `answeredAt` (timestamp)

#### **UserProgress Entity**
- `progressId` (UUID, primary key)
- `userId` (UUID, references User)
- `providerId` (string)
- `examId` (string)
- `topicId` (string, optional)
- `totalQuestions` (integer)
- `correctAnswers` (integer)
- `accuracy` (float, percentage)
- `averageTime` (float, seconds per question)
- `masteryLevel` (string) - "beginner", "intermediate", "advanced", "expert"
- `lastStudiedAt` (timestamp)
- `studyStreak` (integer, consecutive days)
- `metadata` (JSON object)

#### **Goal Entity**
- `goalId` (UUID, primary key)
- `userId` (UUID, references User)
- `goalType` (string) - "exam_target", "study_streak", "accuracy_target"
- `title` (string)
- `description` (string)
- `providerId` (string, optional)
- `examId` (string, optional)
- `targetValue` (integer or float)
- `currentValue` (integer or float)
- `targetDate` (date, optional)
- `status` (string) - "active", "completed", "paused"
- `createdAt` (timestamp)
- `metadata` (JSON object)

#### **Analytics Entity** (Computed/Aggregate)
- `userId` (UUID)
- `timeframe` (string) - "daily", "weekly", "monthly"
- `providerId` (string, optional)
- `examId` (string, optional)
- `sessionsCompleted` (integer)
- `questionsAnswered` (integer)
- `averageAccuracy` (float)
- `studyTime` (integer, minutes)
- `improvementTrend` (float)
- `competencyScores` (JSON object, by topic)
- `generatedAt` (timestamp)

### Task 3: Map the true relationships between entities (not artificial hierarchies)

#### **Many-to-Many Relationships**:
- **Topics ↔ Exams**: Topics can appear in multiple exams, exams contain multiple topics
- **Questions ↔ Topics**: Questions can cover multiple topics, topics contain multiple questions

#### **One-to-Many Relationships**:
- **User → StudySessions**: Users can have multiple study sessions
- **User → UserProgress**: Users have progress records for each provider/exam/topic
- **User → Goals**: Users can set multiple goals

#### **Reference Relationships** (No Foreign Keys in traditional sense):
- **Provider → Exams**: Providers offer multiple exams (reference only, not containment)
- **StudySession references Questions**: Via questionIds in answers array
- **UserProgress references Provider/Exam/Topic**: Via string identifiers
- **Analytics references all entities**: For computation purposes

#### **Critical Architecture Insight**: 
**NO ARTIFICIAL HIERARCHIES** - Providers don't "contain" exams, exams don't "contain" topics. These are independent entities with reference relationships.

### Task 4: Identify entity lifecycle and state management requirements

#### **User Lifecycle**:
Registration → Email Verification → Active User → Deactivated (optional)

#### **StudySession Lifecycle**:
Created → Active (answering questions) → Completed or Abandoned

#### **Goal Lifecycle**:
Created → Active → Completed or Paused

#### **Static Entities** (No lifecycle):
- **Provider, Exam, Topic, Question**: Loaded from JSON files, no state changes

#### **Computed Entities**:
- **Analytics**: Generated on-demand, cached temporarily

#### **Storage Patterns**:
- **Database Storage**: User, StudySession, UserProgress, Goal (PostgreSQL)
- **File Storage**: Provider, Exam, Topic, Question (S3 JSON files)
- **Cache Storage**: Analytics (Redis, temporary)
- **Embedded Storage**: Answer (within StudySession JSON)

---

## Phase 2.2: API Endpoint Inventory

### Task 1: Extract ALL endpoints from API documentation

**Source**: Cross-referenced from `/backend/docs/README.md`, `/backend/docs/API_REFERENCE.md`, and `/docs/HANDOFF.md` from Phase 1 review

**Complete API Endpoint Catalog** (29 endpoints total):

#### **Authentication Endpoints** (No Auth Required)
1. `POST /api/v1/auth/register` - User registration with email validation
2. `POST /api/v1/auth/login` - User authentication with JWT generation
3. `POST /api/v1/auth/refresh` - JWT token refresh mechanism
4. `POST /api/v1/auth/logout` - User logout with token blacklisting

#### **Provider Endpoints** (Auth Required)
5. `GET /api/v1/providers` - List all certification providers
6. `GET /api/v1/providers/{providerId}` - Get specific provider details

#### **Exam Endpoints** (Auth Required)
7. `GET /api/v1/exams` - List all exams with filtering by provider/difficulty
8. `GET /api/v1/exams/{examId}` - Get specific exam details

#### **Topic Endpoints** (Auth Required)
9. `GET /api/v1/topics` - List all topics with filtering by provider/exam
10. `GET /api/v1/topics/{topicId}` - Get specific topic details

#### **Question Endpoints** (Auth Required)
11. `GET /api/v1/questions` - Get questions with filtering by provider/exam/topics/difficulty
12. `GET /api/v1/questions/{questionId}` - Get specific question details
13. `POST /api/v1/questions/search` - Full-text search across question bank

#### **Study Session Endpoints** (Auth Required)
14. `POST /api/v1/sessions` - Create new study session
15. `GET /api/v1/sessions/{sessionId}` - Get session details and current question
16. `PUT /api/v1/sessions/{sessionId}` - Update session (pause/resume)
17. `DELETE /api/v1/sessions/{sessionId}` - Delete/abandon session
18. `POST /api/v1/sessions/{sessionId}/answers` - Submit answers for current question
19. `POST /api/v1/sessions/{sessionId}/complete` - Complete session and get results
20. `POST /api/v1/sessions/adaptive` - Create enhanced session with difficulty adjustment

#### **Analytics Endpoints** (Auth Required)
21. `GET /api/v1/analytics/progress` - Get user progress analytics
22. `GET /api/v1/analytics/sessions/{sessionId}` - Get detailed session analytics
23. `GET /api/v1/analytics/performance` - Get performance insights and trends

#### **Goals Endpoints** (Auth Required)
24. `GET /api/v1/goals` - Get user's study goals
25. `POST /api/v1/goals` - Create new study goal
26. `PUT /api/v1/goals/{goalId}` - Update existing goal
27. `DELETE /api/v1/goals/{goalId}` - Delete study goal

#### **Health Endpoints** (No Auth Required)
28. `GET /api/v1/health` - Basic health check
29. `GET /api/v1/health/detailed` - Detailed system health check

### Task 2: Include HTTP methods, parameters, request/response formats

#### **Request/Response Format Standards**:
- **Success Response**: `{ success: true, data: <response_data> }`
- **Error Response**: `{ success: false, error: { code, message, details } }`
- **Content-Type**: `application/json`
- **Authentication**: `Authorization: Bearer <jwt_token>`

#### **Common Query Parameters**:
- **Pagination**: `limit`, `offset`
- **Filtering**: `provider`, `exam`, `topics`, `difficulty`
- **Search**: `searchTerm`, `relevanceThreshold`
- **Analytics**: `timeframe`, `includeGoals`

#### **Example Request/Response Formats**:

**GET /api/v1/questions**
```
Query Parameters:
- provider (string, optional): "aws", "azure", "gcp", etc.
- exam (string, optional): "saa-c03", "az-900", etc.
- topics (string, optional): "storage,compute,networking"
- difficulty (string, optional): "beginner", "intermediate", "advanced"
- limit (integer, optional): default 50, max 100
- offset (integer, optional): default 0

Response:
{
  "success": true,
  "data": {
    "questions": [
      {
        "questionId": "q_001",
        "questionText": "Which service...",
        "options": ["Option A", "Option B"],
        "questionType": "single_choice",
        "difficulty": "intermediate"
      }
    ],
    "pagination": {
      "total": 250,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

**POST /api/v1/sessions**
```
Request Body:
{
  "providerIds": ["aws", "azure"],
  "examIds": ["saa-c03", "az-900"],
  "topicIds": ["storage", "compute"],
  "questionCount": 20,
  "sessionType": "cross_provider"
}

Response:
{
  "success": true,
  "data": {
    "sessionId": "session_123",
    "status": "active",
    "questionCount": 20,
    "questions": [...],
    "currentQuestionIndex": 0
  }
}
```

### Task 3: Note authentication requirements for each endpoint

#### **No Authentication Required**:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/health`
- `GET /api/v1/health/detailed`

#### **JWT Bearer Token Required** (24 endpoints):
All other endpoints require `Authorization: Bearer <token>` header

#### **Authentication Method**:
- **TOKEN Authorizer** at API Gateway level (proven working approach)
- **JWT Validation**: Base64URL character set support
- **Token Expiration**: Configurable via `ACCESS_TOKEN_EXPIRES_IN` environment variable

### Task 4: Identify missing endpoints mentioned in features but not documented in API

#### **Endpoints Missing from API Reference Documentation** (13 endpoints):
From `/backend/docs/API_REFERENCE.md` analysis, these endpoints were referenced in README but missing from API docs:

1. `POST /api/v1/auth/refresh` - Token refresh
2. `POST /api/v1/auth/logout` - User logout
3. `GET /api/v1/providers/{providerId}` - Provider details
4. `GET /api/v1/providers/{providerId}/exams` - Provider exams
5. `GET /api/v1/exams` - List exams
6. `GET /api/v1/exams/{examId}` - Exam details
7. `GET /api/v1/exams/{examId}/topics` - Exam topics
8. `GET /api/v1/questions/{questionId}` - Specific question
9. `PUT /api/v1/sessions/{sessionId}` - Update session
10. `DELETE /api/v1/sessions/{sessionId}` - Delete session
11. `POST /api/v1/sessions/{sessionId}/complete` - Complete session
12. `GET /api/v1/analytics/performance` - Performance analytics
13. `GET /api/v1/health/detailed` - Detailed health

#### **Additional Missing Features Referenced**:
- **Goal Milestones**: `POST /api/v1/goals/{goalId}/milestones`
- **Random Questions**: `GET /api/v1/questions/random`
- **Advanced Session Controls**: Additional adaptive session management endpoints

#### **API Coverage Analysis**:
- **Total Documented Endpoints**: 30
- **In API Reference**: 17 endpoints (57%)
- **Missing from API Reference**: 13 endpoints (43%)
- **Conclusion**: API Reference documentation is significantly incomplete

---

## Phase 2.3: Functional Requirements Extraction

### Task 1: List all features described in README and other docs

**Source**: Comprehensive analysis of 12 functional domains identified in Phase 1 review

#### **Core Functional Requirements**:

**1. User Management & Authentication**
- User registration with email validation
- JWT-based authentication with refresh tokens
- User logout with token blacklisting
- User profiles with preferences
- Account status management

**2. Multi-Provider Certification Platform**
- Support for AWS, Azure, GCP, CompTIA, Cisco providers
- Provider metadata management (logos, descriptions, websites)
- Dynamic provider loading from JSON files
- Provider independence (no hierarchical nesting)

**3. Exam Management**
- Exam metadata (name, code, description, duration, passing score)
- Multi-provider exam system
- Exam difficulty classification
- Exam-topic many-to-many relationships
- Exam filtering by provider/difficulty

**4. Topic Organization**
- Independent topics (not nested under exams/providers)
- Cross-exam topics (appear in multiple exams)
- Optional hierarchical topics (parent-child)
- Topic metadata with question counts

**5. Question Management & Storage**
- File-based storage in S3 JSON files (NOT database)
- Multiple question types (single choice, multiple choice, select all)
- Question filtering by provider/exam/topics/difficulty/keywords
- Full-text search with relevance scoring
- Multi-layer caching (in-memory + Redis)

**6. Study Session Management**
- Session types: regular, cross-provider, adaptive (enhanced configuration)
- Cross-provider sessions (mix questions from multiple providers)
- Session configuration (providers, exams, topics, question count)
- Session states (active, completed, abandoned)
- Question randomization and option shuffling
- Real-time progress tracking

**7. Answer Submission & Validation**
- Multi-option answer support
- Answer timing tracking
- Immediate feedback with explanations
- Progress calculation
- Next question logic

**8. Progress Tracking & Analytics**
- User progress per provider/exam/topic
- Session analytics and performance breakdown
- Cross-provider analytics and skills transferability
- Performance trends over time
- Mastery level progression

**9. Goals & Milestones**
- Multiple goal types (exam targets, study streaks, accuracy)
- Goal configuration with dates and target values
- Progress monitoring and completion tracking
- Goal management (create, update, delete, pause)

**10. Session Configuration & Analytics**
- Enhanced session configuration with difficulty adjustment
- Generic study tips and suggestions  
- Performance analysis and topic scoring
- Cross-provider progress comparison
- Progress tracking and goal comparison

**11. Search & Discovery**
- Full-text question search
- Advanced multi-criteria filtering
- Pagination for large result sets
- Search result caching

**12. Data Management**
- S3 data structure organized by provider/exam
- JSON schema validation
- Metadata file management
- Secure file operations with path validation

### Task 2: Extract non-functional requirements (performance, security, etc.)

#### **Performance Requirements**:
- **API Response Times**: <200ms for endpoints, <100ms for question loading, <50ms for session creation
- **Cold Start Performance**: 40% faster with individual Lambda bundling + ARM64
- **Concurrent Users**: 10,000+ with auto-scaling
- **Caching Strategy**: L1 (in-memory 5min) + L2 (Redis 30min-2hr)
- **Bundle Optimization**: 5-58KB individual vs 200KB+ monolithic

#### **Security Requirements**:
- **Authentication**: JWT TOKEN authorizer
- **Authorization**: User-based access control
- **Input Validation**: Comprehensive request validation
- **Path Security**: File path validation preventing directory traversal
- **Token Management**: Secure generation, refresh, blacklisting
- **Rate Limiting**: API abuse prevention
- **CORS Security**: Proper cross-origin configuration

#### **Scalability Requirements**:
- **Auto-Scaling**: Lambda functions scale automatically
- **Database Scaling**: PostgreSQL with connection pooling
- **Caching Scaling**: Redis distributed caching
- **File System Scaling**: S3 unlimited storage
- **Load Distribution**: CloudFront CDN

#### **Reliability Requirements**:
- **Error Handling**: Structured responses, comprehensive logging
- **Fault Tolerance**: Graceful degradation, circuit breaker patterns
- **Data Consistency**: Transaction management
- **Backup Strategy**: Automated user data backups
- **Monitoring**: CloudWatch integration, health checks

#### **Maintainability Requirements**:
- **Clean Architecture**: SOLID principles, separation of concerns
- **Code Organization**: Layered architecture (controllers → services → repositories)
- **TypeScript**: Strong typing for maintainability
- **Testing Strategy**: Unit, integration, E2E, performance testing

### Task 3: Identify configuration requirements and environment variables

#### **Required Environment Variables**:
None identified as actually necessary.

#### **Infrastructure Configuration Requirements**:
- **API Gateway**: TOKEN authorizer with JWT validation
- **Lambda Functions**: Individual bundling with ARM64 architecture
- **DynamoDB GSIs**: email-index, UserIdIndex for efficient queries
- **CloudFront**: Custom origin request policy for JWT header forwarding
- **S3 Buckets**: Data bucket with proper IAM policies
- **Secrets Manager**: JWT secrets and database credentials

### Task 4: Note any feature flags or optional functionality

#### **Feature Flags Identified**:
- **ENABLE_ADAPTIVE_SESSIONS**: Toggle enhanced question selection
- **ENABLE_CROSS_PROVIDER**: Toggle multi-provider session capability
- **ENABLE_RECOMMENDATIONS**: Toggle study tips feature
- **ENABLE_MULTI_PROVIDER**: Toggle multi-provider platform features
- **ENABLE_CROSS_PROVIDER_ANALYTICS**: Toggle cross-provider analytics
- **ENABLE_QUESTION_STATISTICS**: Toggle question usage tracking
- **ENABLE_PROGRESS_TRACKING**: Toggle user progress features

#### **Optional Functionality**:
- **Advanced Analytics**: Detailed performance analytics can be toggled
- **Goals System**: Goal and milestone tracking can be disabled
- **Search Features**: Advanced search capabilities are optional
- **Analytics Features**: Advanced analytics components can be disabled
- **Email Notifications**: User notification system is optional
- **Detailed Health Checks**: System health monitoring can be simplified
