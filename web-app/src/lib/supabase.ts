import { createClient } from '@/utils/supabase/client';

// This is a singleton client for use in browser components.
// It uses @supabase/ssr createBrowserClient internally.
export const supabase = createClient();
