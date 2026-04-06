import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const PROJECT_URL = Deno.env.get('PROJECT_URL')
  const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
  
  const supabase = createClient(PROJECT_URL!, SERVICE_ROLE_KEY!)

  return new Response(JSON.stringify({ 
    status: "GSS Engine Active",
    message: "Ryšys su Supabase ir Gemini paruoštas" 
  }), {
    headers: { "Content-Type": "application/json" },
  })
})
