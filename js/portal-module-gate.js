(() => {
  "use strict";

  const PORTAL_URL = "https://portal-afonso-greco.vercel.app/app.html";
  const FIRST_ACCESS_URL = "https://portal-afonso-greco.vercel.app/primeiro-acesso.html";
  let checking = false;

  function client() {
    try { return obterInventarioSupabase(); }
    catch (_) { return null; }
  }

  async function verify(session) {
    if (checking || !session?.user) return;
    checking = true;

    try {
      const supabase = client();
      if (!supabase) {
        deny("Não foi possível validar o acesso central.");
        return;
      }

      const state = await supabase.rpc("portal_estado_acesso");
      if (state.error) throw state.error;

      const row = Array.isArray(state.data) ? state.data[0] : null;
      if (row?.must_change_password === true) {
        window.location.replace(FIRST_ACCESS_URL);
        return;
      }

      const access = await supabase.rpc("portal_has_permission", {
        p_permission_key: "inventario.visualizar"
      });

      if (access.error) throw access.error;
      if (access.data === true) return;

      deny("Seu usuário está autenticado, mas não possui a permissão inventario.visualizar.");
    } catch (error) {
      console.warn("Gate central do Portal:", error);
      deny("Não foi possível confirmar sua permissão no Portal Afonso Greco.");
    } finally {
      checking = false;
    }
  }

  function deny(message) {
    document.body.innerHTML = `
      <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f7fa;font-family:Arial,sans-serif">
        <section style="width:min(520px,100%);padding:32px;border:1px solid #dce5ee;border-radius:18px;background:#fff;text-align:center;box-shadow:0 18px 48px rgba(22,42,69,.10)">
          <h1 style="margin:0 0 10px;color:#172333;font-size:1.65rem">Acesso não liberado</h1>
          <p style="margin:0 0 22px;color:#66788c;line-height:1.55">${message}</p>
          <a href="${PORTAL_URL}" style="display:inline-flex;padding:11px 16px;border-radius:10px;background:#233985;color:#fff;text-decoration:none;font-weight:700">Voltar para a Área Interna</a>
        </section>
      </main>`;
  }

  function boot() {
    const supabase = client();
    if (!supabase) return;

    supabase.auth.getSession()
      .then(({ data }) => verify(data?.session))
      .catch(error => console.warn("Sessão indisponível:", error));

    supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => verify(session), 0);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();