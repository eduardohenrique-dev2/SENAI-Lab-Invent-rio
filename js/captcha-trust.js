(() => {
  "use strict";

  const SITE_KEY="99b6aeca-0a42-4d56-b8be-06f0e2c068f6";
  const TRUST_MS=5*60*1000;
  const TRUST_KEY="inventario-hcaptcha-trusted-until";
  let widgetId=null;
  let widgetMode="visible";

  function apiReady(){
    return typeof window.hcaptcha?.render==="function";
  }

  function trusted(){
    try{
      const until=Number(sessionStorage.getItem(TRUST_KEY)||0);
      return Number.isFinite(until)&&until>Date.now();
    }catch(_){
      return false;
    }
  }

  function markTrusted(){
    try{
      sessionStorage.setItem(TRUST_KEY,String(Date.now()+TRUST_MS));
    }catch(_){}
  }

  function status(text){
    const element=document.getElementById("inventoryCaptchaStatus");
    if(element)element.textContent=text||"";
  }

  function render(){
    const container=document.getElementById("inventoryLoginCaptcha");
    if(!container||widgetId!==null||!apiReady())return;

    const invisible=trusted();

    try{
      widgetMode=invisible?"invisible":"visible";
      widgetId=window.hcaptcha.render(container,{
        sitekey:SITE_KEY,
        size:invisible
          ?"invisible"
          :(container.clientWidth<304?"compact":"normal"),
        theme:"light",
        callback:()=>{
          markTrusted();
          status("Verificação concluída. Por 5 minutos, novas verificações serão automáticas quando possível.");
        },
        "expired-callback":()=>{
          status(
            trusted()
              ?"Verificação automática pronta para gerar um novo token."
              :"A verificação expirou. Confirme novamente para continuar."
          );
        },
        "error-callback":()=>{
          status("Não foi possível carregar a verificação de segurança.");
        }
      });

      status(
        invisible
          ?"Verificação automática ativa por até 5 minutos."
          :"Confirme que você é humano para continuar."
      );
    }catch(error){
      console.warn("hCaptcha do Inventário:",error);
      status("A verificação de segurança está indisponível.");
    }
  }

  async function getToken(){
    if(!apiReady()){
      throw new Error("A verificação de segurança ainda não carregou.");
    }

    if(widgetId===null)render();
    if(widgetId===null){
      throw new Error("A verificação de segurança não foi inicializada.");
    }

    const existing=String(window.hcaptcha.getResponse(widgetId)||"").trim();
    if(existing)return existing;

    if(!trusted()){
      if(widgetMode==="invisible")rerenderVisible();
      throw new Error("Confirme a verificação de segurança antes de entrar.");
    }

    try{
      const result=await window.hcaptcha.execute(widgetId,{async:true});
      const token=String(result?.response||"").trim();
      if(!token)throw new Error("Token de segurança não retornado.");
      markTrusted();
      return token;
    }catch(error){
      console.warn("hCaptcha automático do Inventário:",error);
      clearTrust();
      rerenderVisible();
      throw new Error("A verificação automática não foi concluída. Confirme o desafio para continuar.");
    }
  }

  function clearTrust(){
    try{sessionStorage.removeItem(TRUST_KEY);}catch(_){}
  }

  function rerenderVisible(){
    if(widgetId===null||!apiReady()||typeof window.hcaptcha.remove!=="function")return;
    const container=document.getElementById("inventoryLoginCaptcha");
    if(!container)return;
    try{
      window.hcaptcha.remove(widgetId);
      widgetId=null;
      widgetMode="visible";
      container.replaceChildren();
      render();
    }catch(_){}
  }

  function reset(){
    if(widgetId===null||!apiReady())return;

    if(trusted()&&typeof window.hcaptcha.remove==="function"){
      try{
        const container=document.getElementById("inventoryLoginCaptcha");
        window.hcaptcha.remove(widgetId);
        widgetId=null;
        container?.replaceChildren();
        render();
        return;
      }catch(_){}
    }

    try{window.hcaptcha.reset(widgetId);}catch(_){}
  }

  window.inventarioCaptchaInit=render;
  window.inventoryCaptcha=Object.freeze({
    getToken,
    reset,
    trusted,
    render
  });

  document.addEventListener("DOMContentLoaded",()=>{
    if(apiReady())render();
  },{once:true});
})();