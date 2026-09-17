(() => {
  "use strict";

  const STATUS_LABELS = {
    disponivel: "Disponível",
    em_uso: "Em uso",
    emprestado: "Emprestado",
    manutencao: "Manutenção",
    danificado: "Danificado",
    reservado: "Reservado",
    baixado: "Baixado",
    perdido: "Perdido"
  };

  const TYPE_LABELS = {
    equipamento: "Equipamento",
    material: "Material",
    componente: "Componente",
    consumivel: "Consumível"
  };

  const $ = id => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", loadPublicItem);

  async function loadPublicItem() {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
      showError("O QR Code não possui um identificador válido.");
      return;
    }

    try {
      const { data, error } = await obterInventarioSupabase().rpc("inv_item_publico", { p_token: token });
      if (error) throw error;
      const item = Array.isArray(data) ? data[0] : data;
      if (!item) return showError("Este item não foi encontrado ou não está mais ativo no inventário.");
      render(item);
    } catch (error) {
      console.error("Falha na consulta pública do item:", error);
      showError("Não foi possível consultar o item agora. Tente novamente em instantes.");
    }
  }

  function render(item) {
    $("itemLoading").hidden = true;
    $("itemError").hidden = true;
    $("itemCard").hidden = false;

    setText("itemType", TYPE_LABELS[item.tipo_item] || item.tipo_item || "Item");
    setText("itemName", item.nome || "Item SENAI Lab");
    setText("itemDescription", item.descricao || "Item identificado no SENAI Lab Inventário.");
    setText("itemPatrimonio", item.patrimonio || "—");
    setText("itemCode", item.codigo_interno || "—");
    setText("itemBrand", item.marca || "—");
    setText("itemModel", item.modelo || "—");
    setText("itemStatus", STATUS_LABELS[item.status] || item.status || "—");
    setText("itemLocation", item.localizacao || "Sem localização definida");

    if (item.foto_url) {
      $("itemPhoto").src = item.foto_url;
      $("itemPhotoWrap").hidden = false;
    }

    const base = `${window.location.origin}/?item=${encodeURIComponent(item.id)}`;
    $("itemLoanAction").href = `${base}&action=loan`;
    $("itemMovementAction").href = `${base}&action=movement`;
    $("itemMaintenanceAction").href = `${base}&action=maintenance`;
  }

  function showError(text) {
    $("itemLoading").hidden = true;
    $("itemCard").hidden = true;
    $("itemError").hidden = false;
    setText("itemErrorText", text);
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = String(value ?? "");
  }
})();
