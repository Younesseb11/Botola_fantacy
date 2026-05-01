import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

const logoMapping: Record<string, string> = {
  "Wydad AC": "https://tmssl.akamaized.net/images/wappen/head/6603.png",
  "Berkane": "https://tmssl.akamaized.net/images/wappen/head/37176.png",
  "FAR Rabat": "https://tmssl.akamaized.net/images/wappen/head/9099.png",
  "Raja Casablanca": "https://tmssl.akamaized.net/images/wappen/head/2068.png",
  "Maghreb Fez": "https://tmssl.akamaized.net/images/wappen/head/3282.png",
  "FUS Rabat": "https://tmssl.akamaized.net/images/wappen/head/6371.png",
  "Union Touarga": "https://tmssl.akamaized.net/images/wappen/head/79389.png",
  "Hassania Agadir": "https://tmssl.akamaized.net/images/wappen/head/22935.png",
  "Olympique de Safi": "https://tmssl.akamaized.net/images/wappen/head/22944.png",
  "COD Meknes": "https://tmssl.akamaized.net/images/wappen/head/30625.png",
  "Renaissance Zemamra": "https://tmssl.akamaized.net/images/wappen/head/74953.png",
  "IR Tanger": "https://tmssl.akamaized.net/images/wappen/head/12721.png",
  "Kawkab Marrakech": "https://tmssl.akamaized.net/images/wappen/head/4697.png",
  "Difaa El Jadidi": "https://tmssl.akamaized.net/images/wappen/head/14462.png",
  "Yacoub El Mansour": "https://tmssl.akamaized.net/images/wappen/head/103954.png",
  "Dcheira": "https://tmssl.akamaized.net/images/wappen/head/13763.png" // Guessing ID for Dcheira JS
};

async function populateLogos() {
  console.log("Starting logo population...");
  
  // 1. Fetch all teams to avoid name mismatch issues
  const { data: dbTeams, error: fetchErr } = await supabase
    .from('teams')
    .select('id, name');

  if (fetchErr) {
    console.error("Error fetching teams:", fetchErr.message);
    return;
  }

  console.log(`Found ${dbTeams?.length} teams in DB.`);

  for (const team of (dbTeams || [])) {
    const logoUrl = logoMapping[team.name];
    
    if (logoUrl) {
      const { error: updateErr } = await supabase
        .from('teams')
        .update({ logo_url: logoUrl })
        .eq('id', team.id);
      
      if (updateErr) {
        console.error(`Error updating ${team.name}:`, updateErr.message);
      } else {
        console.log(`✓ Updated ${team.name}`);
      }
    } else {
      console.warn(`! No logo mapping for team: ${team.name}`);
    }
  }
  
  console.log("Logo population complete.");
}

populateLogos();
