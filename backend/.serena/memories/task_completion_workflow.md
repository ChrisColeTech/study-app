# Task Completion Workflow

## Code Quality Checks (Always Required)
1. **Build Check**: `npm run build` - Ensure TypeScript compiles without errors
2. **Lint Check**: `npm run lint` - Fix any ESLint violations 
3. **Format Check**: `npm run format` - Apply Prettier formatting
4. **Type Check**: Verify all TypeScript types are correct

## Testing Requirements
1. **Unit Tests**: Run `npm run test:unit` for affected components
2. **Integration Tests**: Run `npm run test:integration` for API changes
3. **Endpoint Tests**: Run specific endpoint test scripts for handler changes
4. **Coverage**: Maintain 80%+ test coverage (jest.config.js threshold)

## Architecture-Specific Workflows

### Handler Changes
1. **Build Test**: `npm run build` after each handler modification
2. **Endpoint Test**: Run corresponding `npm run test:endpoints:*` script
3. **Validation**: Ensure proper use of BaseHandler methods
4. **Middleware**: Verify ValidationMiddleware and ParsingMiddleware integration

### Service/Repository Changes
1. **Unit Tests**: Update/create tests in tests/unit/services/ or tests/unit/repositories/
2. **Mock Updates**: Update AWS SDK mocks if needed
3. **Integration**: Test service-repository integration
4. **Dependency**: Update ServiceFactory if new dependencies added

### Infrastructure Changes
1. **CDK Tests**: Run CDK unit tests if infrastructure modified
2. **Health Check**: Ensure health endpoint reflects changes
3. **Environment**: Update environment variables if needed

## Documentation Updates
1. **API Changes**: Update docs/API_REFERENCE.md if endpoints modified
2. **Architecture**: Update docs/ARCHITECTURE.md for structural changes
3. **README**: Update project status if major milestones completed

## Deployment Preparation
1. **Bundle Test**: `npm run bundle` - Ensure esbuild creates valid bundles
2. **Package Test**: `npm run package` - Full packaging workflow
3. **Environment**: Verify all environment variables configured
4. **Health**: Confirm health endpoints return success

## Quality Gates
- **Zero Build Errors**: TypeScript must compile cleanly
- **Zero Lint Errors**: All ESLint rules must pass
- **Test Coverage**: Maintain 80%+ coverage threshold
- **Handler Compliance**: All handlers must use BaseHandler methods correctly