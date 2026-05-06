const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
// These environment variables will be set in Vercel's dashboard later
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
);

module.exports = { supabase };
