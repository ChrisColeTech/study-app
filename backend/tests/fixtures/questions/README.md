# Question Test Fixtures

This directory contains JSON fixtures for testing question endpoints.

## Question Listing Fixtures (Phase 12) ✅

- `list-questions.json` - Basic question listing
- `list-questions-filtered.json` - Filtered question retrieval  
- `list-questions-by-provider.json` - Provider-specific questions
- `list-questions-by-tags.json` - Tag-based filtering
- `list-questions-invalid-difficulty.json` - Invalid difficulty parameter
- `list-questions-invalid-pagination.json` - Invalid pagination parameters  
- `list-questions-invalid-type.json` - Invalid type parameter
- `list-questions-pagination.json` - Pagination test
- `list-questions-provider-exam.json` - Provider and exam filtering
- `list-questions-search.json` - Search functionality

## Question Details Fixtures (Phase 13) ✅

- `get-question-basic.json` - Basic question retrieval with full details
- `get-question-no-explanation.json` - Question without explanation
- `get-question-no-metadata.json` - Question without metadata
- `get-question-minimal.json` - Question without explanation or metadata
- `get-question-not-found.json` - Non-existent question ID
- `get-question-invalid-id.json` - Invalid question ID format
- `get-question-missing-id.json` - Missing question ID parameter

## Endpoints Tested

- `GET /v1/questions` - Get questions with filtering (Phase 12)
- `GET /v1/questions/{id}` - Get individual question details (Phase 13)

## Future Fixtures (Planned)

- `submit-answers.json` - Answer submission data
- Session-based question endpoints

## Implementation Status

✅ **Phase 12**: Question listing implemented  
✅ **Phase 13**: Question details implemented  
⏳ **Future phases**: Answer submission, session management