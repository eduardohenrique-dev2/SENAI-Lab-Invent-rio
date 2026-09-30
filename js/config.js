const INVENTARIO_CONFIG = Object.freeze({
  supabaseUrl: "https://lnzcrdyqqumvrlgbcofd.supabase.co",
  supabasePublishableKey: "sb_publishable_Fc3j2jCiD5FN8l1t6dI4Rg_9WqeVLWP",
  storagePublicBucket: "inventario-publico",
  storagePrivateBucket: "inventario-privado",
  publicItemPath: "/item.html",
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

/*
 * Módulos complementares são carregados daqui para manter o index.html
 * simples e permitir evoluções sem alterar a estrutura principal.
 */
(function carregarModulosInventario() {
  if (!document.querySelector('link[href="./css/importacoes.css"]')) {
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "./css/importacoes.css";
    document.head.appendChild(style);
  }

  if (!document.querySelector('script[src="./js/importacoes-v2.js?v=20260917-23"]')) {
    const script = document.createElement("script");
    script.src = "./js/importacoes-v2.js?v=20260917-23";
    script.defer = true;
    document.head.appendChild(script);
  }

  if (!document.querySelector('script[src="./js/exclusoes.js"]')) {
    const script = document.createElement("script");
    script.src = "./js/exclusoes.js";
    script.defer = true;
    document.head.appendChild(script);
  }
})();
