const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const takeoffMs = 800;

function opensElsewhere(event) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function makeInertAllBut(kept) {
  for (let element = kept; element !== document.body; element = element.parentElement) {
    for (const sibling of element.parentElement.children) {
      if (sibling !== element && sibling instanceof HTMLElement) sibling.inert = true;
    }
  }
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a.balloon-float");
  if (!link || event.defaultPrevented || opensElsewhere(event) || reducedMotion.matches) return;
  event.preventDefault();
  const balloon = link.closest(".balloon");
  balloon.classList.add("is-flying");
  makeInertAllBut(balloon);
  document.body.classList.add("is-leaving");
  setTimeout(() => location.assign(link.href), takeoffMs);
});

addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  document.body.classList.remove("is-leaving");
  for (const balloon of document.querySelectorAll(".is-flying")) balloon.classList.remove("is-flying");
  for (const element of document.querySelectorAll("[inert]")) element.inert = false;
});
