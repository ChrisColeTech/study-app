#!/bin/bash

# DRY Violation Elimination Script for Handler Methods
# Systematically replaces repeated patterns with BaseHandler helper methods

echo "Starting DRY violation elimination across all handlers..."

# Directory containing handlers
HANDLERS_DIR="/mnt/c/Projects/study-app/backend/src/handlers"

# Pattern 1: Replace ParsingMiddleware.parseRequestBody patterns
echo "Replacing parseRequestBody patterns..."
find "$HANDLERS_DIR" -name "*.ts" ! -name "*.disabled" -exec sed -i 's/const { data: \([^,]*\), error: parseError } = ParsingMiddleware\.parseRequestBody</const { data: \1, error: parseError } = await this.parseRequestBodyOrError</g' {} \;

# Pattern 2: Replace ParsingMiddleware.parsePathParams patterns
echo "Replacing parsePathParams patterns..."
find "$HANDLERS_DIR" -name "*.ts" ! -name "*.disabled" -exec sed -i 's/const { data: \([^,]*\), error: parseError } = ParsingMiddleware\.parsePathParams(context);/const { data: \1, error: parseError } = await this.parsePathParamsOrError(context);/g' {} \;

# Pattern 3: Replace ParsingMiddleware.parseQueryParams patterns
echo "Replacing parseQueryParams patterns..."
find "$HANDLERS_DIR" -name "*.ts" ! -name "*.disabled" -exec sed -i 's/const { data: \([^,]*\), error: parseError } = ParsingMiddleware\.parseQueryParams(context/const { data: \1, error: parseError } = await this.parseQueryParamsOrError(context/g' {} \;

# Pattern 4: Replace ErrorHandlingMiddleware.withErrorHandling patterns
echo "Replacing withErrorHandling patterns..."
find "$HANDLERS_DIR" -name "*.ts" ! -name "*.disabled" -exec sed -i 's/const { result, error } = await ErrorHandlingMiddleware\.withErrorHandling(/const { result, error } = await this.executeServiceOrError(/g' {} \;
find "$HANDLERS_DIR" -name "*.ts" ! -name "*.disabled" -exec sed -i 's/const { error } = await ErrorHandlingMiddleware\.withErrorHandling(/const { error } = await this.executeServiceOrError(/g' {} \;

echo "DRY elimination patterns applied. Running build test..."

# Test build
cd /mnt/c/Projects/study-app/backend
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful! DRY violations eliminated."
else
    echo "❌ Build failed. Manual fixes required."
    exit 1
fi

echo "DRY elimination complete!"