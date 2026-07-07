#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function deployRules() {
  try {
    const rulesPath = path.join(process.cwd(), 'firebase-rules.json');
    
    if (!fs.existsSync(rulesPath)) {
      console.error('❌ firebase-rules.json not found');
      process.exit(1);
    }

    console.log('📋 Reading Firebase rules...');
    const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
    const rules = JSON.parse(rulesContent);

    console.log('🔧 Deploying rules to Firebase...');
    const projectId = 'siapel-ed2b0';
    
    console.log(`\n📡 Using project: ${projectId}`);
    console.log('📋 Rules to deploy:');
    console.log('  - attendance');
    console.log('  - apel');
    console.log('  - qr');
    console.log('  - pengajuan');
    console.log('  - activeSessions');
    console.log('  - fingerprints');
    console.log('  - pegawai_passwords');
    console.log('  - master_pegawai');

    try {
      await execAsync(`firebase deploy --only database --project ${projectId}`, {
        cwd: process.cwd(),
        stdio: 'inherit'
      });
      
      console.log('\n✅ Firebase rules deployed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Firebase CLI deployment failed');
      console.log('\n📌 Alternative: Manual deployment via Firebase Console');
      console.log('1. Go to https://console.firebase.google.com');
      console.log('2. Select project: siapel-ed2b0');
      console.log('3. Navigate to Realtime Database > Rules tab');
      console.log('4. Copy and paste the contents of firebase-rules.json');
      console.log('5. Click "Publish"');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deployRules();
