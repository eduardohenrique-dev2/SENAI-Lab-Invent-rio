(() => {
  "use strict";

  const state = {
    profile: null,
    itemObserver: null,
    importObserver: null,
    imports: [],
    refreshingImports: false
  };

  const $ = id => document.getElementById(id);
  const db = () => obterInventarioSupabase();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  function boot() {
    observeAuth();
    refreshAccess();
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

      const { data, error } = await db()
        .from("inv_perfis")
        .select("user_id,nome,email,papel,ativo")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      applyAccess(data);
    } catch (error) {
      console.warn("Exclusões: falha ao validar acesso", error);
      applyAccess(null);
    }
  }

  function applyAccess(profile) {
    state.profile = profile;
    const allowed = Boolean(profile?.ativo && ["administrador", "gestor"].includes(profile.papel));

    if (!allowed) {
      disconnectObservers();
      document.querySelectorAll("[data-inventory-delete],[data-import-delete]").forEach(button => button.remove());
      return;
    }

    connectObservers();
    enhanceItemRows();
    enhanceImportHistory();
  }

  function connectObservers() {
    const itemsBody = $("itemsTableBody");
    if (itemsBody && !state.itemObserver) {
      state.itemObserver = new MutationObserver(() => enhanceItemRows());
      state.itemObserver.observe(itemsBody, { childList: true, subtree: true });
    }

    const history = $("v2History");
    if (history && !state.importObserver) {
      state.importObserver = new MutationObserver(() => enhanceImportHistory());
      state.importObserver.observe(history, { childList: true, subtree: true });
    }

    if (!history) {
      setTimeout(() => {
        if (state.profile?.ativo) connectObservers();
      }, 1200);
    }
  }

  function disconnectObservers() {
    state.itemObserver?.disconnect();
    state.importObserver?.disconnect();
    state.itemObserver = null;
    state.importObserver = null;
  }

  function enhanceItemRows() {
    if (!state.profile?.ativo) return;

    document.querySelectorAll("#itemsTableBody tr").forEach(row => {
      if (row.querySelector("[data-inventory-delete]")) return;

      const anchor = row.querySelector("[data-item-edit]") || row.querySelector("[data-item-qr]");
      const itemId = anchor?.dataset.itemEdit || anchor?.dataset.itemQr;
      const actions = row.querySelector(".table-actions");
      if (!itemId || !actions) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button--danger button--small";
      button.dataset.inventoryDelete = itemId;
      button.textContent = "Excluir";
      button.title = "Dar baixa no item e removê-lo da listagem ativa";
      button.addEventListener("click", () => deleteInventoryItem(itemId, button));
      actions.appendChild(button);
    });
  }

  async function deleteInventoryItem(itemId, button) {
    if (!canManage()) return;

    try {
      button.disabled = true;
      button.textContent = "Verificando...";

      const [{ data: item, error: itemError }, { data: loans, error: loanError }] = await Promise.all([
        db().from("inv_itens").select("id,nome,codigo_interno,patrimonio,status,ativo").eq("id", itemId).maybeSingle(),
        db().from("inv_emprestimos").select("id,status,retirado_por_nome,previsao_devolucao").eq("item_id", itemId).in("status", ["solicitado", "aberto", "atrasado"]).limit(5)
      ]);

      if (itemError) throw itemError;
      if (loanError) throw loanError;
      if (!item?.ativo) throw new Error("Este item já está baixado ou inativo.");

      if ((loans || []).length) {
        window.alert("Este item possui empréstimo ou solicitação em aberto. Finalize/cancele o empréstimo antes de excluir o item.");
        return;
      }

      const identifier = item.patrimonio || item.codigo_interno || "sem identificação";
      const confirmed = window.confirm(
        `Excluir “${item.nome}” (${identifier})?\n\n` +
        "O item será dado como BAIXADO e sairá do inventário ativo. O histórico, movimentações e auditoria serão preservados."
      );
      if (!confirmed) return;

      button.textContent = "Excluindo...";
      const { error } = await db().rpc("inv_registrar_movimentacao", {
        p_item_id: itemId,
        p_tipo: "baixa",
        p_quantidade: 1,
        p_destino: null,
        p_responsavel: state.profile?.nome || state.profile?.email || "Administrador",
        p_motivo: "Exclusão / baixa pelo painel do Inventário",
        p_observacoes: "Item removido da listagem ativa. Histórico e auditoria preservados pelo sistema."
      });
      if (error) throw error;

      window.alert("Item excluído da listagem ativa e registrado como baixa.");
      $("btnGlobalRefresh")?.click();
    } catch (error) {
      console.error("Falha ao excluir item:", error);
      window.alert(`Não foi possível excluir o item: ${friendlyError(error)}`);
    } finally {
      if (button?.isConnected) {
        button.disabled = false;
        button.textContent = "Excluir";
      }
    }
  }

  async function enhanceImportHistory() {
    if (!canManage() || state.refreshingImports) return;
    const box = $("v2History");
    if (!box) return;

    const cards = Array.from(box.querySelectorAll(".import-history-card"));
    if (!cards.length) return;

    state.refreshingImports = true;
    try {
      const { data, error } = await db()
        .from("inv_importacoes")
        .select("id,arquivo_nome,arquivos,status,total_linhas,novos,atualizados,ignorados,erros,criado_em")
        .order("criado_em", { ascending: false })
        .limit(40);
      if (error) throw error;

      state.imports = data || [];
      cards.forEach((card, index) => {
        if (card.querySelector("[data-import-delete]")) return;
        const batch = state.imports[index];
        if (!batch) return;

        const actions = document.createElement("div");
        actions.className = "entity-card__actions";
        actions.style.marginTop = "10px";
        actions.style.display = "flex";
        actions.style.justifyContent = "flex-end";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "button button--danger button--small";
        button.dataset.importDelete = batch.id;
        button.textContent = "Excluir lote";
        button.title = "Excluir o histórico e os arquivos originais deste upload";
        button.addEventListener("click", () => deleteImportBatch(batch, button));

        actions.appendChild(button);
        card.appendChild(actions);
      });
    } catch (error) {
      console.warn("Não foi possível preparar exclusão dos uploads:", error);
    } finally {
      state.refreshingImports = false;
    }
  }

  async function deleteImportBatch(batch, button) {
    if (!canManage()) return;

    if (["analisando", "importando"].includes(batch.status)) {
      window.alert("Este lote ainda está em processamento e não pode ser excluído agora.");
      return;
    }

    const confirmed = window.confirm(
      `Excluir o lote “${batch.arquivo_nome}”?\n\n` +
      "Os arquivos originais e o histórico desta importação serão apagados. " +
      "Os itens que já foram criados ou atualizados no Inventário NÃO serão excluídos."
    );
    if (!confirmed) return;

    try {
      button.disabled = true;
      button.textContent = "Excluindo...";

      const paths = Array.isArray(batch.arquivos)
        ? batch.arquivos.map(file => String(file?.path || "").trim()).filter(Boolean)
        : [];

      if (paths.length) {
        const { error: storageError } = await db().storage.from("inventario-privado").remove(paths);
        if (storageError) throw new Error(`Falha ao remover arquivos originais: ${storageError.message}`);
      }

      const { data, error } = await db().rpc("inv_excluir_importacao", { p_importacao_id: batch.id });
      if (error) throw error;
      if (data !== true) throw new Error("Lote não encontrado ou já excluído.");

      window.alert("Lote de upload excluído com sucesso.");
      $("v2RefreshHistory")?.click();
    } catch (error) {
      console.error("Falha ao excluir lote de upload:", error);
      window.alert(`Não foi possível excluir o lote: ${friendlyError(error)}`);
    } finally {
      if (button?.isConnected) {
        button.disabled = false;
        button.textContent = "Excluir lote";
      }
    }
  }

  function canManage() {
    return Boolean(state.profile?.ativo && ["administrador", "gestor"].includes(state.profile.papel));
  }

  function friendlyError(error) {
    const message = String(error?.message || error || "Erro inesperado.");
    if (/function .*inv_excluir_importacao|could not find the function|does not exist/i.test(message)) {
      return "execute a migration supabase/04_exclusoes_seguras.sql no Supabase e tente novamente.";
    }
    if (/row-level security/i.test(message)) return "seu perfil não possui permissão para esta operação.";
    return message;
  }
})();
