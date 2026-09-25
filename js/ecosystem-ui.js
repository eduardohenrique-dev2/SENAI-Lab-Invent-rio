(() => {
  "use strict";

  const target = document.getElementById("inventoryMessageRotator");
  if (!target) return;

  const messages = [
    "Conectando pessoas, informação e tecnologia.",
    "Um ecossistema digital para a indústria.",
    "Informação centralizada em um só lugar.",
    "Mais tecnologia para transformar processos.",
    "Conectando pessoas, ideias e inovação.",
    "Um portal. Várias soluções. Um único ecossistema.",
    "Da formação à inovação.",
    "Tecnologia que aproxima pessoas e processos."
  ];

  let index = 0;
  target.textContent = messages[index];

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

  window.setInterval(() => {
    target.classList.add("is-changing");
    window.setTimeout(() => {
      index = (index + 1) % messages.length;
      target.textContent = messages[index];
      target.classList.remove("is-changing");
    }, 220);
  }, 4800);
})();
