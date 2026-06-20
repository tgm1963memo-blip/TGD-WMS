// scripts/testResetEmail.js
import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });

import { requestPasswordReset } from '../src/services/stagingAuthService.js';

async function main() {
  const email = 'test@example.com';
  console.log('Calling requestPasswordReset for', email);
  const result = await requestPasswordReset(email);
  console.log('Result:', result);
}

main().catch(err => {
  console.error('Error running test script:', err);
});
