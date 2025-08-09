# API Reference - Multi-Exam Certification Study Platform

## 🌐 API Overview

This API provides comprehensive endpoints for managing multi-exam certification study sessions, user progress tracking, and AI-powered analytics using serverless AWS Lambda functions with S3 JSON data sources.

**Base URL**: `https://{api-gateway-url}/dev/api/v1`  
**Content Type**: `application/json`  
**Authentication**: JWT Bearer tokens

## 📋 Authentication

All protected endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### **POST /auth/register**
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "name": "John Doe"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": "uuid-123",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

### **POST /auth/login**
Authenticate user and receive access token.

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
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": "uuid-123",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

## 🏢 Providers

### **GET /providers**
List all available certification providers.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "id": "aws",
        "name": "Amazon Web Services",
        "description": "Cloud computing platform and services",
        "exams": [
          {
            "id": "saa-c03",
            "name": "Solutions Architect Associate",
            "description": "Validates ability to design distributed systems on AWS",
            "questionCount": 681
          },
          {
            "id": "dva-c01",
            "name": "Developer Associate",
            "description": "Validates ability to develop applications on AWS",
            "questionCount": 0
          },
          {
            "id": "soa-c02",
            "name": "SysOps Administrator Associate",
            "description": "Validates ability to deploy and manage systems on AWS",
            "questionCount": 0
          }
        ]
      },
      {
        "id": "azure",
        "name": "Microsoft Azure",
        "description": "Cloud computing platform and services",
        "exams": [
          {
            "id": "az-900",
            "name": "Azure Fundamentals",
            "description": "Validates foundational knowledge of cloud services",
            "questionCount": 0
          },
          {
            "id": "az-104",
            "name": "Azure Administrator",
            "description": "Validates skills to manage Azure subscriptions and resources",
            "questionCount": 0
          },
          {
            "id": "az-204",
            "name": "Azure Developer",
            "description": "Validates skills to develop cloud solutions",
            "questionCount": 0
          }
        ]
      },
      {
        "id": "gcp",
        "name": "Google Cloud Platform",
        "description": "Cloud computing platform and services",
        "exams": [
          {
            "id": "ace",
            "name": "Associate Cloud Engineer",
            "description": "Validates ability to deploy and manage GCP resources",
            "questionCount": 0
          },
          {
            "id": "pca",
            "name": "Professional Cloud Architect",
            "description": "Validates ability to design and manage GCP solutions",
            "questionCount": 0
          }
        ]
      }
    ],
    "totalProviders": 3,
    "totalExams": 8
  }
}
```

## ❓ Questions

### **GET /questions**
Retrieve questions with filtering and pagination.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `provider` (string, optional): Filter by provider ID (default: "aws")
- `exam` (string, optional): Filter by exam ID (default: "saa-c03")
- `topics` (string[], optional): Filter by topic names
- `difficulty` (string, optional): Filter by difficulty (easy, medium, hard)
- `limit` (number, optional): Questions per page (default: 20)
- `offset` (number, optional): Starting offset (default: 0)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "question_number": 1,
        "question": {
          "text": "A company collects data for temperature, humidity, and atmospheric pressure...",
          "options": [
            ["A", "Turn on S3 Transfer Acceleration on the destination S3 bucket..."],
            ["B", "Upload the data from each site to an S3 bucket in the closest Region..."],
            ["C", "Schedule AWS Snowball Edge Storage Optimized device jobs..."],
            ["D", "Upload the data from each site to an Amazon EC2 instance..."]
          ],
          "question_type": "single_choice",
          "expected_answers": 1,
          "topic": "Storage Services",
          "service_category": "Storage Services",
          "aws_services": ["S3", "BUCKET", "VOLUME"]
        },
        "answer": {
          "correct_answer": "Turn on S3 Transfer Acceleration on the destination S3 bucket...",
          "explanation": "Correct answer A: S3 Transfer Acceleration...",
          "keywords": ["S3"],
          "parsing_confidence": 0.88,
          "source": "enhanced"
        },
        "study_metadata": {
          "difficulty": "easy",
          "completeness": "complete",
          "question_preview": "A company collects data for temperature, humidity...",
          "has_explanation": true,
          "confidence_level": "high"
        }
      }
    ],
    "pagination": {
      "offset": 0,
      "limit": 20,
      "totalCount": 681,
      "hasMore": true
    },
    "filters": {
      "provider": "aws",
      "exam": "saa-c03"
    }
  }
}
```

### **POST /questions/search**
Search questions by text content.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "query": "S3 bucket",
  "provider": "aws",
  "exam": "saa-c03",
  "limit": 10
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "question_number": 1,
        "question": {
          "text": "A company uses AWS Organizations to manage multiple AWS accounts...",
          "options": [
            ["A", "Add the aws PrincipalOrgID global condition key..."],
            ["B", "Create an organizational unit (OU) for each department..."]
          ],
          "question_type": "single_choice",
          "expected_answers": 1,
          "topic": "Storage Services",
          "service_category": "Storage Services",
          "aws_services": ["S3", "BUCKET"]
        },
        "answer": {
          "correct_answer": "Add the aws PrincipalOrgID global condition key...",
          "explanation": "aws:PrincipalOrgID – Simplifies specifying the Principal element...",
          "keywords": ["S3"],
          "parsing_confidence": 0.88,
          "source": "enhanced"
        },
        "study_metadata": {
          "difficulty": "easy",
          "completeness": "complete",
          "question_preview": "A company uses AWS Organizations to manage...",
          "has_explanation": true,
          "confidence_level": "high"
        }
      }
    ],
    "searchQuery": "S3 bucket",
    "totalResults": 2,
    "provider": "aws",
    "exam": "saa-c03"
  }
}
```

## 📝 Study Sessions

### **POST /sessions**
Create a new study session.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "provider": "aws",
  "exam": "saa-c03",
  "questionCount": 10
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "sessionId": "uuid-session-123",
      "provider": "aws",
      "exam": "saa-c03",
      "completed": false,
      "createdAt": "2025-08-08T21:53:48.480Z"
    }
  }
}
```

### **GET /sessions/:sessionId**
Get study session details and current state.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "sessionId": "uuid-session-123",
      "provider": "aws",
      "exam": "saa-c03",
      "questions": [],
      "answers": {},
      "completed": false,
      "createdAt": "2025-08-08T21:53:48.480Z",
      "updatedAt": "2025-08-08T21:53:48.480Z"
    }
  }
}
```

### **POST /sessions/:sessionId/answers**
Submit answer for a question.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "questionId": "1",
  "answer": "A"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "questionId": "1",
    "answerSubmitted": "A",
    "totalAnswered": 1
  }
}
```

### **POST /sessions/adaptive**
Create an AI-powered adaptive learning session.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "provider": "aws",
  "exam": "saa-c03",
  "questionCount": 20
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-adaptive-123",
    "sessionType": "adaptive",
    "config": {
      "questionCount": 20,
      "isAdaptive": true,
      "skillLevel": "beginner",
      "adaptiveAlgorithm": "v1.0"
    },
    "adaptiveFeatures": {
      "skillLevel": "beginner",
      "averageAccuracy": 0,
      "questionsAnalyzed": 0,
      "weakAreasIdentified": []
    },
    "questionPreview": [],
    "nextQuestionUrl": "/api/v1/sessions/{sessionId}/next-question"
  }
}
```

## 📊 Analytics

### **GET /analytics/progress**
Get comprehensive user progress across all providers.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `provider` (string, optional): Filter by provider
- `exam` (string, optional): Filter by exam
- `timeRange` (string, optional): Filter by timeframe (week, month, year)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalSessions": 1,
      "completedSessions": 0,
      "completionRate": 0,
      "totalQuestions": 0,
      "correctAnswers": 0,
      "overallAccuracy": 0
    },
    "topicPerformance": [],
    "progressTrend": [
      {
        "date": "2025-08-08",
        "sessions": 1,
        "questions": 0,
        "accuracy": 0
      }
    ],
    "strengths": [],
    "weaknesses": [],
    "filters": {
      "provider": "aws",
      "exam": null,
      "timeRange": "month",
      "startDate": "2025-07-08T21:54:14.470Z",
      "endDate": "2025-08-08T21:54:14.470Z"
    }
  }
}
```

### **GET /analytics/sessions/:sessionId**
Get detailed session analytics and performance insights.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionInfo": {
      "sessionId": "uuid-session-123",
      "provider": "aws",
      "createdAt": "2025-08-08T21:53:48.480Z",
      "duration": null,
      "isCompleted": false
    },
    "performance": {
      "totalQuestions": 0,
      "correctAnswers": 0,
      "incorrectAnswers": 0,
      "accuracy": 0,
      "averageTimePerQuestion": 0
    },
    "topicPerformance": [],
    "difficultyPerformance": [],
    "answerDistribution": {},
    "questionAnalysis": [],
    "insights": [
      "Consider reviewing fundamental concepts before attempting more questions.",
      "Consider spending more time analyzing questions thoroughly."
    ]
  }
}
```

### **GET /recommendations**
Get AI-driven study recommendations and personalized suggestions.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `provider` (string, optional): Filter by provider
- `exam` (string, optional): Filter by exam

**Response (200):**
```json
{
  "success": true,
  "data": {
    "performance": {
      "overallAccuracy": 0,
      "totalQuestions": 0,
      "totalCorrect": 0,
      "readinessScore": 0,
      "readinessLevel": "Beginner"
    },
    "weakTopics": [],
    "strongTopics": [],
    "recommendations": [
      {
        "type": "study_frequency",
        "priority": "medium",
        "title": "Increase Study Frequency",
        "description": "Regular practice is key to retention and improvement",
        "action": "Aim for at least 3-4 study sessions per week"
      }
    ],
    "studyPlan": [
      {
        "week": 1,
        "focus": "Foundation Building",
        "activities": [
          "Review basic concepts and terminology",
          "Practice 20-30 easy questions daily",
          "Study explanations thoroughly for incorrect answers"
        ],
        "target": "Achieve 70% accuracy on easy questions"
      }
    ],
    "suggestedQuestions": [],
    "metrics": {
      "sessionsAnalyzed": 1,
      "topicsIdentified": 0,
      "lastStudyDate": "2025-08-08T21:53:48.480Z"
    }
  }
}
```

## ⚠️ Error Responses

### **Standard Error Format**
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### **Common Error Codes**
- `400 Bad Request`: Invalid request data or validation error
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

### **Authentication Errors**
```json
{
  "message": "Unauthorized"
}
```

### **Validation Errors**
```json
{
  "success": false,
  "error": "\"timeLimit\" is not allowed"
}
```

## 🔗 API Base URLs

- **Development**: `https://{api-gateway-id}.execute-api.us-east-2.amazonaws.com/dev/api/v1`
- **Production**: `https://{api-gateway-id}.execute-api.us-east-2.amazonaws.com/prod/api/v1`

## 📚 Available Endpoints Summary

### Authentication (No Auth Required)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Authenticate user

### Protected Endpoints (Auth Required)
- `GET /providers` - List certification providers
- `GET /questions` - Get questions with filtering
- `POST /questions/search` - Search questions by text
- `POST /sessions` - Create study session
- `GET /sessions/{id}` - Get session details
- `POST /sessions/{id}/answers` - Submit answers
- `POST /sessions/adaptive` - Create adaptive session
- `GET /analytics/progress` - Get user progress analytics
- `GET /analytics/sessions/{id}` - Get session analytics
- `GET /recommendations` - Get AI recommendations

## 🎯 Current Data Availability
- **AWS SAA-C03**: 681 questions with full explanations
- **Other Exams**: Placeholder data (0 questions)
- **Providers**: AWS, Azure, GCP with exam metadata

This API reference accurately reflects the current serverless Lambda-based implementation with AWS API Gateway, DynamoDB, and S3 data storage.