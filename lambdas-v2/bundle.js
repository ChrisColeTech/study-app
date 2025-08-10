#!/usr/bin/env node

const esbuild = require('esbuild');
const glob = require('glob');
const path = require('path');
const fs = require('fs');

// Lambda function entry points
const lambdaEntries = {
  'token-authorizer': './src/token-authorizer.ts',
  'auth-handler': './src/handlers/auth-handler.ts',
  'provider-handler': './src/handlers/provider-handler.ts',
  'exam-handler': './src/handlers/exam-handler.ts',
  'question-handler': './src/handlers/question-handler.ts',
  'session-handler': './src/handlers/session-handler.ts',
  'goal-handler': './src/handlers/goal-handler.ts',
  'analytics-handler': './src/handlers/analytics-handler.ts',
  'health-handler': './src/handlers/health-handler.ts'
};

// Common esbuild configuration
const commonConfig = {
  bundle: true,
  minify: true,
  sourcemap: true,
  target: 'es2020',
  platform: 'node',
  format: 'cjs',
  external: [
    // AWS SDK is available in Lambda runtime
    'aws-sdk',
    '@aws-sdk/*',
    // Test mocks should not be bundled
    'mock-aws-s3',
    'nock'
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  }
};

async function bundleLambdas() {
  console.log('🏗️  Building Lambda functions with esbuild...');
  
  // Clean bundles directory
  if (fs.existsSync('./bundles')) {
    fs.rmSync('./bundles', { recursive: true });
  }
  fs.mkdirSync('./bundles', { recursive: true });

  const buildPromises = Object.entries(lambdaEntries).map(async ([name, entry]) => {
    const outputDir = `./bundles/${name}`;
    
    try {
      console.log(`📦 Bundling ${name}...`);
      
      await esbuild.build({
        ...commonConfig,
        entryPoints: [entry],
        outfile: `${outputDir}/index.js`,
        metafile: true
      });
      
      // Get bundle size info
      const stats = fs.statSync(`${outputDir}/index.js`);
      const sizeKB = (stats.size / 1024).toFixed(2);
      
      console.log(`✅ ${name}: ${sizeKB} KB`);
      
      return { name, size: sizeKB, success: true };
    } catch (error) {
      console.error(`❌ Failed to bundle ${name}:`, error.message);
      return { name, error: error.message, success: false };
    }
  });

  const results = await Promise.all(buildPromises);
  
  // Summary
  console.log('\n📊 Bundle Summary:');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  successful.forEach(result => {
    console.log(`✅ ${result.name.padEnd(25)} ${result.size.padStart(8)} KB`);
  });
  
  if (failed.length > 0) {
    console.log('\nFailed builds:');
    failed.forEach(result => {
      console.log(`❌ ${result.name}: ${result.error}`);
    });
  }
  
  const totalSize = successful.reduce((sum, result) => sum + parseFloat(result.size), 0);
  console.log('='.repeat(50));
  console.log(`📦 Total bundle size: ${totalSize.toFixed(2)} KB`);
  console.log(`🎯 Successfully bundled: ${successful.length}/${results.length} functions`);
  
  if (failed.length > 0) {
    process.exit(1);
  }
}

// Watch mode support
if (process.argv.includes('--watch')) {
  console.log('👀 Starting watch mode...');
  
  // TODO: Implement watch mode with chokidar if needed
  console.log('Watch mode not implemented yet. Use npm run build:watch for TypeScript watching.');
} else {
  bundleLambdas().catch(error => {
    console.error('Bundle process failed:', error);
    process.exit(1);
  });
}