const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const takeoffMs = 800;

function opensElsewhere(event) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a.balloon-float");
  if (!link || event.defaultPrevented || opensElsewhere(event) || reducedMotion.matches) return;
  event.preventDefault();
  link.closest(".balloon").classList.add("is-flying");
  document.body.classList.add("is-leaving");
  setTimeout(() => location.assign(link.href), takeoffMs);
});

addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  document.body.classList.remove("is-leaving");
  for (const balloon of document.querySelectorAll(".is-flying")) balloon.classList.remove("is-flying");
});
