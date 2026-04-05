/**
 * verify-admin-user.js
 * 
 * Diagnostic script to verify admin user exists in Supabase and provision if needed.
 * 
 * Usage:
 *   node scripts/verify-admin-user.js [action]
 *   
 * Actions:
 *   verify     - Check if admin exists in Supabase (default)
 *   provision  - Create admin user in user_profiles if missing
 *   sync       - Sync admin user between auth and database
 * 
 * Requirements:
 *   - .env file with Supabase credentials
 *   - Node.js 18+
 * 
 * Example:
 *   node scripts/verify-admin-user.js verify   # Check if admin exists
 *   node scripts/verify-admin-user.js provision # Create admin if missing
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_USERNAME = process.env.VITE_ADMIN_USERNAME;
const ADMIN_EMAIL = process.env.VITE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.VITE_ADMIN_PASSWORD;

// Validate required environment variables
const validateEnv = () => {
  const missing = [];
  if (!SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY');
  if (!ADMIN_USERNAME) missing.push('VITE_ADMIN_USERNAME');
  if (!ADMIN_PASSWORD) missing.push('VITE_ADMIN_PASSWORD');
  
  if (missing.length > 0) {
    console.error('\n❌ CRITICAL ERROR: Missing required environment variables');
    console.error('   Missing:', missing.join(', '));
    console.error('   Please set these in your .env file\n');
    process.exit(1);
  }
  
  // Email is optional with default
  if (!ADMIN_EMAIL) {
    console.warn('⚠️  WARNING: VITE_ADMIN_EMAIL not set - using default');
  }
};

validateEnv();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyAdmin() {
  console.log('\n🔍 Verifying admin user in Supabase...\n');
  
  try {
    // Check in user_profiles table
    console.log('📋 Checking user_profiles table...');
    const { data: dbAdmin, error: dbError } = await supabase
      .from('user_profiles')
      .select('id, username, email, role, status, created_at')
      .eq('role', 'Administrator')
      .maybeSingle();

    if (dbError) {
      console.error('❌ Error querying user_profiles:', dbError.message);
      return false;
    }

    if (dbAdmin) {
      console.log('✅ Admin found in user_profiles table:');
      console.log('   Username:', dbAdmin.username);
      console.log('   Email:', dbAdmin.email);
      console.log('   Status:', dbAdmin.status);
      console.log('   Created:', new Date(dbAdmin.created_at).toLocaleString());
      return true;
    } else {
      console.warn('⚠️  No admin user found in user_profiles table');
      return false;
    }
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    return false;
  }
}

async function provisionAdmin() {
  console.log('\n📝 Provisioning admin user in Supabase...\n');
  
  try {
    // First check if admin already exists
    const exists = await verifyAdmin();
    if (exists) {
      console.log('\n✅ Admin already exists. Skipping provisioning.');
      return true;
    }

    console.log('➕ Creating admin user in user_profiles table...');
    
    // Generate a UUID for the admin (using a deterministic pattern for consistency)
    // In production, this would be tied to the auth user ID
    const adminId = crypto.randomUUID ? crypto.randomUUID() : 'admin-' + Date.now();

    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: adminId,
        username: ADMIN_USERNAME,
        email: ADMIN_EMAIL,
        password_hash: 'SUPABASE_AUTH',
        role: 'Administrator',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error('❌ Error provisioning admin:', error.message);
      console.error('   Details:', error);
      return false;
    }

    console.log('✅ Admin user provisioned successfully:');
    console.log('   ID:', adminId);
    console.log('   Username:', ADMIN_USERNAME);
    console.log('   Email:', ADMIN_EMAIL);
    console.log('\n💡 Admin credentials configured in .env:');
    console.log('   VITE_ADMIN_USERNAME=' + ADMIN_USERNAME);
    console.log('   VITE_ADMIN_EMAIL=' + ADMIN_EMAIL);
    console.log('   VITE_ADMIN_PASSWORD=[configured in .env]');
    
    return true;
  } catch (error) {
    console.error('❌ Error during provisioning:', error.message);
    return false;
  }
}

async function syncAdmin() {
  console.log('\n🔄 Syncing admin user credentials...\n');
  
  try {
    // Check current admin in database
    const { data: dbAdmin, error: dbError } = await supabase
      .from('user_profiles')
      .select('id, username, email')
      .eq('role', 'Administrator')
      .maybeSingle();

    if (dbError || !dbAdmin) {
      console.warn('⚠️  No admin found in database. Run "provision" first.');
      return false;
    }

    // Update email if it doesn't match environment config
    if (dbAdmin.email !== ADMIN_EMAIL) {
      console.log(`⚠️  Email mismatch detected:`);
      console.log(`   Database: ${dbAdmin.email}`);
      console.log(`   .env:     ${ADMIN_EMAIL}`);
      
      console.log('✏️  Updating database email to match .env...');
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ email: ADMIN_EMAIL, updated_at: new Date().toISOString() })
        .eq('id', dbAdmin.id);

      if (updateError) {
        console.error('❌ Error updating email:', updateError.message);
        return false;
      }
      console.log('✅ Email updated successfully');
    }

    // Update username if it doesn't match
    if (dbAdmin.username !== ADMIN_USERNAME) {
      console.log(`⚠️  Username mismatch detected:`);
      console.log(`   Database: ${dbAdmin.username}`);
      console.log(`   .env:     ${ADMIN_USERNAME}`);
      
      console.log('✏️  Updating database username to match .env...');
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ username: ADMIN_USERNAME, updated_at: new Date().toISOString() })
        .eq('id', dbAdmin.id);

      if (updateError) {
        console.error('❌ Error updating username:', updateError.message);
        return false;
      }
      console.log('✅ Username updated successfully');
    }

    if (dbAdmin.email === ADMIN_EMAIL && dbAdmin.username === ADMIN_USERNAME) {
      console.log('✅ Admin credentials are in sync');
    }

    return true;
  } catch (error) {
    console.error('❌ Error during sync:', error.message);
    return false;
  }
}

async function main() {
  const action = process.argv[2] || 'verify';

  console.log(`
╔════════════════════════════════════════════════════════════╗
║         Supabase Admin User Verification Tool              ║
╚════════════════════════════════════════════════════════════╝

Supabase URL: ${SUPABASE_URL}
Admin Username: ${ADMIN_USERNAME}
Admin Email: ${ADMIN_EMAIL}
  `);

  let success = false;

  switch (action.toLowerCase()) {
    case 'verify':
      success = await verifyAdmin();
      break;
    case 'provision':
      success = await provisionAdmin();
      break;
    case 'sync':
      success = await syncAdmin();
      break;
    default:
      console.error(`❌ Unknown action: ${action}`);
      console.log('\nAvailable actions: verify, provision, sync');
      process.exit(1);
  }

  console.log(success ? '\n✅ Operation completed successfully\n' : '\n❌ Operation failed\n');
  process.exit(success ? 0 : 1);
}

main();
