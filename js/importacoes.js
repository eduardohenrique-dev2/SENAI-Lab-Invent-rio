(() => {
  "use strict";

  const MODULE = {
    maxFiles: 10,
    maxFileSize: 20 * 1024 * 1024,
    maxRows: 10000,
    pdfJsUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
    pdfWorkerUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
  };

  const state = {
    profile: null,
    files: [],
    rows: [],
    existingItems: [],
    categories: [],
    locations: [],
    imports: [],
    prefix: "LAB-INV",
    moduleReady: false,
    processing: false,
    sourceWarnings: []
  };

  const HEADER_ALIASES = new Map();
  registerAliases("codigo_interno", ["codigo", "código", "codigo interno", "código interno", "cod interno", "cod.", "id item", "codigo do item"]);
  registerAliases("patrimonio", ["patrimonio", "patrimônio", "n patrimonio", "nº patrimonio", "numero patrimonio", "número patrimônio", "tombamento", "tombo", "placa patrimonio", "plaqueta"]);
  registerAliases("nome", ["nome", "item", "bem", "descricao do bem", "descrição do bem", "equipamento", "material", "nome do item", "nome do bem"]);
  registerAliases("descricao", ["descricao", "descrição", "observacao descritiva", "detalhamento"]);
  registerAliases("categoria", ["categoria", "grupo", "classe", "familia", "família"]);
  registerAliases("subcategoria", ["subcategoria", "sub categoria", "subgrupo", "sub grupo"]);
  registerAliases("tipo_item", ["tipo", "tipo item", "tipo do item", "natureza"]);
  registerAliases("marca", ["marca"]);
  registerAliases("modelo", ["modelo"]);
  registerAliases("numero_serie", ["serie", "série", "numero de serie", "número de série", "n serie", "serial"]);
  registerAliases("codigo_barras", ["codigo de barras", "código de barras", "barcode", "ean", "gtin"]);
  registerAliases("quantidade", ["quantidade", "qtd", "qtde", "saldo", "quant."]);
  registerAliases("unidade", ["unidade", "un", "und", "unid", "unidade medida"]);
  registerAliases("localizacao", ["localizacao", "localização", "local", "setor", "ambiente", "lotacao", "lotação", "onde esta", "onde está"]);
  registerAliases("sala", ["sala", "sala laboratorio", "sala laboratório"]);
  registerAliases("armario", ["armario", "armário", "gabinete"]);
  registerAliases("prateleira", ["prateleira", "estante", "gaveta"]);
  registerAliases("responsavel", ["responsavel", "responsável", "custodiante", "usuario responsavel", "usuário responsável"]);
  registerAliases("status", ["status", "situacao", "situação", "estado", "condicao", "condição"]);
  registerAliases("data_aquisicao", ["data aquisicao", "data aquisição", "aquisicao", "aquisição", "data compra", "compra"]);
  registerAliases("valor_unitario", ["valor", "valor unitario", "valor unitário", "preco", "preço", "valor aquisicao", "valor aquisição"]);
  registerAliases("garantia_ate", ["garantia", "garantia ate", "garantia até", "fim garantia", "validade garantia"]);
  registerAliases("voltagem", ["voltagem", "tensao", "tensão"]);
  registerAliases("potencia", ["potencia", "potência"]);
  registerAliases("capacidade", ["capacidade"]);
  registerAliases("fabricante", ["fabricante", "manufacturer"]);
  registerAliases("especificacoes", ["especificacoes", "especificações", "especificacao", "especificação"]);

  const STATUS_MAP = new Map([
    ["disponivel", "disponivel"], ["disponível", "disponivel"], ["livre", "disponivel"], ["ativo", "disponivel"], ["bom", "disponivel"],
    ["em uso", "em_uso"], ["uso", "em_uso"], ["utilizacao", "em_uso"], ["utilização", "em_uso"],
    ["emprestado", "emprestado"], ["emprestimo", "emprestado"], ["empréstimo", "emprestado"],
    ["manutencao", "manutencao"], ["manutenção", "manutencao"], ["em manutencao", "manutencao"], ["em manutenção", "manutencao"],
    ["danificado", "danificado"], ["avariado", "danificado"], ["quebrado", "danificado"],
    ["reservado", "reservado"], ["reserva", "reservado"],
    ["baixado", "baixado"], ["baixa", "baixado"], ["inativo", "baixado"],
    ["perdido", "perdido"], ["extraviado", "perdido"]
  ]);

  const TYPE_MAP = new Map([
    ["equipamento", "equipamento"], ["equipamentos", "equipamento"], ["maquina", "equipamento"], ["máquina", "equipamento"],
    ["material", "material"], ["materiais", "material"],
    ["componente", "componente"], ["componentes", "componente"], ["peca", "componente"], ["peça", "componente"],
    ["consumivel", "consumivel"], ["consumível", "consumivel"], ["consumiveis", "consumivel"], ["consumíveis", "consumivel"]
  ]);

  const $ = id => document.getElementById(id);
  const db = () => obterInventarioSupabase();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  function boot() {
    injectUi();
    bindEvents();
    observeSession();
    refreshAccess();
  }

  function injectUi() {
    if ($("view-uploads")) return;

    const reportsButton = document.querySelector('.nav-button[data-view="relatorios"]');
    const navButton = document.createElement("button");
    navButton.id = "navUploads";
    navButton.className = "nav-button";
    navButton.type = "button";
    navButton.dataset.view = "uploads";
    navButton.hidden = true;
    navButton.innerHTML = '<span class="nav-icon">⇧</span>Uploads / Importar';
    reportsButton?.parentNode?.insertBefore(navButton, reportsButton);

    const content = document.querySelector(".content");
    if (!content) return;
    const section = document.createElement("section");
    section.id = "view-uploads";
    section.className = "view";
    section.innerHTML = `
      <div class="import-shell">
        <article class="panel">
          <header class="panel-header">
            <div><h2>Uploads / Importação de patrimônio</h2><p>Envie Excel, CSV ou PDF e transforme o inventário atual em registros organizados do SENAI Lab.</p></div>
            <span id="importModuleStatus" class="status" data-status="reservado">Verificando</span>
          </header>
          <div class="panel-body">
            <div id="importModuleError" class="import-error" hidden></div>
            <div id="importDropzone" class="import-dropzone">
              <input id="importFileInput" class="import-file-input" type="file" multiple accept=".xlsx,.xls,.csv,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/pdf">
              <div>
                <strong>Arraste seus arquivos aqui ou selecione no celular/computador</strong>
                <p>Excel (.xlsx/.xls), CSV e PDF textual. Até ${MODULE.maxFiles} arquivos de 20 MB cada.</p>
                <button id="btnChooseImportFiles" class="button" type="button">Selecionar arquivos</button>
              </div>
            </div>
            <div id="importFiles" class="import-files"></div>
          </div>
        </article>

        <article class="panel">
          <header class="panel-header"><div><h2>Como o sistema deve organizar</h2><p>As decisões automáticas sempre aparecem na prévia antes de gravar.</p></div></header>
          <div class="panel-body">
            <div class="import-options">
              <div class="import-option"><label><input id="importUpdateExisting" type="checkbox" checked> Atualizar itens já existentes</label><small>Compara patrimônio, código interno, número de série e código de barras.</small></div>
              <div class="import-option"><label><input id="importCreateLocations" type="checkbox" checked> Criar localizações ausentes</label><small>Reconhece sala, armário e prateleira e monta a hierarquia abaixo do SENAI Lab.</small></div>
              <div class="import-option"><label><input id="importCreateCategories" type="checkbox" checked> Criar categorias ausentes</label><small>Quando a categoria estiver no arquivo e ainda não existir, ela será criada no inventário.</small></div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
              <button id="btnAnalyzeImport" class="button" type="button">Analisar arquivos</button>
              <button id="btnClearImport" class="button button--secondary" type="button">Limpar</button>
            </div>
          </div>
        </article>

        <article id="importPreviewPanel" class="panel" hidden>
          <header class="panel-header">
            <div><h2>Prévia da importação</h2><p>Confira antes de gravar. Nenhum item é importado nesta etapa.</p></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap"><button id="btnDownloadImportErrors" class="button button--secondary button--small" type="button" hidden>Baixar inconsistências</button><button id="btnConfirmImport" class="button" type="button">Confirmar importação</button></div>
          </header>
          <div class="panel-body">
            <div class="import-summary">
              <div class="import-stat"><span>Linhas lidas</span><strong id="importTotal">0</strong></div>
              <div class="import-stat" data-tone="success"><span>Novos</span><strong id="importNew">0</strong></div>
              <div class="import-stat"><span>Atualizações</span><strong id="importUpdate">0</strong></div>
              <div class="import-stat" data-tone="warning"><span>Ignorados</span><strong id="importIgnore">0</strong></div>
              <div class="import-stat" data-tone="danger"><span>Erros</span><strong id="importErrors">0</strong></div>
            </div>
            <div id="importSourceWarnings" style="display:grid;gap:8px;margin:12px 0"></div>
            <p class="import-preview-note">O sistema não substitui dados existentes por campos vazios. Itens com erro ficam fora da confirmação até que o arquivo seja corrigido.</p>
            <div class="table-wrap"><table><thead><tr><th>Ação</th><th>Origem</th><th>Patrimônio</th><th>Item</th><th>Categoria / tipo</th><th>Qtd.</th><th>Localização</th><th>Status</th><th>Observação</th></tr></thead><tbody id="importPreviewBody"></tbody></table></div>
          </div>
        </article>

        <article id="importProgressPanel" class="panel" hidden>
          <header class="panel-header"><div><h2>Importando patrimônio</h2><p id="importProgressText">Preparando...</p></div></header>
          <div class="panel-body"><div class="import-progress"><span id="importProgressBar"></span></div></div>
        </article>

        <article class="panel">
          <header class="panel-header"><div><h2>Histórico de uploads</h2><p>Arquivos já processados e resultado de cada lote.</p></div><button id="btnRefreshImportHistory" class="button button--secondary button--small" type="button">Atualizar</button></header>
          <div id="importHistory" class="panel-body import-history"><div class="empty">Entre no sistema para consultar os uploads.</div></div>
        </article>
      </div>`;

    const reportsView = $("view-relatorios");
    content.insertBefore(section, reportsView || null);
  }

  function bindEvents() {
    $("navUploads")?.addEventListener("click", openUploadsView);
    $("btnChooseImportFiles")?.addEventListener("click", () => $("importFileInput")?.click());
    $("importFileInput")?.addEventListener("change", event => addFiles(event.target.files));
    $("btnAnalyzeImport")?.addEventListener("click", analyzeFiles);
    $("btnClearImport")?.addEventListener("click", clearImport);
    $("btnConfirmImport")?.addEventListener("click", confirmImport);
    $("btnDownloadImportErrors")?.addEventListener("click", downloadProblems);
    $("btnRefreshImportHistory")?.addEventListener("click", loadImportHistory);

    const dropzone = $("importDropzone");
    if (dropzone) {
      ["dragenter", "dragover"].forEach(name => dropzone.addEventListener(name, event => {
        event.preventDefault();
        dropzone.dataset.drag = "true";
      }));
      ["dragleave", "drop"].forEach(name => dropzone.addEventListener(name, event => {
        event.preventDefault();
        dropzone.dataset.drag = "false";
      }));
      dropzone.addEventListener("drop", event => addFiles(event.dataTransfer?.files));
    }
  }

  function observeSession() {
    try {
      db().auth.onAuthStateChange(() => setTimeout(refreshAccess, 0));
    } catch (_) {}
    const shell = $("appShell");
    if (shell) new MutationObserver(() => { if (!shell.hidden) refreshAccess(); }).observe(shell, { attributes: true, attributeFilter: ["hidden"] });
  }

  async function refreshAccess() {
    try {
      const { data: { user } } = await db().auth.getUser();
      if (!user) return setAccess(null);
      const { data, error } = await db().from("inv_perfis").select("user_id,nome,email,papel,ativo").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      setAccess(data);
    } catch (error) {
      console.warn("Uploads: não foi possível validar o perfil:", error);
      setAccess(null);
    }
  }

  function setAccess(profile) {
    state.profile = profile;
    const allowed = Boolean(profile?.ativo && ["administrador", "gestor"].includes(profile.papel));
    if ($("navUploads")) $("navUploads").hidden = !allowed;
    if (!allowed && $("view-uploads")?.dataset.active === "true") document.querySelector('.nav-button[data-view="dashboard"]')?.click();
    if (allowed) {
      checkModule().then(() => loadImportHistory());
    }
  }

  function openUploadsView() {
    if (!state.profile?.ativo || !["administrador", "gestor"].includes(state.profile.papel)) return;
    document.querySelectorAll(".view").forEach(section => section.dataset.active = String(section.id === "view-uploads"));
    document.querySelectorAll(".nav-button[data-view]").forEach(button => {
      if (button.dataset.view === "uploads") button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if ($("pageTitle")) $("pageTitle").textContent = "Uploads / Importar";
    if ($("pageSubtitle")) $("pageSubtitle").textContent = "Leia planilhas e PDFs e organize o patrimônio automaticamente";
    if ($("sidebar")) $("sidebar").dataset.open = "false";
    checkModule();
    loadImportHistory();
  }

  async function checkModule() {
    const badge = $("importModuleStatus");
    const errorBox = $("importModuleError");
    try {
      const { error } = await db().from("inv_importacoes").select("id").limit(1);
      if (error) throw error;
      state.moduleReady = true;
      if (badge) { badge.textContent = "Pronto"; badge.dataset.status = "disponivel"; }
      if (errorBox) errorBox.hidden = true;
      return true;
    } catch (error) {
      state.moduleReady = false;
      if (badge) { badge.textContent = "Ativação necessária"; badge.dataset.status = "danificado"; }
      if (errorBox) {
        errorBox.textContent = /inv_importacoes|does not exist|relation/i.test(String(error?.message || error))
          ? "O módulo de Uploads ainda precisa da migration supabase/03_importacoes_uploads.sql no Supabase. A análise dos arquivos funciona, mas a confirmação ficará bloqueada até a ativação."
          : `Não foi possível verificar o módulo de importação: ${error?.message || error}`;
        errorBox.hidden = false;
      }
      return false;
    }
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    for (const file of incoming) {
      if (state.files.length >= MODULE.maxFiles) break;
      const extension = fileExtension(file.name);
      if (!["xlsx", "xls", "csv", "pdf"].includes(extension)) {
        toast("Arquivo ignorado", `${file.name}: formato não suportado.`, "warning");
        continue;
      }
      if (file.size > MODULE.maxFileSize) {
        toast("Arquivo ignorado", `${file.name}: limite de 20 MB.`, "warning");
        continue;
      }
      if (!state.files.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) state.files.push(file);
    }
    renderFiles();
    if ($("importFileInput")) $("importFileInput").value = "";
  }

  function renderFiles() {
    const box = $("importFiles");
    if (!box) return;
    box.replaceChildren();
    state.files.forEach((file, index) => {
      const row = document.createElement("div");
      row.className = "import-file";
      row.innerHTML = `<div class="import-file__meta"><strong>${escapeHtml(file.name)}</strong><span>${fileExtension(file.name).toUpperCase()} · ${formatBytes(file.size)}</span></div><button class="button button--secondary button--small" type="button" data-remove-import-file="${index}">Remover</button>`;
      box.appendChild(row);
    });
    box.querySelectorAll("[data-remove-import-file]").forEach(button => button.addEventListener("click", () => {
      state.files.splice(Number(button.dataset.removeImportFile), 1);
      renderFiles();
    }));
  }

  function clearImport() {
    if (state.processing) return;
    state.files = [];
    state.rows = [];
    state.sourceWarnings = [];
    renderFiles();
    if ($("importPreviewPanel")) $("importPreviewPanel").hidden = true;
    if ($("importProgressPanel")) $("importProgressPanel").hidden = true;
  }

  async function analyzeFiles() {
    if (state.processing) return;
    if (!state.files.length) return toast("Selecione um arquivo", "Envie uma planilha, CSV ou PDF antes de analisar.", "warning");

    setProcessing(true, "Analisando arquivos...");
    state.rows = [];
    state.sourceWarnings = [];
    try {
      await loadReferenceData();
      let rowNumber = 0;
      for (const file of state.files) {
        let parsed;
        const ext = fileExtension(file.name);
        if (["xlsx", "xls", "csv"].includes(ext)) parsed = await parseSpreadsheet(file);
        else parsed = await parsePdf(file);

        parsed.warnings?.forEach(w => state.sourceWarnings.push(`${file.name}: ${w}`));
        for (const raw of parsed.rows || []) {
          rowNumber += 1;
          if (rowNumber > MODULE.maxRows) throw new Error(`Limite de ${MODULE.maxRows.toLocaleString("pt-BR")} linhas por análise excedido.`);
          state.rows.push(prepareRow(raw, file.name, rowNumber));
        }
      }

      if (!state.rows.length) throw new Error("Nenhum item foi reconhecido nos arquivos. Verifique os cabeçalhos da planilha ou se o PDF possui texto selecionável.");
      assignGeneratedCodes();
      classifyDuplicates();
      renderPreview();
      if ($("importPreviewPanel")) $("importPreviewPanel").hidden = false;
      $("importPreviewPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      console.error("Falha ao analisar importação:", error);
      toast("Não foi possível analisar", error?.message || String(error), "danger");
    } finally {
      setProcessing(false);
    }
  }

  async function loadReferenceData() {
    const [items, categories, locations, settings] = await Promise.all([
      fetchAll("inv_itens", "*", query => query.eq("ativo", true).order("nome")),
      fetchAll("inv_categorias", "*", query => query.eq("ativo", true).order("nome")),
      fetchAll("inv_localizacoes", "*", query => query.eq("ativo", true).order("nome")),
      db().from("inv_configuracoes").select("chave,valor").eq("chave", "geral").maybeSingle()
    ]);
    state.existingItems = items;
    state.categories = categories;
    state.locations = locations;
    if (settings.error) throw settings.error;
    state.prefix = String(settings.data?.valor?.prefixo_codigo || "LAB-INV").trim() || "LAB-INV";
  }

  async function fetchAll(table, select, mutate) {
    const output = [];
    let from = 0;
    const size = 1000;
    while (true) {
      let query = db().from(table).select(select).range(from, from + size - 1);
      if (mutate) query = mutate(query);
      const { data, error } = await query;
      if (error) throw error;
      output.push(...(data || []));
      if (!data || data.length < size) break;
      from += size;
      if (from > 50000) break;
    }
    return output;
  }

  async function parseSpreadsheet(file) {
    if (!window.XLSX) throw new Error("Leitor de planilhas não carregado.");
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const rows = [];
    const warnings = [];

    for (const sheetName of workbook.SheetNames) {
      const matrix = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
      if (!matrix.length) continue;
      const headerInfo = detectHeader(matrix);
      if (!headerInfo || headerInfo.score < 2) {
        warnings.push(`aba “${sheetName}” ignorada porque não foi possível reconhecer pelo menos duas colunas de patrimônio.`);
        continue;
      }
      for (let index = headerInfo.index + 1; index < matrix.length; index += 1) {
        const source = matrix[index] || [];
        if (source.every(value => clean(value) === "")) continue;
        const record = { _sourceLine: index + 1, _sheet: sheetName, _provided: [] };
        headerInfo.map.forEach((field, column) => {
          if (!field) return;
          const value = source[column];
          if (clean(value) === "") return;
          if (field === "descricao" && !record.nome && headerInfo.map.includes("nome") === false) {
            record.nome = value;
            record._provided.push("nome");
          } else {
            record[field] = value;
            record._provided.push(field);
          }
        });
        rows.push(record);
      }
    }
    return { rows, warnings };
  }

  function detectHeader(matrix) {
    let best = null;
    const limit = Math.min(matrix.length, 25);
    for (let index = 0; index < limit; index += 1) {
      const values = matrix[index] || [];
      const map = values.map(resolveHeader);
      const recognized = map.filter(Boolean);
      const unique = new Set(recognized);
      let score = unique.size;
      if (unique.has("patrimonio")) score += 2;
      if (unique.has("nome")) score += 2;
      if (!best || score > best.score) best = { index, map, score };
    }
    return best;
  }

  async function parsePdf(file) {
    await ensurePdfJs();
    const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const rows = [];
    const warnings = [];
    let totalTextItems = 0;

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      totalTextItems += content.items?.length || 0;
      const lines = groupPdfLines(content.items || []);
      let header = null;
      for (const line of lines) {
        const candidate = detectPdfHeader(line);
        if (candidate?.score >= 2) {
          header = candidate;
          continue;
        }
        if (!header) continue;
        const record = pdfLineToRecord(line, header, pageNo);
        if (record && rowHasIdentity(record)) rows.push(record);
      }
    }

    if (!totalTextItems) throw new Error("O PDF parece ser imagem/scan e não possui texto selecionável. Exporte-o como PDF pesquisável ou use a planilha original.");
    if (!rows.length) warnings.push("o PDF possui texto, mas nenhuma tabela com cabeçalhos reconhecíveis foi encontrada. Para melhor resultado, use XLSX/CSV ou um PDF exportado diretamente da planilha.");
    return { rows, warnings };
  }

  function groupPdfLines(items) {
    const tokens = items
      .filter(item => clean(item.str))
      .map(item => ({ text: clean(item.str), x: Number(item.transform?.[4] || 0), y: Number(item.transform?.[5] || 0), width: Number(item.width || 0) }))
      .sort((a, b) => Math.abs(b.y - a.y) > 2.5 ? b.y - a.y : a.x - b.x);
    const lines = [];
    for (const token of tokens) {
      let line = lines.find(candidate => Math.abs(candidate.y - token.y) <= 2.5);
      if (!line) { line = { y: token.y, tokens: [] }; lines.push(line); }
      line.tokens.push(token);
    }
    lines.sort((a, b) => b.y - a.y);
    lines.forEach(line => line.tokens.sort((a, b) => a.x - b.x));
    return lines;
  }

  function detectPdfHeader(line) {
    const groups = groupPdfCells(line.tokens);
    const columns = groups.map(group => ({ field: resolveHeader(group.text), x: group.x, text: group.text })).filter(column => column.field);
    const unique = new Set(columns.map(column => column.field));
    let score = unique.size;
    if (unique.has("patrimonio")) score += 2;
    if (unique.has("nome")) score += 2;
    return { columns, score };
  }

  function groupPdfCells(tokens) {
    const groups = [];
    let current = null;
    for (const token of tokens) {
      if (!current) {
        current = { x: token.x, end: token.x + token.width, text: token.text };
        groups.push(current);
        continue;
      }
      const gap = token.x - current.end;
      if (gap > 16) {
        current = { x: token.x, end: token.x + token.width, text: token.text };
        groups.push(current);
      } else {
        current.text += ` ${token.text}`;
        current.end = Math.max(current.end, token.x + token.width);
      }
    }
    return groups;
  }

  function pdfLineToRecord(line, header, pageNo) {
    if (!header.columns.length) return null;
    const record = { _sourceLine: pageNo, _sheet: `PDF pág. ${pageNo}`, _provided: [] };
    const ordered = [...header.columns].sort((a, b) => a.x - b.x);
    for (const token of line.tokens) {
      let chosen = ordered[0];
      for (const column of ordered) {
        if (column.x <= token.x + 4) chosen = column;
        else break;
      }
      if (!chosen?.field) continue;
      record[chosen.field] = record[chosen.field] ? `${record[chosen.field]} ${token.text}` : token.text;
      if (!record._provided.includes(chosen.field)) record._provided.push(chosen.field);
    }
    return record;
  }

  function rowHasIdentity(record) {
    return Boolean(clean(record.nome) || clean(record.patrimonio) || clean(record.codigo_interno) || clean(record.numero_serie));
  }

  async function ensurePdfJs() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = MODULE.pdfWorkerUrl;
      return;
    }
    await loadScript(MODULE.pdfJsUrl);
    if (!window.pdfjsLib) throw new Error("Leitor de PDF não carregado.");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = MODULE.pdfWorkerUrl;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("Falha ao carregar leitor de PDF.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
      script.addEventListener("error", () => reject(new Error("Falha ao carregar leitor de PDF.")), { once: true });
      document.head.appendChild(script);
    });
  }

  function prepareRow(raw, sourceName, number) {
    const provided = new Set(raw._provided || []);
    const row = {
      number,
      sourceName,
      sourceLine: raw._sourceLine || number,
      sheet: raw._sheet || "",
      provided: Array.from(provided),
      codigo_interno: clean(raw.codigo_interno),
      patrimonio: clean(raw.patrimonio),
      nome: clean(raw.nome),
      descricao: clean(raw.descricao),
      categoria: clean(raw.categoria),
      subcategoria: clean(raw.subcategoria),
      tipo_item: normalizeType(raw.tipo_item),
      marca: clean(raw.marca),
      modelo: clean(raw.modelo),
      numero_serie: clean(raw.numero_serie),
      codigo_barras: clean(raw.codigo_barras),
      quantidade: parseNumber(raw.quantidade),
      unidade: clean(raw.unidade),
      localizacao: clean(raw.localizacao),
      sala: clean(raw.sala),
      armario: clean(raw.armario),
      prateleira: clean(raw.prateleira),
      responsavel: clean(raw.responsavel),
      status: normalizeStatus(raw.status),
      data_aquisicao: parseDate(raw.data_aquisicao),
      valor_unitario: parseMoney(raw.valor_unitario),
      garantia_ate: parseDate(raw.garantia_ate),
      voltagem: clean(raw.voltagem),
      potencia: clean(raw.potencia),
      capacidade: clean(raw.capacidade),
      fabricante: clean(raw.fabricante),
      especificacoes: clean(raw.especificacoes),
      action: "novo",
      error: "",
      message: "",
      existingItem: null,
      inferred: []
    };

    if (!row.nome) {
      if (row.patrimonio && !provided.has("nome")) {
        row.error = "Nome/descrição do item não foi reconhecido.";
        row.action = "erro";
      } else {
        row.error = "Nome do item é obrigatório.";
        row.action = "erro";
      }
    }

    if (!row.tipo_item) {
      row.tipo_item = inferType(row);
      row.inferred.push("tipo");
    }
    if (!Number.isFinite(row.quantidade)) {
      row.quantidade = 1;
      row.inferred.push("quantidade=1");
    }
    if (!row.unidade) row.unidade = "un";
    if (!row.status) {
      row.status = "disponivel";
      row.inferred.push("status=disponível");
    }
    if (!row.categoria) {
      const inferredCategory = inferCategory(row);
      if (inferredCategory) {
        row.categoria = inferredCategory;
        row.inferred.push(`categoria=${inferredCategory}`);
      }
    }
    row.locationParts = buildLocationParts(row);
    return row;
  }

  function assignGeneratedCodes() {
    const used = new Set(state.existingItems.map(item => normalize(item.codigo_interno)).filter(Boolean));
    let next = state.existingItems.reduce((max, item) => {
      const match = String(item.codigo_interno || "").match(/(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;

    for (const row of state.rows) {
      if (row.codigo_interno || row.action === "erro") continue;
      let code;
      do { code = `${state.prefix}-${String(next++).padStart(4, "0")}`; } while (used.has(normalize(code)));
      row.codigo_interno = code;
      row.inferred.push(`código=${code}`);
      used.add(normalize(code));
    }
  }

  function classifyDuplicates() {
    const indexes = buildExistingIndexes();
    const updateExisting = Boolean($("importUpdateExisting")?.checked);
    const seen = new Map();

    for (const row of state.rows) {
      if (row.action === "erro") continue;
      const matches = new Set();
      addMatch(matches, indexes.patrimonio.get(normalize(row.patrimonio)));
      addMatch(matches, indexes.codigo.get(normalize(row.codigo_interno)));
      addMatch(matches, indexes.serie.get(normalize(row.numero_serie)));
      addMatch(matches, indexes.barras.get(normalize(row.codigo_barras)));

      if (matches.size > 1) {
        row.action = "erro";
        row.error = "Os identificadores desta linha apontam para itens diferentes já cadastrados.";
        continue;
      }
      if (matches.size === 1) {
        row.existingItem = [...matches][0];
        row.action = updateExisting ? "atualizar" : "ignorar";
        row.message = updateExisting ? `Atualizará ${row.existingItem.nome}.` : "Item existente; atualização automática desativada.";
        continue;
      }

      const localKeys = [row.patrimonio && `pat:${normalize(row.patrimonio)}`, row.codigo_interno && `cod:${normalize(row.codigo_interno)}`, row.numero_serie && `ser:${normalize(row.numero_serie)}`, row.codigo_barras && `bar:${normalize(row.codigo_barras)}`].filter(Boolean);
      const duplicateInFile = localKeys.find(key => seen.has(key));
      if (duplicateInFile) {
        row.action = "erro";
        row.error = `Duplicado no próprio upload (mesmo identificador da linha ${seen.get(duplicateInFile)}).`;
        continue;
      }
      localKeys.forEach(key => seen.set(key, row.number));
    }
  }

  function buildExistingIndexes() {
    const result = { patrimonio: new Map(), codigo: new Map(), serie: new Map(), barras: new Map() };
    state.existingItems.forEach(item => {
      if (normalize(item.patrimonio)) result.patrimonio.set(normalize(item.patrimonio), item);
      if (normalize(item.codigo_interno)) result.codigo.set(normalize(item.codigo_interno), item);
      if (normalize(item.numero_serie)) result.serie.set(normalize(item.numero_serie), item);
      if (normalize(item.codigo_barras)) result.barras.set(normalize(item.codigo_barras), item);
    });
    return result;
  }

  function addMatch(set, value) { if (value) set.add(value); }

  function renderPreview() {
    const counts = countActions();
    setText("importTotal", state.rows.length);
    setText("importNew", counts.novo);
    setText("importUpdate", counts.atualizar);
    setText("importIgnore", counts.ignorar);
    setText("importErrors", counts.erro);
    if ($("btnDownloadImportErrors")) $("btnDownloadImportErrors").hidden = !counts.erro;
    if ($("btnConfirmImport")) $("btnConfirmImport").disabled = !counts.novo && !counts.atualizar;

    const warningBox = $("importSourceWarnings");
    if (warningBox) {
      warningBox.replaceChildren();
      state.sourceWarnings.forEach(text => {
        const node = document.createElement("div");
        node.className = "import-warning";
        node.textContent = text;
        warningBox.appendChild(node);
      });
    }

    const body = $("importPreviewBody");
    if (!body) return;
    body.replaceChildren();
    state.rows.slice(0, 2000).forEach(row => {
      const tr = document.createElement("tr");
      const location = row.locationParts.length ? row.locationParts.join(" → ") : "Sem localização";
      const observation = row.error || row.message || (row.inferred.length ? `Inferido: ${row.inferred.join(", ")}` : "Pronto");
      tr.innerHTML = `
        <td><span class="import-action" data-action="${escapeHtml(row.action)}">${escapeHtml(actionLabel(row.action))}</span></td>
        <td>${escapeHtml(row.sourceName)}<div class="muted">${escapeHtml(row.sheet || "")} · linha ${escapeHtml(row.sourceLine)}</div></td>
        <td>${escapeHtml(row.patrimonio || "—")}</td>
        <td><div class="item-name"><strong>${escapeHtml(row.nome || "—")}</strong><span>${escapeHtml(row.codigo_interno || "—")}${row.marca ? ` · ${escapeHtml(row.marca)}` : ""}</span></div></td>
        <td>${escapeHtml(row.categoria || "Sem categoria")}<div class="muted">${escapeHtml(typeLabel(row.tipo_item))}</div></td>
        <td>${escapeHtml(formatNumber(row.quantidade))} ${escapeHtml(row.unidade || "un")}</td>
        <td>${escapeHtml(location)}</td>
        <td>${escapeHtml(statusLabel(row.status))}</td>
        <td><div class="import-row-message ${row.error ? "text-danger" : ""}">${escapeHtml(observation)}</div></td>`;
      body.appendChild(tr);
    });
    if (state.rows.length > 2000) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="9"><div class="import-warning">A prévia exibe as primeiras 2.000 linhas por desempenho. As ${state.rows.length.toLocaleString("pt-BR")} linhas serão processadas na confirmação.</div></td>`;
      body.appendChild(tr);
    }
  }

  async function confirmImport() {
    if (state.processing) return;
    const actionable = state.rows.filter(row => ["novo", "atualizar"].includes(row.action));
    if (!actionable.length) return toast("Nada para importar", "Não há linhas novas ou atualizáveis na prévia.", "warning");
    if (!(await checkModule())) return toast("Ative o módulo", "Execute supabase/03_importacoes_uploads.sql antes de confirmar.", "danger");
    if (!window.confirm(`Confirmar ${actionable.length} item(ns)? O sistema criará/atualizará os registros conforme a prévia.`)) return;

    state.processing = true;
    toggleImportButtons(true);
    if ($("importProgressPanel")) $("importProgressPanel").hidden = false;
    setProgress(0, `Criando lote de importação...`);

    let batch = null;
    const counters = { novo: 0, atualizar: 0, ignorar: state.rows.filter(r => r.action === "ignorar").length, erro: state.rows.filter(r => r.action === "erro").length };
    try {
      const { data: { user } } = await db().auth.getUser();
      if (!user) throw new Error("Sessão expirada. Entre novamente.");
      const types = new Set(state.files.map(file => fileExtension(file.name)));
      const { data, error } = await db().from("inv_importacoes").insert({
        arquivo_nome: state.files.map(file => file.name).join(" + ").slice(0, 1000),
        arquivo_tipo: types.size === 1 ? [...types][0] : "misto",
        status: "importando",
        total_linhas: state.rows.length,
        novos: 0,
        atualizados: 0,
        ignorados: counters.ignorar,
        erros: counters.erro,
        criado_por: user.id,
        resumo: { opcoes: currentOptions(), origem: "interface-web" }
      }).select("*").single();
      if (error) throw error;
      batch = data;

      const uploadedPaths = [];
      for (let index = 0; index < state.files.length; index += 1) {
        const file = state.files[index];
        setProgress(2 + (index / Math.max(state.files.length, 1)) * 6, `Guardando arquivo original: ${file.name}`);
        const path = `importacoes/${batch.id}/${Date.now()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await db().storage.from("inventario-privado").upload(path, file, { upsert: false, contentType: file.type || mimeFor(file.name) });
        if (uploadError) throw uploadError;
        uploadedPaths.push({ nome: file.name, path, tipo: fileExtension(file.name), tamanho: file.size });
      }
      await db().from("inv_importacoes").update({ arquivos: uploadedPaths }).eq("id", batch.id);

      const total = actionable.length;
      let completed = 0;
      for (const row of state.rows) {
        if (!["novo", "atualizar"].includes(row.action)) {
          await logImportLine(batch.id, row, row.action, null, row.error || row.message || "Linha ignorada.");
          continue;
        }
        try {
          const itemId = await importRow(row, user.id);
          counters[row.action] += 1;
          await logImportLine(batch.id, row, row.action, itemId, row.message || "Importado com sucesso.");
        } catch (error) {
          counters.erro += 1;
          row.action = "erro";
          row.error = error?.message || String(error);
          await logImportLine(batch.id, row, "erro", null, row.error).catch(() => {});
        }
        completed += 1;
        setProgress(8 + (completed / total) * 90, `Importando ${completed} de ${total}...`);
      }

      const finalStatus = counters.erro ? "concluido_com_erros" : "concluido";
      const { error: finishError } = await db().from("inv_importacoes").update({
        status: finalStatus,
        novos: counters.novo,
        atualizados: counters.atualizar,
        ignorados: counters.ignorar,
        erros: counters.erro,
        concluido_em: new Date().toISOString(),
        resumo: { opcoes: currentOptions(), arquivos: uploadedPaths.length, resultado: counters }
      }).eq("id", batch.id);
      if (finishError) throw finishError;

      setProgress(100, `Concluído: ${counters.novo} novo(s), ${counters.atualizar} atualizado(s), ${counters.erro} erro(s).`);
      toast("Importação concluída", `${counters.novo} novo(s), ${counters.atualizar} atualizado(s) e ${counters.erro} erro(s).`, counters.erro ? "warning" : "success");
      renderPreview();
      await loadImportHistory();
      $("btnGlobalRefresh")?.click();
    } catch (error) {
      console.error("Falha na importação:", error);
      if (batch?.id) await db().from("inv_importacoes").update({ status: "falhou", erros: Math.max(1, counters.erro), concluido_em: new Date().toISOString(), resumo: { erro: error?.message || String(error) } }).eq("id", batch.id).catch(() => {});
      toast("Importação interrompida", error?.message || String(error), "danger");
      setProgress(0, `Falha: ${error?.message || error}`);
    } finally {
      state.processing = false;
      toggleImportButtons(false);
    }
  }

  async function importRow(row, userId) {
    let categoryId = row.existingItem?.categoria_id || null;
    if (row.categoria) categoryId = await ensureCategory(row.categoria, row.tipo_item);
    let locationId = row.existingItem?.localizacao_id || null;
    if (row.locationParts.length) locationId = await ensureLocationPath(row.locationParts);

    const update = row.action === "atualizar";
    const payload = buildItemPayload(row, update);
    if (categoryId) payload.categoria_id = categoryId;
    if (locationId) payload.localizacao_id = locationId;

    const importNote = `Importado via Upload · ${row.sourceName} · ${new Date().toLocaleDateString("pt-BR")}`;
    if (!update) {
      payload.criado_por = userId;
      payload.observacoes = row.descricao ? `${importNote}\n${row.descricao}` : importNote;
      const { data, error } = await db().from("inv_itens").insert(payload).select("id").single();
      if (error) throw error;
      return data.id;
    }

    const existing = row.existingItem;
    if (!existing?.id) throw new Error("Item existente não encontrado para atualização.");
    if (row.descricao && row.provided.includes("descricao")) payload.descricao = row.descricao;
    const previousNotes = clean(existing.observacoes);
    payload.observacoes = previousNotes.includes(importNote) ? previousNotes : [previousNotes, importNote].filter(Boolean).join("\n");
    const { data, error } = await db().from("inv_itens").update(payload).eq("id", existing.id).select("id").single();
    if (error) throw error;
    return data.id;
  }

  function buildItemPayload(row, update) {
    const source = new Set(row.provided);
    const payload = {};
    const setIf = (field, value, forceForNew = false) => {
      if (!update || forceForNew || source.has(field)) {
        if (value !== "" && value !== null && value !== undefined && !(typeof value === "number" && Number.isNaN(value))) payload[field] = value;
      }
    };

    setIf("codigo_interno", row.codigo_interno, true);
    setIf("patrimonio", nullable(row.patrimonio));
    setIf("nome", row.nome, true);
    setIf("subcategoria", nullable(row.subcategoria));
    setIf("tipo_item", row.tipo_item, !update);
    setIf("marca", nullable(row.marca));
    setIf("modelo", nullable(row.modelo));
    setIf("numero_serie", nullable(row.numero_serie));
    setIf("codigo_barras", nullable(row.codigo_barras));
    setIf("descricao", row.descricao);
    setIf("especificacoes", row.especificacoes);
    setIf("voltagem", nullable(row.voltagem));
    setIf("potencia", nullable(row.potencia));
    setIf("capacidade", nullable(row.capacidade));
    setIf("fabricante", nullable(row.fabricante));
    setIf("quantidade", row.quantidade, !update);
    setIf("unidade", row.unidade, !update);
    setIf("armario", nullable(row.armario));
    setIf("prateleira", nullable(row.prateleira));
    setIf("responsavel", nullable(row.responsavel));
    setIf("status", row.status, !update);
    setIf("data_aquisicao", row.data_aquisicao);
    setIf("valor_unitario", row.valor_unitario);
    setIf("garantia_ate", row.garantia_ate);
    return payload;
  }

  async function ensureCategory(name, type) {
    const normalizedName = normalize(name);
    let category = state.categories.find(item => normalize(item.nome) === normalizedName && item.tipo === type);
    if (category) return category.id;
    if (!$("importCreateCategories")?.checked) return null;
    const { data, error } = await db().from("inv_categorias").insert({ nome: clean(name), tipo: type, descricao: "Criada automaticamente por importação de patrimônio." }).select("*").single();
    if (error) {
      if (/duplicate|unique/i.test(error.message || "")) {
        const { data: found, error: findError } = await db().from("inv_categorias").select("*").eq("tipo", type).ilike("nome", clean(name)).maybeSingle();
        if (findError) throw findError;
        if (found) { state.categories.push(found); return found.id; }
      }
      throw error;
    }
    state.categories.push(data);
    return data.id;
  }

  async function ensureLocationPath(parts) {
    const cleanParts = parts.map(clean).filter(Boolean);
    if (!cleanParts.length) return null;

    if (!$("importCreateLocations")?.checked) {
      const target = normalize(cleanParts[cleanParts.length - 1]);
      return state.locations.find(location => normalize(location.nome) === target || normalize(location.codigo) === target)?.id || null;
    }

    let parent = state.locations.find(location => normalize(location.codigo) === "lab")?.id
      || state.locations.find(location => normalize(location.nome) === "senai lab")?.id
      || null;
    let currentId = parent;

    for (let index = 0; index < cleanParts.length; index += 1) {
      const name = cleanParts[index];
      if (normalize(name) === "senai" || normalize(name) === "senai lab" || normalize(name) === "lab") continue;
      let found = state.locations.find(location => normalize(location.nome) === normalize(name) && String(location.parent_id || "") === String(currentId || ""));
      if (!found && index === cleanParts.length - 1) found = state.locations.find(location => normalize(location.nome) === normalize(name));
      if (!found) {
        const { data, error } = await db().from("inv_localizacoes").insert({ parent_id: currentId, nome: name, codigo: null, tipo: inferLocationType(name, index, cleanParts.length), descricao: "Criada automaticamente por importação de patrimônio." }).select("*").single();
        if (error) throw error;
        state.locations.push(data);
        found = data;
      }
      currentId = found.id;
    }
    return currentId;
  }

  async function logImportLine(batchId, row, action, itemId, message) {
    const compact = {
      codigo_interno: row.codigo_interno || null,
      patrimonio: row.patrimonio || null,
      nome: row.nome || null,
      categoria: row.categoria || null,
      tipo_item: row.tipo_item || null,
      quantidade: row.quantidade,
      unidade: row.unidade,
      localizacao: row.locationParts,
      status: row.status || null
    };
    const { error } = await db().from("inv_importacao_linhas").insert({
      importacao_id: batchId,
      numero_linha: row.number,
      origem: `${row.sourceName}${row.sheet ? ` · ${row.sheet}` : ""} · linha ${row.sourceLine}`,
      acao: action,
      identificador: row.patrimonio || row.codigo_interno || row.numero_serie || null,
      dados: compact,
      mensagem: message || null,
      item_id: itemId || null
    });
    if (error) throw error;
  }

  async function loadImportHistory() {
    const box = $("importHistory");
    if (!box || !state.profile?.ativo) return;
    try {
      const { data, error } = await db().from("inv_importacoes").select("*").order("criado_em", { ascending: false }).limit(40);
      if (error) throw error;
      state.imports = data || [];
      box.replaceChildren();
      if (!state.imports.length) return box.append(emptyNode("Nenhum upload processado ainda."));
      state.imports.forEach(batch => {
        const card = document.createElement("article");
        card.className = "import-history-card";
        card.innerHTML = `<div class="import-history-card__top"><div><h3>${escapeHtml(batch.arquivo_nome)}</h3><p>${escapeHtml(formatDateTime(batch.criado_em))} · ${escapeHtml(batch.arquivo_tipo.toUpperCase())}</p></div><span class="status" data-status="${escapeHtml(batchStatusTone(batch.status))}">${escapeHtml(batchStatusLabel(batch.status))}</span></div><div class="import-history-card__stats"><span>Total ${batch.total_linhas}</span><span>Novos ${batch.novos}</span><span>Atualizados ${batch.atualizados}</span><span>Ignorados ${batch.ignorados}</span><span>Erros ${batch.erros}</span></div>`;
        box.appendChild(card);
      });
    } catch (error) {
      if (/inv_importacoes|does not exist|relation/i.test(String(error?.message || error))) {
        box.replaceChildren(emptyNode("Execute supabase/03_importacoes_uploads.sql para ativar o histórico de uploads."));
      } else {
        box.replaceChildren(emptyNode(`Falha ao carregar histórico: ${error?.message || error}`));
      }
    }
  }

  function downloadProblems() {
    const problemRows = state.rows.filter(row => row.action === "erro");
    if (!problemRows.length) return;
    const values = [["Arquivo", "Linha", "Patrimônio", "Código", "Nome", "Problema"], ...problemRows.map(row => [row.sourceName, row.sourceLine, row.patrimonio, row.codigo_interno, row.nome, row.error])];
    const csv = values.map(row => row.map(csvValue).join(";")).join("\r\n");
    downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), `inconsistencias-importacao-${new Date().toISOString().slice(0,10)}.csv`);
  }

  function buildLocationParts(row) {
    const parts = [];
    if (row.localizacao) {
      const split = row.localizacao.split(/\s*(?:>|\/|\||;)\s*/).map(clean).filter(Boolean);
      if (split.length > 1) parts.push(...split);
      else parts.push(row.localizacao);
    }
    [row.sala, row.armario, row.prateleira].forEach(value => {
      if (value && !parts.some(part => normalize(part) === normalize(value))) parts.push(value);
    });
    return parts.filter((part, index, all) => all.findIndex(other => normalize(other) === normalize(part)) === index);
  }

  function inferLocationType(name, index, total) {
    const value = normalize(name);
    if (value.includes("sala")) return "sala";
    if (value.includes("almox")) return "almoxarifado";
    if (value.includes("armario") || value.includes("armário")) return "armario";
    if (value.includes("prateleira") || value.includes("estante") || value.includes("gaveta")) return "prateleira";
    if (index === total - 1) return "local";
    return "sala";
  }

  function inferType(row) {
    const text = normalize(`${row.categoria} ${row.nome}`);
    if (/filamento|chapa|resina|tinta|cola|papel|parafuso|consumivel|consumível/.test(text)) return "consumivel";
    if (/arduino|esp32|raspberry|sensor|servo|motor|driver|rele|relé|componente|modulo|módulo/.test(text)) return "componente";
    if (/epi|material|cabo|fio|ferragem/.test(text)) return "material";
    return "equipamento";
  }

  function inferCategory(row) {
    const text = normalize(`${row.nome} ${row.marca} ${row.modelo}`);
    const candidates = [
      ["Impressão 3D", /impressora 3d|ender|creality|bambu|filamento/],
      ["Corte e Gravação Laser", /laser|corte laser|gravadora/],
      ["Eletrônica", /multimetro|multímetro|osciloscopio|osciloscópio|fonte dc|estacao de solda|estação de solda/],
      ["Arduino / Microcontroladores", /arduino|esp32|raspberry|microcontrolador/],
      ["Sensores", /sensor/],
      ["Motores e Atuadores", /servo|motor|atuador/],
      ["Informática", /computador|notebook|monitor|teclado|mouse|tablet|roteador/],
      ["Ferramentas", /furadeira|parafusadeira|alicate|chave|serra|ferramenta/],
      ["Filamentos 3D", /filamento|pla\b|petg|abs\b|tpu/],
      ["Chapas e Materiais Laser", /mdf|acrilico|acrílico|chapa/]
    ];
    return candidates.find(([, regex]) => regex.test(text))?.[0] || "";
  }

  function normalizeType(value) {
    const normalized = normalize(value);
    if (!normalized) return "";
    return TYPE_MAP.get(normalized) || TYPE_MAP.get(normalized.replace(/s$/, "")) || "";
  }

  function normalizeStatus(value) {
    const normalized = normalize(value);
    if (!normalized) return "";
    return STATUS_MAP.get(normalized) || "";
  }

  function resolveHeader(value) {
    const key = normalizeHeader(value);
    return HEADER_ALIASES.get(key) || null;
  }

  function registerAliases(field, aliases) {
    aliases.forEach(alias => HEADER_ALIASES.set(normalizeHeader(alias), field));
  }

  function normalizeHeader(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function parseNumber(value) {
    const text = clean(value);
    if (!text) return NaN;
    const normalized = text.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
    const number = Number(normalized);
    return Number.isFinite(number) && number >= 0 ? number : NaN;
  }

  function parseMoney(value) {
    const number = parseNumber(value);
    return Number.isFinite(number) ? number : null;
  }

  function parseDate(value) {
    const text = clean(value);
    if (!text) return null;
    let match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
    if (match) {
      const year = match[3].length === 2 ? `20${match[3]}` : match[3];
      return `${year}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
    }
    match = text.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
    if (match) return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  function countActions() {
    return state.rows.reduce((acc, row) => { acc[row.action] = (acc[row.action] || 0) + 1; return acc; }, { novo: 0, atualizar: 0, ignorar: 0, erro: 0 });
  }

  function currentOptions() {
    return {
      atualizar_existentes: Boolean($("importUpdateExisting")?.checked),
      criar_localizacoes: Boolean($("importCreateLocations")?.checked),
      criar_categorias: Boolean($("importCreateCategories")?.checked)
    };
  }

  function setProcessing(value, text = "") {
    state.processing = value;
    toggleImportButtons(value);
    if (value && text) toast("Analisando", text, "info");
  }

  function toggleImportButtons(disabled) {
    ["btnAnalyzeImport", "btnClearImport", "btnConfirmImport", "btnChooseImportFiles"].forEach(id => { if ($(id)) $(id).disabled = disabled; });
  }

  function setProgress(percent, text) {
    if ($("importProgressBar")) $("importProgressBar").style.width = `${Math.max(0, Math.min(100, percent))}%`;
    if ($("importProgressText")) $("importProgressText").textContent = text;
  }

  function actionLabel(action) { return ({ novo: "Novo", atualizar: "Atualizar", ignorar: "Ignorar", erro: "Erro" })[action] || action; }
  function typeLabel(type) { return ({ equipamento: "Equipamento", material: "Material", componente: "Componente", consumivel: "Consumível" })[type] || type || "—"; }
  function statusLabel(status) { return ({ disponivel: "Disponível", em_uso: "Em uso", emprestado: "Emprestado", manutencao: "Manutenção", danificado: "Danificado", reservado: "Reservado", baixado: "Baixado", perdido: "Perdido" })[status] || status || "—"; }
  function batchStatusLabel(status) { return ({ analisando: "Analisando", pronto: "Pronto", importando: "Importando", concluido: "Concluído", concluido_com_erros: "Concluído com erros", falhou: "Falhou", cancelado: "Cancelado" })[status] || status; }
  function batchStatusTone(status) { if (status === "concluido") return "disponivel"; if (["falhou", "concluido_com_erros"].includes(status)) return "danificado"; if (status === "importando") return "em_uso"; return "reservado"; }

  function formatDateTime(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  function formatNumber(value) { return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(value || 0)); }
  function formatBytes(bytes) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
  function fileExtension(name) { return String(name || "").split(".").pop().toLowerCase(); }
  function mimeFor(name) { const ext = fileExtension(name); return ({ xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel", csv: "text/csv", pdf: "application/pdf" })[ext] || "application/octet-stream"; }
  function safeFileName(name) { return String(name || "arquivo").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120); }
  function clean(value) { return String(value ?? "").trim(); }
  function nullable(value) { const text = clean(value); return text ? text : null; }
  function normalize(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function setText(id, value) { if ($(id)) $(id).textContent = String(value ?? ""); }

  function emptyNode(text) { const node = document.createElement("div"); node.className = "empty"; node.textContent = text; return node; }
  function toast(title, text, tone = "info") {
    const stack = $("toastStack");
    if (!stack) return console.log(title, text);
    const node = document.createElement("div");
    node.className = "toast";
    node.dataset.tone = tone;
    const strong = document.createElement("strong"); strong.textContent = title;
    const span = document.createElement("span"); span.textContent = text;
    node.append(strong, span); stack.appendChild(node); setTimeout(() => node.remove(), 5500);
  }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
  function csvValue(value) { let text = String(value ?? ""); if (/^[=+\-@]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; }
  function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); }
})();
