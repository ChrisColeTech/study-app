# Suggested Development Commands

## Build Commands
- `npm run build` - Compile TypeScript to JavaScript
- `npm run build:watch` - Watch mode for continuous compilation
- `npm run clean` - Remove dist, coverage, and cache directories

## Testing Commands
- `npm test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:unit` - Run only unit tests
- `npm run test:integration` - Run only integration tests

## Endpoint Testing (Shell Scripts)
- `npm run test:endpoints` - Run all endpoint tests
- `npm run test:endpoints:auth` - Test auth endpoints
- `npm run test:endpoints:sessions` - Test session endpoints
- `npm run test:endpoints:goals` - Test goals endpoints
- `npm run test:endpoints:analytics` - Test analytics endpoints
- (Additional endpoint test scripts available for each handler)

## Code Quality Commands
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier

## Packaging Commands
- `npm run package` - Build and bundle for deployment
- `npm run bundle` - Create esbuild bundles for Lambda

## Local Development
- `npm run local:start` - Start SAM local API (if using SAM)
- `npm run local:invoke` - Invoke specific Lambda function locally

## System Commands
- `tsc` - Direct TypeScript compilation
- `jest --testPathPattern=specific/test/path` - Run specific tests
- System utilities: `ls`, `cd`, `grep`, `find`, `git` (standard Linux commands)