(() => {
  "use strict";

  const ROLE_LABELS = Object.freeze({
    administrador: "Administrador",
    gestor: "Gestor",
    instrutor: "Instrutor",
    aluno: "Aluno",
    auditor: "Auditor"
  });

  const ITEM_STATUS_LABELS = Object.freeze({
    disponivel: "Disponível",
    em_uso: "Em uso",
    emprestado: "Emprestado",
    manutencao: "Manutenção",
    danificado: "Danificado",
    reservado: "Reservado",
    baixado: "Baixado",
    perdido: "Perdido"
  });

  const ITEM_TYPE_LABELS = Object.freeze({
    equipamento: "Equipamento",
    material: "Material",
    componente: "Componente",
    consumivel: "Consumível"
  });

  const LOAN_STATUS_LABELS = Object.freeze({
    solicitado: "Solicitado",
    aberto: "Em aberto",
    devolvido: "Devolvido",
    atrasado: "Atrasado",
    perdido: "Perdido",
    cancelado: "Cancelado"
  });

  const MOVEMENT_LABELS = Object.freeze({
    entrada: "Entrada",
    saida: "Saída",
    transferencia: "Transferência",
    emprestimo: "Empréstimo",
    devolucao: "Devolução",
    manutencao: "Manutenção",
    baixa: "Baixa",
    ajuste: "Ajuste"
  });

  const MAINTENANCE_STATUS_LABELS = Object.freeze({
    aberta: "Aberta",
    em_andamento: "Em andamento",
    aguardando_peca: "Aguardando peça",
    concluida: "Concluída",
    cancelada: "Cancelada"
  });

  const VIEW_META = Object.freeze({
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
  });

  window.InventoryDomain = Object.freeze({
    ROLE_LABELS,
    ITEM_STATUS_LABELS,
    ITEM_TYPE_LABELS,
    LOAN_STATUS_LABELS,
    MOVEMENT_LABELS,
    MAINTENANCE_STATUS_LABELS,
    VIEW_META
  });
})();