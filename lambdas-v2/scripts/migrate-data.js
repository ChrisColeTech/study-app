#!/usr/bin/env node

/**
 * Data Migration Script for Study App V2
 * 
 * Migrates the 681 AWS SAA-C03 questions from study_data_final.json
 * to the proper S3 structure for the V2 backend.
 * 
 * Usage: node scripts/migrate-data.js
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

console.log('🚀 Starting Study App V2 Data Migration...\n');

// File paths
const sourceFile = path.join(__dirname, '../../data/study_data_final.json');
const outputDir = path.join(__dirname, '../migrated-data');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Load source data
console.log('📖 Loading source data from study_data_final.json...');
let sourceData;
try {
  const rawData = fs.readFileSync(sourceFile, 'utf8');
  sourceData = JSON.parse(rawData);
  console.log(`✅ Loaded ${sourceData.study_data.length} questions from source file`);
} catch (error) {
  console.error('❌ Failed to load source data:', error.message);
  process.exit(1);
}

// Convert raw question data to Question interface
function convertRawToQuestion(raw, provider, exam) {
  return {
    questionId: uuidv4(),
    questionNumber: raw.question_number,
    provider,
    exam,
    text: raw.question.text,
    options: raw.question.options,
    questionType: raw.question.question_type,
    expectedAnswers: raw.question.expected_answers,
    correctAnswer: raw.answer?.correct_answer || '',
    explanation: raw.answer?.explanation,
    difficulty: raw.study_metadata?.difficulty || 'medium',
    topics: raw.question.topic ? [raw.question.topic] : [],
    serviceCategory: raw.question.service_category,
    awsServices: raw.question.aws_services || [],
    keywords: raw.answer?.keywords || [],
    createdAt: new Date().toISOString(),
    parsingConfidence: raw.answer?.parsing_confidence,
    hasExplanation: raw.study_metadata?.has_explanation || false
  };
}

// Process questions
console.log('🔄 Converting questions to V2 format...');
const convertedQuestions = sourceData.study_data.map(raw => 
  convertRawToQuestion(raw, 'aws', 'saa-c03')
);

// Create provider metadata
console.log('📊 Creating provider metadata...');
const providers = [
  {
    id: 'aws',
    name: 'Amazon Web Services',
    description: 'Cloud computing platform and services',
    exams: [
      {
        id: 'saa-c03',
        name: 'Solutions Architect Associate',
        description: 'Validates ability to design distributed systems on AWS',
        questionCount: convertedQuestions.length,
        duration: 130,
        passingScore: 720
      },
      {
        id: 'dva-c01',
        name: 'Developer Associate',
        description: 'Validates ability to develop applications on AWS',
        questionCount: 0,
        duration: 130,
        passingScore: 720
      },
      {
        id: 'soa-c02',
        name: 'SysOps Administrator Associate',
        description: 'Validates ability to deploy and manage systems on AWS',
        questionCount: 0,
        duration: 130,
        passingScore: 720
      }
    ]
  },
  {
    id: 'azure',
    name: 'Microsoft Azure',
    description: 'Cloud computing platform and services',
    exams: [
      {
        id: 'az-900',
        name: 'Azure Fundamentals',
        description: 'Validates foundational knowledge of cloud services',
        questionCount: 0,
        duration: 60,
        passingScore: 700
      },
      {
        id: 'az-104',
        name: 'Azure Administrator',
        description: 'Validates skills to manage Azure subscriptions and resources',
        questionCount: 0,
        duration: 150,
        passingScore: 700
      }
    ]
  },
  {
    id: 'gcp',
    name: 'Google Cloud Platform',
    description: 'Cloud computing platform and services',
    exams: [
      {
        id: 'ace',
        name: 'Associate Cloud Engineer',
        description: 'Validates ability to deploy and manage GCP resources',
        questionCount: 0,
        duration: 120,
        passingScore: 70
      }
    ]
  }
];

// Create directory structure
console.log('📁 Creating directory structure...');
const providersDir = path.join(outputDir, 'providers');
const questionsDir = path.join(outputDir, 'questions', 'aws', 'saa-c03');

fs.mkdirSync(providersDir, { recursive: true });
fs.mkdirSync(questionsDir, { recursive: true });

// Write provider data
console.log('💾 Writing provider data...');
fs.writeFileSync(
  path.join(providersDir, 'providers.json'),
  JSON.stringify(providers, null, 2)
);

// Write individual provider files
providers.forEach(provider => {
  fs.writeFileSync(
    path.join(providersDir, `${provider.id}.json`),
    JSON.stringify(provider, null, 2)
  );
});

// Write question data
console.log('💾 Writing question data...');
fs.writeFileSync(
  path.join(questionsDir, 'questions.json'),
  JSON.stringify(convertedQuestions, null, 2)
);

// Write raw data for fallback
fs.writeFileSync(
  path.join(questionsDir, 'raw-data.json'),
  JSON.stringify({ study_data: sourceData.study_data }, null, 2)
);

// Generate statistics
console.log('📈 Generating statistics...');
const stats = {
  totalQuestions: convertedQuestions.length,
  difficultyDistribution: {},
  topicDistribution: {},
  serviceDistribution: {},
  hasExplanationCount: 0,
  questionTypeDistribution: {},
  migrationTimestamp: new Date().toISOString()
};

convertedQuestions.forEach(question => {
  // Difficulty distribution
  const difficulty = question.difficulty || 'unknown';
  stats.difficultyDistribution[difficulty] = (stats.difficultyDistribution[difficulty] || 0) + 1;

  // Topic distribution
  question.topics.forEach(topic => {
    stats.topicDistribution[topic] = (stats.topicDistribution[topic] || 0) + 1;
  });

  // Service distribution
  if (question.awsServices) {
    question.awsServices.forEach(service => {
      stats.serviceDistribution[service] = (stats.serviceDistribution[service] || 0) + 1;
    });
  }

  // Question type distribution
  stats.questionTypeDistribution[question.questionType] = 
    (stats.questionTypeDistribution[question.questionType] || 0) + 1;

  // Explanation count
  if (question.hasExplanation) {
    stats.hasExplanationCount++;
  }
});

// Write statistics
fs.writeFileSync(
  path.join(outputDir, 'migration-stats.json'),
  JSON.stringify(stats, null, 2)
);

// Create upload instructions
const uploadInstructions = `# S3 Upload Instructions

## Directory Structure
The migrated data should be uploaded to S3 with the following structure:

\`\`\`
your-bucket/
├── providers/
│   ├── providers.json          # All providers metadata
│   ├── aws.json               # AWS provider metadata
│   ├── azure.json             # Azure provider metadata
│   └── gcp.json               # GCP provider metadata
└── questions/
    └── aws/
        └── saa-c03/
            ├── questions.json  # Processed questions (${convertedQuestions.length} questions)
            └── raw-data.json   # Raw data fallback
\`\`\`

## AWS CLI Upload Commands
Assuming your S3 bucket is named 'study-app-data':

\`\`\`bash
# Upload provider data
aws s3 cp providers/ s3://study-app-data/providers/ --recursive

# Upload question data
aws s3 cp questions/ s3://study-app-data/questions/ --recursive

# Verify upload
aws s3 ls s3://study-app-data/ --recursive
\`\`\`

## Environment Variables
Make sure your Lambda functions have the following environment variable:
- S3_STUDY_DATA_BUCKET=study-app-data

## Statistics
- Total Questions: ${stats.totalQuestions}
- Questions with Explanations: ${stats.hasExplanationCount}
- Unique Topics: ${Object.keys(stats.topicDistribution).length}
- AWS Services Covered: ${Object.keys(stats.serviceDistribution).length}
`;

fs.writeFileSync(path.join(outputDir, 'UPLOAD_INSTRUCTIONS.md'), uploadInstructions);

// Print summary
console.log('\n✅ Migration completed successfully!\n');
console.log('📊 Migration Summary:');
console.log(`   • Total Questions: ${stats.totalQuestions}`);
console.log(`   • Questions with Explanations: ${stats.hasExplanationCount}`);
console.log(`   • Difficulty Distribution:`);
Object.entries(stats.difficultyDistribution).forEach(([key, value]) => {
  console.log(`     - ${key}: ${value}`);
});
console.log(`   • Question Types:`);
Object.entries(stats.questionTypeDistribution).forEach(([key, value]) => {
  console.log(`     - ${key}: ${value}`);
});
console.log(`   • Unique Topics: ${Object.keys(stats.topicDistribution).length}`);
console.log(`   • AWS Services Covered: ${Object.keys(stats.serviceDistribution).length}`);

console.log(`\n📁 Output Directory: ${outputDir}`);
console.log(`📋 Upload Instructions: ${path.join(outputDir, 'UPLOAD_INSTRUCTIONS.md')}`);
console.log(`📈 Detailed Statistics: ${path.join(outputDir, 'migration-stats.json')}`);

console.log('\n🎉 Ready for S3 upload!');