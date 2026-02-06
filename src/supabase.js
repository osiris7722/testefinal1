import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.REACT_APP_SUPABASE_URL ||
  'https://rjuiqkbyzcimxrucoxxe.supabase.co';
const supabaseAnonKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqdWlxa2J5emNpbXhydWNveHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODIxNTUsImV4cCI6MjA4NTk1ODE1NX0.UqRdTBR6qxpZ0Mp4wJdapUj4JmADqQhm6bhW0UzGI5Y';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export const supabaseProjectId = supabaseUrl
  ? supabaseUrl.replace('https://', '').split('.')[0]
  : '';
