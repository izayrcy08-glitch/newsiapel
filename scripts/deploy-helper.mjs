#!/usr/bin/env node

import { execSync } from 'child_process';

console.log('🔐 Firebase Rules Deployment Helper');
console.log('====================================\n');

console.log('📋 Step 1: Checking Firebase CLI authentication...\n');

try {
  const loginStatus = execSync('firebase login:list', { encoding: 'utf-8' });
  
  if (loginStatus.includes('No authorized accounts')) {
    console.log('❌ Not authenticated with Firebase CLI');
    console.log('\n🔑 Step 2: Please authenticate with Firebase\n');
    console.log('Run the following command and complete the authentication:');
    console.log('   firebase login\n');
    console.log('This will open your browser to sign in with your Google account.\n');
    console.log('📌 Make sure to use the account that has access to the siapel-ed2b0 project!\n');
    
    console.log('After authentication, run:');
    console.log('   npm run firebase:deploy-rules\n');
    process.exit(1);
  } else {
    console.log('✅ Already authenticated');
    console.log(loginStatus);
  }
} catch (error) {
  console.error('❌ Error checking authentication:', error.message);
  process.exit(1);
}

console.log('\n📡 Step 3: Deploying Firebase Rules...\n');

try {
  execSync('firebase deploy --only database --project siapel-ed2b0', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('\n✅ Firebase rules deployed successfully!');
  console.log('\n🔄 Next steps:');
  console.log('1. Clear browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)');
  console.log('2. Close and reopen the app in your browser');
  console.log('3. Login again and test the scanner');
  console.log('4. Check browser console for any remaining permission errors\n');
  
} catch (error) {
  console.error('❌ Deployment failed');
  console.error(error.message);
  console.log('\n💡 Troubleshooting:');
  console.log('1. Make sure you\'re authenticated: firebase login');
  console.log('2. Check project ID: firebase projects:list');
  console.log('3. Try deploying manually: firebase deploy --only database --debug\n');
  process.exit(1);
}
