const INVENTARIO_CONFIG = Object.freeze({
  supabaseUrl: "https://lnzcrdyqqumvrlgbcofd.supabase.co",
  supabasePublishableKey: "sb_publishable_Fc3j2jCiD5FN8l1t6dI4Rg_9WqeVLWP",
  hcaptchaSiteKey: "99b6aeca-0a42-4d56-b8be-06f0e2c068f6",
  storagePublicBucket: "inventario-publico",
  storagePrivateBucket: "inventario-privado",
  publicItemPath: "/item.html",
  appName: "SENAI Lab Inventário",
  realtimeFallbackMs: 30000
});

const INVENTARIO_CAPTCHA_FALLBACK_TOKEN = "__senai_lab_captcha_unavailable__";

let inventarioSupabaseClient = null;

/*
 * Alguns navegadores móveis, bloqueadores de conteúdo, VPNs e redes
 * corporativas impedem o carregamento do hCaptcha. O frontend não deve
 * impedir o envio do login nesses casos: o Supabase Auth continua sendo
 * a autoridade final e, caso CAPTCHA esteja obrigatório no servidor,
 * a autenticação será recusada normalmente.
 *
 * Este stub existe apenas para evitar que a validação local do app.js
 * bloqueie a tentativa antes que ela chegue ao Supabase. Se o hCaptcha
 * carregar normalmente, a biblioteca substitui window.hcaptcha e o token
 * real continua sendo utilizado.
 */
if (!window.hcaptcha?.getResponse) {
  window.hcaptcha = {
    getResponse() {
      return INVENTARIO_CAPTCHA_FALLBACK_TOKEN;
    },
    reset() {}
  };
}

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

    const auth = inventarioSupabaseClient.auth;
    const signInWithPasswordOriginal = auth.signInWithPassword.bind(auth);

    auth.signInWithPassword = credentials => {
      const captchaToken = String(credentials?.options?.captchaToken || "");

      if (captchaToken === INVENTARIO_CAPTCHA_FALLBACK_TOKEN) {
        return signInWithPasswordOriginal({
          email: credentials?.email,
          password: credentials?.password
        });
      }

      return signInWithPasswordOriginal(credentials);
    };
  }

  return inventarioSupabaseClient;
}
