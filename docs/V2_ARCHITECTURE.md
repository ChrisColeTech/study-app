# Study App V2 - Complete Architecture Rewrite

## Architecture Overview

Based on lessons learned from V1 debugging session, V2 will use proven patterns and avoid problematic configurations.

## Key Changes from V1

### 1. Authentication Strategy
- **V1 Problem**: API Gateway REQUEST authorizer never triggered
- **V2 Solution**: Use TOKEN authorizer with JWT validation
- **Backup Plan**: Lambda-level authentication with consistent middleware

### 2. Stack Naming Strategy  
- **V1**: StudyAppStack-prod with old logical IDs
- **V2**: StudyAppV2Stack-prod with completely new logical IDs
- **Benefit**: Avoid any caching or configuration conflicts

### 3. Infrastructure Components

#### Core Services
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CloudFront    │────│   API Gateway    │────│     Lambda      │
│                 │    │   (V2 APIs)      │    │   (V2 Functions)│
│ - JWT Forwarding│    │ - TOKEN Auth     │    │ - Auth Middleware│
│ - CORS Headers  │    │ - New Resources  │    │ - New Logical IDs│
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│       S3        │    │    DynamoDB      │    │   CloudWatch    │
│ - Study Data    │    │  - User Data     │    │    Logging      │
│ - Static Assets │    │  - Sessions      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## V2 Stack Architecture

### Authentication Flow
1. **Frontend** → JWT token in Authorization header
2. **CloudFront** → Forward all headers (custom policy)
3. **API Gateway** → TOKEN authorizer validates JWT
4. **Lambda** → Extract userId from context, execute business logic

### New Logical IDs (V2 Prefix)
- `StudyAppV2Stack-prod`
- `V2-API-Gateway`
- `V2-CloudFront-Distribution`  
- `V2-DynamoDB-Users-Table`
- `V2-Lambda-Auth-Function`
- `V2-Lambda-Provider-Function`
- etc.

### Lambda Functions (Rewritten)
```
lambdas-v2/
├── src/
│   ├── handlers/
│   │   ├── v2-auth-handler.ts      # JWT validation & user management
│   │   ├── v2-provider-handler.ts  # Provider/exam data
│   │   ├── v2-question-handler.ts  # Question management
│   │   ├── v2-session-handler.ts   # Study sessions
│   │   └── v2-health-handler.ts    # Health checks
│   ├── middleware/
│   │   ├── v2-auth-middleware.ts   # Consistent auth across all handlers
│   │   └── v2-cors-middleware.ts   # CORS handling
│   ├── services/
│   │   ├── v2-jwt-service.ts       # JWT validation logic
│   │   └── v2-data-service.ts      # Data access layer
│   └── shared/
│       ├── v2-response-builder.ts  # Consistent API responses
│       └── v2-types.ts             # Type definitions
```

## Implementation Strategy

### Phase 1: Core Infrastructure
1. Create V2 CDK stack with new logical IDs
2. Implement TOKEN authorizer (not REQUEST)
3. Set up DynamoDB tables with V2 names
4. Configure CloudFront with proper header forwarding

### Phase 2: Lambda Functions  
1. Implement auth service with JWT validation
2. Create provider service for exam data
3. Build question service for study content
4. Add session management service

### Phase 3: Testing & Validation
1. Test each endpoint individually
2. Verify token flow end-to-end
3. Load test critical paths
4. Document working configuration

## Success Criteria

✅ **Authentication**: JWT tokens validated at API Gateway level  
✅ **Authorization**: User context available in all Lambda functions  
✅ **CORS**: All headers forwarded correctly through CloudFront  
✅ **Logging**: Comprehensive CloudWatch logging for debugging  
✅ **Testing**: All endpoints return expected responses  
✅ **Documentation**: Complete setup and troubleshooting guide  

## Lessons Learned Integration

### From V1 Debugging Session:
1. **API Gateway REQUEST authorizers** can fail silently - use TOKEN instead
2. **CloudFront header forwarding** requires custom origin request policy  
3. **Centralized auth middleware** eliminates code duplication
4. **Comprehensive logging** is essential for debugging
5. **New logical IDs** prevent caching/configuration conflicts

### V2 Improvements:
1. **TOKEN authorizer**: More reliable than REQUEST type
2. **Lambda-level validation**: Backup auth at handler level  
3. **Consistent middleware**: All handlers use same auth pattern
4. **Better logging**: Structured logging for easier debugging
5. **Clean slate**: No legacy configuration conflicts