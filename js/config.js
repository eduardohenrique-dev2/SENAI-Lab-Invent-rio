const INVENTARIO_CONFIG = Object.freeze({
  supabaseUrl: "https://lnzcrdyqqumvrlgbcofd.supabase.co",
  supabasePublishableKey: "sb_publishable_Fc3j2jCiD5FN8l1t6dI4Rg_9WqeVLWP",
  hcaptchaSiteKey: "99b6aeca-0a42-4d56-b8be-06f0e2c068f6",
  storageBucket: "inventario-arquivos",
  appName: "SENAI Lab Inventário",
  realtimeFallbackMs: 30000
});

let inventarioSupabaseClient = null;

function obterInventarioSupabase() {
  if (!window.supabase?.createClient) {
    throw new Error("Cliente do Supabase não carregado.");
  }

  if (!inventarioSupabaseClient) {
    inventarioSupabaseClient = window.supabase.createClient(
      INVENTARIO_CONFIG.supabaseUrl,
      INVENTARIO_CONFIG.supabasePublishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
        realtime: {
          params: { eventsPerSecond: 10 }
        }
      }
    );
  }

  return inventarioSupabaseClient;
}
