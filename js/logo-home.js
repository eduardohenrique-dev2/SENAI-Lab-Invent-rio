(() => {
    "use strict";
    const HOME="./";
    const SELECTOR='img[src*="logo-senai"], img[src*="logo-senai-lab"], img[alt*="SENAI" i]';
    function link(img){
      if(img.dataset.homeLinked==="true")return;
      img.dataset.homeLinked="true";img.style.cursor="pointer";img.title="Voltar para o Dashboard do Inventário";
      const a=img.closest("a");
      if(a){a.href=HOME;a.removeAttribute("target");a.removeAttribute("rel");a.setAttribute("aria-label","Voltar para o Dashboard do Inventário");return;}
      img.setAttribute("role","link");img.setAttribute("tabindex","0");img.setAttribute("aria-label","Voltar para o Dashboard do Inventário");
      const go=()=>location.href=HOME;img.addEventListener("click",go);img.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}});
    }
    const boot=()=>document.querySelectorAll(SELECTOR).forEach(link);
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  })();