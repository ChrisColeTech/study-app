#!/bin/bash

# init-app.sh - Multi-Exam Certification Study Platform Scaffolding Script
# This script creates the complete application structure as defined in PROJECT_STRUCTURE.md

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Progress tracking
TOTAL_STEPS=8
CURRENT_STEP=0

print_step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    echo -e "${BLUE}[${CURRENT_STEP}/${TOTAL_STEPS}]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

# Check if we're in the correct directory (should be run from frontend directory)
if [[ ! -d "docs" ]] || [[ ! -f "docs/README.md" ]]; then
    print_error "Please run this script from the frontend directory (where docs/ folder exists)"
fi

echo -e "${GREEN}🚀 Multi-Exam Certification Study Platform Scaffolding${NC}"
echo "This script will create the complete application structure based on PROJECT_STRUCTURE.md"
echo ""

# Step 1: Create app folder and main source directories  
print_step "Creating app folder and main source directory structure..."

mkdir -p app
cd app

# Initialize package.json if it doesn't exist
if [[ ! -f "package.json" ]]; then
    npm init -y
    npm install react react-dom
    npm install -D @types/react @types/react-dom @types/node typescript vite @vitejs/plugin-react
    npm install -D tailwindcss postcss autoprefixer @headlessui/react @heroicons/react
fi

mkdir -p src/{components,pages,hooks,store,services,utils,types,data,styles,assets}
mkdir -p src/components/{ui,study,dashboard,layout,forms,providers,exam,analytics}
mkdir -p src/services/{api,providers,analytics,offline}
mkdir -p src/store/{slices,middleware}
mkdir -p src/assets/{images,fonts,animations,icons}
mkdir -p src/assets/images/{illustrations,providers,logos}
mkdir -p src/data/{providers,exams,questions}
mkdir -p public/{icons,manifest}
mkdir -p src/workers

print_success "Main directories created"

# Step 2: Create component placeholder files
print_step "Creating component placeholder files..."

# UI Components
cat > src/components/ui/index.ts << 'EOF'
// UI Components Barrel Export
export { Button } from './Button'
export { Card } from './Card'
export { Badge } from './Badge'
export { Progress } from './Progress'
export { Modal } from './Modal'
export { Spinner } from './Spinner'
export { Toast } from './Toast'
export { Tooltip } from './Tooltip'
EOF

# Create basic UI component files
for component in Button Card Badge Progress Modal Spinner Toast Tooltip; do
cat > "src/components/ui/${component}.tsx" << EOF
import React from 'react'

interface ${component}Props {
  children?: React.ReactNode
  className?: string
}

export const ${component}: React.FC<${component}Props> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={\`${component,,} \${className}\`}>
      {children}
    </div>
  )
}
EOF
done

# Study Components
study_components=("QuestionCard" "AnswerOption" "ProgressIndicator" "QuestionNavigation" "TimerDisplay" "ScoreCard" "FeedbackPanel" "UniversalQuestionCard" "CrossProviderComparison")

# Provider Components
provider_components=("ExamProviderSelector" "ProviderCard" "ProviderLogo" "ProviderExamList")

# Exam Components  
exam_components=("ExamCard" "ExamDetails" "ExamProgress" "ExamFilters")

# Analytics Components
analytics_components=("CrossProviderDashboard" "ProgressChart" "PerformanceMetrics" "StudyGoalTracker")
for component in "${study_components[@]}"; do
cat > "src/components/study/${component}.tsx" << EOF
import React from 'react'

interface ${component}Props {
  className?: string
}

export const ${component}: React.FC<${component}Props> = ({ className = '' }) => {
  return (
    <div className={\`${component} \${className}\`}>
      {/* TODO: Implement ${component} */}
    </div>
  )
}
EOF
done

for component in "${provider_components[@]}"; do
cat > "src/components/providers/${component}.tsx" << EOF
import React from 'react'

interface ${component}Props {
  className?: string
}

export const ${component}: React.FC<${component}Props> = ({ className = '' }) => {
  return (
    <div className={\`${component} \${className}\`}>
      {/* TODO: Implement ${component} */}
    </div>
  )
}
EOF
done

for component in "${exam_components[@]}"; do
cat > "src/components/exam/${component}.tsx" << EOF
import React from 'react'

interface ${component}Props {
  className?: string
}

export const ${component}: React.FC<${component}Props> = ({ className = '' }) => {
  return (
    <div className={\`${component} \${className}\`}>
      {/* TODO: Implement ${component} */}
    </div>
  )
}
EOF
done

for component in "${analytics_components[@]}"; do
cat > "src/components/analytics/${component}.tsx" << EOF
import React from 'react'

interface ${component}Props {
  className?: string
}

export const ${component}: React.FC<${component}Props> = ({ className = '' }) => {
  return (
    <div className={\`${component} \${className}\`}>
      {/* TODO: Implement ${component} */}
    </div>
  )
}
EOF
done

print_success "Component placeholders created"

# Step 3: Create page components
print_step "Creating page components..."

pages=("HomePage" "ProvidersPage" "ExamsPage" "StudyPage" "CrossProviderStudyPage" "ReviewPage" "AnalyticsPage" "SettingsPage" "NotFoundPage" "DashboardPage")
for page in "${pages[@]}"; do
cat > "src/pages/${page}.tsx" << EOF
import React from 'react'

export const ${page}: React.FC = () => {
  return (
    <div className="${page}">
      <h1>${page}</h1>
      {/* TODO: Implement ${page} */}
    </div>
  )
}

export default ${page}
EOF
done

print_success "Page components created"

# Step 4: Create custom hooks
print_step "Creating custom hooks..."

hooks=("useStudySession" "useQuestionData" "usePerformanceAnalytics" "useLocalStorage" "useTimer" "useKeyboardShortcuts" "useOfflineStatus" "useExamProviders" "useCrossProviderAnalytics" "useMultiExamSession" "useProviderComparison")
for hook in "${hooks[@]}"; do
cat > "src/hooks/${hook}.ts" << EOF
// ${hook} - Custom React Hook
import { useState, useEffect } from 'react'

export const ${hook} = () => {
  // TODO: Implement ${hook}
  const [state, setState] = useState(null)
  
  useEffect(() => {
    // Hook logic here
  }, [])
  
  return {
    // Hook return values
  }
}
EOF
done

print_success "Custom hooks created"

# Step 5: Create service files
print_step "Creating service layer..."

services=("dataService" "analyticsService" "storageService" "topicService" "validationService" "exportService" "notificationService" "providerService" "examService" "crossProviderAnalyticsService" "multiExamSessionService")
for service in "${services[@]}"; do
cat > "src/services/${service}.ts" << EOF
// ${service} - Business Logic Service

export class ${service^} {
  // TODO: Implement ${service^} methods
  
  constructor() {
    // Service initialization
  }
}

export const ${service} = new ${service^}()
EOF
done

print_success "Services created"

# Step 6: Create type definitions
print_step "Creating TypeScript type definitions..."

types=("study" "analytics" "api" "ui" "global" "providers" "exams" "multiExam" "crossProvider")
for type in "${types[@]}"; do
cat > "src/types/${type}.ts" << EOF
// ${type^} Type Definitions

// TODO: Define ${type} related types and interfaces

export interface ${type^}Data {
  // Type definition placeholder
}
EOF
done

# Create main types index
cat > src/types/index.ts << 'EOF'
// Types Barrel Export
export * from './study'
export * from './analytics'
export * from './api'
export * from './ui'
export * from './global'
export * from './providers'
export * from './exams'
export * from './multiExam'
export * from './crossProvider'
EOF

print_success "Type definitions created"

# Step 7: Create test infrastructure
print_step "Creating test infrastructure..."

mkdir -p tests/{unit,integration,e2e,mocks,__snapshots__}
mkdir -p tests/unit/{components,services,hooks,utils}
mkdir -p tests/mocks/fixtures

# Test setup file
cat > tests/setup.ts << 'EOF'
// Test Environment Setup
import { beforeAll, afterEach, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'

// Global test setup
beforeAll(() => {
  // Setup before all tests
})

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Cleanup after all tests
afterAll(() => {
  // Global cleanup
})
EOF

# Mock data files
cat > tests/mocks/mockQuestions.ts << 'EOF'
// Mock Question Data for Testing
import { StudyQuestion } from '@/types'

export const mockQuestions: StudyQuestion[] = [
  // TODO: Add mock question data
]
EOF

cat > tests/mocks/fixtures/questions.json << 'EOF'
{
  "questions": [
    {
      "id": "test-1",
      "questionText": "Test question",
      "options": [],
      "correctAnswers": []
    }
  ]
}
EOF

print_success "Test infrastructure created"

# Step 8: Install additional dependencies and finalize setup
print_step "Installing additional dependencies..."

# Install additional packages needed for the implementation
npm install zustand @heroicons/react date-fns clsx react-router-dom react-hot-toast workbox-precaching workbox-routing

# Install development dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

print_success "Dependencies installed"

# Update package.json scripts
print_step "Updating package.json scripts..."

# Create a temporary script to update package.json
node << 'EOF'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Add custom scripts
pkg.scripts = {
  ...pkg.scripts,
  'test': 'vitest',
  'test:ui': 'vitest --ui',
  'test:coverage': 'vitest --coverage',
  'build:analyze': 'npm run build && npx vite-bundle-analyzer dist',
  'type-check': 'tsc --noEmit',
  'lint:fix': 'eslint . --fix',
  'format': 'prettier --write .',
  'scaffold': 'bash scripts/init-app.sh'
};

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
EOF

print_success "Package.json updated"

# Create .env.example file
cat > .env.example << 'EOF'
# Multi-Exam Certification Study Platform Environment Variables

# Application Configuration
VITE_APP_TITLE="Multi-Exam Certification Study Platform"
VITE_APP_VERSION="1.0.0"
VITE_APP_DESCRIPTION="Comprehensive certification study platform supporting multiple providers"

# Feature Flags
VITE_ENABLE_MULTI_EXAM=true
VITE_ENABLE_CROSS_PROVIDER=true
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_PWA=true
VITE_ENABLE_NOTIFICATIONS=true
VITE_ENABLE_DARK_MODE=true

# Development Settings
VITE_DEBUG_MODE=false
VITE_MOCK_DATA=false
VITE_LOG_LEVEL=info

# External Services
VITE_ANALYTICS_ID=
VITE_SENTRY_DSN=

# Provider Documentation URLs
VITE_AWS_DOCS_BASE_URL=https://docs.aws.amazon.com
VITE_AZURE_DOCS_BASE_URL=https://docs.microsoft.com/azure
VITE_GCP_DOCS_BASE_URL=https://cloud.google.com/docs
VITE_COMPTIA_DOCS_BASE_URL=https://www.comptia.org
VITE_CISCO_DOCS_BASE_URL=https://www.cisco.com/certification

# API Configuration
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_API_TIMEOUT=10000

# Provider Integration
VITE_DEFAULT_PROVIDER=aws
VITE_MAX_CROSS_PROVIDER_QUESTIONS=50
EOF

# Create Vitest configuration
cat > vitest.config.ts << 'EOF'
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
EOF

# Update tsconfig.json to include path aliases
node << 'EOF'
const fs = require('fs');
const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));

tsconfig.compilerOptions = {
  ...tsconfig.compilerOptions,
  paths: {
    "@/*": ["./src/*"],
    "@/components/*": ["./src/components/*"],
    "@/hooks/*": ["./src/hooks/*"],
    "@/services/*": ["./src/services/*"],
    "@/utils/*": ["./src/utils/*"],
    "@/types/*": ["./src/types/*"],
    "@/store/*": ["./src/store/*"],
    "@/data/*": ["./src/data/*"]
  }
};

fs.writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 2));
EOF

# Update vite.config.ts to include path aliases
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/store': path.resolve(__dirname, './src/store'),
      '@/data': path.resolve(__dirname, './src/data'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
EOF

echo ""
echo -e "${GREEN}🎉 Application scaffolding complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Configure multi-provider data sources in src/data/"
echo "2. Set up environment variables: cp .env.example .env"
echo "3. Start development server: npm run dev" 
echo "4. Begin implementing Phase 1 of the multi-exam implementation plan"
echo ""
echo "Available scripts:"
echo "  npm run dev          - Start development server"
echo "  npm run build        - Build for production"
echo "  npm run test         - Run tests"
echo "  npm run type-check   - Check TypeScript types"
echo "  npm run lint:fix     - Fix ESLint issues"
echo ""
echo "Documentation available in docs/ folder"
echo "Project structure created according to docs/PROJECT_STRUCTURE.md"
echo ""
print_success "Ready to begin development!"