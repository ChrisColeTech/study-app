# API Reference - Multi-Exam Certification Study Platform

## 🌐 API Overview

This API provides comprehensive endpoints for managing multi-exam certification study sessions, user progress tracking, and cross-provider analytics using serverless AWS Lambda functions with DynamoDB and S3 JSON data sources.

**Base URL**: `https://{api-gateway-url}/dev/api/v1`  
**Content Type**: `application/json`  
**Authentication**: JWT Bearer tokens for protected endpoints

---

## 📋 Authentication Endpoints (No Auth Required)

### **POST /api/v1/auth/register**
User registration with email validation.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "uuid-123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "isActive": true
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

### **POST /api/v1/auth/login**
User authentication with JWT generation.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "uuid-123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

### **POST /api/v1/auth/refresh**
JWT token refresh mechanism.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

### **POST /api/v1/auth/logout**
User logout with token blacklisting.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out"
  }
}
```

---

## 🏢 Provider Endpoints (Auth Required)

### **GET /api/v1/providers**
List all certification providers.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "providerId": "aws",
        "providerName": "Amazon Web Services",
        "description": "Cloud computing platform and services",
        "logoUrl": "https://example.com/aws-logo.png",
        "websiteUrl": "https://aws.amazon.com",
        "examCount": 3,
        "isActive": true
      },
      {
        "providerId": "azure",
        "providerName": "Microsoft Azure",
        "description": "Cloud computing platform and services",
        "logoUrl": "https://example.com/azure-logo.png",
        "websiteUrl": "https://azure.microsoft.com",
        "examCount": 3,
        "isActive": true
      },
      {
        "providerId": "gcp",
        "providerName": "Google Cloud Platform",
        "description": "Cloud computing platform and services",
        "logoUrl": "https://example.com/gcp-logo.png",
        "websiteUrl": "https://cloud.google.com",
        "examCount": 2,
        "isActive": true
      }
    ],
    "totalProviders": 3
  }
}
```

### **GET /api/v1/providers/{providerId}**
Get specific provider details.

**Headers:** `Authorization: Bearer <token>`
**Path Parameters:** `providerId` (string) - Provider identifier

**Response (200):**
```json
{
  "success": true,
  "data": {
    "provider": {
      "providerId": "aws",
      "providerName": "Amazon Web Services",
      "description": "Cloud computing platform and services",
      "logoUrl": "https://example.com/aws-logo.png",
      "websiteUrl": "https://aws.amazon.com",
      "examCount": 3,
      "isActive": true,
      "metadata": {
        "founded": "2006",
        "headquarters": "Seattle, WA"
      }
    }
  }
}
```

---

## 📚 Exam Endpoints (Auth Required)

### **GET /api/v1/exams**
List all exams with filtering by provider/difficulty.

**Headers:** `Authorization: Bearer <token>`
**Query Parameters:**
- `provider` (string, optional): Filter by provider ID
- `difficulty` (string, optional): Filter by difficulty level
- `limit` (integer, optional): Results per page (default: 50)
- `offset` (integer, optional): Starting offset (default: 0)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "exams": [
      {
        "examId": "saa-c03",
        "examName": "AWS Solutions Architect Associate",
        "examCode": "SAA-C03",
        "providerId": "aws",
        "description": "Validates ability to design distributed systems on AWS",
        "duration": 130,
        "questionCount": 65,
        "passingScore": 72,
        "difficulty": "intermediate",
        "topicIds": ["compute", "storage", "networking", "security"],
        "isActive": true
      }
    ],
    "pagination": {
      "total": 8,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### **GET /api/v1/exams/{examId}**
Get specific exam details.

**Headers:** `Authorization: Bearer <token>`
**Path Parameters:** `examId` (string) - Exam identifier

**Response (200):**
```json
{
  "success": true,
  "data": {
    "exam": {
      "examId": "saa-c03",
      "examName": "AWS Solutions Architect Associate",
      "examCode": "SAA-C03",
      "providerId": "aws",
      "description": "Validates ability to design distributed systems on AWS",
      "duration": 130,
      "questionCount": 65,
      "passingScore": 72,
      "difficulty": "intermediate",
      "topicIds": ["compute", "storage", "networking", "security"],
      "isActive": true,
      "metadata": {
        "lastUpdated": "2023-08-01",
        "version": "C03"
      }
    }
  }
}
```

---

## 🏷️ Topic Endpoints (Auth Required)

### **GET /api/v1/topics**
List all topics with filtering by provider/exam.

**Headers:** `Authorization: Bearer <token>`
**Query Parameters:**
- `provider` (string, optional): Filter by provider ID
- `exam` (string, optional): Filter by exam ID
- `limit` (integer, optional): Results per page (default: 50)
- `offset` (integer, optional): Starting offset (default: 0)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "topics": [
      {
        "topicId": "storage",
        "topicName": "Storage Services",
        "description": "Cloud storage solutions and data management",
        "parentTopicId": null,
        "examIds": ["saa-c03", "az-104", "ace"],
        "questionCount": 150,
        "difficulty": "intermediate"
      }
    ],
    "pagination": {
      "total": 12,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### **GET /api/v1/topics/{topicId}**
Get specific topic details.

**Headers:** `Authorization: Bearer <token>`
**Path Parameters:** `topicId` (string) - Topic identifier

**Response (200):**
```json
{
  "success": true,
  "data": {
    "topic": {
      "topicId": "storage",
      "topicName": "Storage Services",
      "description": "Cloud storage solutions and data management",
      "parentTopicId": null,
      "examIds": ["saa-c03", "az-104", "ace"],
      "questionCount": 150,
      "difficulty": "intermediate",
      "metadata": {
        "subTopics": ["object-storage", "block-storage", "file-storage"]
      }
    }
  }
}
```

---

## ❓ Question Endpoints (Auth Required)

### **GET /api/v1/questions**
Get questions with filtering by provider/exam/topics/difficulty.

**Headers:** `Authorization: Bearer <token>`
**Query Parameters:**
- `provider` (string, optional): Filter by provider ID
- `exam` (string, optional): Filter by exam ID
- `topics` (string, optional): Comma-separated topic IDs
- `difficulty` (string, optional): Filter by difficulty level
- `limit` (integer, optional): Results per page (default: 50)
- `offset` (integer, optional): Starting offset (default: 0)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "questionId": "q_001",
        "questionText": "A company collects data for temperature, humidity, and atmospheric pressure in cities across multiple continents. The average volume of data that each city generates is 500 GB per day...",
        "questionType": "single_choice",
        "options": [
          "Turn on S3 Transfer Acceleration on the destination S3 bucket",
          "Upload the data from each site to an S3 bucket in the closest Region",
          "Schedule AWS Snowball Edge Storage Optimized device jobs",
          "Upload the data from each site to an Amazon EC2 instance"
        ],
        "correctAnswers": [1],
        "explanation": "S3 Transfer Acceleration uses CloudFront's globally distributed edge locations to accelerate uploads to S3...",
        "topicIds": ["storage", "networking"],
        "examId": "saa-c03",
        "providerId": "aws",
        "difficulty": "intermediate",
        "keywords": ["S3", "Transfer Acceleration", "CloudFront"]
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

### **GET /api/v1/questions/{questionId}**
Get specific question details.

**Headers:** `Authorization: Bearer <token>`
**Path Parameters:** `questionId` (string) - Question identifier

**Response (200):**
```json
{
  "success": true,
  "data": {
    "question": {
      "questionId": "q_001",
      "questionText": "A company collects data for temperature, humidity, and atmospheric pressure...",
      "questionType": "single_choice",
      "options": [
        "Turn on S3 Transfer Acceleration on the destination S3 bucket",
        "Upload the data from each site to an S3 bucket in the closest Region"
      ],
      "correctAnswers": [1],
      "explanation": "S3 Transfer Acceleration uses CloudFront's globally distributed edge locations...",
      "topicIds": ["storage", "networking"],
      "examId": "saa-c03",
      "providerId": "aws",
      "difficulty": "intermediate",
      "keywords": ["S3", "Transfer Acceleration"],
      "metadata": {
        "lastUpdated": "2024-01-15",
        "source": "official"
      }
    }
  }
}
```

### **POST /api/v1/questions/search**
Full-text search across question bank.

**Headers:** `Authorization: Bearer <token>`
**Request Body:**
```json
{
  "searchTerm": "S3 bucket policy",
  "provider": "aws",
  "exam": "saa-c03",
  "relevanceThreshold": 0.7,
  "limit": 20
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "questionId": "q_045",
        "questionText": "A company uses AWS Organizations to manage multiple AWS accounts...",
        "questionType": "single_choice",
        "options": ["Add the aws PrincipalOrgID global condition key"],
        "correctAnswers": [0],
        "explanation": "aws:PrincipalOrgID simplifies specifying the Principal element...",
        "relevanceScore": 0.89,
        "matchedKeywords": ["S3", "bucket", "policy"]
      }
    ],
    "totalResults": 15,
    "searchQuery": "S3 bucket policy",
    "averageRelevance": 0.82
  }
}
```

---

## 📝 Study Session Endpoints (Auth Required)

### **POST /api/v1/sessions**
Create new study session.

**Headers:** `Authorization: Bearer <token>`
**Request Body:**
```json
{
  "providerIds": ["aws", "azure"],
  "examIds": ["saa-c03", "az-900"],
  "topicIds": ["storage", "compute"],
  "questionCount": 20,
  "sessionType": "cross_provider"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "sessionId": "uuid-session-123",
      "userId": "uuid-user-456",
      "sessionType": "cross_provider",
      "providerIds": ["aws", "azure"],
      "examIds": ["saa-c03", "az-900"],
      "topicIds": ["storage", "compute"],
      "questionCount": 20,
      "status": "active",
      "startedAt": "2025-08-10T10:30:00.000Z",
      "currentQuestionIndex": 0,
      "answers": [],
      "score": 0
    }
  }
}
```

### **GET /api/v1/sessions/{sessionId}**
Get session details and current question.

**Headers:** `Authorization: Bearer <token>`
**Path Parameters:** `sessionId` (string) - Session identifier

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "sessionId": "uuid-session-123",
      "status": "active",
      "currentQuestionIndex": 5,
      "totalQuestions": 20,
      "score": 80.0,
      "timeSpent": 1200,
      "currentQuestion": {
        "questionId": "q_006",
        "questionText": "Which AWS service provides...",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "questionType": "single_choice"
      }
    }
  }
}
```

### **PUT /api/v1/sessions/{sessionId}**
Update session (pause/resume).

**Headers:** `Authorization: Bearer <token>`
**Path Parameters:** `sessionId` (string) - Session identifier
**Request Body:**
```json
{
  "status": "paused"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "sessionId": "uuid-session-123",
      "status": "paused",
      "pausedAt": "2025-08-10T11:15:00.000Z"
    }
  }
}
```

### **DELETE /api/v1/sessions/{sessionId}**
Delete/abandon session.

**Headers:** `Authorization: Bearer <token>`
**Path Parameters:** `sessionId` (string) - Session identifier

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Session successfully deleted"
  }
}
```

### **POST /api/v1/sessions/{sessionId}/answers**
Submit answers for current question.

**Headers:** `Authorization: Bearer <token>`
**Path Parameters:** `sessionId` (string) - Session identifier
**Request Body:**
```json
{
  "questionId": "q_006",
  "selectedAnswers": [1],
  "timeSpent": 45
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "result": {
      "questionId": "q_006",
      "selectedAnswers": [1],
      "correctAnswers": [1],
      "isCorrect": true,
      "explanation": "Correct! This service provides...",
      "timeSpent": 45
    },
    "session": {
      "currentQuestionIndex": 6,
      "score": 85.0,
      "nextQuestion": {
        "questionId": "q_007",
        "questionText": "What is the purpose of..."
      }
    }
  }
}
```

### **POST /api/v1/sessions/{sessionId}/complete**
Complete session and get results.

**Headers:** `Authorization: Bearer <token>`
**Path Parameters:** `sessionId` (string) - Session identifier

**Response (200):**
```json
{
  "success": true,
  "data": {
    "results": {
      "sessionId": "uuid-session-123",
      "finalScore": 85.0,
      "totalQuestions": 20,
      "correctAnswers": 17,
      "totalTime": 1800,
      "averageTimePerQuestion": 90,
      "completedAt": "2025-08-10T12:00:00.000Z",
      "topicBreakdown": [
        {
          "topicId": "storage",
          "accuracy": 90.0,
          "questionsAnswered": 10
        }
      ]
    }
  }
}
```

### **POST /api/v1/sessions/adaptive**
Create enhanced session with difficulty adjustment.

**Headers:** `Authorization: Bearer <token>`
**Request Body:**
```json
{
  "providerId": "aws",
  "examId": "saa-c03",
  "questionCount": 25,
  "difficultyAdjustment": true,
  "initialDifficulty": "intermediate"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "sessionId": "uuid-adaptive-789",
      "sessionType": "adaptive",
      "adaptiveConfig": {
        "difficultyAdjustment": true,
        "initialDifficulty": "intermediate",
        "adjustmentThreshold": 0.7
      },
      "status": "active",
      "questionCount": 25
    }
  }
}
```

---

## 📊 Analytics Endpoints (Auth Required)

### **GET /api/v1/analytics/progress**
Get user progress analytics.

**Headers:** `Authorization: Bearer <token>`
**Query Parameters:**
- `timeframe` (string, optional): daily, weekly, monthly
- `providerId` (string, optional): Filter by provider
- `examId` (string, optional): Filter by exam
- `includeGoals` (boolean, optional): Include goal progress

**Response (200):**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalSessions": 45,
      "completedSessions": 42,
      "totalQuestions": 900,
      "correctAnswers": 720,
      "overallAccuracy": 80.0,
      "averageSessionTime": 1800,
      "studyStreak": 7
    },
    "progressByProvider": [
      {
        "providerId": "aws",
        "accuracy": 85.0,
        "masteryLevel": "advanced",
        "questionsAnswered": 500
      }
    ],
    "progressByTopic": [
      {
        "topicId": "storage",
        "accuracy": 90.0,
        "masteryLevel": "expert",
        "questionsAnswered": 100
      }
    ],
    "trendsOverTime": [
      {
        "date": "2025-08-01",
        "accuracy": 75.0,
        "questionsAnswered": 20
      }
    ]
  }
}
```

### **GET /api/v1/analytics/sessions/{sessionId}**
Get detailed session analytics.

**Headers:** `Authorization: Bearer <token>`
**Path Parameters:** `sessionId` (string) - Session identifier

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionAnalytics": {
      "sessionId": "uuid-session-123",
      "performance": {
        "accuracy": 85.0,
        "totalTime": 1800,
        "averageTimePerQuestion": 90,
        "difficultyDistribution": {
          "beginner": 30,
          "intermediate": 50,
          "advanced": 20
        }
      },
      "topicPerformance": [
        {
          "topicId": "storage",
          "accuracy": 90.0,
          "timeSpent": 600
        }
      ],
      "learningInsights": [
        "Strong performance on storage concepts",
        "Consider reviewing networking fundamentals"
      ]
    }
  }
}
```

### **GET /api/v1/analytics/performance**
Get performance insights and trends.

**Headers:** `Authorization: Bearer <token>`
**Query Parameters:**
- `timeframe` (string, optional): weekly, monthly, yearly
- `includeComparisons` (boolean, optional): Include peer comparisons

**Response (200):**
```json
{
  "success": true,
  "data": {
    "performanceMetrics": {
      "currentAccuracy": 82.0,
      "accuracyTrend": "improving",
      "learningVelocity": 1.2,
      "consistencyScore": 85,
      "examReadiness": {
        "saa-c03": 78,
        "az-900": 65
      }
    },
    "competencyScores": {
      "storage": 92,
      "compute": 78,
      "networking": 65,
      "security": 71
    },
    "improvementSuggestions": [
      "Focus on networking concepts for better overall performance",
      "Increase study frequency to maintain momentum"
    ]
  }
}
```

---

## 🎯 Goals Endpoints (Auth Required)

### **GET /api/v1/goals**
Get user's study goals.

**Headers:** `Authorization: Bearer <token>`
**Query Parameters:**
- `status` (string, optional): active, completed, paused

**Response (200):**
```json
{
  "success": true,
  "data": {
    "goals": [
      {
        "goalId": "uuid-goal-123",
        "userId": "uuid-user-456",
        "goalType": "exam_target",
        "title": "Pass AWS SAA-C03",
        "description": "Achieve 80% accuracy on AWS Solutions Architect Associate exam",
        "providerId": "aws",
        "examId": "saa-c03",
        "targetValue": 80,
        "currentValue": 72,
        "targetDate": "2025-09-01",
        "status": "active",
        "createdAt": "2025-07-01T00:00:00.000Z"
      }
    ],
    "totalGoals": 3,
    "activeGoals": 2
  }
}
```

### **POST /api/v1/goals**
Create new study goal.

**Headers:** `Authorization: Bearer <token>`
**Request Body:**
```json
{
  "goalType": "accuracy_target",
  "title": "Improve Storage Topic Performance",
  "description": "Achieve 90% accuracy on storage-related questions",
  "targetValue": 90,
  "targetDate": "2025-09-15",
  "providerId": "aws",
  "topicId": "storage"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "goal": {
      "goalId": "uuid-goal-456",
      "userId": "uuid-user-456",
      "goalType": "accuracy_target",
      "title": "Improve Storage Topic Performance",
      "description": "Achieve 90% accuracy on storage-related questions",
      "targetValue": 90,
      "currentValue": 0,
      "targetDate": "2025-09-15",
      "status": "active",
      "providerId": "aws",
      "topicId": "storage",
      "createdAt": "2025-08-10T10:00:00.000Z"
    }
  }
}
```

### **PUT /api/v1/goals/{goalId}**
Update existing goal.

**Headers:** `Authorization: Bearer <token>`
**Path Parameters:** `goalId` (string) - Goal identifier
**Request Body:**
```json
{
  "targetValue": 85,
  "targetDate": "2025-10-01",
  "status": "active"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "goal": {
      "goalId": "uuid-goal-123",
      "targetValue": 85,
      "targetDate": "2025-10-01",
      "status": "active",
      "updatedAt": "2025-08-10T10:30:00.000Z"
    }
  }
}
```

### **DELETE /api/v1/goals/{goalId}**
Delete study goal.

**Headers:** `Authorization: Bearer <token>`
**Path Parameters:** `goalId` (string) - Goal identifier

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Goal successfully deleted"
  }
}
```

---

## 🏥 Health Endpoints (No Auth Required)

### **GET /api/v1/health**
Basic health check.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-08-10T10:30:00.000Z",
    "version": "2.0.0"
  }
}
```

### **GET /api/v1/health/detailed**
Detailed system health check.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-08-10T10:30:00.000Z",
    "version": "2.0.0",
    "services": {
      "database": {
        "status": "healthy",
        "responseTime": 15
      },
      "questionData": {
        "status": "healthy",
        "providersLoaded": 3,
        "examsLoaded": 8
      },
      "cache": {
        "status": "healthy",
        "hitRate": 0.85
      }
    },
    "metrics": {
      "activeUsers": 150,
      "activeSessions": 23,
      "questionsServed": 15420
    }
  }
}
```

---

## ⚠️ Error Responses

### **Standard Error Format**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  }
}
```

### **Common HTTP Status Codes**
- `200 OK`: Successful request
- `400 Bad Request`: Invalid request data or validation error
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### **Authentication Error**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

### **Validation Error**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "questionCount",
        "message": "Must be between 1 and 100"
      }
    ]
  }
}
```

---

## 📚 Complete Endpoint Summary

### **Authentication Endpoints (4 endpoints)**
- `POST /api/v1/auth/register` - User registration with email validation
- `POST /api/v1/auth/login` - User authentication with JWT generation  
- `POST /api/v1/auth/refresh` - JWT token refresh mechanism
- `POST /api/v1/auth/logout` - User logout with token blacklisting

### **Provider Endpoints (2 endpoints)**
- `GET /api/v1/providers` - List all certification providers
- `GET /api/v1/providers/{providerId}` - Get specific provider details

### **Exam Endpoints (2 endpoints)**
- `GET /api/v1/exams` - List all exams with filtering by provider/difficulty
- `GET /api/v1/exams/{examId}` - Get specific exam details

### **Topic Endpoints (2 endpoints)**
- `GET /api/v1/topics` - List all topics with filtering by provider/exam
- `GET /api/v1/topics/{topicId}` - Get specific topic details

### **Question Endpoints (3 endpoints)**
- `GET /api/v1/questions` - Get questions with filtering by provider/exam/topics/difficulty
- `GET /api/v1/questions/{questionId}` - Get specific question details
- `POST /api/v1/questions/search` - Full-text search across question bank

### **Study Session Endpoints (7 endpoints)**
- `POST /api/v1/sessions` - Create new study session
- `GET /api/v1/sessions/{sessionId}` - Get session details and current question
- `PUT /api/v1/sessions/{sessionId}` - Update session (pause/resume)
- `DELETE /api/v1/sessions/{sessionId}` - Delete/abandon session
- `POST /api/v1/sessions/{sessionId}/answers` - Submit answers for current question
- `POST /api/v1/sessions/{sessionId}/complete` - Complete session and get results
- `POST /api/v1/sessions/adaptive` - Create enhanced session with difficulty adjustment

### **Analytics Endpoints (3 endpoints)**
- `GET /api/v1/analytics/progress` - Get user progress analytics
- `GET /api/v1/analytics/sessions/{sessionId}` - Get detailed session analytics
- `GET /api/v1/analytics/performance` - Get performance insights and trends

### **Goals Endpoints (4 endpoints)**
- `GET /api/v1/goals` - Get user's study goals
- `POST /api/v1/goals` - Create new study goal
- `PUT /api/v1/goals/{goalId}` - Update existing goal
- `DELETE /api/v1/goals/{goalId}` - Delete study goal

### **Health Endpoints (2 endpoints)**
- `GET /api/v1/health` - Basic health check
- `GET /api/v1/health/detailed` - Detailed system health check

**Total: 29 endpoints** providing complete coverage for multi-exam certification study platform functionality.

---

## 🎯 Features Supported

### **Multi-Provider Support**
- AWS, Azure, GCP, CompTIA, Cisco certification providers
- Cross-provider study sessions with question mixing
- Provider-agnostic progress tracking and analytics

### **Advanced Session Types**
- Regular study sessions with customizable parameters
- Cross-provider sessions mixing questions from multiple sources
- Adaptive sessions with difficulty adjustment algorithms

### **Comprehensive Analytics**
- User progress tracking across providers and exams
- Session-level performance analysis
- Cross-provider competency scoring and skill transferability

### **Goal Management**  
- Multiple goal types: exam targets, study streaks, accuracy targets
- Progress monitoring and completion tracking
- Goal-based recommendations and study planning

### **Search & Discovery**
- Full-text search across entire question bank
- Advanced filtering by multiple criteria
- Relevance scoring and keyword matching

This API reference reflects the complete 29-endpoint architecture designed in Phase 2, providing comprehensive functionality for a multi-exam certification study platform with clean separation of concerns and proper RESTful design principles.