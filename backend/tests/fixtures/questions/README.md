# Question Test Fixtures

This directory contains JSON fixtures for testing question and exam endpoints.

## Planned Fixtures

- `get-questions.json` - Parameters for retrieving questions
- `get-questions-filtered.json` - Filtered question retrieval
- `submit-answers.json` - Answer submission data
- `get-explanations.json` - Request for question explanations

## Endpoints to be tested

- `GET /v1/questions` - Get questions with filtering
- `GET /v1/providers/{provider}/exams/{exam}/questions` - Get exam-specific questions
- `POST /v1/sessions/{id}/answers` - Submit answers
- `GET /v1/questions/{id}/explanation` - Get question explanations

## Implementation Status

⏳ **Not yet implemented** - Will be created during question management phases