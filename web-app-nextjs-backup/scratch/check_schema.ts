import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error fetching fixtures:', error);
  } else {
    console.log('Fixtures schema:', Object.keys(fixtures[0] || {}));
    console.log('Sample fixture:', fixtures[0]);
  }

  const { data: events, error: err2 } = await supabase
    .from('player_live_points')
    .select('*')
    .limit(1);

  if (err2) {
    console.error('Error fetching events:', err2);
  } else {
    console.log('Events schema:', Object.keys(events[0] || {}));
  }

  const { data: teams, error: err3 } = await supabase
    .from('teams')
    .select('*')
    .limit(1);

  if (err3) {
    console.error('Error fetching teams:', err3);
  } else {
    console.log('Teams schema:', Object.keys(teams[0] || {}));
    console.log('Sample team:', teams[0]);
  }
}

checkSchema();
