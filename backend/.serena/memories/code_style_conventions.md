# Code Style and Conventions

## TypeScript Configuration
- **Target**: ES2020 with CommonJS modules
- **Strict Mode**: Full strict TypeScript with exactOptionalPropertyTypes
- **Path Mapping**: Organized imports with @ aliases (@/handlers/*, @/services/*, etc.)
- **Declaration Files**: Generated for all modules

## ESLint Rules
- **TypeScript Rules**: @typescript-eslint/recommended with custom overrides
- **No Unused Variables**: Error (except parameters starting with _)
- **Explicit Types**: Optional for functions, required for complex types
- **Best Practices**: Strict equality, curly braces required, no eval/console

## Prettier Formatting
- **Line Width**: 100 characters
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings
- **Semicolons**: Always required
- **Trailing Commas**: ES5 style
- **Arrow Functions**: Avoid parentheses when possible

## Naming Conventions
- **Classes**: PascalCase (e.g., SessionHandler, ValidationMiddleware)
- **Methods**: camelCase (e.g., createSession, validateRequestBody)
- **Constants**: UPPER_SNAKE_CASE (e.g., ERROR_CODES, API_CONSTANTS)
- **Files**: kebab-case for utilities, PascalCase.ts for classes
- **Types/Interfaces**: PascalCase with descriptive suffixes (e.g., ApiResponse, ValidationSchema)

## Architecture Patterns
- **Handler Pattern**: All handlers extend BaseHandler, use middleware for parsing/validation
- **Service Pattern**: Business logic in services, injected via ServiceFactory
- **Repository Pattern**: Data access abstraction, separate from business logic
- **Middleware Pattern**: Parsing, validation, error handling extracted to reusable middleware

## Code Organization
- **Imports**: Organized by external libraries, internal modules, types
- **Error Handling**: Centralized through ErrorHandlingMiddleware and BaseHandler methods
- **Validation**: Schema-based validation through ValidationMiddleware
- **Responses**: Standardized through buildSuccessResponse/buildErrorResponse methods