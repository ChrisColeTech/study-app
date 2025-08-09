#!/usr/bin/env node

/**
 * Simple API Test Script for Study App V2
 * Tests the provider and question handlers with the new S3 implementation
 */

const { handler: providerHandler } = require('./bundles/provider-handler/index.js');
const { handler: questionHandler } = require('./bundles/question-handler/index.js');

// Mock API Gateway event
function createMockEvent(httpMethod = 'GET', resource = '/providers', queryStringParameters = null, pathParameters = null) {
  return {
    httpMethod,
    resource,
    path: resource,
    queryStringParameters,
    pathParameters,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'test-script/1.0'
    },
    body: null,
    isBase64Encoded: false,
    requestContext: {
      requestId: 'test-request-' + Date.now(),
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-script/1.0'
      },
      authorizer: {
        userId: 'test-user-123'
      }
    }
  };
}

async function testProviderAPI() {
  console.log('🧪 Testing Provider API...\n');

  try {
    // Test 1: Get all providers
    console.log('1️⃣ Testing GET /providers');
    const event1 = createMockEvent('GET', '/providers');
    const response1 = await providerHandler(event1);
    
    console.log(`   Status: ${response1.statusCode}`);
    console.log(`   Headers: ${JSON.stringify(response1.headers)}`);
    
    if (response1.statusCode === 200) {
      const data = JSON.parse(response1.body);
      console.log(`   ✅ Success: Found ${data.data?.totalProviders || 0} providers`);
      console.log(`   📊 Stats: ${data.data?.totalExams || 0} total exams`);
    } else {
      const error = JSON.parse(response1.body);
      console.log(`   ❌ Error: ${error.error || 'Unknown error'}`);
    }

    // Test 2: Get specific provider
    console.log('\n2️⃣ Testing GET /providers/aws');
    const event2 = createMockEvent('GET', '/providers/{providerId}', null, { providerId: 'aws' });
    const response2 = await providerHandler(event2);
    
    console.log(`   Status: ${response2.statusCode}`);
    
    if (response2.statusCode === 200) {
      const data = JSON.parse(response2.body);
      console.log(`   ✅ Success: Found provider '${data.data?.name || 'unknown'}'`);
      console.log(`   📚 Exams: ${data.data?.exams?.length || 0} available`);
    } else {
      const error = JSON.parse(response2.body);
      console.log(`   ❌ Error: ${error.error || 'Unknown error'}`);
    }

  } catch (error) {
    console.error('❌ Provider API test failed:', error.message);
  }
}

async function testQuestionAPI() {
  console.log('\n🧪 Testing Question API...\n');

  try {
    // Test 1: Get questions with default parameters
    console.log('1️⃣ Testing GET /questions (default params)');
    const event1 = createMockEvent('GET', '/questions', { 
      provider: 'aws', 
      exam: 'saa-c03', 
      limit: '5' 
    });
    const response1 = await questionHandler(event1);
    
    console.log(`   Status: ${response1.statusCode}`);
    
    if (response1.statusCode === 200) {
      const data = JSON.parse(response1.body);
      console.log(`   ✅ Success: Found ${data.data?.totalCount || 0} total questions`);
      console.log(`   📝 Returned: ${data.data?.questions?.length || 0} questions`);
      console.log(`   📊 Has more: ${data.data?.hasMore ? 'Yes' : 'No'}`);
      
      if (data.data?.filters) {
        console.log(`   🏷️ Topics available: ${data.data.filters.availableTopics?.length || 0}`);
        console.log(`   🔧 Services available: ${data.data.filters.availableAwsServices?.length || 0}`);
      }
    } else {
      const error = JSON.parse(response1.body);
      console.log(`   ❌ Error: ${error.error || 'Unknown error'}`);
    }

    // Test 2: Get questions with filtering
    console.log('\n2️⃣ Testing GET /questions (with difficulty filter)');
    const event2 = createMockEvent('GET', '/questions', { 
      provider: 'aws', 
      exam: 'saa-c03', 
      difficulty: 'easy',
      limit: '3'
    });
    const response2 = await questionHandler(event2);
    
    console.log(`   Status: ${response2.statusCode}`);
    
    if (response2.statusCode === 200) {
      const data = JSON.parse(response2.body);
      console.log(`   ✅ Success: Found ${data.data?.questions?.length || 0} easy questions`);
    } else {
      const error = JSON.parse(response2.body);
      console.log(`   ❌ Error: ${error.error || 'Unknown error'}`);
    }

    // Test 3: Get question statistics
    console.log('\n3️⃣ Testing GET /questions/stats');
    const event3 = createMockEvent('GET', '/questions/stats', { 
      provider: 'aws', 
      exam: 'saa-c03' 
    });
    const response3 = await questionHandler(event3);
    
    console.log(`   Status: ${response3.statusCode}`);
    
    if (response3.statusCode === 200) {
      const data = JSON.parse(response3.body);
      console.log(`   ✅ Success: Got question statistics`);
      console.log(`   📊 Total questions: ${data.data?.totalQuestions || 0}`);
      console.log(`   📝 With explanations: ${data.data?.hasExplanationCount || 0}`);
      
      if (data.data?.difficultyDistribution) {
        console.log(`   🎯 Difficulty breakdown:`);
        Object.entries(data.data.difficultyDistribution).forEach(([key, value]) => {
          console.log(`      - ${key}: ${value}`);
        });
      }
    } else {
      const error = JSON.parse(response3.body);
      console.log(`   ❌ Error: ${error.error || 'Unknown error'}`);
    }

  } catch (error) {
    console.error('❌ Question API test failed:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Study App V2 API Integration Tests\n');
  console.log('📝 Note: These tests use the default fallback data since S3 is not configured\n');
  console.log('='*70);

  await testProviderAPI();
  await testQuestionAPI();

  console.log('\n' + '='*70);
  console.log('✅ Integration tests completed!');
  console.log('\n📋 Next Steps:');
  console.log('   1. Upload migrated data to S3 using: ./migrated-data/UPLOAD_INSTRUCTIONS.md');
  console.log('   2. Configure environment variables for S3 bucket and DynamoDB table');
  console.log('   3. Deploy the Lambda functions');
  console.log('   4. Test with real S3 data');
}

// Run the tests
runTests().catch(console.error);