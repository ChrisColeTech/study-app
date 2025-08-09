#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🔨 Building Study App V2 Lambda Functions...');

async function build() {
  // Step 1: TypeScript compilation
  console.log('1️⃣ Compiling TypeScript...');
  await runCommand('npx', ['tsc']);
  
  // Step 2: Bundle individual Lambda functions
  console.log('2️⃣ Bundling Lambda functions...');
  await runCommand('node', ['bundle.js']);
  
  console.log('✅ Build complete!');
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', reject);
  });
}

// Watch mode support
if (process.argv.includes('--watch')) {
  console.log('👀 Starting watch mode...');
  console.log('This will watch TypeScript files and rebuild on changes...');
  
  // Use TypeScript's built-in watch mode
  runCommand('npx', ['tsc', '--watch']).catch(error => {
    console.error('Watch mode failed:', error);
    process.exit(1);
  });
} else {
  build().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
  });
}