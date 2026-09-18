(() => {
  "use strict";

  const VERSION = "2.3.0";
  const CFG = {
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
    items: [],
    categories: [],
    locations: [],
    imports: [],
    prefix: "LAB-INV",
    moduleReady: false,
    processing: false,
    warnings: []
  };

  const $ = id => document.getElementById(id);
  const db = () => obterInventarioSupabase();

  const aliases = new Map();
  addAliases("codigo_interno", ["codigo", "código", "codigo interno", "código interno", "cod interno", "cod.", "id item", "codigo do item", "código do item"]);
  addAliases("patrimonio", ["patrimonio", "patrimônio", "n patrimonio", "nº patrimonio", "numero patrimonio", "número patrimônio", "tombamento", "tombo", "plaqueta", "placa patrimonio", "placa patrimônio"]);
  addAliases("nome", ["nome", "item", "bem", "descricao do bem", "descrição do bem", "nome do bem", "nome do item", "equipamento", "material"]);
  addAliases("descricao", ["descricao", "descrição", "detalhamento", "observacao descritiva", "observação descritiva"]);
  addAliases("observacoes", ["observacoes", "observações", "observacao", "observação", "obs", "obs."]);
  addAliases("categoria", ["categoria", "grupo", "classe", "familia", "família"]);
  addAliases("subcategoria", ["subcategoria", "sub categoria", "subgrupo", "sub grupo"]);
  addAliases("tipo_item", ["tipo", "tipo item", "tipo do item", "natureza"]);
  addAliases("marca", ["marca"]);
  addAliases("modelo", ["modelo"]);
  addAliases("numero_serie", ["serie", "série", "numero de serie", "número de série", "n serie", "serial"]);
  addAliases("codigo_barras", ["codigo de barras", "código de barras", "barcode", "ean", "gtin"]);
  addAliases("quantidade", ["quantidade", "qtd", "qtde", "saldo", "quant."]);
  addAliases("unidade", ["unidade", "un", "und", "unid", "unidade medida", "unidade de medida"]);
  addAliases("localizacao", ["localizacao", "localização", "local", "setor", "ambiente", "lotacao", "lotação", "onde esta", "onde está"]);
  addAliases("sala", ["sala", "sala laboratorio", "sala laboratório", "laboratorio", "laboratório"]);
  addAliases("armario", ["armario", "armário", "gabinete"]);
  addAliases("prateleira", ["prateleira", "estante", "gaveta"]);
  addAliases("responsavel", ["responsavel", "responsável", "custodiante", "usuario responsavel", "usuário responsável"]);
  addAliases("status", ["status", "situacao", "situação", "estado", "condicao", "condição"]);
  addAliases("data_aquisicao", ["data aquisicao", "data aquisição", "aquisicao", "aquisição", "data compra", "data de compra"]);
  addAliases("valor_unitario", ["valor", "valor unitario", "valor unitário", "preco", "preço", "valor aquisicao", "valor aquisição"]);
  addAliases("garantia_ate", ["garantia", "garantia ate", "garantia até", "fim garantia", "validade garantia"]);
  addAliases("voltagem", ["voltagem", "tensao", "tensão"]);
  addAliases("potencia", ["potencia", "potência"]);
  addAliases("capacidade", ["capacidade"]);
  addAliases("fabricante", ["fabricante", "manufacturer"]);
  addAliases("especificacoes", ["especificacoes", "especificações", "especificacao", "especificação"]);

  const statusMap = new Map([
    ["disponivel", "disponivel"], ["livre", "disponivel"], ["ativo", "disponivel"], ["bom", "disponivel"],
    ["em uso", "em_uso"], ["uso", "em_uso"], ["utilizacao", "em_uso"],
    ["emprestado", "emprestado"], ["emprestimo", "emprestado"],
    ["manutencao", "manutencao"], ["em manutencao", "manutencao"],
    ["danificado", "danificado"], ["avariado", "danificado"], ["quebrado", "danificado"],
    ["reservado", "reservado"], ["reserva", "reservado"],
    ["baixado", "baixado"], ["baixa", "baixado"], ["inativo", "baixado"],
    ["perdido", "perdido"], ["extraviado", "perdido"]
  ]);

  const typeMap = new Map([
    ["equipamento", "equipamento"], ["equipamentos", "equipamento"], ["maquina", "equipamento"],
    ["material", "material"], ["materiais", "material"],
    ["componente", "componente"], ["componentes", "componente"], ["peca", "componente"],
    ["consumivel", "consumivel"], ["consumiveis", "consumivel"]
  ]);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  function boot() {
    removeLegacyModule();
    injectUi();
    bindEvents();
    observeAuth();
    refreshAccess();
    window.SenaiInventarioImportador = { version: VERSION };
  }

  function removeLegacyModule() {
    $("navUploads")?.remove();
    $("view-uploads")?.remove();
  }

  function injectUi() {
    if ($("view-uploads-v2")) return;

    const reportsButton = document.querySelector('.nav-button[data-view="relatorios"]');
    const nav = document.createElement("button");
    nav.id = "navUploadsV2";
    nav.type = "button";
    nav.className = "nav-button";
    nav.dataset.view = "uploads-v2";
    nav.hidden = true;
    nav.innerHTML = '<span class="nav-icon">⇧</span>Uploads / Importar';
    reportsButton?.parentNode?.insertBefore(nav, reportsButton);

    const content = document.querySelector(".content");
    if (!content) return;

    const section = document.createElement("section");
    section.id = "view-uploads-v2";
    section.className = "view";
    section.dataset.active = "false";
    section.innerHTML = `
      <div class="import-shell">
        <article class="panel">
          <header class="panel-header">
            <div>
              <h2>Uploads / Importação de patrimônio</h2>
              <p>Envie planilhas ou PDF e organize o patrimônio atual do laboratório com prévia antes de gravar.</p>
            </div>
            <span id="v2ImportStatus" class="status" data-status="reservado">Verificando</span>
          </header>
          <div class="panel-body">
            <div id="v2ImportError" class="import-error" hidden></div>
            <div id="v2ImportDropzone" class="import-dropzone">
              <input id="v2ImportFile" class="import-file-input" type="file" multiple accept=".xlsx,.xls,.csv,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/pdf">
              <div>
                <strong>Selecione a planilha ou PDF do patrimônio atual</strong>
                <p>Excel (.xlsx/.xls), CSV e PDF com texto selecionável. Até ${CFG.maxFiles} arquivos, 20 MB por arquivo.</p>
                <button id="v2ChooseFiles" class="button" type="button">Selecionar arquivos</button>
              </div>
            </div>
            <div id="v2ImportFiles" class="import-files"></div>
          </div>
        </article>

        <article class="panel">
          <header class="panel-header"><div><h2>Regras da importação</h2><p>O sistema reconhece os itens, mas você confirma a prévia antes da gravação.</p></div></header>
          <div class="panel-body">
            <div class="import-options">
              <div class="import-option"><label><input id="v2UpdateExisting" type="checkbox" checked disabled> Reimportar itens existentes</label><small>A mesma planilha pode ser enviada quantas vezes quiser. Itens existentes são atualizados e itens baixados pela limpeza podem ser reativados.</small></div>
              <div class="import-option"><label><input id="v2CreateLocations" type="checkbox" checked> Criar localizações ausentes</label><small>Monta Sala → Armário → Prateleira abaixo do SENAI Lab quando essas informações estiverem no arquivo.</small></div>
              <div class="import-option"><label><input id="v2CreateCategories" type="checkbox" checked> Criar categorias ausentes</label><small>Categorias reconhecidas no arquivo podem ser criadas automaticamente.</small></div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
              <button id="v2Analyze" class="button" type="button">Analisar arquivos</button>
              <button id="v2Clear" class="button button--secondary" type="button">Limpar</button>
              <a class="button button--secondary" href="./modelos/modelo-importacao-patrimonio.csv" download>Baixar modelo CSV</a>
            </div>
          </div>
        </article>

        <article id="v2PreviewPanel" class="panel" hidden>
          <header class="panel-header">
            <div><h2>Prévia</h2><p>Nada é gravado enquanto você não confirmar.</p></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button id="v2DownloadErrors" class="button button--secondary button--small" type="button" hidden>Baixar inconsistências</button>
              <button id="v2Confirm" class="button" type="button">Confirmar importação</button>
            </div>
          </header>
          <div class="panel-body">
            <div class="import-summary">
              <div class="import-stat"><span>Linhas</span><strong id="v2Total">0</strong></div>
              <div class="import-stat" data-tone="success"><span>Novos</span><strong id="v2New">0</strong></div>
              <div class="import-stat"><span>Atualizações</span><strong id="v2Update">0</strong></div>
              <div class="import-stat" data-tone="warning"><span>Ignorados</span><strong id="v2Ignore">0</strong></div>
              <div class="import-stat" data-tone="danger"><span>Erros</span><strong id="v2Errors">0</strong></div>
            </div>
            <div id="v2Warnings" style="display:grid;gap:8px;margin:12px 0"></div>
            <div class="import-warning" style="margin-bottom:12px">Segurança: item existente só terá o código interno alterado quando a planilha trouxer explicitamente uma coluna de código. Código gerado automaticamente é usado apenas em itens novos.</div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Ação</th><th>Origem</th><th>Patrimônio</th><th>Item</th><th>Categoria / tipo</th><th>Qtd.</th><th>Localização</th><th>Status</th><th>Observação</th></tr></thead>
                <tbody id="v2PreviewBody"></tbody>
              </table>
            </div>
          </div>
        </article>

        <article id="v2ProgressPanel" class="panel" hidden>
          <header class="panel-header"><div><h2>Importando</h2><p id="v2ProgressText">Preparando...</p></div></header>
          <div class="panel-body"><div class="import-progress"><span id="v2ProgressBar"></span></div></div>
        </article>

        <article class="panel import-danger-zone">
          <header class="panel-header">
            <div>
              <h2>Limpeza de itens importados</h2>
              <p>Remove do inventário ativo apenas os itens que foram criados pelo módulo de importação. Cadastros manuais e o histórico dos lotes são preservados.</p>
            </div>
            <button id="v2DeleteAllImported" class="button button--danger" type="button">Excluir todos os itens importados</button>
          </header>
          <div class="panel-body import-danger-zone__body">
            <div>
              <strong id="v2ImportedDeleteSummary">Verificando itens importados...</strong>
              <small>Itens com empréstimo ou solicitação em aberto não serão removidos até a pendência ser encerrada.</small>
            </div>
          </div>
        </article>

        <article class="panel">
          <header class="panel-header"><div><h2>Histórico de uploads</h2><p>Arquivos processados e resumo de cada lote.</p></div><button id="v2RefreshHistory" class="button button--secondary button--small" type="button">Atualizar</button></header>
          <div id="v2History" class="panel-body import-history"><div class="empty">Entre no sistema para consultar.</div></div>
        </article>
      </div>`;

    const reportsView = $("view-relatorios");
    content.insertBefore(section, reportsView || null);
  }

  function bindEvents() {
    $("navUploadsV2")?.addEventListener("click", openView);
    $("v2ChooseFiles")?.addEventListener("click", () => $("v2ImportFile")?.click());
    $("v2ImportFile")?.addEventListener("change", event => addFiles(event.target.files));
    $("v2Analyze")?.addEventListener("click", analyzeFiles);
    $("v2Clear")?.addEventListener("click", clearAll);
    $("v2Confirm")?.addEventListener("click", confirmImport);
    $("v2DownloadErrors")?.addEventListener("click", downloadErrors);
    $("v2RefreshHistory")?.addEventListener("click", loadHistory);
    $("v2DeleteAllImported")?.addEventListener("click", deleteAllImportedItems);

    const zone = $("v2ImportDropzone");
    if (zone) {
      ["dragenter", "dragover"].forEach(type => zone.addEventListener(type, event => {
        event.preventDefault();
        zone.dataset.drag = "true";
      }));
      ["dragleave", "drop"].forEach(type => zone.addEventListener(type, event => {
        event.preventDefault();
        zone.dataset.drag = "false";
      }));
      zone.addEventListener("drop", event => addFiles(event.dataTransfer?.files));
    }
  }

  function observeAuth() {
    try {
      db().auth.onAuthStateChange(() => setTimeout(refreshAccess, 0));
    } catch (_) {}

    const shell = $("appShell");
    if (shell) {
      new MutationObserver(() => {
        if (!shell.hidden) setTimeout(refreshAccess, 0);
      }).observe(shell, { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  async function refreshAccess() {
    try {
      const { data: { user } } = await db().auth.getUser();
      if (!user) return applyAccess(null);
      const { data, error } = await db().from("inv_perfis").select("user_id,nome,email,papel,ativo").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      applyAccess(data);
    } catch (error) {
      console.warn("Importador V2: falha ao validar perfil", error);
      applyAccess(null);
    }
  }

  function applyAccess(profile) {
    state.profile = profile;
    const allowed = Boolean(profile?.ativo && ["administrador", "gestor"].includes(profile.papel));
    if ($("navUploadsV2")) $("navUploadsV2").hidden = !allowed;
    if (!allowed && $("view-uploads-v2")?.dataset.active === "true") {
      document.querySelector('.nav-button[data-view="dashboard"]')?.click();
    }
    if (allowed) {
      checkModule();
      loadHistory();
      loadImportedDeleteSummary();
    }
  }

  function openView() {
    if (!state.profile?.ativo || !["administrador", "gestor"].includes(state.profile.papel)) return;
    document.querySelectorAll(".view").forEach(view => view.dataset.active = String(view.id === "view-uploads-v2"));
    document.querySelectorAll(".nav-button[data-view]").forEach(button => {
      if (button.id === "navUploadsV2") button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    setText("pageTitle", "Uploads / Importar");
    setText("pageSubtitle", "Planilhas e PDFs organizados automaticamente no patrimônio");
    if ($("sidebar")) $("sidebar").dataset.open = "false";
    checkModule();
    loadHistory();
    loadImportedDeleteSummary();
  }

  async function checkModule() {
    const badge = $("v2ImportStatus");
    const box = $("v2ImportError");
    try {
      const { error } = await db().from("inv_importacoes").select("id").limit(1);
      if (error) throw error;
      state.moduleReady = true;
      if (badge) {
        badge.textContent = "Pronto";
        badge.dataset.status = "disponivel";
      }
      if (box) box.hidden = true;
      return true;
    } catch (error) {
      state.moduleReady = false;
      if (badge) {
        badge.textContent = "Ativação necessária";
        badge.dataset.status = "danificado";
      }
      if (box) {
        box.textContent = /inv_importacoes|does not exist|relation/i.test(String(error?.message || error))
          ? "Execute a migration supabase/03_importacoes_uploads.sql no Supabase. A análise funciona sem ela, mas a confirmação e o histórico precisam dessa migration."
          : `Falha ao verificar o módulo: ${error?.message || error}`;
        box.hidden = false;
      }
      return false;
    }
  }

  function addFiles(fileList) {
    for (const file of Array.from(fileList || [])) {
      if (state.files.length >= CFG.maxFiles) break;
      const ext = extension(file.name);
      if (!["xlsx", "xls", "csv", "pdf"].includes(ext)) {
        toast("Arquivo ignorado", `${file.name}: formato não suportado.`, "warning");
        continue;
      }
      if (file.size > CFG.maxFileSize) {
        toast("Arquivo ignorado", `${file.name}: máximo de 20 MB.`, "warning");
        continue;
      }
      const duplicate = state.files.some(current => current.name === file.name && current.size === file.size && current.lastModified === file.lastModified);
      if (!duplicate) state.files.push(file);
    }
    renderFiles();
    if ($("v2ImportFile")) $("v2ImportFile").value = "";
  }

  function renderFiles() {
    const box = $("v2ImportFiles");
    if (!box) return;
    box.replaceChildren();
    state.files.forEach((file, index) => {
      const row = document.createElement("div");
      row.className = "import-file";
      row.innerHTML = `<div class="import-file__meta"><strong>${esc(file.name)}</strong><span>${extension(file.name).toUpperCase()} · ${formatBytes(file.size)}</span></div><button class="button button--secondary button--small" type="button" data-v2-remove="${index}">Remover</button>`;
      box.appendChild(row);
    });
    box.querySelectorAll("[data-v2-remove]").forEach(button => button.addEventListener("click", () => {
      state.files.splice(Number(button.dataset.v2Remove), 1);
      renderFiles();
    }));
  }

  function clearAll() {
    if (state.processing) return;
    state.files = [];
    state.rows = [];
    state.warnings = [];
    renderFiles();
    if ($("v2PreviewPanel")) $("v2PreviewPanel").hidden = true;
    if ($("v2ProgressPanel")) $("v2ProgressPanel").hidden = true;
  }

  async function analyzeFiles() {
    if (state.processing) return;
    if (!state.files.length) return toast("Selecione um arquivo", "Escolha uma planilha, CSV ou PDF.", "warning");

    setBusy(true, "Analisando arquivos...");
    state.rows = [];
    state.warnings = [];

    try {
      await loadReferences();
      let sequence = 0;

      for (const file of state.files) {
        const ext = extension(file.name);
        const parsed = ext === "pdf" ? await parsePdf(file) : await parseSpreadsheet(file);
        (parsed.warnings || []).forEach(text => state.warnings.push(`${file.name}: ${text}`));

        for (const raw of parsed.rows || []) {
          sequence += 1;
          if (sequence > CFG.maxRows) throw new Error(`A análise aceita até ${CFG.maxRows.toLocaleString("pt-BR")} linhas por lote.`);
          state.rows.push(prepareRow(raw, file.name, sequence));
        }
      }

      if (!state.rows.length) throw new Error("Nenhum item foi reconhecido. Confira os cabeçalhos ou use um PDF com texto selecionável.");

      classifyRows();
      assignCodesOnlyToNewItems();
      renderPreview();
      $("v2PreviewPanel").hidden = false;
      $("v2PreviewPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      console.error("Importador V2: análise falhou", error);
      toast("Não foi possível analisar", error?.message || String(error), "danger");
    } finally {
      setBusy(false);
    }
  }

  async function loadReferences() {
    const [items, categories, locations, settings] = await Promise.all([
      fetchAll("inv_itens", "*", query => query.order("nome")),
      fetchAll("inv_categorias", "*", query => query.eq("ativo", true).order("nome")),
      fetchAll("inv_localizacoes", "*", query => query.eq("ativo", true).order("nome")),
      db().from("inv_configuracoes").select("chave,valor").eq("chave", "geral").maybeSingle()
    ]);

    state.items = items;
    state.categories = categories;
    state.locations = locations;
    if (settings.error) throw settings.error;
    state.prefix = clean(settings.data?.valor?.prefixo_codigo) || "LAB-INV";
  }

  async function fetchAll(table, select, mutate) {
    const rows = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      let query = db().from(table).select(select).range(from, from + pageSize - 1);
      if (mutate) query = mutate(query);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
      from += pageSize;
      if (from > 50000) break;
    }
    return rows;
  }

  async function parseSpreadsheet(file) {
    if (!window.XLSX) throw new Error("Leitor de planilhas não carregado.");
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const rows = [];
    const warnings = [];

    for (const sheetName of workbook.SheetNames) {
      const matrix = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
      if (!matrix.length) continue;
      const header = detectSpreadsheetHeader(matrix);
      if (!header || header.score < 2) {
        warnings.push(`aba “${sheetName}” ignorada: cabeçalhos não reconhecidos.`);
        continue;
      }

      for (let rowIndex = header.index + 1; rowIndex < matrix.length; rowIndex += 1) {
        const values = matrix[rowIndex] || [];
        if (values.every(value => clean(value) === "")) continue;
        const record = { _sourceLine: rowIndex + 1, _sheet: sheetName, _provided: [] };
        header.fields.forEach((field, columnIndex) => {
          if (!field) return;
          const value = values[columnIndex];
          if (clean(value) === "") return;
          record[field] = value;
          record._provided.push(field);
        });
        if (rowHasIdentity(record)) rows.push(record);
      }
    }

    return { rows, warnings };
  }

  function detectSpreadsheetHeader(matrix) {
    let best = null;
    const limit = Math.min(30, matrix.length);
    for (let index = 0; index < limit; index += 1) {
      const fields = resolveSpreadsheetFields(matrix[index] || []);
      const unique = new Set(fields.filter(Boolean));
      let score = unique.size;
      if (unique.has("nome")) score += 2;
      if (unique.has("patrimonio")) score += 2;
      if (unique.has("codigo_interno")) score += 1;
      if (!best || score > best.score) best = { index, fields, score };
    }
    return best;
  }

  function resolveSpreadsheetFields(headerRow) {
    const normalized = headerRow.map(normalize);
    const senaiPatrimonial = normalized.includes("entidade")
      && normalized.includes("codigo")
      && normalized.includes("descricao");

    return headerRow.map(value => {
      const key = normalize(value);

      // Modelo patrimonial oficial utilizado na unidade:
      // ENTIDADE | CÓDIGO | DESCRIÇÃO | STATUS | ... | LOCALIZAÇÃO
      // Nesse formato, CÓDIGO é o número patrimonial e DESCRIÇÃO é o nome do bem.
      if (senaiPatrimonial && key === "codigo") return "patrimonio";
      if (senaiPatrimonial && key === "descricao") return "nome";

      return resolveHeader(value);
    });
  }

  async function parsePdf(file) {
    await ensurePdfJs();
    let pdf;
    try {
      pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    } catch (error) {
      throw new Error(`Não foi possível abrir o PDF ${file.name}.`);
    }

    const rows = [];
    const warnings = [];
    let totalTokens = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      totalTokens += content.items?.length || 0;
      const lines = groupPdfLines(content.items || []);
      let header = null;

      for (const line of lines) {
        const candidate = detectPdfHeader(line);
        if (candidate.score >= 2) {
          header = candidate;
          continue;
        }
        if (!header) continue;
        const record = pdfLineToRecord(line, header, pageNumber);
        if (record && rowHasIdentity(record)) rows.push(record);
      }
    }

    if (!totalTokens) {
      throw new Error("O PDF parece ser digitalização/imagem e não possui texto selecionável. Use o XLSX/CSV original ou gere um PDF pesquisável.");
    }
    if (!rows.length) warnings.push("há texto no PDF, mas nenhuma tabela de patrimônio foi reconhecida. Planilhas XLSX/CSV dão o melhor resultado.");
    return { rows, warnings };
  }

  function groupPdfLines(items) {
    const tokens = items
      .filter(item => clean(item.str))
      .map(item => ({ text: clean(item.str), x: Number(item.transform?.[4] || 0), y: Number(item.transform?.[5] || 0), width: Number(item.width || 0) }))
      .sort((a, b) => Math.abs(b.y - a.y) > 2.8 ? b.y - a.y : a.x - b.x);

    const lines = [];
    for (const token of tokens) {
      let line = lines.find(candidate => Math.abs(candidate.y - token.y) <= 2.8);
      if (!line) {
        line = { y: token.y, tokens: [] };
        lines.push(line);
      }
      line.tokens.push(token);
    }
    lines.sort((a, b) => b.y - a.y);
    lines.forEach(line => line.tokens.sort((a, b) => a.x - b.x));
    return lines;
  }

  function detectPdfHeader(line) {
    const cells = groupPdfCells(line.tokens);
    const columns = cells.map(cell => ({ x: cell.x, field: resolveHeader(cell.text), text: cell.text })).filter(column => column.field);
    const unique = new Set(columns.map(column => column.field));
    let score = unique.size;
    if (unique.has("nome")) score += 2;
    if (unique.has("patrimonio")) score += 2;
    return { columns, score };
  }

  function groupPdfCells(tokens) {
    const cells = [];
    let current = null;
    for (const token of tokens) {
      if (!current) {
        current = { x: token.x, end: token.x + token.width, text: token.text };
        cells.push(current);
        continue;
      }
      const gap = token.x - current.end;
      if (gap > 18) {
        current = { x: token.x, end: token.x + token.width, text: token.text };
        cells.push(current);
      } else {
        current.text += ` ${token.text}`;
        current.end = Math.max(current.end, token.x + token.width);
      }
    }
    return cells;
  }

  function pdfLineToRecord(line, header, pageNumber) {
    if (!header.columns.length) return null;
    const columns = [...header.columns].sort((a, b) => a.x - b.x);
    const record = { _sourceLine: pageNumber, _sheet: `PDF pág. ${pageNumber}`, _provided: [] };
    for (const token of line.tokens) {
      let target = columns[0];
      for (const column of columns) {
        if (column.x <= token.x + 5) target = column;
        else break;
      }
      if (!target?.field) continue;
      record[target.field] = record[target.field] ? `${record[target.field]} ${token.text}` : token.text;
      if (!record._provided.includes(target.field)) record._provided.push(target.field);
    }
    return record;
  }

  async function ensurePdfJs() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = CFG.pdfWorkerUrl;
      return;
    }
    await loadScript(CFG.pdfJsUrl);
    if (!window.pdfjsLib) throw new Error("Leitor de PDF não carregado.");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = CFG.pdfWorkerUrl;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const current = document.querySelector(`script[src="${src}"]`);
      if (current) {
        if (current.dataset.ready === "true") return resolve();
        current.addEventListener("load", resolve, { once: true });
        current.addEventListener("error", () => reject(new Error("Falha ao carregar leitor de PDF.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.addEventListener("load", () => {
        script.dataset.ready = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error("Falha ao carregar leitor de PDF.")), { once: true });
      document.head.appendChild(script);
    });
  }

  function prepareRow(raw, sourceName, number) {
    const provided = [...new Set(raw._provided || [])];
    const row = {
      number,
      sourceName,
      sourceLine: raw._sourceLine || number,
      sheet: raw._sheet || "",
      provided,
      codigo_interno: cleanIdentifier(raw.codigo_interno),
      patrimonio: cleanIdentifier(raw.patrimonio),
      nome: clean(raw.nome),
      descricao: clean(raw.descricao),
      observacoes: clean(raw.observacoes),
      categoria: clean(raw.categoria),
      subcategoria: clean(raw.subcategoria),
      tipo_item: normalizeType(raw.tipo_item),
      marca: clean(raw.marca),
      modelo: clean(raw.modelo),
      numero_serie: cleanIdentifier(raw.numero_serie),
      codigo_barras: cleanIdentifier(raw.codigo_barras),
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
      existingItem: null,
      error: "",
      message: "",
      inferred: [],
      reactivate: false
    };

    if (!row.nome && row.descricao) {
      row.nome = row.descricao;
      row.inferred.push("nome=descrição");
    }
    if (!row.localizacao && normalize(row.sheet) === "senai lab") {
      row.localizacao = "SENAI Lab";
      row.inferred.push("localização=SENAI Lab");
    }
    if (!row.nome) {
      row.action = "erro";
      row.error = "Nome/Descrição do bem não foi reconhecido.";
    }
    if (!row.tipo_item) {
      row.tipo_item = inferType(row);
      row.inferred.push(`tipo=${row.tipo_item}`);
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
      const category = inferCategory(row);
      if (category) {
        row.categoria = category;
        row.inferred.push(`categoria=${category}`);
      }
    }
    row.locationParts = buildLocationParts(row);
    return row;
  }

  function classifyRows() {
    const index = buildExistingIndex();
    const seen = new Map();

    for (const row of state.rows) {
      if (row.action === "erro") continue;
      const matches = new Set();
      if (row.patrimonio) addMatch(matches, index.patrimonio.get(normalize(row.patrimonio)));
      if (row.codigo_interno) addMatch(matches, index.codigo.get(normalize(row.codigo_interno)));
      if (row.numero_serie) addMatch(matches, index.serie.get(normalize(row.numero_serie)));
      if (row.codigo_barras) addMatch(matches, index.barras.get(normalize(row.codigo_barras)));

      if (matches.size > 1) {
        row.action = "erro";
        row.error = "Patrimônio/código/série apontam para registros diferentes já cadastrados.";
        continue;
      }

      if (matches.size === 1) {
        row.existingItem = [...matches][0];
        row.reactivate = row.existingItem.ativo === false;
        row.action = "atualizar";
        row.message = row.reactivate
          ? `Reativará ${row.existingItem.nome} e aplicará novamente os dados desta planilha.`
          : `Reimportará ${row.existingItem.nome} atualizando os dados reconhecidos.`;
        if (!row.provided.includes("codigo_interno")) row.codigo_interno = row.existingItem.codigo_interno || "";
        continue;
      }

      const keys = identifierKeys(row);
      const duplicateKey = keys.find(key => seen.has(key));
      if (duplicateKey) {
        row.action = "ignorar";
        row.message = `Registro repetido no arquivo; a primeira ocorrência (linha ${seen.get(duplicateKey)}) será utilizada.`;
        continue;
      }
      keys.forEach(key => seen.set(key, row.number));
    }
  }

  function buildExistingIndex() {
    const index = { patrimonio: new Map(), codigo: new Map(), serie: new Map(), barras: new Map() };
    state.items.forEach(item => {
      if (item.patrimonio) index.patrimonio.set(normalize(item.patrimonio), item);
      if (item.codigo_interno) index.codigo.set(normalize(item.codigo_interno), item);
      if (item.numero_serie) index.serie.set(normalize(item.numero_serie), item);
      if (item.codigo_barras) index.barras.set(normalize(item.codigo_barras), item);
    });
    return index;
  }

  function assignCodesOnlyToNewItems() {
    const used = new Set(state.items.map(item => normalize(item.codigo_interno)).filter(Boolean));
    state.rows.forEach(row => {
      if (row.codigo_interno) used.add(normalize(row.codigo_interno));
    });

    let next = state.items.reduce((highest, item) => {
      const match = String(item.codigo_interno || "").match(/(\d+)$/);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0) + 1;

    for (const row of state.rows) {
      if (row.action !== "novo" || row.codigo_interno) continue;
      let code;
      do {
        code = `${state.prefix}-${String(next++).padStart(4, "0")}`;
      } while (used.has(normalize(code)));
      row.codigo_interno = code;
      row.inferred.push(`código=${code}`);
      used.add(normalize(code));
    }
  }

  function renderPreview() {
    const counts = countActions();
    setText("v2Total", state.rows.length);
    setText("v2New", counts.novo);
    setText("v2Update", counts.atualizar);
    setText("v2Ignore", counts.ignorar);
    setText("v2Errors", counts.erro);
    if ($("v2DownloadErrors")) $("v2DownloadErrors").hidden = counts.erro === 0;
    if ($("v2Confirm")) $("v2Confirm").disabled = counts.novo + counts.atualizar === 0;

    const warnings = $("v2Warnings");
    if (warnings) {
      warnings.replaceChildren();
      state.warnings.forEach(text => {
        const node = document.createElement("div");
        node.className = "import-warning";
        node.textContent = text;
        warnings.appendChild(node);
      });
    }

    const body = $("v2PreviewBody");
    if (!body) return;
    body.replaceChildren();

    state.rows.slice(0, 2000).forEach(row => {
      const tr = document.createElement("tr");
      const note = row.error || row.message || (row.inferred.length ? `Inferido: ${row.inferred.join(", ")}` : "Pronto");
      tr.innerHTML = `
        <td><span class="import-action" data-action="${esc(row.action)}">${esc(actionLabel(row.action))}</span></td>
        <td>${esc(row.sourceName)}<div class="muted">${esc(row.sheet || "")} · linha ${esc(row.sourceLine)}</div></td>
        <td>${esc(row.patrimonio || "—")}</td>
        <td><div class="item-name"><strong>${esc(row.nome || "—")}</strong><span>${esc(row.codigo_interno || "—")}${row.marca ? ` · ${esc(row.marca)}` : ""}</span></div></td>
        <td>${esc(row.categoria || "Sem categoria")}<div class="muted">${esc(typeLabel(row.tipo_item))}</div></td>
        <td>${esc(formatNumber(row.quantidade))} ${esc(row.unidade || "un")}</td>
        <td>${esc(row.locationParts.length ? row.locationParts.join(" → ") : "Sem localização")}</td>
        <td>${esc(statusLabel(row.status))}</td>
        <td><div class="import-row-message ${row.error ? "text-danger" : ""}">${esc(note)}</div></td>`;
      body.appendChild(tr);
    });

    if (state.rows.length > 2000) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="9"><div class="import-warning">A tela mostra 2.000 linhas para manter o desempenho. O lote completo de ${state.rows.length.toLocaleString("pt-BR")} linhas será processado.</div></td>`;
      body.appendChild(tr);
    }
  }

  async function confirmImport() {
    if (state.processing) return;
    const actionable = state.rows.filter(row => ["novo", "atualizar"].includes(row.action));
    if (!actionable.length) return toast("Nada para importar", "Não há itens novos ou atualizáveis.", "warning");
    if (!(await checkModule())) return toast("Ativação necessária", "Execute a migration 03 no Supabase antes de confirmar.", "danger");
    if (!window.confirm(`Confirmar a importação de ${actionable.length} item(ns)?`)) return;

    state.processing = true;
    toggleButtons(true);
    $("v2ProgressPanel").hidden = false;
    setProgress(0, "Criando lote...");

    let batch = null;
    const counters = {
      novo: 0,
      atualizar: 0,
      ignorar: state.rows.filter(row => row.action === "ignorar").length,
      erro: state.rows.filter(row => row.action === "erro").length
    };

    try {
      const { data: { user } } = await db().auth.getUser();
      if (!user) throw new Error("Sessão expirada. Entre novamente.");

      const types = new Set(state.files.map(file => extension(file.name)));
      const { data: created, error: createError } = await db().from("inv_importacoes").insert({
        arquivo_nome: state.files.map(file => file.name).join(" + ").slice(0, 1000),
        arquivo_tipo: types.size === 1 ? [...types][0] : "misto",
        status: "importando",
        total_linhas: state.rows.length,
        novos: 0,
        atualizados: 0,
        ignorados: counters.ignorar,
        erros: counters.erro,
        criado_por: user.id,
        resumo: { versao_importador: VERSION, opcoes: optionsSnapshot() }
      }).select("*").single();
      if (createError) throw createError;
      batch = created;

      const storedFiles = [];
      for (let index = 0; index < state.files.length; index += 1) {
        const file = state.files[index];
        setProgress(2 + (index / Math.max(1, state.files.length)) * 6, `Guardando ${file.name}...`);
        const path = `importacoes/${batch.id}/${Date.now()}-${safeFileName(file.name)}`;
        const { error } = await db().storage.from("inventario-privado").upload(path, file, { upsert: false, contentType: file.type || mimeFor(file.name) });
        if (error) throw error;
        storedFiles.push({ nome: file.name, path, tipo: extension(file.name), tamanho: file.size });
      }
      await db().from("inv_importacoes").update({ arquivos: storedFiles }).eq("id", batch.id);

      let completed = 0;
      for (const row of state.rows) {
        if (!["novo", "atualizar"].includes(row.action)) {
          await logLine(batch.id, row, row.action, null, row.error || row.message || "Ignorado.");
          continue;
        }

        try {
          const itemId = await importRow(row, user.id);
          counters[row.action] += 1;
          await logLine(batch.id, row, row.action, itemId, "Processado com sucesso.");
        } catch (error) {
          counters.erro += 1;
          row.action = "erro";
          row.error = error?.message || String(error);
          await logLine(batch.id, row, "erro", null, row.error).catch(() => {});
        }
        completed += 1;
        setProgress(8 + (completed / actionable.length) * 90, `Importando ${completed} de ${actionable.length}...`);
      }

      const finalStatus = counters.erro > 0 ? "concluido_com_erros" : "concluido";
      const { error: finishError } = await db().from("inv_importacoes").update({
        status: finalStatus,
        novos: counters.novo,
        atualizados: counters.atualizar,
        ignorados: counters.ignorar,
        erros: counters.erro,
        concluido_em: new Date().toISOString(),
        resumo: { versao_importador: VERSION, opcoes: optionsSnapshot(), arquivos: storedFiles.length, resultado: counters }
      }).eq("id", batch.id);
      if (finishError) throw finishError;

      setProgress(100, `Concluído: ${counters.novo} novo(s), ${counters.atualizar} atualizado(s), ${counters.erro} erro(s).`);
      toast("Importação concluída", `${counters.novo} novo(s), ${counters.atualizar} atualizado(s), ${counters.erro} erro(s).`, counters.erro ? "warning" : "success");
      renderPreview();
      await loadHistory();
      $("btnGlobalRefresh")?.click();
    } catch (error) {
      console.error("Importador V2: confirmação falhou", error);
      if (batch?.id) {
        try {
          await db().from("inv_importacoes").update({
            status: "falhou",
            erros: Math.max(1, counters.erro),
            concluido_em: new Date().toISOString(),
            resumo: { versao_importador: VERSION, erro: error?.message || String(error) }
          }).eq("id", batch.id);
        } catch (_) {}
      }
      setProgress(0, `Falha: ${error?.message || error}`);
      toast("Importação interrompida", error?.message || String(error), "danger");
    } finally {
      state.processing = false;
      toggleButtons(false);
    }
  }

  async function importRow(row, userId) {
    const updating = row.action === "atualizar";
    const existing = row.existingItem;

    let categoryId = updating ? existing?.categoria_id || null : null;
    const categoryWasProvided = row.provided.includes("categoria");
    if (row.categoria && (!updating || categoryWasProvided)) {
      categoryId = await ensureCategory(row.categoria, row.tipo_item);
    }

    let locationId = updating ? existing?.localizacao_id || null : null;
    const locationWasProvided = ["localizacao", "sala", "armario", "prateleira"].some(field => row.provided.includes(field));
    if (row.locationParts.length && (!updating || locationWasProvided)) {
      locationId = await ensureLocation(row.locationParts);
    }

    const payload = buildPayload(row, updating);
    if (!updating || categoryWasProvided) payload.categoria_id = categoryId;
    if (!updating || locationWasProvided) payload.localizacao_id = locationId;

    const note = `Importado via Upload V2 · ${row.sourceName} · ${new Date().toLocaleDateString("pt-BR")}`;

    if (!updating) {
      payload.criado_por = userId;
      payload.observacoes = [clean(row.observacoes), note].filter(Boolean).join("\n");
      const { data, error } = await db().from("inv_itens").insert(payload).select("id").single();
      if (error) throw error;
      return data.id;
    }

    if (!existing?.id) throw new Error("Registro existente não encontrado para atualização.");
    const previousNotes = clean(existing.observacoes);
    const importedNotes = row.provided.includes("observacoes") ? clean(row.observacoes) : "";
    payload.observacoes = [...new Set([previousNotes, importedNotes, note].filter(Boolean))].join("\n");
    const { data, error } = await db().from("inv_itens").update(payload).eq("id", existing.id).select("id").single();
    if (error) throw error;
    return data.id;
  }

  function buildPayload(row, updating) {
    const provided = new Set(row.provided);
    const payload = {};
    const set = (field, value, defaultForNew = false) => {
      const allowed = !updating || provided.has(field) || defaultForNew;
      if (!allowed) return;
      if (value === "" || value === undefined || (typeof value === "number" && Number.isNaN(value))) return;
      payload[field] = value;
    };

    // Regra crítica: em UPDATE, código só entra se veio explicitamente do arquivo.
    if (!updating || provided.has("codigo_interno")) set("codigo_interno", row.codigo_interno);

    set("patrimonio", nullable(row.patrimonio));
    set("nome", row.nome);
    set("subcategoria", nullable(row.subcategoria));
    set("tipo_item", row.tipo_item, !updating);
    set("marca", nullable(row.marca));
    set("modelo", nullable(row.modelo));
    set("numero_serie", nullable(row.numero_serie));
    set("codigo_barras", nullable(row.codigo_barras));
    set("descricao", row.descricao);
    set("especificacoes", row.especificacoes);
    set("voltagem", nullable(row.voltagem));
    set("potencia", nullable(row.potencia));
    set("capacidade", nullable(row.capacidade));
    set("fabricante", nullable(row.fabricante));
    set("quantidade", row.quantidade, !updating);
    set("unidade", row.unidade, !updating);
    set("armario", nullable(row.armario));
    set("prateleira", nullable(row.prateleira));
    set("responsavel", nullable(row.responsavel));
    set("status", row.status, !updating);
    set("data_aquisicao", row.data_aquisicao);
    set("valor_unitario", row.valor_unitario);
    set("garantia_ate", row.garantia_ate);

    if (updating && row.reactivate) {
      payload.ativo = true;
      payload.status = row.status || "disponivel";
      payload.quantidade = Number.isFinite(row.quantidade) ? row.quantidade : Math.max(Number(row.existingItem?.quantidade || 1), 1);
    }

    return payload;
  }

  async function ensureCategory(name, type) {
    const key = normalize(name);
    let found = state.categories.find(category => normalize(category.nome) === key && category.tipo === type);
    if (found) return found.id;
    if (!$("v2CreateCategories")?.checked) return null;

    const { data, error } = await db().from("inv_categorias").insert({
      nome: clean(name),
      tipo: type,
      descricao: "Criada automaticamente pelo importador de patrimônio."
    }).select("*").single();

    if (error) {
      if (/duplicate|unique/i.test(error.message || "")) {
        const { data: existing, error: findError } = await db().from("inv_categorias").select("*").eq("tipo", type).ilike("nome", clean(name)).maybeSingle();
        if (findError) throw findError;
        if (existing) {
          state.categories.push(existing);
          return existing.id;
        }
      }
      throw error;
    }

    state.categories.push(data);
    return data.id;
  }

  async function ensureLocation(parts) {
    const names = parts.map(clean).filter(Boolean);
    if (!names.length) return null;

    if (!$("v2CreateLocations")?.checked) {
      const target = normalize(names[names.length - 1]);
      return state.locations.find(location => normalize(location.nome) === target || normalize(location.codigo) === target)?.id || null;
    }

    let parentId = state.locations.find(location => normalize(location.codigo) === "lab")?.id
      || state.locations.find(location => normalize(location.nome) === "senai lab")?.id
      || null;
    let currentId = parentId;

    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      if (["senai", "senai lab", "lab"].includes(normalize(name))) continue;

      let found = state.locations.find(location => normalize(location.nome) === normalize(name) && String(location.parent_id || "") === String(currentId || ""));
      if (!found && index === names.length - 1) {
        found = state.locations.find(location => normalize(location.nome) === normalize(name));
      }
      if (!found) {
        const { data, error } = await db().from("inv_localizacoes").insert({
          parent_id: currentId,
          nome: name,
          codigo: null,
          tipo: inferLocationType(name, index, names.length),
          descricao: "Criada automaticamente pelo importador de patrimônio."
        }).select("*").single();
        if (error) throw error;
        state.locations.push(data);
        found = data;
      }
      currentId = found.id;
    }

    return currentId;
  }

  async function logLine(batchId, row, action, itemId, message) {
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

  async function loadHistory() {
    const box = $("v2History");
    if (!box || !state.profile?.ativo) return;
    try {
      const { data, error } = await db().from("inv_importacoes").select("*").order("criado_em", { ascending: false }).limit(40);
      if (error) throw error;
      state.imports = data || [];
      box.replaceChildren();
      if (!state.imports.length) return box.appendChild(emptyNode("Nenhum upload processado ainda."));

      state.imports.forEach(batch => {
        const card = document.createElement("article");
        card.className = "import-history-card";
        card.innerHTML = `<div class="import-history-card__top"><div><h3>${esc(batch.arquivo_nome)}</h3><p>${esc(formatDateTime(batch.criado_em))} · ${esc(String(batch.arquivo_tipo || "").toUpperCase())}</p></div><span class="status" data-status="${esc(batchTone(batch.status))}">${esc(batchLabel(batch.status))}</span></div><div class="import-history-card__stats"><span>Total ${Number(batch.total_linhas || 0)}</span><span>Novos ${Number(batch.novos || 0)}</span><span>Atualizados ${Number(batch.atualizados || 0)}</span><span>Ignorados ${Number(batch.ignorados || 0)}</span><span>Erros ${Number(batch.erros || 0)}</span></div>`;
        box.appendChild(card);
      });
    } catch (error) {
      if (/inv_importacoes|does not exist|relation/i.test(String(error?.message || error))) {
        box.replaceChildren(emptyNode("Execute supabase/03_importacoes_uploads.sql para ativar o histórico."));
      } else {
        box.replaceChildren(emptyNode(`Falha ao carregar: ${error?.message || error}`));
      }
    }
  }

  async function loadImportedDeleteSummary() {
    const label = $("v2ImportedDeleteSummary");
    const button = $("v2DeleteAllImported");
    if (!label || !button || !state.profile?.ativo) return;

    try {
      const { data, error } = await db().rpc("inv_resumo_itens_importados");
      if (error) throw error;

      const total = Number(data?.total || 0);
      const blocked = Number(data?.bloqueados || 0);
      const eligible = Number(data?.elegiveis || 0);

      label.textContent = total
        ? total + " item(ns) importado(s) ativo(s) · " + eligible + " podem ser removidos" + (blocked ? " · " + blocked + " bloqueado(s)" : "")
        : "Nenhum item importado ativo encontrado.";

      button.disabled = eligible === 0;
    } catch (error) {
      button.disabled = true;
      const message = String(error?.message || error);
      label.textContent = /inv_resumo_itens_importados|could not find the function|does not exist/i.test(message)
        ? "Ativação necessária: execute supabase/06_limpeza_itens_importados.sql."
        : "Não foi possível verificar os itens importados: " + message;
    }
  }

  async function deleteAllImportedItems() {
    if (state.processing || !state.profile?.ativo) return;

    const { data: summary, error: summaryError } = await db().rpc("inv_resumo_itens_importados");
    if (summaryError) {
      const message = String(summaryError?.message || summaryError);
      return toast(
        "Ativação necessária",
        /inv_resumo_itens_importados|could not find the function|does not exist/i.test(message)
          ? "Execute supabase/06_limpeza_itens_importados.sql no Supabase."
          : message,
        "danger"
      );
    }

    const eligible = Number(summary?.elegiveis || 0);
    const blocked = Number(summary?.bloqueados || 0);
    if (!eligible) return toast("Nada para excluir", "Não há itens importados elegíveis para remoção.", "warning");

    let promptText = "Você está prestes a remover " + eligible + " item(ns) importado(s) do inventário ativo.";
    if (blocked) promptText += "\n\n" + blocked + " item(ns) com empréstimo/solicitação em aberto serão preservados.";
    promptText += "\n\nCadastros manuais e histórico dos uploads serão preservados.";
    promptText += "\n\nDigite EXCLUIR IMPORTADOS para confirmar:";

    const confirmation = window.prompt(promptText);
    if (confirmation !== "EXCLUIR IMPORTADOS") {
      if (confirmation !== null) toast("Operação cancelada", "A frase de confirmação não corresponde.", "warning");
      return;
    }

    const button = $("v2DeleteAllImported");
    state.processing = true;
    if (button) {
      button.disabled = true;
      button.textContent = "Excluindo...";
    }

    try {
      const { data, error } = await db().rpc("inv_excluir_todos_itens_importados", {
        p_confirmacao: "EXCLUIR IMPORTADOS"
      });
      if (error) throw error;

      const removed = Number(data?.removidos || 0);
      const preserved = Number(data?.bloqueados || 0);
      toast(
        "Limpeza concluída",
        removed + " item(ns) importado(s) removido(s) do inventário ativo." + (preserved ? " " + preserved + " preservado(s) por possuir pendência." : ""),
        preserved ? "warning" : "success"
      );

      state.rows = [];
      if ($("v2PreviewPanel")) $("v2PreviewPanel").hidden = true;
      await loadReferences().catch(() => {});
      await loadImportedDeleteSummary();
      await loadHistory();
      $("btnGlobalRefresh")?.click();
    } catch (error) {
      console.error("Falha ao excluir itens importados:", error);
      toast("Não foi possível concluir a limpeza", error?.message || String(error), "danger");
    } finally {
      state.processing = false;
      if (button) {
        button.textContent = "Excluir todos os itens importados";
        await loadImportedDeleteSummary();
      }
    }
  }
  function downloadErrors() {
    const errors = state.rows.filter(row => row.action === "erro");
    if (!errors.length) return;
    const matrix = [
      ["Arquivo", "Linha", "Patrimônio", "Código", "Nome", "Problema"],
      ...errors.map(row => [row.sourceName, row.sourceLine, row.patrimonio, row.codigo_interno, row.nome, row.error])
    ];
    const csv = matrix.map(row => row.map(csvCell).join(";")).join("\r\n");
    downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), `inconsistencias-importacao-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function optionsSnapshot() {
    return {
      atualizar_existentes: true,
      reimportacao_automatica: true,
      criar_localizacoes: Boolean($("v2CreateLocations")?.checked),
      criar_categorias: Boolean($("v2CreateCategories")?.checked)
    };
  }

  function countActions() {
    return state.rows.reduce((result, row) => {
      result[row.action] = (result[row.action] || 0) + 1;
      return result;
    }, { novo: 0, atualizar: 0, ignorar: 0, erro: 0 });
  }

  function identifierKeys(row) {
    return [
      row.patrimonio ? `pat:${normalize(row.patrimonio)}` : "",
      row.codigo_interno ? `cod:${normalize(row.codigo_interno)}` : "",
      row.numero_serie ? `ser:${normalize(row.numero_serie)}` : "",
      row.codigo_barras ? `bar:${normalize(row.codigo_barras)}` : ""
    ].filter(Boolean);
  }

  function buildLocationParts(row) {
    const parts = [];
    if (row.localizacao) {
      const split = row.localizacao.split(/\s*(?:>|\/|\||;)\s*/).map(clean).filter(Boolean);
      parts.push(...split);
    }
    [row.sala, row.armario, row.prateleira].forEach(value => {
      if (value && !parts.some(existing => normalize(existing) === normalize(value))) parts.push(value);
    });
    return parts.filter((value, index, list) => list.findIndex(other => normalize(other) === normalize(value)) === index);
  }

  function inferLocationType(name, index, total) {
    const value = normalize(name);
    if (value.includes("sala")) return "sala";
    if (value.includes("almox")) return "almoxarifado";
    if (value.includes("armario")) return "armario";
    if (value.includes("prateleira") || value.includes("estante") || value.includes("gaveta")) return "prateleira";
    return index === total - 1 ? "local" : "sala";
  }

  function inferType(row) {
    const text = normalize(`${row.categoria} ${row.nome}`);
    if (/filamento|resina|tinta|cola|papel|chapa|consumivel/.test(text)) return "consumivel";
    if (/arduino|esp32|raspberry|sensor|servo|motor|driver|rele|componente|modulo/.test(text)) return "componente";
    if (/epi|material|cabo|fio|ferragem/.test(text)) return "material";
    return "equipamento";
  }

  function inferCategory(row) {
    const text = normalize(row.nome);
    if (/impressora 3d|ender|creality|bambu|filamento/.test(text)) return row.tipo_item === "consumivel" ? "Filamentos 3D" : "Impressão 3D";
    if (/laser|cortadora|gravadora/.test(text)) return "Corte e Gravação Laser";
    if (/arduino|esp32|raspberry/.test(text)) return "Arduino / Microcontroladores";
    if (/sensor/.test(text)) return "Sensores";
    if (/servo|motor|atuador|driver/.test(text)) return "Motores e Atuadores";
    if (/transmissor|instrumentacao|instrumentação|pressao|pressão|termometro|termômetro|amperimetro|amperímetro|multimetro|multímetro|posicionador|calibracao|calibração|pneumatica|pneumática/.test(text)) return "Automação e Instrumentação";
    if (/osciloscopio|osciloscópio|fonte|eletronica|eletrônica/.test(text)) return "Eletrônica";
    if (/notebook|computador|monitor|teclado|mouse|tablet/.test(text)) return "Informática";
    if (/mesa|cadeira|banqueta|armario|armário|estante|bancada/.test(text)) return "Mobiliário";
    if (/furadeira|parafusadeira|chave|alicate|serra/.test(text)) return "Ferramentas";
    return "";
  }

  function normalizeStatus(value) {
    const key = normalize(value).replace(/_/g, " ");
    return key ? statusMap.get(key) || "" : "";
  }

  function normalizeType(value) {
    const key = normalize(value);
    return key ? typeMap.get(key) || "" : "";
  }

  function parseNumber(value) {
    const raw = clean(value);
    if (!raw) return NaN;
    const normalized = raw.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
    const number = Number(normalized);
    return Number.isFinite(number) && number >= 0 ? number : NaN;
  }

  function parseMoney(value) {
    const number = parseNumber(value);
    return Number.isFinite(number) ? number : null;
  }

  function parseDate(value) {
    const raw = clean(value);
    if (!raw) return null;
    const br = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (br) {
      const year = br[3].length === 2 ? `20${br[3]}` : br[3];
      return `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    }
    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  function rowHasIdentity(record) {
    return Boolean(clean(record.nome) || clean(record.patrimonio) || clean(record.codigo_interno) || clean(record.numero_serie));
  }

  function resolveHeader(value) {
    return aliases.get(normalize(value)) || "";
  }

  function addAliases(field, values) {
    values.forEach(value => aliases.set(normalize(value), field));
  }

  function addMatch(set, value) {
    if (value) set.add(value);
  }

  function setBusy(busy, text = "") {
    state.processing = busy;
    toggleButtons(busy);
    if (text) setProgress(0, text);
  }

  function toggleButtons(disabled) {
    ["v2ChooseFiles", "v2Analyze", "v2Clear", "v2Confirm"].forEach(id => {
      if ($(id)) $(id).disabled = disabled;
    });
  }

  function setProgress(percent, text) {
    if ($("v2ProgressBar")) $("v2ProgressBar").style.width = `${Math.max(0, Math.min(100, percent))}%`;
    if ($("v2ProgressText")) $("v2ProgressText").textContent = text;
  }

  function toast(title, text, tone = "info") {
    const stack = $("toastStack") || document.body;
    const node = document.createElement("div");
    node.className = "toast";
    node.dataset.tone = tone;
    node.innerHTML = `<strong>${esc(title)}</strong><span>${esc(text)}</span>`;
    stack.appendChild(node);
    setTimeout(() => node.remove(), 5000);
  }

  function emptyNode(text) {
    const node = document.createElement("div");
    node.className = "empty";
    node.textContent = text;
    return node;
  }

  function setText(id, value) {
    if ($(id)) $(id).textContent = String(value ?? "");
  }

  function actionLabel(action) {
    return ({ novo: "Novo", atualizar: "Atualizar", ignorar: "Ignorar", erro: "Erro" })[action] || action;
  }

  function typeLabel(type) {
    return ({ equipamento: "Equipamento", material: "Material", componente: "Componente", consumivel: "Consumível" })[type] || type || "—";
  }

  function statusLabel(status) {
    return ({ disponivel: "Disponível", em_uso: "Em uso", emprestado: "Emprestado", manutencao: "Manutenção", danificado: "Danificado", reservado: "Reservado", baixado: "Baixado", perdido: "Perdido" })[status] || status || "—";
  }

  function batchLabel(status) {
    return ({ analisando: "Analisando", pronto: "Pronto", importando: "Importando", concluido: "Concluído", concluido_com_erros: "Concluído com erros", falhou: "Falhou", cancelado: "Cancelado" })[status] || status;
  }

  function batchTone(status) {
    if (status === "concluido") return "disponivel";
    if (status === "concluido_com_erros" || status === "importando") return "reservado";
    if (status === "falhou") return "danificado";
    return "em_uso";
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(value || 0));
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  function extension(name) {
    return String(name || "").split(".").pop().toLowerCase();
  }

  function mimeFor(name) {
    const ext = extension(name);
    if (ext === "pdf") return "application/pdf";
    if (ext === "csv") return "text/csv";
    if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (ext === "xls") return "application/vnd.ms-excel";
    return "application/octet-stream";
  }

  function safeFileName(name) {
    return normalize(name).replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "arquivo";
  }

  function normalize(value) {
    return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function cleanIdentifier(value) {
    const text = clean(value);
    if (!text) return "";
    const key = normalize(text).replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
    if (["na", "n a", "n/a", "s/id", "s id", "sem id", "sem identificacao", "sem identificação", "-", "--"].includes(key)) return "";
    return text;
  }

  function nullable(value) {
    const text = clean(value);
    return text === "" ? null : text;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function csvCell(value) {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
})();
