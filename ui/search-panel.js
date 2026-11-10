window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Search panel below the search button: fuzzy results while typing, Enter or click jumps to the hit (docs/ui/Shell.md#search).
(function (app) {
  const button = /** @type {HTMLButtonElement} */ (document.getElementById("searchButton"));
  const panel = /** @type {HTMLElement} */ (document.getElementById("searchPanel"));
  const input = /** @type {HTMLInputElement} */ (document.getElementById("searchInput"));
  const list = /** @type {HTMLElement} */ (document.getElementById("searchResults"));
  const kinds = { entry: ["calendar", ""], series: ["repeat", "Serie"], multiDay: ["range", "Mehrtägig"], backlog: ["inbox", "Backlog"] };
  /** @type {((query: string) => MDCSearchItem[]) | null} */
  let source = null;
  /** @type {((item: MDCSearchItem) => void) | null} */
  let onPick = null;
  /** @type {MDCSearchItem[]} */
  let results = [];
  let active = 0;

  /** @param {MDCSearchItem} item */
  function when(item) {
    if (item.kind === "backlog") return "Backlog";
    const date = dayjs(item.key).format("dd, DD.MM.YYYY");
    if (item.kind === "multiDay" && item.end) return `${date} – ${dayjs(item.end).format("DD.MM.YYYY")}`;
    return item.kind === "series" ? `ab ${date}` : date;
  }

  function fill() {
    results = source ? source(input.value) : [];
    active = Math.min(active, Math.max(0, results.length - 1));
    list.innerHTML = results.length
      ? results.map((item, index) => `<li class="sp__hit" role="option" id="searchHit${index}" data-hit="${index}" aria-selected="${index === active}">` +
        `${item.tag && app.tiles.tagIcon(item.tag) ? `<span class="sp__tagwrap"${app.tiles.tint(item.tag).style}>${app.tiles.tagIcon(item.tag, "sp__tag")}</span>` : app.tiles.icon(kinds[item.kind][0])}<span class="sp__title">${app.tiles.escape(item.title)}</span>` +
        `<span class="sp__when">${kinds[item.kind][1] && item.kind !== "backlog" ? `${kinds[item.kind][1]} · ` : ""}${when(item)}</span></li>`).join("")
      : input.value.trim() ? `<li class="sp__empty">Keine Treffer</li>` : `<li class="sp__empty">Titel, Ort, Notiz oder Tag – Tippfehler sind erlaubt.</li>`;
    input.setAttribute("aria-activedescendant", results.length ? `searchHit${active}` : "");
  }

  /** @param {boolean} open */
  function setOpen(open) {
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (!open) return;
    const bounds = button.getBoundingClientRect();
    panel.style.top = `${Math.round(bounds.bottom + 10)}px`;
    panel.style.right = `${Math.round(Math.max(14, window.innerWidth - bounds.right - 120))}px`;
    input.select();
    input.focus();
    fill();
  }

  /** @param {number} index */
  function pick(index) {
    const item = results[index];
    if (!item || !onPick) return;
    setOpen(false);
    onPick(item);
  }

  input.addEventListener("input", () => {
    active = 0;
    fill();
  });
  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!results.length) return;
      active = (active + (event.key === "ArrowDown" ? 1 : results.length - 1)) % results.length;
      for (const hit of list.querySelectorAll("[data-hit]")) hit.setAttribute("aria-selected", String(Number(/** @type {HTMLElement} */ (hit).dataset.hit) === active));
      input.setAttribute("aria-activedescendant", `searchHit${active}`);
      list.querySelector(`[data-hit="${active}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") pick(active);
    else if (event.key === "Escape") {
      setOpen(false);
      button.focus();
    } else return;
    event.preventDefault();
  });
  list.addEventListener("click", event => {
    const hit = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-hit]")) : null;
    if (hit) pick(Number(hit.dataset.hit));
  });
  document.addEventListener("pointerdown", event => {
    if (panel.hidden || !(event.target instanceof Node) || panel.contains(event.target) || button.contains(event.target)) return;
    setOpen(false);
  });
  window.addEventListener("resize", () => setOpen(false));

  /** @param {(query: string) => MDCSearchItem[]} search @param {(item: MDCSearchItem) => void} jump */
  function init(search, jump) {
    source = search;
    onPick = jump;
  }

  app.searchPanel = { init, toggle: () => setOpen(panel.hidden), isOpen: () => !panel.hidden };
})(window.MDCalendar);
