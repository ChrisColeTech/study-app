# Project Structure - Multi-Exam Certification Study Platform Backend

## 📁 Complete Directory Structure

```
backend/
├── app/                            # Main application directory
│   ├── src/                        # Source code directory
│   │   ├── controllers/            # HTTP request controllers
│   │   │   ├── auth/               # Authentication controllers
│   │   │   │   ├── AuthController.ts      # User authentication
│   │   │   │   ├── UserController.ts      # User management
│   │   │   │   ├── ProfileController.ts   # User profiles
│   │   │   │   └── index.ts               # Auth controller exports
│   │   │   ├── data/               # Data management controllers
│   │   │   │   ├── ProvidersController.ts # Provider listing and details
│   │   │   │   ├── ExamsController.ts     # Exam information endpoints
│   │   │   │   ├── QuestionsController.ts # Question retrieval and search
│   │   │   │   └── index.ts               # Data controller exports
│   │   │   ├── sessions/           # Study session controllers
│   │   │   │   ├── SessionController.ts   # Session CRUD operations
│   │   │   │   ├── AnswerController.ts    # Answer processing
│   │   │   │   ├── ProgressController.ts  # Session progress tracking
│   │   │   │   └── index.ts               # Session controller exports
│   │   │   ├── analytics/          # Analytics and reporting controllers
│   │   │   │   ├── ProgressController.ts  # User progress analytics
│   │   │   │   ├── PerformanceController.ts # Performance metrics
│   │   │   │   ├── ReportsController.ts   # Report generation
│   │   │   │   └── index.ts               # Analytics controller exports
│   │   │   └── common/             # Shared controllers
│   │   │       ├── HealthController.ts    # System health checks
│   │   │       ├── SearchController.ts    # Cross-provider search
│   │   │       └── FileController.ts      # File operation endpoints
│   │   ├── services/               # Business logic services
│   │   │   ├── auth/               # Authentication services
│   │   │   │   ├── AuthService.ts         # Authentication logic
│   │   │   │   ├── TokenService.ts        # JWT token management
│   │   │   │   ├── PasswordService.ts     # Password operations
│   │   │   │   └── index.ts               # Auth service exports
│   │   │   ├── data/               # Data processing services
│   │   │   │   ├── FileSystemService.ts   # JSON file operations
│   │   │   │   ├── ProviderService.ts     # Provider data management
│   │   │   │   ├── ExamService.ts         # Exam data processing
│   │   │   │   ├── QuestionService.ts     # Question processing and filtering
│   │   │   │   ├── ValidationService.ts   # Data validation
│   │   │   │   └── index.ts               # Data service exports
│   │   │   ├── sessions/           # Study session services
│   │   │   │   ├── SessionService.ts      # Session management
│   │   │   │   ├── QuestionSelectionService.ts # Question selection algorithms
│   │   │   │   ├── AnswerProcessingService.ts  # Answer validation
│   │   │   │   ├── ProgressTrackingService.ts  # Progress calculation
│   │   │   │   └── index.ts               # Session service exports
│   │   │   ├── analytics/          # Analytics services
│   │   │   │   ├── UserAnalyticsService.ts     # User performance analytics
│   │   │   │   ├── CrossProviderService.ts     # Cross-provider comparison
│   │   │   │   ├── RecommendationService.ts    # Study recommendations
│   │   │   │   ├── ReportingService.ts         # Report generation
│   │   │   │   └── index.ts                    # Analytics service exports
│   │   │   ├── cache/              # Caching services
│   │   │   │   ├── CacheService.ts        # Redis cache management
│   │   │   │   ├── DataCacheService.ts    # Question data caching
│   │   │   │   ├── SessionCacheService.ts # Session state caching
│   │   │   │   └── index.ts               # Cache service exports
│   │   │   └── common/             # Shared services
│   │   │       ├── EmailService.ts        # Email notifications
│   │   │       ├── LoggingService.ts      # Application logging
│   │   │       └── UtilityService.ts      # Common utilities
│   │   ├── repositories/           # Data access layer
│   │   │   ├── auth/               # Authentication repositories
│   │   │   │   ├── UserRepository.ts      # User data access
│   │   │   │   ├── SessionRepository.ts   # User session storage
│   │   │   │   └── index.ts               # Auth repository exports
│   │   │   ├── data/               # File system repositories
│   │   │   │   ├── FileRepository.ts      # JSON file access
│   │   │   │   ├── ProviderRepository.ts  # Provider data queries
│   │   │   │   ├── ExamRepository.ts      # Exam data queries
│   │   │   │   ├── QuestionRepository.ts  # Question data access
│   │   │   │   └── index.ts               # Data repository exports
│   │   │   ├── sessions/           # Session repositories
│   │   │   │   ├── StudySessionRepository.ts # Session persistence
│   │   │   │   ├── ProgressRepository.ts     # Progress data storage
│   │   │   │   └── index.ts                  # Session repository exports
│   │   │   ├── analytics/          # Analytics repositories
│   │   │   │   ├── UserProgressRepository.ts # Progress data access
│   │   │   │   ├── PerformanceRepository.ts  # Performance metrics
│   │   │   │   ├── AnalyticsRepository.ts    # Analytics data
│   │   │   │   └── index.ts                  # Analytics repository exports
│   │   │   └── common/             # Shared repositories
│   │   │       ├── BaseRepository.ts      # Base repository class
│   │   │       ├── CacheRepository.ts     # Cache data access
│   │   │       └── FileMetaRepository.ts  # File metadata access
│   │   ├── models/                 # Database models (Prisma)
│   │   │   ├── auth/               # Authentication models
│   │   │   │   ├── User.ts               # User model extensions
│   │   │   │   ├── UserProfile.ts        # User profile extensions
│   │   │   │   └── index.ts              # Auth model exports
│   │   │   ├── sessions/           # Study session models
│   │   │   │   ├── StudySession.ts       # Session model extensions
│   │   │   │   ├── SessionAnswer.ts      # Answer tracking extensions
│   │   │   │   └── index.ts              # Session model exports
│   │   │   ├── analytics/          # Analytics models
│   │   │   │   ├── UserProgress.ts       # Progress model extensions
│   │   │   │   ├── Performance.ts        # Performance model extensions
│   │   │   │   └── index.ts              # Analytics model exports
│   │   │   └── common/             # Shared models
│   │   │       ├── BaseModel.ts          # Base model class
│   │   │       └── AuditModel.ts         # Audit trail models
│   │   ├── middleware/             # Express middleware
│   │   │   ├── auth.ts                   # Authentication middleware
│   │   │   ├── validation.ts             # Request validation middleware
│   │   │   ├── rateLimit.ts              # Rate limiting middleware
│   │   │   ├── cors.ts                   # CORS configuration
│   │   │   ├── security.ts               # Security headers middleware
│   │   │   ├── logging.ts                # Request logging middleware
│   │   │   ├── error.ts                  # Error handling middleware
│   │   │   └── index.ts                  # Middleware exports
│   │   ├── routes/                 # API route definitions
│   │   │   ├── api/                # API version routes
│   │   │   │   └── v1/             # Version 1 API routes
│   │   │   │       ├── auth/       # Authentication routes
│   │   │   │       │   ├── auth.ts        # Login/logout endpoints
│   │   │   │       │   ├── users.ts       # User management endpoints
│   │   │   │       │   ├── profile.ts     # Profile management endpoints
│   │   │   │       │   └── index.ts       # Auth route exports
│   │   │   │       ├── data/       # Data access routes
│   │   │   │       │   ├── providers.ts   # Provider endpoints
│   │   │   │       │   ├── exams.ts       # Exam information endpoints
│   │   │   │       │   ├── questions.ts   # Question retrieval endpoints
│   │   │   │       │   └── index.ts       # Data route exports
│   │   │   │       ├── sessions/   # Study session routes
│   │   │   │       │   ├── sessions.ts    # Session CRUD endpoints
│   │   │   │       │   ├── answers.ts     # Answer submission endpoints
│   │   │   │       │   ├── progress.ts    # Progress tracking endpoints
│   │   │   │       │   └── index.ts       # Session route exports
│   │   │   │       ├── analytics/  # Analytics routes
│   │   │   │       │   ├── progress.ts    # Progress analytics endpoints
│   │   │   │       │   ├── performance.ts # Performance metrics endpoints
│   │   │   │       │   ├── reports.ts     # Report generation endpoints
│   │   │   │       │   └── index.ts       # Analytics route exports
│   │   │   │       └── index.ts           # V1 API route exports
│   │   │   ├── health/             # Health check routes
│   │   │   │   ├── health.ts             # Basic health endpoints
│   │   │   │   ├── metrics.ts            # System metrics endpoints
│   │   │   │   └── index.ts              # Health route exports
│   │   │   └── index.ts            # Main route exports
│   │   ├── validators/             # Request validation schemas
│   │   │   ├── auth/               # Authentication validators
│   │   │   │   ├── authSchema.ts         # Login/registration validation
│   │   │   │   ├── userSchema.ts         # User data validation
│   │   │   │   ├── profileSchema.ts      # Profile validation
│   │   │   │   └── index.ts              # Auth validator exports
│   │   │   ├── data/               # Data validation schemas
│   │   │   │   ├── providerSchema.ts     # Provider data validation
│   │   │   │   ├── examSchema.ts         # Exam data validation
│   │   │   │   ├── questionSchema.ts     # Question data validation
│   │   │   │   └── index.ts              # Data validator exports
│   │   │   ├── sessions/           # Session validation schemas
│   │   │   │   ├── sessionSchema.ts      # Session validation
│   │   │   │   ├── answerSchema.ts       # Answer submission validation
│   │   │   │   └── index.ts              # Session validator exports
│   │   │   └── common/             # Shared validators
│   │   │       ├── commonSchema.ts       # Common validation patterns
│   │   │       └── paginationSchema.ts   # Pagination validation
│   │   ├── utils/                  # Utility functions
│   │   │   ├── auth/               # Authentication utilities
│   │   │   │   ├── jwt.ts                # JWT token utilities
│   │   │   │   ├── password.ts           # Password hashing utilities
│   │   │   │   ├── session.ts            # Session management utilities
│   │   │   │   └── index.ts              # Auth utilities exports
│   │   │   ├── data/               # Data processing utilities
│   │   │   │   ├── fileUtils.ts          # File system utilities
│   │   │   │   ├── jsonUtils.ts          # JSON processing utilities
│   │   │   │   ├── validationUtils.ts    # Data validation utilities
│   │   │   │   ├── transformationUtils.ts # Data transformation utilities
│   │   │   │   └── index.ts              # Data utilities exports
│   │   │   ├── cache/              # Caching utilities
│   │   │   │   ├── redis.ts              # Redis utilities
│   │   │   │   ├── keys.ts               # Cache key generation
│   │   │   │   └── index.ts              # Cache utilities exports
│   │   │   ├── http/               # HTTP utilities
│   │   │   │   ├── response.ts           # Response formatting
│   │   │   │   ├── pagination.ts         # Pagination utilities
│   │   │   │   ├── status.ts             # HTTP status codes
│   │   │   │   └── index.ts              # HTTP utilities exports
│   │   │   ├── math/               # Mathematical utilities
│   │   │   │   ├── statistics.ts         # Statistical calculations
│   │   │   │   ├── algorithms.ts         # Algorithm implementations
│   │   │   │   └── index.ts              # Math utilities exports
│   │   │   └── common/             # Common utilities
│   │   │       ├── logger.ts             # Logging utilities
│   │   │       ├── constants.ts          # Application constants
│   │   │       ├── helpers.ts            # Helper functions
│   │   │       └── index.ts              # Common utilities exports
│   │   ├── lib/                    # External library configurations
│   │   │   ├── database/           # Database configuration
│   │   │   │   ├── prisma.ts            # Prisma client setup
│   │   │   │   ├── migrations.ts        # Migration utilities
│   │   │   │   └── index.ts             # Database lib exports
│   │   │   ├── redis/              # Redis configuration
│   │   │   │   ├── client.ts            # Redis client setup
│   │   │   │   ├── config.ts            # Redis configuration
│   │   │   │   └── index.ts             # Redis lib exports
│   │   │   ├── email/              # Email service configuration
│   │   │   │   ├── provider.ts          # Email provider setup
│   │   │   │   ├── templates.ts         # Email templates
│   │   │   │   └── index.ts             # Email lib exports
│   │   │   └── monitoring/         # Monitoring and logging libraries
│   │   │       ├── metrics.ts           # Metrics collection
│   │   │       ├── health.ts            # Health check setup
│   │   │       └── index.ts             # Monitoring lib exports
│   │   ├── types/                  # TypeScript type definitions
│   │   │   ├── auth/               # Authentication types
│   │   │   │   ├── user.ts              # User-related types
│   │   │   │   ├── session.ts           # Session types
│   │   │   │   └── index.ts             # Auth type exports
│   │   │   ├── data/               # Data structure types
│   │   │   │   ├── provider.ts          # Provider data types
│   │   │   │   ├── exam.ts              # Exam data types
│   │   │   │   ├── question.ts          # Question data types
│   │   │   │   └── index.ts             # Data type exports
│   │   │   ├── sessions/           # Session types
│   │   │   │   ├── studySession.ts      # Study session types
│   │   │   │   ├── answer.ts            # Answer types
│   │   │   │   ├── progress.ts          # Progress types
│   │   │   │   └── index.ts             # Session type exports
│   │   │   ├── analytics/          # Analytics types
│   │   │   │   ├── userProgress.ts      # Progress analytics types
│   │   │   │   ├── performance.ts       # Performance types
│   │   │   │   ├── reports.ts           # Report types
│   │   │   │   └── index.ts             # Analytics type exports
│   │   │   ├── api/                # API request/response types
│   │   │   │   ├── requests.ts          # Request types
│   │   │   │   ├── responses.ts         # Response types
│   │   │   │   ├── errors.ts            # Error types
│   │   │   │   └── index.ts             # API type exports
│   │   │   └── common/             # Common types
│   │   │       ├── pagination.ts        # Pagination types
│   │   │       ├── filters.ts           # Filter types
│   │   │       ├── config.ts            # Configuration types
│   │   │       └── index.ts             # Common type exports
│   │   ├── config/                 # Application configuration
│   │   │   ├── database.ts              # Database configuration
│   │   │   ├── redis.ts                 # Redis configuration
│   │   │   ├── auth.ts                  # Authentication configuration
│   │   │   ├── cache.ts                 # Cache configuration
│   │   │   ├── email.ts                 # Email service configuration
│   │   │   ├── logging.ts               # Logging configuration
│   │   │   ├── security.ts              # Security configuration
│   │   │   ├── environment.ts           # Environment-specific config
│   │   │   └── index.ts                 # Main configuration exports
│   │   ├── swagger/                # API documentation
│   │   │   ├── components/         # Swagger components
│   │   │   │   ├── schemas/        # Data schemas
│   │   │   │   │   ├── auth.yaml        # Authentication schemas
│   │   │   │   │   ├── data.yaml        # Data schemas
│   │   │   │   │   ├── sessions.yaml    # Session schemas
│   │   │   │   │   └── analytics.yaml   # Analytics schemas
│   │   │   │   ├── responses/      # Response schemas
│   │   │   │   │   ├── success.yaml     # Success response schemas
│   │   │   │   │   └── errors.yaml      # Error response schemas
│   │   │   │   └── parameters/     # Parameter schemas
│   │   │   │       ├── common.yaml      # Common parameters
│   │   │   │       └── filters.yaml     # Filter parameters
│   │   │   ├── paths/              # API endpoint documentation
│   │   │   │   ├── auth.yaml            # Authentication endpoints
│   │   │   │   ├── providers.yaml       # Provider endpoints
│   │   │   │   ├── questions.yaml       # Question endpoints
│   │   │   │   ├── sessions.yaml        # Session endpoints
│   │   │   │   └── analytics.yaml       # Analytics endpoints
│   │   │   ├── openapi.yaml        # Main OpenAPI specification
│   │   │   └── index.ts            # Swagger setup and configuration
│   │   ├── app.ts                  # Express application setup
│   │   └── server.ts               # Application entry point
│   ├── data/                       # Local JSON study data (gitignored)
│   │   ├── providers/              # Study data organized by provider
│   │   │   ├── aws/                # AWS certification data
│   │   │   │   ├── saa-c03/        # Solutions Architect Associate
│   │   │   │   │   ├── questions.json    # Question bank
│   │   │   │   │   ├── metadata.json     # Exam metadata
│   │   │   │   │   └── topics.json       # Topic breakdown
│   │   │   │   ├── dva-c01/        # Developer Associate
│   │   │   │   │   ├── questions.json
│   │   │   │   │   ├── metadata.json
│   │   │   │   │   └── topics.json
│   │   │   │   └── soa-c02/        # SysOps Administrator
│   │   │   │       ├── questions.json
│   │   │   │       ├── metadata.json
│   │   │   │       └── topics.json
│   │   │   ├── azure/              # Microsoft Azure certification data
│   │   │   │   ├── az-900/         # Azure Fundamentals
│   │   │   │   │   ├── questions.json
│   │   │   │   │   ├── metadata.json
│   │   │   │   │   └── topics.json
│   │   │   │   ├── az-104/         # Azure Administrator
│   │   │   │   │   ├── questions.json
│   │   │   │   │   ├── metadata.json
│   │   │   │   │   └── topics.json
│   │   │   │   └── az-204/         # Azure Developer
│   │   │   │       ├── questions.json
│   │   │   │       ├── metadata.json
│   │   │   │       └── topics.json
│   │   │   ├── gcp/                # Google Cloud Platform data
│   │   │   │   ├── ace/            # Associate Cloud Engineer
│   │   │   │   │   ├── questions.json
│   │   │   │   │   ├── metadata.json
│   │   │   │   │   └── topics.json
│   │   │   │   └── pca/            # Professional Cloud Architect
│   │   │   │       ├── questions.json
│   │   │   │       ├── metadata.json
│   │   │   │       └── topics.json
│   │   │   ├── comptia/            # CompTIA certification data
│   │   │   │   ├── aplus/          # A+ certification
│   │   │   │   │   ├── questions.json
│   │   │   │   │   ├── metadata.json
│   │   │   │   │   └── topics.json
│   │   │   │   ├── network/        # Network+ certification
│   │   │   │   │   ├── questions.json
│   │   │   │   │   ├── metadata.json
│   │   │   │   │   └── topics.json
│   │   │   │   └── security/       # Security+ certification
│   │   │   │       ├── questions.json
│   │   │   │       ├── metadata.json
│   │   │   │       └── topics.json
│   │   │   └── cisco/              # Cisco certification data
│   │   │       ├── ccna/           # CCNA certification
│   │   │       │   ├── questions.json
│   │   │       │   ├── metadata.json
│   │   │       │   └── topics.json
│   │   │       └── ccnp/           # CCNP certification
│   │   │           ├── questions.json
│   │   │           ├── metadata.json
│   │   │           └── topics.json
│   │   ├── schemas/                # JSON schema definitions
│   │   │   ├── question.schema.json      # Question format schema
│   │   │   ├── exam.schema.json          # Exam metadata schema
│   │   │   ├── provider.schema.json      # Provider information schema
│   │   │   └── topics.schema.json        # Topic structure schema
│   │   └── templates/              # Data templates for new providers
│   │       ├── question-template.json    # Question format template
│   │       ├── exam-template.json        # Exam metadata template
│   │       └── provider-template.json    # Provider info template
│   ├── prisma/                     # Prisma ORM configuration
│   │   ├── migrations/             # Database migration files
│   │   │   └── [timestamp]_migration_name/ # Individual migrations
│   │   ├── schema.prisma           # Database schema definition
│   │   └── seed.ts                 # Database seeding script
│   ├── tests/                      # Test files
│   │   ├── unit/                   # Unit tests
│   │   │   ├── controllers/        # Controller unit tests
│   │   │   │   ├── auth/           # Auth controller tests
│   │   │   │   ├── data/           # Data controller tests
│   │   │   │   ├── sessions/       # Session controller tests
│   │   │   │   └── analytics/      # Analytics controller tests
│   │   │   ├── services/           # Service unit tests
│   │   │   │   ├── auth/           # Auth service tests
│   │   │   │   ├── data/           # Data service tests
│   │   │   │   ├── sessions/       # Session service tests
│   │   │   │   ├── analytics/      # Analytics service tests
│   │   │   │   └── cache/          # Cache service tests
│   │   │   ├── repositories/       # Repository unit tests
│   │   │   │   ├── auth/           # Auth repository tests
│   │   │   │   ├── data/           # Data repository tests
│   │   │   │   ├── sessions/       # Session repository tests
│   │   │   │   └── analytics/      # Analytics repository tests
│   │   │   ├── utils/              # Utility function tests
│   │   │   │   ├── auth/           # Auth utility tests
│   │   │   │   ├── data/           # Data utility tests
│   │   │   │   ├── cache/          # Cache utility tests
│   │   │   │   └── common/         # Common utility tests
│   │   │   └── validators/         # Validation tests
│   │   │       ├── auth/           # Auth validation tests
│   │   │       ├── data/           # Data validation tests
│   │   │       └── sessions/       # Session validation tests
│   │   ├── integration/            # Integration tests
│   │   │   ├── auth/               # Authentication integration tests
│   │   │   ├── data/               # Data processing integration tests
│   │   │   ├── sessions/           # Session management integration tests
│   │   │   └── analytics/          # Analytics integration tests
│   │   ├── e2e/                    # End-to-end tests
│   │   │   ├── auth.test.ts              # Authentication E2E tests
│   │   │   ├── study-session.test.ts     # Study session E2E tests
│   │   │   ├── multi-provider.test.ts    # Multi-provider E2E tests
│   │   │   └── analytics.test.ts         # Analytics E2E tests
│   │   ├── performance/            # Performance tests
│   │   │   ├── data-loading.test.ts      # Data loading performance tests
│   │   │   ├── concurrent-sessions.test.ts # Concurrent session tests
│   │   │   └── large-datasets.test.ts    # Large dataset performance tests
│   │   ├── mocks/                  # Mock data and utilities
│   │   │   ├── data/               # Mock data files
│   │   │   │   ├── providers.json        # Mock provider data
│   │   │   │   ├── exams.json            # Mock exam data
│   │   │   │   ├── questions.json        # Mock question data
│   │   │   │   └── users.json            # Mock user data
│   │   │   ├── services/           # Service mocks
│   │   │   │   ├── mockAuthService.ts    # Auth service mock
│   │   │   │   ├── mockDataService.ts    # Data service mock
│   │   │   │   └── mockCacheService.ts   # Cache service mock
│   │   │   └── fixtures/           # Test fixtures
│   │   │       ├── questions.json        # Question test data
│   │   │       ├── sessions.json         # Session test data
│   │   │       └── users.json            # User test data
│   │   ├── helpers/                # Test helper functions
│   │   │   ├── auth.ts                   # Auth test helpers
│   │   │   ├── data.ts                   # Data test helpers
│   │   │   ├── sessions.ts               # Session test helpers
│   │   │   ├── database.ts               # Database test helpers
│   │   │   └── setup.ts                  # Test setup utilities
│   │   └── setup.ts                # Global test setup configuration
│   ├── scripts/                    # Utility and deployment scripts
│   │   ├── development/            # Development scripts
│   │   │   ├── setup-dev-env.sh          # Development environment setup
│   │   │   ├── load-sample-data.sh       # Load sample question data
│   │   │   ├── reset-database.sh         # Reset development database
│   │   │   └── generate-test-data.ts     # Generate test question data
│   │   ├── deployment/             # Deployment scripts
│   │   │   ├── build.sh                  # Production build script
│   │   │   ├── deploy.sh                 # Deployment script
│   │   │   ├── migrate.sh                # Database migration script
│   │   │   └── health-check.sh           # Post-deployment health check
│   │   ├── data/                   # Data management scripts
│   │   │   ├── validate-data.ts          # Validate question data integrity
│   │   │   ├── migrate-data.ts           # Migrate data between formats
│   │   │   ├── backup-data.sh            # Backup question data
│   │   │   └── import-provider.ts        # Import new provider data
│   │   └── init-app.sh             # Application scaffolding script
│   ├── logs/                       # Application logs (gitignored)
│   │   ├── app.log                       # Application logs
│   │   ├── error.log                     # Error logs
│   │   ├── access.log                    # HTTP access logs
│   │   └── performance.log               # Performance metrics logs
│   ├── uploads/                    # File uploads (gitignored)
│   │   ├── avatars/                      # User avatar uploads
│   │   └── temp/                         # Temporary file uploads
│   ├── .env                        # Environment variables (gitignored)
│   ├── .env.example                # Environment variables template
│   ├── package.json                # Dependencies and scripts
│   ├── package-lock.json           # Dependency lock file
│   ├── tsconfig.json               # TypeScript configuration
│   ├── jest.config.js              # Jest testing configuration
│   ├── eslint.config.js            # ESLint configuration
│   ├── .prettierrc                 # Prettier configuration
│   ├── .gitignore                  # Git ignore patterns
│   ├── Dockerfile                  # Docker container definition
│   ├── docker-compose.yml          # Docker Compose configuration
│   └── README.md                   # Project setup and documentation
└── docs/                           # Documentation
    ├── README.md                   # Backend overview and setup
    ├── IMPLEMENTATION_PLAN.md      # Development implementation plan
    ├── PROJECT_STRUCTURE.md        # This file - project organization
    ├── ARCHITECTURE.md             # System architecture documentation
    ├── API_REFERENCE.md            # Complete API documentation
    └── CODE_EXAMPLES.md            # Code examples and patterns
```

## 📋 Directory Purpose and Organization

### **Source Code Organization (/src)**

#### **Controllers Layer**
- **Purpose**: Handle HTTP requests, validate input, call business logic, format responses
- **Pattern**: One controller per entity/feature area with focused responsibilities
- **Dependencies**: Services, validators, middleware

#### **Services Layer**
- **Purpose**: Business logic, data processing, complex operations
- **Pattern**: Domain-driven service organization with clear boundaries
- **Dependencies**: Repositories, external libraries, other services

#### **Repositories Layer**
- **Purpose**: Data access abstraction, file system operations, database queries
- **Pattern**: Repository pattern with consistent interfaces
- **Dependencies**: Database connections, file system, cache

#### **Models Layer**
- **Purpose**: Database model extensions and business entity definitions
- **Pattern**: Domain models with Prisma integration
- **Dependencies**: Prisma client, validation libraries

### **Data Organization (/data)**

#### **Provider Structure**
```
/data/providers/{provider}/{exam}/
├── questions.json      # Main question bank
├── metadata.json       # Exam information and configuration  
└── topics.json         # Topic breakdown and organization
```

#### **Schema Validation**
```
/data/schemas/
├── question.schema.json    # Validates question structure
├── exam.schema.json        # Validates exam metadata
└── provider.schema.json    # Validates provider information
```

### **Configuration Management (/config)**

#### **Environment-Specific Configuration**
- **Development**: Local file paths, debug logging, relaxed validation
- **Production**: Optimized caching, strict security, performance monitoring  
- **Testing**: Mock data paths, isolated environments, enhanced logging

#### **Feature Configuration**
- **Authentication**: JWT settings, password policies, session management
- **Caching**: Redis configuration, TTL settings, cache strategies
- **Security**: Rate limiting, CORS policies, input validation rules

### **Testing Strategy (/tests)**

#### **Test Organization**
- **Unit Tests**: Individual component testing with mocks
- **Integration Tests**: Service integration and data flow testing
- **E2E Tests**: Complete user workflow testing
- **Performance Tests**: Load testing and performance benchmarking

#### **Mock Data Structure**
- **Realistic Data**: Representative question sets and user scenarios
- **Edge Cases**: Boundary conditions and error scenarios
- **Performance Data**: Large datasets for performance testing

## 🔧 File Naming Conventions

### **TypeScript Files**
- **Services**: `{Domain}Service.ts` (e.g., `QuestionService.ts`)
- **Controllers**: `{Domain}Controller.ts` (e.g., `SessionController.ts`)
- **Repositories**: `{Domain}Repository.ts` (e.g., `UserRepository.ts`)
- **Utilities**: `{purpose}Utils.ts` (e.g., `validationUtils.ts`)
- **Types**: `{domain}.ts` (e.g., `question.ts` for question types)

### **Configuration Files**
- **Environment**: `{environment}.ts` (e.g., `development.ts`)
- **Feature Config**: `{feature}.ts` (e.g., `database.ts`)
- **Schema Files**: `{entity}.schema.json` (e.g., `question.schema.json`)

### **Test Files**
- **Unit Tests**: `{ComponentName}.test.ts`
- **Integration Tests**: `{FeatureName}.integration.test.ts`
- **E2E Tests**: `{WorkflowName}.e2e.test.ts`

## 📊 Data Flow Architecture

### **Request Processing Flow**
```
HTTP Request → Routes → Middleware → Controllers → Services → Repositories → Data/Database
                 ↓         ↓           ↓          ↓          ↓
            Validation → Auth → Business → Cache → File System
                                Logic              ↓
                                  ↓         JSON Processing
                            Response ← Format ← Transform
```

### **Data Processing Pipeline**
```
JSON Files → Validation → Parsing → Caching → Business Logic → API Response
     ↓           ↓          ↓         ↓            ↓             ↓
File System → Schema → Transform → Redis → Processing → HTTP JSON
```

### **Study Session Flow**
```
Session Request → Question Selection → Data Loading → Processing → Response
       ↓               ↓                  ↓            ↓           ↓
   Validation → Algorithm Logic → File System → Transform → JSON API
```

## 🚀 Deployment Structure

### **Production Deployment**
```
/app/
├── dist/               # Compiled JavaScript
├── data/               # Question data files
├── node_modules/       # Dependencies
├── prisma/             # Database configuration
└── package.json        # Runtime configuration
```

### **Container Structure**
```
Container:
├── /app/               # Application code
├── /data/              # Mounted data volume
├── /logs/              # Log output
└── /tmp/               # Temporary files
```

This project structure provides a comprehensive, scalable foundation for building a multi-exam certification study platform backend that efficiently processes local JSON data while maintaining clean architecture principles and supporting future growth and maintenance.