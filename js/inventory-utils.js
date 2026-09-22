(() => {
  "use strict";

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function nullable(value) {
    const text=clean(value);
    return text===""?null:text;
  }

  function numberValue(value,fallback=0) {
    const number=Number(value);
    return Number.isFinite(number)?number:fallback;
  }

  function nullableNumber(value) {
    const text=clean(value);
    if(!text)return null;
    const number=Number(text);
    return Number.isFinite(number)?number:null;
  }

  function cleanIdentifier(value) {
    const text=clean(value);
    if(!text)return "";
    const key=normalize(text)
      .replace(/[._-]+/g," ")
      .replace(/\s+/g," ")
      .trim();
    if([
      "na","n a","n/a","s/id","s id","sem id",
      "sem identificacao","sem identificação","-","--"
    ].includes(key))return "";
    return text;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR",{
      maximumFractionDigits:3
    }).format(Number(value||0));
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR",{
      style:"currency",
      currency:"BRL"
    }).format(Number(value||0));
  }

  function formatDate(value) {
    if(!value)return "—";
    const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(match)return `${match[3]}/${match[2]}/${match[1]}`;
    const date=new Date(value);
    return Number.isNaN(date.getTime())
      ?"—"
      :date.toLocaleDateString("pt-BR");
  }

  function formatDateTime(value) {
    if(!value)return "—";
    const date=new Date(value);
    return Number.isNaN(date.getTime())
      ?"—"
      :date.toLocaleString("pt-BR",{
        day:"2-digit",
        month:"2-digit",
        year:"numeric",
        hour:"2-digit",
        minute:"2-digit"
      });
  }

  function daysUntil(value) {
    if(!value)return NaN;
    const date=new Date(`${String(value).slice(0,10)}T12:00:00`);
    const today=new Date();
    today.setHours(12,0,0,0);
    return Math.ceil((date.getTime()-today.getTime())/86400000);
  }

  function formatBytes(bytes) {
    const value=Number(bytes||0);
    if(value<1024)return `${value} B`;
    if(value<1024*1024)return `${(value/1024).toFixed(1)} KB`;
    return `${(value/1024/1024).toFixed(1)} MB`;
  }

  function extension(name) {
    return String(name||"").split(".").pop().toLowerCase();
  }

  function mimeFor(name) {
    const ext=extension(name);
    if(ext==="pdf")return "application/pdf";
    if(ext==="csv")return "text/csv";
    if(ext==="xlsx")return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if(ext==="xls")return "application/vnd.ms-excel";
    return "application/octet-stream";
  }

  function normalizeError(error) {
    const message=String(error?.message||error||"Erro inesperado.");
    if(/row-level security/i.test(message)){
      return "Seu perfil não possui permissão para esta operação.";
    }
    if(/duplicate key|unique constraint/i.test(message)){
      return "Já existe um registro com este código, patrimônio, série ou identificador.";
    }
    if(/does not exist|relation/i.test(message)){
      return "O banco do Inventário ainda não foi ativado ou está incompleto.";
    }
    return message;
  }

  function safeFileName(name) {
    return normalize(name)
      .replace(/[^a-z0-9._-]+/g,"-")
      .replace(/-+/g,"-")
      .replace(/^-|-$/g,"")
      .slice(0,100)||"arquivo";
  }

  function shortId(value) {
    const text=String(value||"");
    return text.length>12?`${text.slice(0,8)}…`:text||"—";
  }

  function todayIso() {
    return new Date().toISOString().slice(0,10);
  }

  function slug(value) {
    return normalize(value)
      .replace(/[^a-z0-9]+/g,"-")
      .replace(/^-|-$/g,"")||"relatorio";
  }

  function csvValue(value) {
    let text=String(value??"");
    if(/^[=+\-@]/.test(text))text=`'${text}`;
    return `"${text.replace(/"/g,'""')}"`;
  }

  function esc(value) {
    return String(value??"").replace(/[&<>'"]/g,char=>({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      "'":"&#39;",
      '"':"&quot;"
    })[char]);
  }

  const escapeHtml=esc;

  function cssEscape(value) {
    if(window.CSS?.escape)return window.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g,"\\$&");
  }

  function downloadBlob(blob,filename) {
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download=filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),0);
  }

  function actionLabel(action) {
    return ({
      novo:"Novo",
      atualizar:"Atualizar",
      ignorar:"Ignorar",
      erro:"Erro"
    })[action]||action;
  }

  function typeLabel(type) {
    return ({
      equipamento:"Equipamento",
      material:"Material",
      componente:"Componente",
      consumivel:"Consumível"
    })[type]||type||"—";
  }

  function statusLabel(status) {
    return ({
      disponivel:"Disponível",
      em_uso:"Em uso",
      emprestado:"Emprestado",
      manutencao:"Manutenção",
      danificado:"Danificado",
      reservado:"Reservado",
      baixado:"Baixado",
      perdido:"Perdido"
    })[status]||status||"—";
  }

  function batchLabel(status) {
    return ({
      analisando:"Analisando",
      pronto:"Pronto",
      importando:"Importando",
      concluido:"Concluído",
      concluido_com_erros:"Concluído com erros",
      falhou:"Falhou",
      cancelado:"Cancelado"
    })[status]||status;
  }

  function batchTone(status) {
    if(status==="concluido")return "disponivel";
    if(status==="concluido_com_erros"||status==="importando")return "reservado";
    if(status==="falhou")return "danificado";
    return "em_uso";
  }

  window.InventoryUtils=Object.freeze({
    normalize,
    clean,
    nullable,
    numberValue,
    nullableNumber,
    cleanIdentifier,
    formatNumber,
    formatCurrency,
    formatDate,
    formatDateTime,
    daysUntil,
    formatBytes,
    extension,
    mimeFor,
    normalizeError,
    safeFileName,
    shortId,
    todayIso,
    slug,
    csvValue,
    csvCell:csvValue,
    esc,
    escapeHtml,
    cssEscape,
    downloadBlob,
    actionLabel,
    typeLabel,
    statusLabel,
    batchLabel,
    batchTone
  });
})();