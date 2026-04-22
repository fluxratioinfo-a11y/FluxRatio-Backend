import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * CORS antraštės – būtinos, kad jūsų testas.html galėtų susikalbėti su serveriu
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Apdorojame naršyklės užklausą (Preflight)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 2. Saugus kintamųjų gavimas
    const PROJECT_URL = Deno.env.get('PROJECT_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY nerastas nustatymuose.")

    // Inicializuojame Supabase klientą (skirta būsimiems įrašams į DB)
    const _supabase = createClient(PROJECT_URL!, SERVICE_ROLE_KEY!)

    // 3. Tikriname, ar tai failo siuntimas (POST)
    if (req.method === 'POST') {
      const formData = await req.formData()
      const file = formData.get('file') as File
      
      if (!file) {
        return new Response(JSON.stringify({ error: "PDF failas nebuvo gautas." }), 
               { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      // 4. Paverčiame PDF į tekstą (Base64) skaidydami dalimis
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      let chunks = []
      const chunkSize = 0x8000 // 32KB dalys
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        chunks.push(String.fromCharCode.apply(null, uint8Array.subarray(i, i + chunkSize)))
      }
      const base64File = btoa(chunks.join(''))

      // 5. Kreipiamės į Gemini (stabilus kanalas v1beta)
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;

      const promptText = `
        Esi vyriausiasis inžinierius. Išanalizuok šį PDF brėžinį/žiniaraštį.
        Ištrauk VISĄ įrangą, medžiagas ir kiekius.
        Suskirstyk į sistemas: EL, ER, AS, GSS, LEE, LEL, Vaizdo_stebejimas, Ieigos_kontrole.
        Pateik atsakymą TIK JSON formatu: [{"sistema": "...", "pavadinimas": "...", "mato_vnt": "...", "kiekis": 0}]
      `;

      const geminiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              { inline_data: { mime_type: "application/pdf", data: base64File } }
            ]
          }]
        })
      });

      if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        throw new Error(`Google API klaida: ${geminiResponse.status} - ${errText}`);
      }

      const result = await geminiResponse.json();
      const aiResponseText = result.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      
      // Išvalome JSON nuo galimų AI „šiukšlių“ (pvz. ```json ...)
      const cleanJson = aiResponseText.replace(/```json/g, "").replace(/```/g, "").trim();

      return new Response(JSON.stringify({ 
        status: "Analizė baigta", 
        duomenys: JSON.parse(cleanJson) 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Jei tiesiog užsukama per naršyklę (GET)
    return new Response(JSON.stringify({ status: "GSS Engine Active" }), 
           { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("KLAIDA:", error.message);
    return new Response(JSON.stringify({ error: error.message }), 
           { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
})
