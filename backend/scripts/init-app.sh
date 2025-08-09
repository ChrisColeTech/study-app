#!/bin/bash

# Multi-Exam Certification Study Platform Backend - Application Scaffolding Script
# This script initializes the complete backend project structure for local JSON data processing

set -e

echo "🏗️  Initializing Multi-Exam Study Platform Backend..."
echo "📚 Architecture: Local JSON data processing with multi-provider support"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to create directory with success message
create_dir() {
    if [ ! -d "$1" ]; then
        mkdir -p "$1"
        echo -e "${GREEN}✅ Created:${NC} $1"
    else
        echo -e "${YELLOW}⚠️  Exists:${NC} $1"
    fi
}

# Function to create file with content
create_file() {
    local file_path="$1"
    local content="$2"
    
    if [ ! -f "$file_path" ]; then
        echo "$content" > "$file_path"
        echo -e "${GREEN}✅ Created:${NC} $file_path"
    else
        echo -e "${YELLOW}⚠️  Exists:${NC} $file_path"
    fi
}

echo ""
echo "📁 Creating Backend Directory Structure..."

# Main application directories
create_dir "app/src"
create_dir "app/src/controllers/auth"
create_dir "app/src/controllers/data"
create_dir "app/src/controllers/sessions"
create_dir "app/src/controllers/analytics"
create_dir "app/src/controllers/common"

create_dir "app/src/services/auth"
create_dir "app/src/services/data"
create_dir "app/src/services/sessions"
create_dir "app/src/services/analytics"
create_dir "app/src/services/cache"
create_dir "app/src/services/common"

create_dir "app/src/repositories/auth"
create_dir "app/src/repositories/data"
create_dir "app/src/repositories/sessions"
create_dir "app/src/repositories/analytics"
create_dir "app/src/repositories/common"

create_dir "app/src/models/auth"
create_dir "app/src/models/sessions"
create_dir "app/src/models/analytics"
create_dir "app/src/models/common"

create_dir "app/src/middleware"
create_dir "app/src/routes/api/v1/auth"
create_dir "app/src/routes/api/v1/data"
create_dir "app/src/routes/api/v1/sessions"
create_dir "app/src/routes/api/v1/analytics"
create_dir "app/src/routes/health"

create_dir "app/src/validators/auth"
create_dir "app/src/validators/data"
create_dir "app/src/validators/sessions"
create_dir "app/src/validators/common"

create_dir "app/src/utils/auth"
create_dir "app/src/utils/data"
create_dir "app/src/utils/cache"
create_dir "app/src/utils/http"
create_dir "app/src/utils/math"
create_dir "app/src/utils/common"

create_dir "app/src/lib/database"
create_dir "app/src/lib/redis"
create_dir "app/src/lib/email"
create_dir "app/src/lib/monitoring"

create_dir "app/src/types/auth"
create_dir "app/src/types/data"
create_dir "app/src/types/sessions"
create_dir "app/src/types/analytics"
create_dir "app/src/types/api"
create_dir "app/src/types/common"

create_dir "app/src/config"

create_dir "app/src/swagger/components/schemas"
create_dir "app/src/swagger/components/responses"
create_dir "app/src/swagger/components/parameters"
create_dir "app/src/swagger/paths"

# Data directories for local JSON processing
echo ""
echo "📊 Creating Local JSON Data Structure..."

create_dir "app/data/providers/aws/saa-c03"
create_dir "app/data/providers/aws/dva-c01"
create_dir "app/data/providers/aws/soa-c02"

create_dir "app/data/providers/azure/az-900"
create_dir "app/data/providers/azure/az-104"
create_dir "app/data/providers/azure/az-204"

create_dir "app/data/providers/gcp/ace"
create_dir "app/data/providers/gcp/pca"

create_dir "app/data/providers/comptia/aplus"
create_dir "app/data/providers/comptia/network"
create_dir "app/data/providers/comptia/security"

create_dir "app/data/providers/cisco/ccna"
create_dir "app/data/providers/cisco/ccnp"

create_dir "app/data/schemas"
create_dir "app/data/templates"

# Database and infrastructure
create_dir "app/prisma/migrations"

# Testing directories
create_dir "app/tests/unit/controllers/auth"
create_dir "app/tests/unit/controllers/data"
create_dir "app/tests/unit/controllers/sessions"
create_dir "app/tests/unit/controllers/analytics"

create_dir "app/tests/unit/services/auth"
create_dir "app/tests/unit/services/data"
create_dir "app/tests/unit/services/sessions"
create_dir "app/tests/unit/services/analytics"
create_dir "app/tests/unit/services/cache"

create_dir "app/tests/unit/repositories/auth"
create_dir "app/tests/unit/repositories/data"
create_dir "app/tests/unit/repositories/sessions"
create_dir "app/tests/unit/repositories/analytics"

create_dir "app/tests/unit/utils/auth"
create_dir "app/tests/unit/utils/data"
create_dir "app/tests/unit/utils/cache"
create_dir "app/tests/unit/utils/common"

create_dir "app/tests/unit/validators/auth"
create_dir "app/tests/unit/validators/data"
create_dir "app/tests/unit/validators/sessions"

create_dir "app/tests/integration/auth"
create_dir "app/tests/integration/data"
create_dir "app/tests/integration/sessions"
create_dir "app/tests/integration/analytics"

create_dir "app/tests/e2e"
create_dir "app/tests/performance"

create_dir "app/tests/mocks/data"
create_dir "app/tests/mocks/services"
create_dir "app/tests/mocks/fixtures"

create_dir "app/tests/helpers"

# Scripts directories
create_dir "app/scripts/development"
create_dir "app/scripts/deployment"
create_dir "app/scripts/data"

# Logs and uploads (gitignored)
create_dir "app/logs"
create_dir "app/uploads/avatars"
create_dir "app/uploads/temp"

echo ""
echo "📄 Creating Core Configuration Files..."

# Package.json
create_file "app/package.json" '{
  "name": "multi-exam-study-backend",
  "version": "1.0.0",
  "description": "Backend API for multi-exam certification study platform with local JSON data processing",
  "main": "dist/server.js",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "jest --config jest.e2e.config.js",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "cache:clear": "node -e \"require('\''redis'\'').createClient().flushall()\"",
    "data:validate": "tsx scripts/data/validate-data.ts",
    "data:import": "tsx scripts/data/import-provider.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.7.1",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "morgan": "^1.10.0",
    "compression": "^1.7.4",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "joi": "^17.11.0",
    "redis": "^4.6.11",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "@types/cors": "^2.8.17",
    "@types/morgan": "^1.9.9",
    "@types/compression": "^1.7.5",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/bcryptjs": "^2.4.6",
    "@types/uuid": "^9.0.7",
    "@types/jest": "^29.5.8",
    "@types/supertest": "^2.0.16",
    "typescript": "^5.3.3",
    "tsx": "^4.6.2",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "supertest": "^6.3.3",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.13.2",
    "@typescript-eslint/parser": "^6.13.2",
    "prettier": "^3.1.1",
    "husky": "^8.0.3",
    "lint-staged": "^15.2.0",
    "prisma": "^5.7.1"
  },
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=9.0.0"
  }
}'

# TypeScript configuration
create_file "app/tsconfig.json" '{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"],
      "@/controllers/*": ["./controllers/*"],
      "@/services/*": ["./services/*"],
      "@/repositories/*": ["./repositories/*"],
      "@/models/*": ["./models/*"],
      "@/middleware/*": ["./middleware/*"],
      "@/routes/*": ["./routes/*"],
      "@/utils/*": ["./utils/*"],
      "@/types/*": ["./types/*"],
      "@/config/*": ["./config/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}'

# Environment variables template
create_file "app/.env.example" '# Multi-Exam Study Platform Backend Environment Configuration

# Application
NODE_ENV=development
PORT=3001
APP_NAME=Multi-Exam Study Platform Backend
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/study_platform
REDIS_URL=redis://localhost:6379

# Authentication & Security
JWT_SECRET=your_super_secure_jwt_secret_key_here
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_key_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Local Data Configuration
DATA_PATH=./data/providers
DEFAULT_PROVIDER=aws
MAX_CROSS_PROVIDER_QUESTIONS=100
ENABLE_DATA_CACHING=true
DATA_CACHE_TTL=3600

# Email Configuration (optional)
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key

# Feature Flags
ENABLE_MULTI_PROVIDER=true
ENABLE_CROSS_PROVIDER_ANALYTICS=true
ENABLE_QUESTION_STATISTICS=true
ENABLE_PROGRESS_TRACKING=true

# Performance & Security
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
ENABLE_CORS=true
CORS_ORIGIN=http://localhost:3000

# Monitoring & Logging
ENABLE_REQUEST_LOGGING=true
LOG_FORMAT=combined
ENABLE_PERFORMANCE_MONITORING=true'

# Prisma schema
create_file "app/prisma/schema.prisma" 'generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  firstName String?
  lastName  String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sessions     StudySession[]
  progress     UserProgress[]
  achievements Achievement[]

  @@map("users")
}

model StudySession {
  id          String                @id @default(uuid())
  userId      String
  provider    String
  examCode    String?
  sessionType StudySessionType
  name        String?
  config      Json
  progress    Json                  @default("{}")
  status      StudySessionStatus    @default(ACTIVE)
  startedAt   DateTime              @default(now())
  completedAt DateTime?
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt

  user    User           @relation(fields: [userId], references: [id])
  answers SessionAnswer[]

  @@index([userId, provider])
  @@index([status, startedAt])
  @@map("study_sessions")
}

model SessionAnswer {
  id              String   @id @default(uuid())
  sessionId       String
  questionId      String
  selectedAnswers String[]
  isCorrect       Boolean
  timeSpent       Int      @default(0) // seconds
  confidence      Int?     // 1-5 scale
  flagged         Boolean  @default(false)
  answeredAt      DateTime @default(now())

  session StudySession @relation(fields: [sessionId], references: [id])

  @@index([sessionId])
  @@index([questionId])
  @@map("session_answers")
}

model UserProgress {
  id                String   @id @default(uuid())
  userId            String
  provider          String
  examCode          String?
  topic             String
  questionsAnswered Int      @default(0)
  correctAnswers    Int      @default(0)
  lastStudiedAt     DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, provider, examCode, topic])
  @@index([userId, provider])
  @@map("user_progress")
}

model QuestionStatistic {
  id                    String   @id @default(uuid())
  provider              String
  examCode              String?
  questionHash          String   // Hash of question content for privacy
  timesAnswered         Int      @default(0)
  timesCorrect          Int      @default(0)
  averageTimeSeconds    Float?
  difficultyRating      Float?
  lastAnsweredAt        DateTime @default(now())
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([provider, examCode, questionHash])
  @@index([provider, examCode])
  @@map("question_statistics")
}

model Achievement {
  id          String   @id @default(uuid())
  userId      String
  type        String   // streak, accuracy, completion, etc.
  title       String
  description String
  points      Int      @default(0)
  earnedAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId, type])
  @@map("achievements")
}

enum StudySessionType {
  PRACTICE
  TIMED
  TOPIC_FOCUS
  REVIEW
  MIXED_PROVIDER

  @@map("study_session_type")
}

enum StudySessionStatus {
  ACTIVE
  COMPLETED
  PAUSED
  ABANDONED

  @@map("study_session_status")
}'

# Docker configuration
create_file "app/Dockerfile" 'FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci --production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S backend -u 1001

# Change ownership of app directory
RUN chown -R backend:nodejs /app
USER backend

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["npm", "start"]'

# Docker Compose
create_file "app/docker-compose.yml" 'version: '\''3.8'\''

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/study_platform
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./data:/app/data:ro
      - ./logs:/app/logs

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=study_platform
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:'

# Git ignore
create_file "app/.gitignore" '# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Production build
dist/
build/

# Environment variables
.env
.env.local
.env.*.local

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output/

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Output of '\''npm pack'\''
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache
.cache
.parcel-cache

# next.js build output
.next/

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless/

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# Local data files (add your question data to .env template)
data/providers/*/
!data/providers/*/metadata.json.example
!data/schemas/
!data/templates/

# Uploads
uploads/

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# Database
*.db
*.sqlite

# Testing
test-results/
junit.xml'

# Sample JSON schema files
create_file "app/data/schemas/question.schema.json" '{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "exam": {
      "type": "string",
      "description": "Exam code (e.g., AWS-SAA-C03)"
    },
    "provider": {
      "type": "string",
      "description": "Provider ID (aws, azure, gcp, etc.)"
    },
    "version": {
      "type": "string",
      "description": "Question set version"
    },
    "questions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "questionNumber": {
            "type": "integer"
          },
          "topic": {
            "type": "string"
          },
          "category": {
            "type": "string"
          },
          "difficulty": {
            "type": "string",
            "enum": ["easy", "intermediate", "hard"]
          },
          "questionType": {
            "type": "string",
            "enum": ["single_choice", "multiple_choice", "scenario", "drag_drop"]
          },
          "questionText": {
            "type": "string"
          },
          "options": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string"
                },
                "text": {
                  "type": "string"
                },
                "isCorrect": {
                  "type": "boolean"
                }
              },
              "required": ["id", "text", "isCorrect"]
            }
          },
          "explanation": {
            "type": "string"
          },
          "references": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "title": {
                  "type": "string"
                },
                "url": {
                  "type": "string"
                }
              }
            }
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": ["id", "questionNumber", "topic", "difficulty", "questionType", "questionText", "options", "explanation"]
      }
    }
  },
  "required": ["exam", "provider", "version", "questions"]
}'

# Sample metadata template
create_file "app/data/templates/exam-template.json" '{
  "id": "saa-c03",
  "provider": "aws",
  "name": "AWS Certified Solutions Architect - Associate",
  "description": "Design and deploy scalable systems on AWS",
  "level": "Associate",
  "duration": 130,
  "passingScore": 72,
  "questionCount": 681,
  "topics": [
    {
      "name": "Design Secure Architectures",
      "weight": 30,
      "questionCount": 204,
      "subtopics": [
        "Access control and management",
        "Application security",
        "Infrastructure protection"
      ]
    },
    {
      "name": "Design Resilient Architectures",
      "weight": 26,
      "questionCount": 177,
      "subtopics": [
        "Multi-tier architecture solutions",
        "Highly available and fault-tolerant architectures"
      ]
    }
  ],
  "prerequisites": [
    "One year of hands-on experience with AWS",
    "Experience with AWS services",
    "Knowledge of AWS architectural principles"
  ],
  "officialLink": "https://aws.amazon.com/certification/certified-solutions-architect-associate/",
  "lastUpdated": "2024-01-01"
}'

echo ""
echo -e "${GREEN}🎉 Backend project structure created successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo -e "  1. ${YELLOW}cd app${NC} - Navigate to the backend directory"
echo -e "  2. ${YELLOW}cp .env.example .env${NC} - Copy environment variables"
echo -e "  3. ${YELLOW}npm install${NC} - Install dependencies"
echo -e "  4. ${YELLOW}npm run db:generate${NC} - Generate Prisma client"
echo -e "  5. ${YELLOW}npm run db:migrate${NC} - Run database migrations"
echo -e "  6. ${YELLOW}npm run dev${NC} - Start development server"
echo ""
echo -e "${BLUE}📊 Local JSON Data:${NC}"
echo -e "  • Add your question JSON files to: ${YELLOW}data/providers/{provider}/{exam}/questions.json${NC}"
echo -e "  • Add exam metadata to: ${YELLOW}data/providers/{provider}/{exam}/metadata.json${NC}"
echo -e "  • Use templates in: ${YELLOW}data/templates/${NC}"
echo ""
echo -e "${GREEN}✨ Multi-Exam Study Platform Backend is ready for development!${NC}"