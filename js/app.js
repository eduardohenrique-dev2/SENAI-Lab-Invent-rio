(() => {
  "use strict";

  const ROLE_LABELS = {
    administrador: "Administrador",
    gestor: "Gestor",
    instrutor: "Instrutor",
    aluno: "Aluno",
    auditor: "Auditor"
  };

  const ITEM_STATUS_LABELS = {
    disponivel: "Disponível",
    em_uso: "Em uso",
    emprestado: "Emprestado",
    manutencao: "Manutenção",
    danificado: "Danificado",
    reservado: "Reservado",
    baixado: "Baixado",
    perdido: "Perdido"
  };

  const ITEM_TYPE_LABELS = {
    equipamento: "Equipamento",
    material: "Material",
    componente: "Componente",
    consumivel: "Consumível"
  };

  const LOAN_STATUS_LABELS = {
    solicitado: "Solicitado",
    aberto: "Em aberto",
    devolvido: "Devolvido",
    atrasado: "Atrasado",
    perdido: "Perdido",
    cancelado: "Cancelado"
  };

  const MOVEMENT_LABELS = {
    entrada: "Entrada",
    saida: "Saída",
    transferencia: "Transferência",
    emprestimo: "Empréstimo",
    devolucao: "Devolução",
    manutencao: "Manutenção",
    baixa: "Baixa",
    ajuste: "Ajuste"
  };

  const MAINTENANCE_STATUS_LABELS = {
    aberta: "Aberta",
    em_andamento: "Em andamento",
    aguardando_peca: "Aguardando peça",
    concluida: "Concluída",
    cancelada: "Cancelada"
  };

  const VIEW_META = {
    dashboard: ["Dashboard", "Visão geral do laboratório"],
    inventario: ["Inventário", "Equipamentos, materiais, componentes e consumíveis"],
    estoque: ["Estoque", "Quantidades, mínimos e reposição"],
    emprestimos: ["Empréstimos", "Solicitações, retiradas e devoluções"],
    devolucoes: ["Devoluções", "Itens aguardando retorno"],
    movimentacoes: ["Movimentações", "Rastreabilidade de entradas, saídas e transferências"],
    manutencao: ["Manutenção", "Ocorrências técnicas, custos e histórico"],
    fisico: ["Inventário físico", "Conferência presencial do patrimônio"],
    localizacoes: ["Localizações", "Estrutura física do SENAI Lab"],
    qrcode: ["QR Code", "Etiquetas e consulta rápida por item"],
    usuarios: ["Usuários", "Perfis e permissões de acesso"],
    relatorios: ["Relatórios", "Exportações operacionais e patrimoniais"],
    auditoria: ["Auditoria", "Registro técnico de alterações"],
    notificacoes: ["Notificações", "Alertas e avisos operacionais"],
    configuracoes: ["Configurações", "Parâmetros do inventário"]
  };

  const state = {
    user: null,
    profile: null,
    items: [],
    categories: [],
    locations: [],
    loans: [],
    movements: [],
    maintenances: [],
    physical: [],
    counts: [],
    profiles: [],
    audit: [],
    notifications: [],
    settings: {
      prefixo_codigo: "LAB-INV",
      dias_alerta_garantia: 30,
      dias_alerta_manutencao: 7,
      horas_item_parado: 168
    },
    dashboard: {},
    currentView: "dashboard",
    currentPhysicalId: null,
    realtimeChannel: null,
    reloadTimer: null,
    fallbackTimer: null,
    loading: false
  };

  const $ = id => document.getElementById(id);
  const client = () => obterInventarioSupabase();

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindStaticEvents();
    setHealth("checking", "Conectando");

    try {
      const { data } = await client().auth.getSession();
      if (data?.session?.user) {
        await restoreSession(data.session.user);
      }
    } catch (error) {
      console.warn("Falha ao restaurar sessão:", error);
    }

    client().auth.onAuthStateChange((_event, session) => {
      if (!session && state.user) resetToLogin();
    });
  }

  function bindStaticEvents() {
    $("loginForm")?.addEventListener("submit", handleLogin);
    $("btnLogout")?.addEventListener("click", handleLogout);
    $("btnGlobalRefresh")?.addEventListener("click", () => loadAll());
    $("btnMobileMenu")?.addEventListener("click", () => {
      const sidebar = $("sidebar");
      if (sidebar) sidebar.dataset.open = String(sidebar.dataset.open !== "true");
    });

    document.querySelectorAll(".nav-button[data-view]").forEach(button => {
      button.addEventListener("click", () => showView(button.dataset.view));
    });

    document.querySelectorAll("[data-view-jump]").forEach(button => {
      button.addEventListener("click", () => showView(button.dataset.viewJump));
    });

    document.querySelectorAll("[data-close-modal]").forEach(button => {
      button.addEventListener("click", () => closeModal(button.dataset.closeModal));
    });

    document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
      backdrop.addEventListener("click", event => {
        if (event.target === backdrop) closeModal(backdrop.id);
      });
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        document.querySelectorAll(".modal-backdrop:not([hidden])").forEach(el => closeModal(el.id));
      }
    });

    window.addEventListener("online", () => {
      setHealth("online", "Online");
      if (state.user) {
        subscribeRealtime();
        loadAll({ silent: true });
      }
    });

    window.addEventListener("offline", () => setHealth("offline", "Sem internet"));

    bindFilters();
    bindForms();
    bindButtons();
  }

  function bindFilters() {
    $("itemSearch")?.addEventListener("input", renderItems);
    $("itemTypeFilter")?.addEventListener("change", renderItems);
    $("itemStatusFilter")?.addEventListener("change", renderItems);
    $("itemLocationFilter")?.addEventListener("change", renderItems);
    $("btnClearItemFilters")?.addEventListener("click", () => {
      $("itemSearch").value = "";
      $("itemTypeFilter").value = "";
      $("itemStatusFilter").value = "";
      $("itemLocationFilter").value = "";
      renderItems();
    });

    $("loanSearch")?.addEventListener("input", renderLoans);
    $("loanStatusFilter")?.addEventListener("change", renderLoans);
    $("movementSearch")?.addEventListener("input", renderMovements);
    $("movementTypeFilter")?.addEventListener("change", renderMovements);
  }

  function bindForms() {
    $("itemForm")?.addEventListener("submit", saveItem);
    $("movementForm")?.addEventListener("submit", saveMovement);
    $("loanForm")?.addEventListener("submit", saveLoan);
    $("returnForm")?.addEventListener("submit", saveReturn);
    $("maintenanceForm")?.addEventListener("submit", saveMaintenance);
    $("locationForm")?.addEventListener("submit", saveLocation);
    $("physicalForm")?.addEventListener("submit", savePhysical);
    $("settingsForm")?.addEventListener("submit", saveSettings);
  }

  function bindButtons() {
    $("btnNewItem")?.addEventListener("click", () => openItemModal());
    $("btnStockMovement")?.addEventListener("click", () => openMovementModal());
    $("btnNewMovement")?.addEventListener("click", () => openMovementModal());
    $("btnNewLoan")?.addEventListener("click", () => openLoanModal());
    $("btnNewMaintenance")?.addEventListener("click", () => openMaintenanceModal());
    $("btnNewLocation")?.addEventListener("click", () => openLocationModal());
    $("btnNewPhysical")?.addEventListener("click", () => openModal("physicalModal"));
    $("btnFinishPhysical")?.addEventListener("click", finishPhysical);
    $("btnGenerateQr")?.addEventListener("click", renderSelectedQr);
    $("btnPrintQr")?.addEventListener("click", () => window.print());
    $("btnReadNotifications")?.addEventListener("click", markNotificationsRead);

    document.querySelectorAll("[data-report][data-format]").forEach(button => {
      button.addEventListener("click", () => exportReport(button.dataset.report, button.dataset.format));
    });
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) return form.reportValidity();

    const email = String($("loginEmail")?.value || "").trim();
    const password = String($("loginPassword")?.value || "");
    const captchaToken = getCaptchaToken();
    const button = $("btnLogin");

    hideLoginError();
    if (!captchaToken) {
      showLoginError("Confirme a verificação de segurança antes de entrar.");
      return;
    }

    button.disabled = true;
    button.textContent = "Entrando...";

    try {
      const { data, error } = await client().auth.signInWithPassword({
        email,
        password,
        options: { captchaToken }
      });
      if (error) throw error;
      await restoreSession(data.user);
    } catch (error) {
      console.error("Falha no login:", error);
      showLoginError("Não foi possível entrar. Confira seus dados, sua permissão e refaça a verificação de segurança.");
      try { window.hcaptcha?.reset(); } catch (_) {}
    } finally {
      button.disabled = false;
      button.textContent = "Entrar no sistema";
    }
  }

  function getCaptchaToken() {
    try { return String(window.hcaptcha?.getResponse?.() || "").trim(); }
    catch (_) { return ""; }
  }

  async function restoreSession(user) {
    const { data: profile, error } = await client()
      .from("inv_perfis")
      .select("user_id,nome,email,papel,ativo")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      if (/relation .*inv_perfis|does not exist/i.test(error.message || "")) {
        throw new Error("O banco do SENAI Lab Inventário ainda não foi ativado.");
      }
      throw error;
    }

    if (!profile?.ativo) {
      await client().auth.signOut();
      showLoginError("Sua conta ainda não está liberada para o SENAI Lab Inventário.");
      return;
    }

    state.user = user;
    state.profile = profile;
    $("loginScreen").hidden = true;
    $("appShell").hidden = false;
    $("userName").textContent = profile.nome || profile.email || "Usuário";
    $("userRole").textContent = ROLE_LABELS[profile.papel] || profile.papel;
    $("userAvatar").textContent = (profile.nome || profile.email || "S").charAt(0).toUpperCase();

    applyPermissions();
    await loadAll();
    subscribeRealtime();
    startFallback();
    handleDeepLink();
  }

  async function handleLogout() {
    try {
      if (state.realtimeChannel) await client().removeChannel(state.realtimeChannel);
      await client().auth.signOut();
    } catch (error) {
      console.warn("Falha ao encerrar sessão:", error);
    }
    resetToLogin();
  }

  function resetToLogin() {
    clearInterval(state.fallbackTimer);
    clearTimeout(state.reloadTimer);
    state.user = null;
    state.profile = null;
    state.realtimeChannel = null;
    $("appShell").hidden = true;
    $("loginScreen").hidden = false;
    setHealth("checking", "Conectando");
    try { window.hcaptcha?.reset(); } catch (_) {}
  }

  function applyPermissions() {
    const role = state.profile?.papel;
    const allowedViews = new Set(["dashboard", "inventario", "emprestimos", "devolucoes", "localizacoes", "qrcode", "notificacoes"]);

    if (role !== "aluno") allowedViews.add("estoque");
    if (canOperate() || canAudit()) allowedViews.add("movimentacoes");
    if (canOperate() || canAudit()) allowedViews.add("manutencao");
    if (canAudit()) allowedViews.add("fisico");
    if (isAdmin()) allowedViews.add("usuarios");
    if (canReport()) allowedViews.add("relatorios");
    if (canAudit()) allowedViews.add("auditoria");
    if (canManage()) allowedViews.add("configuracoes");

    document.querySelectorAll(".nav-button[data-view]").forEach(button => {
      button.hidden = !allowedViews.has(button.dataset.view);
    });

    setHidden("btnNewItem", !canManage());
    setHidden("btnStockMovement", !canOperate());
    setHidden("btnNewMovement", !canOperate());
    setHidden("btnNewMaintenance", !canManage());
    setHidden("btnNewLocation", !canManage());
    setHidden("btnNewPhysical", !canAudit());

    if (!allowedViews.has(state.currentView)) state.currentView = "dashboard";
    showView(state.currentView);
  }

  function isAdmin() { return state.profile?.papel === "administrador"; }
  function canManage() { return ["administrador", "gestor"].includes(state.profile?.papel); }
  function canOperate() { return ["administrador", "gestor", "instrutor"].includes(state.profile?.papel); }
  function canAudit() { return ["administrador", "gestor", "auditor"].includes(state.profile?.papel); }
  function canReport() { return ["administrador", "gestor", "auditor"].includes(state.profile?.papel); }

  async function loadAll({ silent = false } = {}) {
    if (!state.user || state.loading) return;
    state.loading = true;
    if (!silent) setHealth("checking", "Sincronizando");

    try {
      const c = client();
      const essential = await Promise.all([
        c.from("inv_categorias").select("*").eq("ativo", true).order("nome"),
        c.from("inv_localizacoes").select("*").eq("ativo", true).order("nome"),
        state.profile.papel === "aluno"
          ? c.rpc("inv_listar_itens_consulta")
          : c.from("inv_itens").select("*").eq("ativo", true).order("nome"),
        c.from("inv_emprestimos").select("*").order("criado_em", { ascending: false }).limit(500),
        c.from("inv_configuracoes").select("chave,valor"),
        c.rpc("inv_dashboard")
      ]);

      essential.forEach(result => { if (result.error) throw result.error; });
      state.categories = essential[0].data || [];
      state.locations = essential[1].data || [];
      state.items = essential[2].data || [];
      state.loans = essential[3].data || [];
      applySettingsRows(essential[4].data || []);
      state.dashboard = essential[5].data || {};

      const optional = await Promise.all([
        (canOperate() || canAudit())
          ? c.from("inv_movimentacoes").select("*").order("criado_em", { ascending: false }).limit(700)
          : Promise.resolve({ data: [], error: null }),
        (canOperate() || canAudit())
          ? c.from("inv_manutencoes").select("*").order("criado_em", { ascending: false }).limit(500)
          : Promise.resolve({ data: [], error: null }),
        canAudit()
          ? c.from("inv_inventarios_fisicos").select("*").order("criado_em", { ascending: false }).limit(100)
          : Promise.resolve({ data: [], error: null }),
        canAudit()
          ? c.from("inv_contagens").select("*").order("id", { ascending: true }).limit(5000)
          : Promise.resolve({ data: [], error: null }),
        (isAdmin() || state.profile.papel === "gestor" || state.profile.papel === "auditor")
          ? c.from("inv_perfis").select("user_id,nome,email,papel,ativo,criado_em,atualizado_em").order("nome")
          : Promise.resolve({ data: [state.profile], error: null }),
        canAudit()
          ? c.from("inv_auditoria").select("id,user_id,acao,entidade,entidade_id,dados,criado_em").order("criado_em", { ascending: false }).limit(500)
          : Promise.resolve({ data: [], error: null }),
        c.from("inv_notificacoes").select("*").order("criado_em", { ascending: false }).limit(300)
      ]);

      optional.forEach(result => {
        if (result.error) console.warn("Consulta opcional do inventário falhou:", result.error.message);
      });

      state.movements = optional[0].data || [];
      state.maintenances = optional[1].data || [];
      state.physical = optional[2].data || [];
      state.counts = optional[3].data || [];
      state.profiles = optional[4].data || [];
      state.audit = optional[5].data || [];
      state.notifications = optional[6].data || [];

      renderEverything();
      setHealth("online", "Online");
    } catch (error) {
      console.error("Falha ao sincronizar inventário:", error);
      setHealth(navigator.onLine ? "offline" : "offline", navigator.onLine ? "Erro no banco" : "Sem internet");
      if (!silent) {
        showToast("Falha na sincronização", normalizeError(error), "danger");
      }
    } finally {
      state.loading = false;
    }
  }

  function applySettingsRows(rows) {
    const general = rows.find(row => row.chave === "geral")?.valor || {};
    state.settings = { ...state.settings, ...general };
  }

  function renderEverything() {
    fillSelects();
    renderDashboard();
    renderItems();
    renderStock();
    renderLoans();
    renderReturns();
    renderMovements();
    renderMaintenances();
    renderPhysical();
    renderLocations();
    renderUsers();
    renderAudit();
    renderNotifications();
    renderSettings();
    renderSelectedQr();
    updateNavBadges();
  }

  function renderDashboard() {
    const d = state.dashboard || {};
    setText("kpiTotal", d.total_itens ?? state.items.length);
    setText("kpiDisponiveis", d.disponiveis ?? countItemsByStatus("disponivel"));
    setText("kpiEmUso", d.em_uso ?? countItemsByStatus("em_uso"));
    setText("kpiEmprestados", d.emprestados ?? countItemsByStatus("emprestado"));
    setText("kpiManutencao", d.manutencao ?? countItemsByStatus("manutencao"));
    setText("kpiDanificados", d.danificados ?? countItemsByStatus("danificado"));
    setText("kpiEstoqueBaixo", d.estoque_baixo ?? lowStockItems().length);
    setText("kpiSemLocal", d.sem_localizacao ?? state.items.filter(i => !i.localizacao_id).length);
    setText("kpiPatrimonio", formatCurrency(d.valor_patrimonio ?? estimatedAssetValue()));
    setText("kpiAtrasados", d.emprestimos_atrasados ?? overdueLoans().length);

    const activity = $("dashboardActivity");
    if (activity) {
      activity.replaceChildren();
      const rows = state.movements.slice(0, 8);
      if (!rows.length) activity.append(emptyNode("Nenhuma movimentação registrada."));
      rows.forEach(movement => {
        const item = findItem(movement.item_id);
        const node = document.createElement("article");
        node.className = "activity-item";
        const title = document.createElement("strong");
        title.textContent = `${item?.nome || "Item"} · ${MOVEMENT_LABELS[movement.tipo] || movement.tipo}`;
        const text = document.createElement("span");
        text.textContent = `${formatDateTime(movement.criado_em)}${movement.responsavel ? ` · ${movement.responsavel}` : ""}${movement.motivo ? ` · ${movement.motivo}` : ""}`;
        node.append(title, text);
        activity.appendChild(node);
      });
    }

    const statusBox = $("dashboardStatus");
    if (statusBox) {
      statusBox.replaceChildren();
      Object.entries(ITEM_STATUS_LABELS).forEach(([status, label]) => {
        const total = countItemsByStatus(status);
        if (!total && ["baixado", "perdido"].includes(status)) return;
        const card = document.createElement("article");
        card.className = "entity-card";
        card.innerHTML = `<div class="entity-card__head"><h3>${escapeHtml(label)}</h3><span class="status" data-status="${escapeHtml(status)}">${total}</span></div><p>${total} item(ns) neste estado.</p>`;
        statusBox.appendChild(card);
      });
    }

    const alertBox = $("dashboardAlerts");
    if (alertBox) {
      alertBox.replaceChildren();
      const alerts = buildAlerts().slice(0, 12);
      if (!alerts.length) alertBox.append(emptyNode("Nenhum alerta crítico no momento."));
      alerts.forEach(alert => alertBox.appendChild(alertNode(alert)));
    }
  }

  function renderItems() {
    const tbody = $("itemsTableBody");
    if (!tbody) return;

    const search = normalize($("itemSearch")?.value || "");
    const type = $("itemTypeFilter")?.value || "";
    const status = $("itemStatusFilter")?.value || "";
    const location = $("itemLocationFilter")?.value || "";

    const rows = state.items.filter(item => {
      if (type && item.tipo_item !== type) return false;
      if (status && item.status !== status) return false;
      if (location && String(item.localizacao_id || "") !== location) return false;
      if (!search) return true;
      const haystack = normalize([
        item.nome, item.patrimonio, item.codigo_interno, item.numero_serie,
        item.marca, item.modelo, item.responsavel, locationName(item.localizacao_id)
      ].filter(Boolean).join(" "));
      return haystack.includes(search);
    });

    tbody.replaceChildren();
    if (!rows.length) return appendEmptyRow(tbody, 8, "Nenhum item encontrado.");

    rows.forEach(item => {
      const tr = document.createElement("tr");
      const actionButtons = [];
      actionButtons.push(`<button class="button button--secondary button--small" data-item-qr="${item.id}">QR</button>`);
      if (state.profile?.papel !== "aluno") actionButtons.push(`<button class="button button--secondary button--small" data-item-history="${item.id}">Histórico</button>`);
      if (canManage()) actionButtons.push(`<button class="button button--small" data-item-edit="${item.id}">Editar</button>`);
      if (["disponivel", "em_uso"].includes(item.status) || item.tipo_item !== "equipamento") {
        actionButtons.push(`<button class="button button--secondary button--small" data-item-loan="${item.id}">Emprestar</button>`);
      }
      tr.innerHTML = `
        <td><div class="item-name"><strong>${escapeHtml(item.nome)}</strong><span>${escapeHtml(item.codigo_interno || "—")}${item.marca ? ` · ${escapeHtml(item.marca)}` : ""}</span></div></td>
        <td>${escapeHtml(item.patrimonio || "—")}</td>
        <td>${escapeHtml(ITEM_TYPE_LABELS[item.tipo_item] || item.tipo_item || "—")}</td>
        <td>${formatNumber(item.quantidade)} ${escapeHtml(item.unidade || "un")}</td>
        <td><span class="status" data-status="${escapeHtml(item.status || "")}">${escapeHtml(ITEM_STATUS_LABELS[item.status] || item.status || "—")}</span></td>
        <td>${escapeHtml(locationName(item.localizacao_id) || "Sem localização")}</td>
        <td>${escapeHtml(item.responsavel || "A definir")}</td>
        <td><div class="table-actions">${actionButtons.join("")}</div></td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-item-edit]").forEach(btn => btn.addEventListener("click", () => openItemModal(findItem(btn.dataset.itemEdit))));
    tbody.querySelectorAll("[data-item-history]").forEach(btn => btn.addEventListener("click", () => openHistory(btn.dataset.itemHistory)));
    tbody.querySelectorAll("[data-item-qr]").forEach(btn => btn.addEventListener("click", () => {
      showView("qrcode");
      $("qrItemSelect").value = btn.dataset.itemQr;
      renderSelectedQr();
    }));
    tbody.querySelectorAll("[data-item-loan]").forEach(btn => btn.addEventListener("click", () => openLoanModal(btn.dataset.itemLoan)));
  }

  function renderStock() {
    const items = state.items.filter(item => item.tipo_item !== "equipamento" || Number(item.estoque_minimo || 0) > 0);
    setText("stockTotal", items.length);
    setText("stockLow", items.filter(isLowStock).length);
    setText("stockZero", items.filter(item => Number(item.quantidade || 0) <= 0).length);

    const tbody = $("stockTableBody");
    if (!tbody) return;
    tbody.replaceChildren();
    if (!items.length) return appendEmptyRow(tbody, 7, "Nenhum item de estoque cadastrado.");

    items.forEach(item => {
      const low = isLowStock(item);
      const zero = Number(item.quantidade || 0) <= 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><div class="item-name"><strong>${escapeHtml(item.nome)}</strong><span>${escapeHtml(item.codigo_interno || "")}</span></div></td>
        <td>${escapeHtml(ITEM_TYPE_LABELS[item.tipo_item] || item.tipo_item)}</td>
        <td>${formatNumber(item.quantidade)} ${escapeHtml(item.unidade || "un")}</td>
        <td>${formatNumber(item.estoque_minimo)} ${escapeHtml(item.unidade || "un")}</td>
        <td><span class="${zero ? "text-danger" : low ? "text-warning" : "text-success"}">${zero ? "Sem estoque" : low ? "Estoque baixo" : "Normal"}</span></td>
        <td>${escapeHtml(locationName(item.localizacao_id) || "Sem localização")}</td>
        <td>${canOperate() ? `<button class="button button--small" data-stock-move="${item.id}">Movimentar</button>` : "—"}</td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-stock-move]").forEach(btn => btn.addEventListener("click", () => openMovementModal(btn.dataset.stockMove)));
  }

  function renderLoans() {
    const tbody = $("loansTableBody");
    if (!tbody) return;
    const search = normalize($("loanSearch")?.value || "");
    const statusFilter = $("loanStatusFilter")?.value || "";

    const rows = state.loans.filter(loan => {
      const dynamicStatus = loanDisplayStatus(loan);
      if (statusFilter && dynamicStatus !== statusFilter) return false;
      if (!search) return true;
      const item = findItem(loan.item_id);
      return normalize(`${item?.nome || ""} ${loan.retirado_por_nome || ""} ${loan.retirado_por_email || ""}`).includes(search);
    });

    tbody.replaceChildren();
    if (!rows.length) return appendEmptyRow(tbody, 7, "Nenhum empréstimo encontrado.");

    rows.forEach(loan => {
      const item = findItem(loan.item_id);
      const status = loanDisplayStatus(loan);
      const actions = [];
      if (status === "solicitado" && canOperate()) actions.push(`<button class="button button--small" data-loan-approve="${loan.id}">Aprovar</button>`);
      if (["aberto", "atrasado"].includes(status) && canOperate()) actions.push(`<button class="button button--small" data-loan-return="${loan.id}">Devolver</button>`);
      if (["aberto", "atrasado"].includes(status) && canOperate()) actions.push(`<button class="button button--danger button--small" data-loan-lost="${loan.id}">Perdido</button>`);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(item?.nome || "Item indisponível")}</td>
        <td><div class="item-name"><strong>${escapeHtml(loan.retirado_por_nome || "—")}</strong><span>${escapeHtml(loan.retirado_por_email || "")}</span></div></td>
        <td>${formatNumber(loan.quantidade)}</td>
        <td>${formatDateTime(loan.data_retirada)}</td>
        <td>${formatDateTime(loan.previsao_devolucao)}</td>
        <td><span class="status" data-status="${escapeHtml(status)}">${escapeHtml(LOAN_STATUS_LABELS[status] || status)}</span></td>
        <td><div class="table-actions">${actions.join("") || "—"}</div></td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-loan-approve]").forEach(btn => btn.addEventListener("click", () => approveLoan(btn.dataset.loanApprove)));
    tbody.querySelectorAll("[data-loan-return]").forEach(btn => btn.addEventListener("click", () => openReturnModal(btn.dataset.loanReturn)));
    tbody.querySelectorAll("[data-loan-lost]").forEach(btn => btn.addEventListener("click", () => markLoanLost(btn.dataset.loanLost)));
  }

  function renderReturns() {
    const container = $("returnsCards");
    if (!container) return;
    const rows = state.loans.filter(loan => ["aberto", "atrasado"].includes(loanDisplayStatus(loan)));
    container.replaceChildren();
    if (!rows.length) return container.append(emptyNode("Nenhuma devolução pendente."));

    rows.forEach(loan => {
      const item = findItem(loan.item_id);
      const status = loanDisplayStatus(loan);
      const card = document.createElement("article");
      card.className = "entity-card";
      card.innerHTML = `
        <div class="entity-card__head"><h3>${escapeHtml(item?.nome || "Item")}</h3><span class="status" data-status="${escapeHtml(status)}">${escapeHtml(LOAN_STATUS_LABELS[status] || status)}</span></div>
        <p>${escapeHtml(loan.retirado_por_nome || "—")} · previsão ${escapeHtml(formatDateTime(loan.previsao_devolucao))}</p>
        <div class="entity-card__meta"><span>Qtd.: ${formatNumber(loan.quantidade)}</span><span>${escapeHtml(loan.estado_retirada || "Estado não informado")}</span></div>
        <div class="entity-card__actions">${canOperate() ? `<button class="button button--small" data-return-card="${loan.id}">Registrar devolução</button>` : ""}</div>`;
      container.appendChild(card);
    });

    container.querySelectorAll("[data-return-card]").forEach(btn => btn.addEventListener("click", () => openReturnModal(btn.dataset.returnCard)));
  }

  function renderMovements() {
    const tbody = $("movementsTableBody");
    if (!tbody) return;
    const search = normalize($("movementSearch")?.value || "");
    const type = $("movementTypeFilter")?.value || "";
    const rows = state.movements.filter(movement => {
      if (type && movement.tipo !== type) return false;
      if (!search) return true;
      const item = findItem(movement.item_id);
      return normalize(`${item?.nome || ""} ${movement.responsavel || ""} ${movement.motivo || ""}`).includes(search);
    });

    tbody.replaceChildren();
    if (!rows.length) return appendEmptyRow(tbody, 7, "Nenhuma movimentação registrada.");
    rows.forEach(movement => {
      const item = findItem(movement.item_id);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(formatDateTime(movement.criado_em))}</td>
        <td>${escapeHtml(item?.nome || "Item")}</td>
        <td>${escapeHtml(MOVEMENT_LABELS[movement.tipo] || movement.tipo)}</td>
        <td>${formatNumber(movement.quantidade)}</td>
        <td>${escapeHtml(movement.responsavel || "—")}</td>
        <td>${escapeHtml(movement.motivo || "—")}</td>
        <td>${escapeHtml(locationName(movement.localizacao_origem_id) || "—")} → ${escapeHtml(locationName(movement.localizacao_destino_id) || "—")}</td>`;
      tbody.appendChild(tr);
    });
  }

  function renderMaintenances() {
    const container = $("maintenanceCards");
    if (!container) return;
    container.replaceChildren();
    if (!state.maintenances.length) return container.append(emptyNode("Nenhuma manutenção registrada."));

    state.maintenances.forEach(maintenance => {
      const item = findItem(maintenance.item_id);
      const card = document.createElement("article");
      card.className = "entity-card";
      card.innerHTML = `
        <div class="entity-card__head"><h3>${escapeHtml(item?.nome || "Equipamento")}</h3><span class="status" data-status="${escapeHtml(maintenance.status)}">${escapeHtml(MAINTENANCE_STATUS_LABELS[maintenance.status] || maintenance.status)}</span></div>
        <p>${escapeHtml(maintenance.problema || "Sem descrição")}</p>
        <div class="entity-card__meta"><span>${escapeHtml(maintenance.tipo || "corretiva")}</span><span>Previsão: ${escapeHtml(formatDate(maintenance.previsao))}</span><span>Técnico: ${escapeHtml(maintenance.tecnico_responsavel || "A definir")}</span><span>Custo: ${formatCurrency(maintenance.custo || 0)}</span></div>
        <div class="entity-card__actions">${canManage() ? `<button class="button button--small" data-maintenance-edit="${maintenance.id}">Editar</button>` : ""}</div>`;
      container.appendChild(card);
    });
    container.querySelectorAll("[data-maintenance-edit]").forEach(btn => btn.addEventListener("click", () => openMaintenanceModal(state.maintenances.find(m => m.id === btn.dataset.maintenanceEdit))));
  }

  function renderPhysical() {
    const container = $("physicalCards");
    if (!container) return;
    container.replaceChildren();
    if (!state.physical.length) return container.append(emptyNode("Nenhum inventário físico criado."));

    state.physical.forEach(inv => {
      const counts = state.counts.filter(c => c.inventario_id === inv.id);
      const found = counts.filter(c => c.resultado === "encontrado").length;
      const missing = counts.filter(c => c.resultado === "nao_encontrado").length;
      const damaged = counts.filter(c => c.resultado === "danificado").length;
      const pending = counts.filter(c => c.resultado === "pendente").length;
      const card = document.createElement("article");
      card.className = "entity-card";
      card.innerHTML = `
        <div class="entity-card__head"><h3>${escapeHtml(inv.titulo)}</h3><span class="status" data-status="${escapeHtml(inv.status)}">${escapeHtml(inv.status.replace("_", " "))}</span></div>
        <p>${escapeHtml(inv.responsavel)} · iniciado em ${escapeHtml(formatDateTime(inv.iniciado_em))}</p>
        <div class="entity-card__meta"><span>Total: ${counts.length}</span><span>Encontrados: ${found}</span><span>Ausentes: ${missing}</span><span>Danificados: ${damaged}</span><span>Pendentes: ${pending}</span></div>
        <div class="entity-card__actions">${canAudit() ? `<button class="button button--small" data-physical-open="${inv.id}">${inv.status === "concluido" ? "Ver conferência" : "Conferir"}</button>` : ""}</div>`;
      container.appendChild(card);
    });
    container.querySelectorAll("[data-physical-open]").forEach(btn => btn.addEventListener("click", () => openCountModal(btn.dataset.physicalOpen)));
  }

  function renderLocations() {
    const container = $("locationTree");
    if (!container) return;
    container.replaceChildren();
    if (!state.locations.length) return container.append(emptyNode("Nenhuma localização cadastrada."));

    const children = new Map();
    state.locations.forEach(loc => {
      const key = loc.parent_id || "root";
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(loc);
    });

    const walk = (parent, depth = 0) => {
      (children.get(parent) || []).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).forEach(loc => {
        const row = document.createElement("div");
        row.className = "location-row";
        row.style.setProperty("--depth", depth);
        row.innerHTML = `<span class="location-indent"></span><strong>${escapeHtml(loc.nome)}</strong>${loc.codigo ? `<span class="muted">${escapeHtml(loc.codigo)}</span>` : ""}<span class="location-type">${escapeHtml(loc.tipo)}</span>${canManage() ? `<button class="button button--secondary button--small" data-location-edit="${loc.id}">Editar</button>` : ""}`;
        container.appendChild(row);
        walk(loc.id, depth + 1);
      });
    };
    walk("root", 0);
    container.querySelectorAll("[data-location-edit]").forEach(btn => btn.addEventListener("click", () => openLocationModal(state.locations.find(l => l.id === btn.dataset.locationEdit))));
  }

  function renderUsers() {
    const tbody = $("usersTableBody");
    if (!tbody) return;
    tbody.replaceChildren();
    if (!state.profiles.length) return appendEmptyRow(tbody, 5, "Nenhum perfil disponível.");

    state.profiles.forEach(profile => {
      const tr = document.createElement("tr");
      const editable = isAdmin();
      tr.innerHTML = `
        <td>${escapeHtml(profile.nome || "Usuário")}</td>
        <td>${escapeHtml(profile.email || "—")}</td>
        <td>${editable ? roleSelectHtml(profile) : escapeHtml(ROLE_LABELS[profile.papel] || profile.papel)}</td>
        <td>${editable ? `<input type="checkbox" data-user-active="${profile.user_id}" ${profile.ativo ? "checked" : ""}>` : profile.ativo ? "Sim" : "Não"}</td>
        <td>${editable ? `<button class="button button--small" data-user-save="${profile.user_id}">Salvar</button>` : "—"}</td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-user-save]").forEach(btn => btn.addEventListener("click", () => saveUserProfile(btn.dataset.userSave)));
  }

  function renderAudit() {
    const tbody = $("auditTableBody");
    if (!tbody) return;
    tbody.replaceChildren();
    if (!state.audit.length) return appendEmptyRow(tbody, 6, "Nenhum evento de auditoria disponível.");

    state.audit.forEach(event => {
      const profile = state.profiles.find(p => p.user_id === event.user_id);
      const tr = document.createElement("tr");
      const summary = event.dados?.operacao || event.acao || "alteração";
      tr.innerHTML = `<td>${escapeHtml(formatDateTime(event.criado_em))}</td><td>${escapeHtml(event.acao)}</td><td>${escapeHtml(event.entidade)}</td><td>${escapeHtml(shortId(event.entidade_id))}</td><td>${escapeHtml(profile?.nome || event.user_id ? shortId(event.user_id) : "Sistema")}</td><td>${escapeHtml(summary)}</td>`;
      tbody.appendChild(tr);
    });
  }

  function renderNotifications() {
    const container = $("notificationsList");
    if (!container) return;
    container.replaceChildren();

    const persisted = state.notifications.map(n => ({
      tone: n.severidade || "info",
      title: n.titulo,
      text: n.mensagem,
      created: n.criado_em,
      unread: !n.lida_em
    }));
    const computed = buildAlerts().map(a => ({ tone: a.tone, title: a.title, text: a.text, created: null, unread: false }));
    const all = [...persisted, ...computed];
    if (!all.length) return container.append(emptyNode("Nenhuma notificação no momento."));

    all.forEach(item => {
      const node = document.createElement("article");
      node.className = "alert-item";
      node.dataset.tone = item.tone;
      const title = document.createElement("strong");
      title.textContent = `${item.unread ? "● " : ""}${item.title}`;
      const text = document.createElement("span");
      text.textContent = `${item.text}${item.created ? ` · ${formatDateTime(item.created)}` : ""}`;
      node.append(title, text);
      container.appendChild(node);
    });
  }

  function renderSettings() {
    if ($("settingPrefix")) $("settingPrefix").value = state.settings.prefixo_codigo || "LAB-INV";
    if ($("settingWarranty")) $("settingWarranty").value = Number(state.settings.dias_alerta_garantia || 30);
    if ($("settingMaintenance")) $("settingMaintenance").value = Number(state.settings.dias_alerta_manutencao || 7);
    if ($("settingIdle")) $("settingIdle").value = Number(state.settings.horas_item_parado || 168);
  }

  function updateNavBadges() {
    setBadge("navLowStock", lowStockItems().length);
    setBadge("navLoans", overdueLoans().length + state.loans.filter(l => l.status === "solicitado").length);
    setBadge("navNotifications", state.notifications.filter(n => !n.lida_em).length + buildAlerts().filter(a => a.tone === "danger").length);
  }

  function fillSelects() {
    fillSelect("itemLocationFilter", state.locations, "Todos", "");
    fillSelect("itemLocation", state.locations, "Sem localização", "");
    fillSelect("movementDestination", state.locations, "Sem alteração", "");
    fillSelect("locationParent", state.locations, "Raiz", "");

    const itemOptions = state.items.map(item => ({ id: item.id, nome: `${item.nome} · ${item.codigo_interno || item.patrimonio || "sem código"}` }));
    fillSelect("movementItem", itemOptions, "Selecione um item", "");
    fillSelect("loanItem", itemOptions, "Selecione um item", "");
    fillSelect("maintenanceItem", itemOptions.filter(option => findItem(option.id)?.tipo_item === "equipamento"), "Selecione um equipamento", "");
    fillSelect("qrItemSelect", itemOptions, "Selecione um item", "");

    const categorySelect = $("itemCategory");
    if (categorySelect) {
      const selected = categorySelect.value;
      categorySelect.replaceChildren(new Option("Sem categoria", ""));
      state.categories.forEach(category => categorySelect.add(new Option(`${category.nome} · ${ITEM_TYPE_LABELS[category.tipo] || category.tipo}`, category.id)));
      categorySelect.value = selected;
    }
  }

  function fillSelect(id, rows, placeholder, placeholderValue) {
    const select = $(id);
    if (!select) return;
    const selected = select.value;
    select.replaceChildren(new Option(placeholder, placeholderValue));
    rows.forEach(row => select.add(new Option(row.nome, row.id)));
    if ([...select.options].some(o => o.value === selected)) select.value = selected;
  }

  function showView(view) {
    const button = document.querySelector(`.nav-button[data-view="${cssEscape(view)}"]`);
    if (button?.hidden) view = "dashboard";
    state.currentView = view;
    document.querySelectorAll(".view").forEach(section => section.dataset.active = String(section.id === `view-${view}`));
    document.querySelectorAll(".nav-button[data-view]").forEach(nav => {
      if (nav.dataset.view === view) nav.setAttribute("aria-current", "page");
      else nav.removeAttribute("aria-current");
    });
    const [title, subtitle] = VIEW_META[view] || ["SENAI Lab Inventário", ""];
    setText("pageTitle", title);
    setText("pageSubtitle", subtitle);
    if ($("sidebar")) $("sidebar").dataset.open = "false";
  }

  function openModal(id) {
    const modal = $(id);
    if (modal) modal.hidden = false;
  }

  function closeModal(id) {
    const modal = $(id);
    if (modal) modal.hidden = true;
  }

  function openItemModal(item = null) {
    if (!canManage()) return showToast("Acesso restrito", "Seu perfil não pode editar o inventário.", "warning");
    $("itemForm").reset();
    $("itemId").value = item?.id || "";
    setText("itemModalTitle", item ? `Editar · ${item.nome}` : "Novo item");
    $("itemCode").value = item?.codigo_interno || nextSuggestedCode();
    $("itemAsset").value = item?.patrimonio || "";
    $("itemName").value = item?.nome || "";
    $("itemType").value = item?.tipo_item || "equipamento";
    $("itemCategory").value = item?.categoria_id || "";
    $("itemSubcategory").value = item?.subcategoria || "";
    $("itemBrand").value = item?.marca || "";
    $("itemModel").value = item?.modelo || "";
    $("itemSerial").value = item?.numero_serie || "";
    $("itemBarcode").value = item?.codigo_barras || "";
    $("itemDescription").value = item?.descricao || "";
    $("itemSpecs").value = item?.especificacoes || "";
    $("itemVoltage").value = item?.voltagem || "";
    $("itemPower").value = item?.potencia || "";
    $("itemCapacity").value = item?.capacidade || "";
    $("itemManufacturer").value = item?.fabricante || "";
    $("itemQuantity").value = item?.quantidade ?? 1;
    $("itemUnit").value = item?.unidade || "un";
    $("itemMinStock").value = item?.estoque_minimo ?? 0;
    $("itemLocation").value = item?.localizacao_id || "";
    $("itemCabinet").value = item?.armario || "";
    $("itemShelf").value = item?.prateleira || "";
    $("itemResponsible").value = item?.responsavel || "";
    $("itemStatus").value = item?.status || "disponivel";
    $("itemAcquired").value = item?.data_aquisicao || "";
    $("itemValue").value = item?.valor_unitario ?? "";
    $("itemWarranty").value = item?.garantia_ate || "";
    $("itemNotes").value = item?.observacoes || "";
    openModal("itemModal");
  }

  async function saveItem(event) {
    event.preventDefault();
    if (!canManage()) return;
    const form = event.currentTarget;
    if (!form.checkValidity()) return form.reportValidity();
    const button = $("btnSaveItem");
    button.disabled = true;
    button.textContent = "Salvando...";

    try {
      const id = $("itemId").value || null;
      const payload = {
        codigo_interno: clean($("itemCode").value),
        patrimonio: nullable($("itemAsset").value),
        nome: clean($("itemName").value),
        categoria_id: nullable($("itemCategory").value),
        subcategoria: nullable($("itemSubcategory").value),
        tipo_item: $("itemType").value,
        marca: nullable($("itemBrand").value),
        modelo: nullable($("itemModel").value),
        numero_serie: nullable($("itemSerial").value),
        codigo_barras: nullable($("itemBarcode").value),
        descricao: clean($("itemDescription").value),
        especificacoes: clean($("itemSpecs").value),
        voltagem: nullable($("itemVoltage").value),
        potencia: nullable($("itemPower").value),
        capacidade: nullable($("itemCapacity").value),
        fabricante: nullable($("itemManufacturer").value),
        quantidade: numberValue($("itemQuantity").value, 1),
        unidade: clean($("itemUnit").value) || "un",
        estoque_minimo: numberValue($("itemMinStock").value, 0),
        localizacao_id: nullable($("itemLocation").value),
        armario: nullable($("itemCabinet").value),
        prateleira: nullable($("itemShelf").value),
        responsavel: nullable($("itemResponsible").value),
        status: $("itemStatus").value,
        data_aquisicao: nullable($("itemAcquired").value),
        valor_unitario: nullableNumber($("itemValue").value),
        garantia_ate: nullable($("itemWarranty").value),
        observacoes: clean($("itemNotes").value)
      };

      let saved;
      if (id) {
        const { data, error } = await client().from("inv_itens").update(payload).eq("id", id).select().single();
        if (error) throw error;
        saved = data;
      } else {
        payload.criado_por = state.user.id;
        const { data, error } = await client().from("inv_itens").insert(payload).select().single();
        if (error) throw error;
        saved = data;
      }

      const fileUpdates = {};
      const photo = $("itemPhoto").files?.[0];
      const manual = $("itemManual").files?.[0];
      const invoice = $("itemInvoice").files?.[0];
      if (photo) fileUpdates.foto_url = await uploadPublicFile(saved.id, "foto", photo);
      if (manual) fileUpdates.manual_url = await uploadPrivateFile(saved.id, "manual", manual);
      if (invoice) fileUpdates.nota_fiscal_url = await uploadPrivateFile(saved.id, "nota-fiscal", invoice);
      if (Object.keys(fileUpdates).length) {
        const { error } = await client().from("inv_itens").update(fileUpdates).eq("id", saved.id);
        if (error) throw error;
      }

      closeModal("itemModal");
      showToast("Item salvo", `${payload.nome} foi atualizado no inventário.`, "success");
      await loadAll({ silent: true });
    } catch (error) {
      console.error("Erro ao salvar item:", error);
      showToast("Não foi possível salvar", normalizeError(error), "danger");
    } finally {
      button.disabled = false;
      button.textContent = "Salvar item";
    }
  }

  async function uploadPublicFile(itemId, kind, file) {
    validateFile(file);
    const path = `itens/${itemId}/${kind}-${Date.now()}-${safeFileName(file.name)}`;
    const { error } = await client().storage.from("inventario-publico").upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return client().storage.from("inventario-publico").getPublicUrl(path).data.publicUrl;
  }

  async function uploadPrivateFile(itemId, kind, file) {
    validateFile(file);
    const path = `itens/${itemId}/${kind}-${Date.now()}-${safeFileName(file.name)}`;
    const { error } = await client().storage.from("inventario-privado").upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return path;
  }

  function validateFile(file) {
    if (file.size > 20 * 1024 * 1024) throw new Error("Arquivo acima do limite de 20 MB.");
    const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) throw new Error("Formato de arquivo não permitido.");
  }

  function openMovementModal(itemId = "") {
    if (!canOperate()) return showToast("Acesso restrito", "Seu perfil não pode registrar movimentações.", "warning");
    $("movementForm").reset();
    $("movementItem").value = itemId || "";
    $("movementQuantity").value = "1";
    openModal("movementModal");
  }

  async function saveMovement(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) return form.reportValidity();
    try {
      const { error } = await client().rpc("inv_registrar_movimentacao", {
        p_item_id: $("movementItem").value,
        p_tipo: $("movementType").value,
        p_quantidade: numberValue($("movementQuantity").value, 1),
        p_destino: nullable($("movementDestination").value),
        p_responsavel: nullable($("movementResponsible").value),
        p_motivo: clean($("movementReason").value),
        p_observacoes: clean($("movementNotes").value)
      });
      if (error) throw error;
      closeModal("movementModal");
      showToast("Movimentação registrada", "O histórico do item foi atualizado.", "success");
      await loadAll({ silent: true });
    } catch (error) {
      showToast("Falha na movimentação", normalizeError(error), "danger");
    }
  }

  function openLoanModal(itemId = "") {
    $("loanForm").reset();
    $("loanItem").value = itemId || "";
    $("loanQuantity").value = "1";
    const due = new Date(Date.now() + 24 * 60 * 60 * 1000);
    due.setMinutes(due.getMinutes() - due.getTimezoneOffset());
    $("loanDue").value = due.toISOString().slice(0, 16);
    $("loanPerson").value = state.profile?.nome || "";
    $("loanEmail").value = state.profile?.email || "";
    openModal("loanModal");
  }

  async function saveLoan(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) return form.reportValidity();
    try {
      const due = new Date($("loanDue").value);
      if (Number.isNaN(due.getTime())) throw new Error("Informe uma previsão válida.");
      const { error } = await client().rpc("inv_solicitar_emprestimo", {
        p_item_id: $("loanItem").value,
        p_quantidade: numberValue($("loanQuantity").value, 1),
        p_nome: clean($("loanPerson").value),
        p_email: nullable($("loanEmail").value),
        p_previsao: due.toISOString(),
        p_estado: clean($("loanCondition").value),
        p_observacoes: clean($("loanNotes").value)
      });
      if (error) throw error;
      closeModal("loanModal");
      showToast("Empréstimo registrado", canOperate() ? "A retirada foi registrada." : "A solicitação foi enviada para autorização.", "success");
      await loadAll({ silent: true });
    } catch (error) {
      showToast("Falha no empréstimo", normalizeError(error), "danger");
    }
  }

  async function approveLoan(id) {
    try {
      const { error } = await client().rpc("inv_aprovar_emprestimo", { p_emprestimo_id: id });
      if (error) throw error;
      showToast("Empréstimo aprovado", "A retirada foi liberada e o estoque atualizado.", "success");
      await loadAll({ silent: true });
    } catch (error) {
      showToast("Falha ao aprovar", normalizeError(error), "danger");
    }
  }

  function openReturnModal(id) {
    $("returnForm").reset();
    $("returnLoanId").value = id;
    openModal("returnModal");
  }

  async function saveReturn(event) {
    event.preventDefault();
    try {
      const { error } = await client().rpc("inv_devolver_emprestimo", {
        p_emprestimo_id: $("returnLoanId").value,
        p_estado: clean($("returnCondition").value),
        p_observacoes: clean($("returnNotes").value)
      });
      if (error) throw error;
      closeModal("returnModal");
      showToast("Devolução confirmada", "O item voltou ao estoque e o histórico foi atualizado.", "success");
      await loadAll({ silent: true });
    } catch (error) {
      showToast("Falha na devolução", normalizeError(error), "danger");
    }
  }

  async function markLoanLost(id) {
    if (!window.confirm("Marcar este empréstimo como perdido?")) return;
    const loan = state.loans.find(l => l.id === id);
    if (!loan) return;
    try {
      const { error: loanError } = await client().from("inv_emprestimos").update({ status: "perdido" }).eq("id", id);
      if (loanError) throw loanError;
      const { error: itemError } = await client().from("inv_itens").update({ status: "perdido" }).eq("id", loan.item_id);
      if (itemError) throw itemError;
      showToast("Item marcado como perdido", "O registro foi atualizado para investigação.", "warning");
      await loadAll({ silent: true });
    } catch (error) {
      showToast("Falha ao atualizar", normalizeError(error), "danger");
    }
  }

  function openMaintenanceModal(maintenance = null) {
    if (!canManage()) return showToast("Acesso restrito", "Seu perfil não pode editar manutenção.", "warning");
    $("maintenanceForm").reset();
    $("maintenanceId").value = maintenance?.id || "";
    $("maintenanceItem").value = maintenance?.item_id || "";
    $("maintenanceType").value = maintenance?.tipo || "corretiva";
    $("maintenanceProblem").value = maintenance?.problema || "";
    $("maintenanceTech").value = maintenance?.tecnico_responsavel || "";
    $("maintenanceCost").value = maintenance?.custo ?? "";
    $("maintenanceSend").value = maintenance?.data_envio || "";
    $("maintenanceForecast").value = maintenance?.previsao || "";
    $("maintenanceStatus").value = maintenance?.status || "aberta";
    $("maintenanceParts").value = maintenance?.pecas_utilizadas || "";
    $("maintenanceDiagnosis").value = maintenance?.diagnostico || "";
    $("maintenanceSolution").value = maintenance?.solucao || "";
    openModal("maintenanceModal");
  }

  async function saveMaintenance(event) {
    event.preventDefault();
    if (!canManage()) return;
    const form = event.currentTarget;
    if (!form.checkValidity()) return form.reportValidity();
    try {
      const id = $("maintenanceId").value || null;
      const status = $("maintenanceStatus").value;
      const payload = {
        item_id: $("maintenanceItem").value,
        tipo: $("maintenanceType").value,
        problema: clean($("maintenanceProblem").value),
        tecnico_responsavel: nullable($("maintenanceTech").value),
        custo: nullableNumber($("maintenanceCost").value),
        data_envio: nullable($("maintenanceSend").value),
        previsao: nullable($("maintenanceForecast").value),
        status,
        pecas_utilizadas: clean($("maintenanceParts").value),
        diagnostico: clean($("maintenanceDiagnosis").value),
        solucao: clean($("maintenanceSolution").value),
        data_conclusao: status === "concluida" ? new Date().toISOString().slice(0, 10) : null
      };

      if (id) {
        const { error } = await client().from("inv_manutencoes").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        payload.criado_por = state.user.id;
        const { error } = await client().from("inv_manutencoes").insert(payload);
        if (error) throw error;
        const { error: moveError } = await client().rpc("inv_registrar_movimentacao", {
          p_item_id: payload.item_id,
          p_tipo: "manutencao",
          p_quantidade: 1,
          p_destino: null,
          p_responsavel: payload.tecnico_responsavel,
          p_motivo: payload.problema,
          p_observacoes: "Manutenção aberta pelo sistema de inventário."
        });
        if (moveError) console.warn("Movimentação de manutenção não registrada:", moveError);
      }

      if (["concluida", "cancelada"].includes(status)) {
        const item = findItem(payload.item_id);
        if (item?.status === "manutencao") {
          await client().from("inv_itens").update({ status: "disponivel" }).eq("id", payload.item_id);
        }
      }

      closeModal("maintenanceModal");
      showToast("Manutenção salva", "A ficha técnica foi atualizada.", "success");
      await loadAll({ silent: true });
    } catch (error) {
      showToast("Falha na manutenção", normalizeError(error), "danger");
    }
  }

  function openLocationModal(location = null) {
    if (!canManage()) return;
    $("locationForm").reset();
    $("locationId").value = location?.id || "";
    $("locationParent").value = location?.parent_id || "";
    $("locationName").value = location?.nome || "";
    $("locationCode").value = location?.codigo || "";
    $("locationType").value = location?.tipo || "local";
    $("locationDescription").value = location?.descricao || "";
    openModal("locationModal");
  }

  async function saveLocation(event) {
    event.preventDefault();
    if (!canManage()) return;
    const form = event.currentTarget;
    if (!form.checkValidity()) return form.reportValidity();
    try {
      const id = $("locationId").value || null;
      const payload = {
        parent_id: nullable($("locationParent").value),
        nome: clean($("locationName").value),
        codigo: nullable($("locationCode").value),
        tipo: $("locationType").value,
        descricao: clean($("locationDescription").value)
      };
      if (id) {
        const { error } = await client().from("inv_localizacoes").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await client().from("inv_localizacoes").insert(payload);
        if (error) throw error;
      }
      closeModal("locationModal");
      showToast("Localização salva", "A estrutura física foi atualizada.", "success");
      await loadAll({ silent: true });
    } catch (error) {
      showToast("Falha na localização", normalizeError(error), "danger");
    }
  }

  async function savePhysical(event) {
    event.preventDefault();
    if (!canAudit()) return;
    const form = event.currentTarget;
    if (!form.checkValidity()) return form.reportValidity();
    try {
      const { data, error } = await client().rpc("inv_criar_inventario_fisico", {
        p_titulo: clean($("physicalTitle").value),
        p_responsavel: clean($("physicalResponsible").value),
        p_observacoes: clean($("physicalNotes").value)
      });
      if (error) throw error;
      closeModal("physicalModal");
      showToast("Inventário físico iniciado", "A lista de conferência foi criada.", "success");
      await loadAll({ silent: true });
      openCountModal(data);
    } catch (error) {
      showToast("Falha ao iniciar inventário", normalizeError(error), "danger");
    }
  }

  function openCountModal(inventoryId) {
    const inventory = state.physical.find(inv => inv.id === inventoryId);
    if (!inventory) return;
    state.currentPhysicalId = inventoryId;
    setText("countTitle", inventory.titulo);
    setText("countSubtitle", `${inventory.responsavel} · ${inventory.status}`);
    renderCountList();
    setHidden("btnFinishPhysical", inventory.status === "concluido");
    openModal("countModal");
  }

  function renderCountList() {
    const list = $("countList");
    if (!list) return;
    const rows = state.counts.filter(c => c.inventario_id === state.currentPhysicalId);
    setText("countTotal", rows.length);
    setText("countFound", rows.filter(c => c.resultado === "encontrado").length);
    setText("countMissing", rows.filter(c => c.resultado === "nao_encontrado").length);
    setText("countDamaged", rows.filter(c => c.resultado === "danificado").length);
    list.replaceChildren();
    if (!rows.length) return list.append(emptyNode("Nenhum item nesta conferência."));

    const inventory = state.physical.find(inv => inv.id === state.currentPhysicalId);
    rows.forEach(count => {
      const item = findItem(count.item_id);
      const row = document.createElement("div");
      row.className = "count-row";
      const locked = inventory?.status === "concluido";
      row.innerHTML = `
        <div class="item-name"><strong>${escapeHtml(item?.nome || "Item")}</strong><span>${escapeHtml(item?.patrimonio || item?.codigo_interno || "—")} · ${escapeHtml(locationName(item?.localizacao_id) || "Sem localização")}</span></div>
        <button class="button button--small" data-count-result="encontrado" data-count-id="${count.id}" ${locked ? "disabled" : ""}>✓ Encontrado</button>
        <button class="button button--secondary button--small" data-count-result="nao_encontrado" data-count-id="${count.id}" ${locked ? "disabled" : ""}>Não encontrado</button>
        <button class="button button--danger button--small" data-count-result="danificado" data-count-id="${count.id}" ${locked ? "disabled" : ""}>Danificado</button>`;
      if (count.resultado !== "pendente") row.dataset.resultado = count.resultado;
      list.appendChild(row);
    });

    list.querySelectorAll("[data-count-result]").forEach(btn => btn.addEventListener("click", () => updateCount(btn.dataset.countId, btn.dataset.countResult)));
  }

  async function updateCount(id, result) {
    const count = state.counts.find(c => String(c.id) === String(id));
    if (!count) return;
    const item = findItem(count.item_id);
    try {
      const payload = {
        resultado: result,
        quantidade_encontrada: result === "nao_encontrado" ? 0 : Number(item?.quantidade || 1),
        localizacao_confirmada_id: item?.localizacao_id || null,
        conferido_por: state.user.id,
        conferido_em: new Date().toISOString()
      };
      const { error } = await client().from("inv_contagens").update(payload).eq("id", id);
      if (error) throw error;
      Object.assign(count, payload);
      renderCountList();
      renderPhysical();
    } catch (error) {
      showToast("Falha na conferência", normalizeError(error), "danger");
    }
  }

  async function finishPhysical() {
    const id = state.currentPhysicalId;
    if (!id) return;
    const pending = state.counts.filter(c => c.inventario_id === id && c.resultado === "pendente").length;
    if (pending && !window.confirm(`Ainda existem ${pending} item(ns) pendentes. Concluir mesmo assim?`)) return;
    try {
      const { error } = await client().rpc("inv_concluir_inventario_fisico", { p_inventario_id: id });
      if (error) throw error;
      closeModal("countModal");
      showToast("Inventário concluído", "A conferência foi encerrada e preservada no histórico.", "success");
      await loadAll({ silent: true });
    } catch (error) {
      showToast("Falha ao concluir", normalizeError(error), "danger");
    }
  }

  function renderSelectedQr() {
    const select = $("qrItemSelect");
    const canvas = $("qrCanvas");
    if (!select || !canvas) return;
    const item = findItem(select.value);
    canvas.replaceChildren();
    if (!item) {
      setText("qrItemName", "Selecione um item");
      setText("qrItemPatrimonio", "Patrimônio: —");
      setText("qrItemCode", "Código: —");
      setText("qrItemStatus", "Status: —");
      return;
    }
    setText("qrItemName", item.nome);
    setText("qrItemPatrimonio", `Patrimônio: ${item.patrimonio || "—"}`);
    setText("qrItemCode", `Código: ${item.codigo_interno || "—"}`);
    setText("qrItemStatus", `Status: ${ITEM_STATUS_LABELS[item.status] || item.status || "—"}`);
    const url = `${window.location.origin}/item.html?token=${encodeURIComponent(item.qr_token)}`;
    if (window.QRCode) new window.QRCode(canvas, { text: url, width: 172, height: 172, correctLevel: window.QRCode.CorrectLevel.M });
    else canvas.textContent = url;
  }

  function openHistory(itemId) {
    const item = findItem(itemId);
    if (!item) return;
    setText("historyTitle", `Histórico · ${item.nome}`);
    setText("historySubtitle", item.patrimonio || item.codigo_interno || "Sem patrimônio");
    const body = $("historyBody");
    body.replaceChildren();

    const events = [];
    state.movements.filter(m => m.item_id === itemId).forEach(m => events.push({ date: m.criado_em, title: MOVEMENT_LABELS[m.tipo] || m.tipo, text: `${m.responsavel || "SENAI Lab"}${m.motivo ? ` · ${m.motivo}` : ""}` }));
    state.loans.filter(l => l.item_id === itemId).forEach(l => events.push({ date: l.criado_em, title: `Empréstimo · ${LOAN_STATUS_LABELS[loanDisplayStatus(l)] || l.status}`, text: `${l.retirado_por_nome || "—"} · previsão ${formatDateTime(l.previsao_devolucao)}` }));
    state.maintenances.filter(m => m.item_id === itemId).forEach(m => events.push({ date: m.identificado_em || m.criado_em, title: `Manutenção · ${MAINTENANCE_STATUS_LABELS[m.status] || m.status}`, text: m.problema || "Ocorrência técnica" }));
    state.counts.filter(c => c.item_id === itemId && c.conferido_em).forEach(c => {
      const inv = state.physical.find(p => p.id === c.inventario_id);
      events.push({ date: c.conferido_em, title: `Inventário físico · ${c.resultado.replace("_", " ")}`, text: inv?.titulo || "Conferência física" });
    });
    events.push({ date: item.criado_em, title: "Cadastro", text: "Item incluído no SENAI Lab Inventário." });
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (!events.length) body.append(emptyNode("Nenhum evento registrado."));
    events.forEach(event => {
      const node = document.createElement("article");
      node.className = "activity-item";
      const title = document.createElement("strong");
      title.textContent = event.title;
      const text = document.createElement("span");
      text.textContent = `${formatDateTime(event.date)} · ${event.text}`;
      node.append(title, text);
      body.appendChild(node);
    });
    openModal("historyModal");
  }

  async function saveUserProfile(userId) {
    if (!isAdmin()) return;
    const row = document.querySelector(`[data-user-save="${cssEscape(userId)}"]`)?.closest("tr");
    const role = row?.querySelector(`[data-user-role="${cssEscape(userId)}"]`)?.value;
    const active = Boolean(row?.querySelector(`[data-user-active="${cssEscape(userId)}"]`)?.checked);
    try {
      const { error } = await client().from("inv_perfis").update({ papel: role, ativo: active }).eq("user_id", userId);
      if (error) throw error;
      showToast("Perfil atualizado", "As permissões foram salvas.", "success");
      await loadAll({ silent: true });
    } catch (error) {
      showToast("Falha ao atualizar perfil", normalizeError(error), "danger");
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (!canManage()) return;
    const value = {
      ...state.settings,
      prefixo_codigo: clean($("settingPrefix").value) || "LAB-INV",
      dias_alerta_garantia: Math.max(1, numberValue($("settingWarranty").value, 30)),
      dias_alerta_manutencao: Math.max(1, numberValue($("settingMaintenance").value, 7)),
      horas_item_parado: Math.max(1, numberValue($("settingIdle").value, 168))
    };
    try {
      const { error } = await client().from("inv_configuracoes").upsert({ chave: "geral", valor: value, atualizado_por: state.user.id }, { onConflict: "chave" });
      if (error) throw error;
      state.settings = value;
      showToast("Configurações salvas", "Os parâmetros operacionais foram atualizados.", "success");
      renderDashboard();
      renderNotifications();
    } catch (error) {
      showToast("Falha nas configurações", normalizeError(error), "danger");
    }
  }

  async function markNotificationsRead() {
    const unread = state.notifications.filter(n => !n.lida_em).map(n => n.id);
    if (!unread.length) return showToast("Notificações", "Não há notificações pendentes.", "success");
    try {
      const { error } = await client().from("inv_notificacoes").update({ lida_em: new Date().toISOString() }).in("id", unread);
      if (error) throw error;
      await loadAll({ silent: true });
    } catch (error) {
      showToast("Falha ao marcar notificações", normalizeError(error), "danger");
    }
  }

  function buildAlerts() {
    const alerts = [];
    lowStockItems().forEach(item => alerts.push({ tone: Number(item.quantidade || 0) <= 0 ? "danger" : "warning", title: `Estoque baixo · ${item.nome}`, text: `${formatNumber(item.quantidade)} ${item.unidade || "un"} disponível(is), mínimo ${formatNumber(item.estoque_minimo)}.` }));
    overdueLoans().forEach(loan => alerts.push({ tone: "danger", title: `Empréstimo atrasado · ${findItem(loan.item_id)?.nome || "Item"}`, text: `${loan.retirado_por_nome || "—"} deveria devolver em ${formatDateTime(loan.previsao_devolucao)}.` }));
    state.items.filter(i => !i.localizacao_id).slice(0, 15).forEach(item => alerts.push({ tone: "warning", title: `Sem localização · ${item.nome}`, text: "Defina sala, armário ou prateleira para manter a rastreabilidade." }));

    const warrantyDays = Number(state.settings.dias_alerta_garantia || 30);
    state.items.filter(i => i.garantia_ate).forEach(item => {
      const days = daysUntil(item.garantia_ate);
      if (days >= 0 && days <= warrantyDays) alerts.push({ tone: "warning", title: `Garantia vencendo · ${item.nome}`, text: `Garantia termina em ${days} dia(s), em ${formatDate(item.garantia_ate)}.` });
    });

    const maintenanceDays = Number(state.settings.dias_alerta_manutencao || 7);
    state.maintenances.filter(m => !["concluida", "cancelada"].includes(m.status) && m.previsao).forEach(m => {
      const days = daysUntil(m.previsao);
      if (days < 0) alerts.push({ tone: "danger", title: `Manutenção atrasada · ${findItem(m.item_id)?.nome || "Equipamento"}`, text: `Previsão venceu em ${formatDate(m.previsao)}.` });
      else if (days <= maintenanceDays) alerts.push({ tone: "warning", title: `Manutenção próxima · ${findItem(m.item_id)?.nome || "Equipamento"}`, text: `Previsão em ${days} dia(s).` });
    });

    const idleHours = Number(state.settings.horas_item_parado || 168);
    state.items.filter(item => item.atualizado_em && !["baixado", "perdido"].includes(item.status)).forEach(item => {
      const hours = (Date.now() - new Date(item.atualizado_em).getTime()) / 3600000;
      if (Number.isFinite(hours) && hours >= idleHours && item.status !== "disponivel") alerts.push({ tone: "warning", title: `Item parado · ${item.nome}`, text: `Sem atualização operacional há cerca de ${Math.floor(hours / 24)} dia(s).` });
    });

    return alerts.slice(0, 60);
  }

  function alertNode(alert) {
    const node = document.createElement("article");
    node.className = "alert-item";
    node.dataset.tone = alert.tone;
    const strong = document.createElement("strong");
    strong.textContent = alert.title;
    const span = document.createElement("span");
    span.textContent = alert.text;
    node.append(strong, span);
    return node;
  }

  function exportReport(type, format) {
    if (!canReport()) return showToast("Acesso restrito", "Seu perfil não possui acesso a relatórios.", "warning");
    const report = buildReport(type);
    if (!report.rows.length) return showToast("Relatório vazio", "Não há dados para exportar.", "warning");
    try {
      if (format === "csv") exportCsv(report);
      else if (format === "xlsx") exportXlsx(report);
      else if (format === "pdf") exportPdf(report);
      showToast("Relatório gerado", `${report.title} exportado em ${format.toUpperCase()}.`, "success");
    } catch (error) {
      showToast("Falha ao exportar", normalizeError(error), "danger");
    }
  }

  function buildReport(type) {
    if (type === "inventario") return {
      title: "Inventário geral",
      headers: ["Código", "Patrimônio", "Nome", "Tipo", "Marca", "Modelo", "Quantidade", "Unidade", "Status", "Localização", "Responsável", "Valor unitário", "Valor total"],
      rows: state.items.map(i => [i.codigo_interno, i.patrimonio || "", i.nome, ITEM_TYPE_LABELS[i.tipo_item] || i.tipo_item, i.marca || "", i.modelo || "", i.quantidade, i.unidade, ITEM_STATUS_LABELS[i.status] || i.status, locationName(i.localizacao_id) || "", i.responsavel || "", Number(i.valor_unitario || 0), Number(i.valor_unitario || 0) * Number(i.quantidade || 0)])
    };
    if (type === "estoque") return {
      title: "Estoque",
      headers: ["Código", "Item", "Tipo", "Quantidade", "Unidade", "Mínimo", "Situação", "Localização"],
      rows: state.items.filter(i => i.tipo_item !== "equipamento" || Number(i.estoque_minimo || 0) > 0).map(i => [i.codigo_interno, i.nome, ITEM_TYPE_LABELS[i.tipo_item] || i.tipo_item, i.quantidade, i.unidade, i.estoque_minimo, isLowStock(i) ? "Estoque baixo" : "Normal", locationName(i.localizacao_id) || ""])
    };
    if (type === "emprestimos") return {
      title: "Empréstimos",
      headers: ["Item", "Pessoa", "E-mail", "Quantidade", "Retirada", "Previsão", "Devolução", "Status"],
      rows: state.loans.map(l => [findItem(l.item_id)?.nome || "", l.retirado_por_nome, l.retirado_por_email || "", l.quantidade, formatDateTime(l.data_retirada), formatDateTime(l.previsao_devolucao), formatDateTime(l.data_devolucao), LOAN_STATUS_LABELS[loanDisplayStatus(l)] || l.status])
    };
    if (type === "manutencoes") return {
      title: "Manutenções",
      headers: ["Item", "Problema", "Tipo", "Técnico", "Status", "Previsão", "Conclusão", "Custo", "Diagnóstico", "Solução"],
      rows: state.maintenances.map(m => [findItem(m.item_id)?.nome || "", m.problema, m.tipo, m.tecnico_responsavel || "", MAINTENANCE_STATUS_LABELS[m.status] || m.status, formatDate(m.previsao), formatDate(m.data_conclusao), Number(m.custo || 0), m.diagnostico || "", m.solucao || ""])
    };
    if (type === "movimentacoes") return {
      title: "Movimentações",
      headers: ["Data", "Item", "Tipo", "Quantidade", "Responsável", "Motivo", "Origem", "Destino"],
      rows: state.movements.map(m => [formatDateTime(m.criado_em), findItem(m.item_id)?.nome || "", MOVEMENT_LABELS[m.tipo] || m.tipo, m.quantidade, m.responsavel || "", m.motivo || "", locationName(m.localizacao_origem_id) || "", locationName(m.localizacao_destino_id) || ""])
    };
    if (type === "fisico") return {
      title: "Inventário físico",
      headers: ["Inventário", "Responsável", "Status", "Total", "Encontrados", "Não encontrados", "Danificados", "Pendentes", "Início", "Conclusão"],
      rows: state.physical.map(inv => {
        const counts = state.counts.filter(c => c.inventario_id === inv.id);
        return [inv.titulo, inv.responsavel, inv.status, counts.length, counts.filter(c => c.resultado === "encontrado").length, counts.filter(c => c.resultado === "nao_encontrado").length, counts.filter(c => c.resultado === "danificado").length, counts.filter(c => c.resultado === "pendente").length, formatDateTime(inv.iniciado_em), formatDateTime(inv.concluido_em)];
      })
    };
    return { title: "Relatório", headers: [], rows: [] };
  }

  function exportCsv(report) {
    const csv = [report.headers, ...report.rows].map(row => row.map(csvValue).join(";")).join("\r\n");
    downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), `${slug(report.title)}-${todayIso()}.csv`);
  }

  function exportXlsx(report) {
    if (!window.XLSX) throw new Error("Biblioteca de Excel não carregada.");
    const sheet = window.XLSX.utils.aoa_to_sheet([report.headers, ...report.rows]);
    const book = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(book, sheet, "Relatório");
    window.XLSX.writeFile(book, `${slug(report.title)}-${todayIso()}.xlsx`);
  }

  function exportPdf(report) {
    if (!window.jspdf?.jsPDF) throw new Error("Biblioteca de PDF não carregada.");
    const doc = new window.jspdf.jsPDF({ orientation: report.headers.length > 8 ? "landscape" : "portrait" });
    doc.setFontSize(15);
    doc.text(`SENAI Lab · ${report.title}`, 14, 16);
    doc.setFontSize(8);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 22);
    if (typeof doc.autoTable !== "function") throw new Error("Módulo de tabela PDF não carregado.");
    doc.autoTable({ head: [report.headers], body: report.rows.map(row => row.map(v => String(v ?? ""))), startY: 27, styles: { fontSize: 7 } });
    doc.save(`${slug(report.title)}-${todayIso()}.pdf`);
  }

  function subscribeRealtime() {
    if (!state.user || !navigator.onLine) return;
    const c = client();
    if (state.realtimeChannel) c.removeChannel(state.realtimeChannel);
    state.realtimeChannel = c
      .channel("senai-lab-inventario-v1")
      .on("postgres_changes", { event: "*", schema: "public", table: "inv_itens" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inv_movimentacoes" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inv_emprestimos" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inv_manutencoes" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "inv_notificacoes" }, scheduleReload)
      .subscribe(status => {
        if (status === "SUBSCRIBED") setHealth("online", "Realtime online");
        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          setHealth("checking", "Reconectando");
          setTimeout(() => state.user && navigator.onLine && subscribeRealtime(), 5000);
        }
      });
  }

  function scheduleReload() {
    clearTimeout(state.reloadTimer);
    state.reloadTimer = setTimeout(() => loadAll({ silent: true }), 300);
  }

  function startFallback() {
    clearInterval(state.fallbackTimer);
    state.fallbackTimer = setInterval(() => {
      if (state.user && navigator.onLine) loadAll({ silent: true });
    }, INVENTARIO_CONFIG.realtimeFallbackMs || 30000);
  }

  function handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get("item");
    const action = params.get("action");
    if (itemId && action === "loan") {
      const item = findItem(itemId);
      if (item) setTimeout(() => openLoanModal(itemId), 250);
    }
  }

  function lowStockItems() {
    return state.items.filter(isLowStock);
  }

  function isLowStock(item) {
    return Number(item.estoque_minimo || 0) > 0 && Number(item.quantidade || 0) <= Number(item.estoque_minimo || 0);
  }

  function overdueLoans() {
    return state.loans.filter(loan => ["aberto", "atrasado"].includes(loan.status) && new Date(loan.previsao_devolucao).getTime() < Date.now() && !loan.data_devolucao);
  }

  function loanDisplayStatus(loan) {
    if (loan.status === "aberto" && new Date(loan.previsao_devolucao).getTime() < Date.now() && !loan.data_devolucao) return "atrasado";
    return loan.status;
  }

  function countItemsByStatus(status) { return state.items.filter(i => i.status === status).length; }
  function estimatedAssetValue() { return state.items.reduce((sum, item) => sum + Number(item.quantidade || 0) * Number(item.valor_unitario || 0), 0); }
  function findItem(id) { return state.items.find(item => String(item.id) === String(id)); }
  function locationName(id) { return state.locations.find(location => String(location.id) === String(id))?.nome || ""; }

  function nextSuggestedCode() {
    const prefix = state.settings.prefixo_codigo || "LAB-INV";
    const numbers = state.items.map(i => String(i.codigo_interno || "").match(/(\d+)$/)?.[1]).filter(Boolean).map(Number);
    const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
    return `${prefix}-${String(next).padStart(4, "0")}`;
  }

  function roleSelectHtml(profile) {
    return `<select data-user-role="${profile.user_id}">${Object.entries(ROLE_LABELS).map(([value, label]) => `<option value="${value}" ${profile.papel === value ? "selected" : ""}>${label}</option>`).join("")}</select>`;
  }

  function setHealth(stateName, label) {
    const pill = $("healthPill");
    if (!pill) return;
    pill.dataset.state = stateName;
    const span = pill.querySelector("span");
    if (span) span.textContent = label;
  }

  function showLoginError(text) {
    const el = $("loginError");
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
  }
  function hideLoginError() { if ($("loginError")) $("loginError").hidden = true; }

  function showToast(title, text, tone = "info") {
    const stack = $("toastStack");
    if (!stack) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.dataset.tone = tone;
    const strong = document.createElement("strong");
    strong.textContent = title;
    const span = document.createElement("span");
    span.textContent = text;
    toast.append(strong, span);
    stack.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
  }

  function emptyNode(text) {
    const div = document.createElement("div");
    div.className = "empty";
    div.textContent = text;
    return div;
  }

  function appendEmptyRow(tbody, colspan, text) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = colspan;
    td.appendChild(emptyNode(text));
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function setText(id, value) { const el = $(id); if (el) el.textContent = String(value ?? ""); }
  function setHidden(id, hidden) { const el = $(id); if (el) el.hidden = hidden; }
  function setBadge(id, value) { const el = $(id); if (!el) return; el.textContent = String(value); el.hidden = !value; }

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function clean(value) { return String(value ?? "").trim(); }
  function nullable(value) { const v = clean(value); return v === "" ? null : v; }
  function numberValue(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function nullableNumber(value) { const v = clean(value); if (!v) return null; const n = Number(v); return Number.isFinite(n) ? n : null; }

  function formatNumber(value) {
    const number = Number(value || 0);
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(number);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return "—";
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function daysUntil(value) {
    if (!value) return NaN;
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return Math.ceil((date.getTime() - today.getTime()) / 86400000);
  }

  function normalizeError(error) {
    const message = String(error?.message || error || "Erro inesperado.");
    if (/row-level security/i.test(message)) return "Seu perfil não possui permissão para esta operação.";
    if (/duplicate key|unique constraint/i.test(message)) return "Já existe um registro com este código, patrimônio, série ou identificador.";
    if (/does not exist|relation/i.test(message)) return "O banco do Inventário ainda não foi ativado ou está incompleto.";
    return message;
  }

  function safeFileName(name) { return String(name || "arquivo").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 100); }
  function shortId(value) { const v = String(value || ""); return v.length > 12 ? `${v.slice(0, 8)}…` : v || "—"; }
  function todayIso() { return new Date().toISOString().slice(0, 10); }
  function slug(value) { return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "relatorio"; }

  function csvValue(value) {
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
    URL.revokeObjectURL(url);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }
})();
