(() => {
  "use strict";
  const MODULE_KEY = "inventario";
  const PORTAL_URL = "https://portal-afonso-greco.vercel.app/app.html";
  let checking = false;

  function client(){try{return obterInventarioSupabase();}catch(_){return null;}}

  async function verify(session){
    if(checking || !session?.user) return;
    checking = true;
    try{
      const supabase=client();
      if(!supabase) return;
      const accessState=await supabase.rpc("portal_estado_acesso");
      if(!accessState.error){
        const row=Array.isArray(accessState.data)?accessState.data[0]:null;
        if(row?.must_change_password===true){
          window.location.replace("https://portal-afonso-greco.vercel.app/primeiro-acesso.html");
          return;
        }
      }

      const {data,error}=await supabase.rpc("portal_pode_modulo",{p_modulo_chave:MODULE_KEY});
      if(error){
        if(/portal_pode_modulo|could not find the function|does not exist/i.test(String(error.message||error))) return;
        throw error;
      }
      if(data===true) return;
      await supabase.auth.signOut();
      deny();
    }catch(error){console.warn("Gate central do Portal:",error);}
    finally{checking=false;}
  }

  function deny(){
    document.body.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f7fa;font-family:Arial,sans-serif"><section style="width:min(520px,100%);padding:32px;border:1px solid #dce5ee;border-radius:18px;background:#fff;text-align:center;box-shadow:0 18px 48px rgba(22,42,69,.10)"><h1 style="margin:0 0 10px;color:#172333;font-size:1.65rem">Acesso não liberado</h1><p style="margin:0 0 22px;color:#66788c;line-height:1.55">Seu usuário está autenticado, mas o módulo Inventário não está liberado no Portal Afonso Greco.</p><a href="${PORTAL_URL}" style="display:inline-flex;padding:11px 16px;border-radius:10px;background:#233985;color:#fff;text-decoration:none;font-weight:700">Voltar para a Área Interna</a></section></main>`;
  }

  function boot(){
    const supabase=client();
    if(!supabase)return;
    supabase.auth.getSession().then(({data})=>verify(data?.session)).catch(()=>{});
    supabase.auth.onAuthStateChange((_event,session)=>setTimeout(()=>verify(session),0));
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();