const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
// These environment variables will be set in Vercel's dashboard later
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://rrcrijwctafkoyoedacs.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyY3JpandjdGFma295b2VkYWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA3MzQzOCwiZXhwIjoyMDkzNjQ5NDM4fQ.XWTFI80xE20C7mVqccFpavGIzRVgP7D5QMdSDExiClQ'
);

module.exports = { supabase };
