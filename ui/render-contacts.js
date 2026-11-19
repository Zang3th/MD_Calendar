
window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Contacts view: list with search and sort on the left, inline editor on the right (docs/ui/Views.md#contacts).
(function (app) {
  const board = /** @type {HTMLElement} */ (document.getElementById("contacts"));
  /** Labels of the data format, shown as they are; a click on a label cycles through them. */
  const labelCycles = { phones: ["Mobile", "Home", "Work", "Other"], emails: ["Home", "Work", "Other"], addresses: ["Home", "Work", "Other"] };
  const addNames = { phones: "Phone", emails: "Email", addresses: "Address" };
  /** @type {MDCContactsHandlers | null} */
  let handlers = null;
  /** @type {{contacts: MDCContacts, selected: number, today: string} | null} */
  let shown = null;
  let query = "";
  /** @type {"name" | "birthday"} */
  let sort = "name";
  /** Index of the contact with the next birthday in the birthday order, -1 when none. */
  let nextContact = -1;
  let built = false;

  const escape = (/** @type {string} */ value) => app.tiles.escape(value);
  const icon = (/** @type {string} */ name) => app.tiles.icon(name);

  /** Hue of the initials avatar, derived from the name. @param {string} name */
  function hue(name) {
    return [...(name || "?")].reduce((value, character) => (value * 31 + character.charCodeAt(0)) % 360, 7);
  }

  /** @param {MDCContact} contact */
  function initials(contact) {
    return ((contact.firstName[0] || "") + (contact.lastName[0] || "")).toUpperCase() || "?";
  }

  /** @param {MDCContact} contact */
  function shownName(contact) {
    return app.contacts.name(contact) || "No name";
  }

  /** @param {MDCContact} contact @param {"sm" | "lg"} size */
  function avatar(contact, size) {
    return `<span class="cx-av cx-av--${size}" style="--h:${hue(shownName(contact))}" aria-hidden="true">${escape(initials(contact))}</span>`;
  }


  /** @param {MDCContact} contact @param {number} index @param {string} today */
  function row(contact, index, today) {
    // Sorted by birthday the second line is the birthday, sorted by name the first phone number.
    const next = sort === "birthday" ? app.contacts.nextBirthday(contact, today) : null;
    const birthday = contact.birthday.startsWith("--") ? app.calendar.formatDay(`2000${contact.birthday.slice(1)}`, "D MMMM") : contact.birthday && app.calendar.formatDay(contact.birthday, "D MMMM YYYY");
    const sub = next
      ? `<span class="cx-row__soon">${birthday}${next.age !== null ? ` · turns ${next.age}` : ""}</span>`
      : escape(contact.phones[0]?.value || "");
    return `<button class="cx-row${shown && index === shown.selected ? " is-sel" : ""}" type="button" data-contact="${index}">` +
      `${avatar(contact, "sm")}<span class="cx-row__main"><b>${escape(shownName(contact))}</b><small>${sub}</small></span></button>`;
  }

  /** The next three birthdays and anniversaries above the list, in every sort (docs/ui/Views.md#list). @param {MDCContacts} contacts @param {string} today */
  function nextUp(contacts, today) {
    const items = app.contacts.upcoming(contacts, today, 3);
    if (!items.length) return "";
    return `<div class="cx-sec-h">Next up</div>` + items.map(item => {
      const label = item.kind === "anniversary" ? item.label || "Anniversary" : "";
      const detail = [item.days === 0 ? "today" : "", label, item.years === null ? "" : String(item.years)].filter(Boolean).join(" · ");
      return `<button class="cx-next__tile${item.kind === "anniversary" ? " cx-next__tile--anniversary" : ""}${item.days === 0 ? " is-today" : ""}" type="button" data-contact="${item.index}">` +
        `<b class="cx-next__day">${app.calendar.formatDay(item.date, "dd D")}</b><span class="cx-next__name">${escape(shownName(contacts.contacts[item.index]))}</span>` +
        `<small class="cx-next__detail">${escape(detail)}</small></button>`;
    }).join("");
  }

  /** @param {MDCContacts} contacts @param {string} today */
  function rows(contacts, today) {
    nextContact = -1;
    const list = contacts.contacts.map((contact, index) => ({ contact, index }))
      .filter(item => app.contacts.matches(item.contact, query));
    if (!list.length) return `<div class="cx-empty">${contacts.contacts.length ? `No results${query ? ` for “${escape(query)}”` : ""}` : "No contacts yet."}</div>`;
    const section = (/** @type {string} */ title, /** @type {typeof list} */ items) =>
      items.length ? `<div class="cx-sec-h">${escape(title)}</div>${items.map(item => row(item.contact, item.index, today)).join("")}` : "";
    if (sort === "birthday") {
      // Chronological from January; the contact whose birthday comes next is the scroll target.
      const withBirthday = list.filter(item => item.contact.birthday)
        .sort((left, right) => left.contact.birthday.slice(-5).localeCompare(right.contact.birthday.slice(-5)) ||
          app.contacts.sortName(left.contact).localeCompare(app.contacts.sortName(right.contact), "en"));
      let soonest = Infinity;
      for (const item of withBirthday) {
        const days = app.contacts.nextBirthday(item.contact, today)?.days ?? Infinity;
        if (days < soonest) [soonest, nextContact] = [days, item.index];
      }
      /** @type {Map<string, typeof list>} */
      const months = new Map();
      for (const item of withBirthday) {
        const month = item.contact.birthday.slice(-5, -3);
        months.set(month, [...(months.get(month) || []), item]);
      }
      return Array.from(months, ([month, items]) => section(app.calendar.formatDay(`2000-${month}-01`, "MMMM"), items)).join("") +
        section("No birthday", list.filter(item => !item.contact.birthday));
    }
    const byName = [...list].sort((left, right) => app.contacts.sortName(left.contact).localeCompare(app.contacts.sortName(right.contact), "en"));
    /** @type {Map<string, typeof list>} */
    const letters = new Map();
    for (const item of byName) {
      const letter = (app.contacts.sortName(item.contact)[0] || "#").toUpperCase();
      letters.set(letter, [...(letters.get(letter) || []), item]);
    }
    return Array.from(letters, ([letter, items]) => section(letter, items)).join("");
  }

  /** @param {keyof typeof labelCycles} kind @param {MDCContact} contact */
  function labelledRows(kind, contact) {
    const items = contact[kind];
    const link = (/** @type {string} */ value) => kind === "phones" ? `tel:${value.replace(/[^\d+]/g, "")}` : `mailto:${value}`;
    return items.map((item, index) =>
      `<div class="cx-field"><button class="cx-label" type="button" data-cycle="${kind}:${index}" aria-label="Label: ${escape(item.label || "None")}">${escape(item.label || "–")}</button>` +
      `<input class="cx-in" data-key="${kind}:${index}" value="${escape(item.value)}" placeholder="${addNames[kind]}" autocomplete="off" aria-label="${addNames[kind]}">` +
      (kind === "addresses"
        ? `<button class="cx-go" type="button" data-copy="${index}" aria-label="Copy address"${item.value ? "" : " disabled"}>${icon("copy")}</button>`
        : item.value ? `<a class="cx-go" href="${escape(link(item.value))}" aria-label="${kind === "phones" ? "Call" : "Send email"}">${icon(kind === "phones" ? "phone" : "mail")}</a>` : `<span class="cx-go"></span>`) +
      `<button class="cx-x" type="button" data-remove="${kind}:${index}" aria-label="Remove ${addNames[kind].toLowerCase()}">${icon("close")}</button></div>`).join("") +
      `<button class="cx-add" type="button" data-add="${kind}">${icon("plus")}Add ${addNames[kind].toLowerCase()}</button>`;
  }

  /** @param {MDCContacts} contacts @param {number} selected @param {string} today */
  function detail(contacts, selected, today) {
    const contact = contacts.contacts[selected];
    if (!contact) return `<section class="cx-detail cx-detail--empty"><p>${contacts.contacts.length ? "No contact selected." : "Create the first contact with + or import a vCard."}</p></section>`;
    const next = app.contacts.nextBirthday(contact, today);
    const field = (/** @type {string} */ key, /** @type {string} */ value, /** @type {string} */ placeholder, /** @type {string} */ classes) =>
      `<input class="cx-in ${classes}" data-key="${key}" value="${escape(value)}" placeholder="${placeholder}" aria-label="${placeholder}" autocomplete="off">`;
    return `<section class="cx-detail" aria-label="${escape(shownName(contact))}">` +
      `<header class="cx-hero">${avatar(contact, "lg")}<div class="cx-hero__text">` +
      `${field("name", app.contacts.name(contact), "Name", "cx-in--name")}` +
      `<div class="cx-actions">` +
      `<button class="cx-act" type="button" data-action="export">${icon("download")}vCard</button>` +
      `<button class="cx-act cx-act--danger" type="button" data-action="delete">${icon("trash")}Delete</button></div></div></header>` +
      `<div class="cx-grid">` +
      `<section class="cx-sec"><h3>${icon("phone")}Phone</h3>${labelledRows("phones", contact)}</section>` +
      `<section class="cx-sec"><h3>${icon("mail")}Email</h3>${labelledRows("emails", contact)}</section>` +
      `<section class="cx-sec"><h3>${icon("pin")}Addresses</h3>${labelledRows("addresses", contact)}</section>` +
      `<section class="cx-sec"><h3>${icon("gift")}Dates</h3><div class="cx-field"><span class="cx-label cx-label--fixed">Birthday</span>` +
      `<span class="cx-date">${field("birthday", contact.birthday ? app.contactsFormat.formatBirthday(contact.birthday) : "", "DD.MM.YYYY or DD.MM.", "")}` +
      `${next && next.age !== null ? `<span class="cx-turns">turns ${next.age}</span>` : ""}</span><span></span>` +
      `<button class="cx-x" type="button" data-remove="birthday" aria-label="Remove birthday"${contact.birthday ? "" : " disabled"}>${icon("close")}</button></div>` +
      contact.anniversaries.map((item, index) => `<div class="cx-field">` +
        `<input class="cx-label cx-label--input" data-key="anniversaryLabel:${index}" value="${escape(item.label)}" placeholder="Anniversary" aria-label="Anniversary label" autocomplete="off">` +
        `${field(`anniversaryDate:${index}`, app.calendar.formatDate(item.date), "DD.MM.YYYY", "")}<span></span>` +
        `<button class="cx-x" type="button" data-remove="anniversaries:${index}" aria-label="Remove anniversary">${icon("close")}</button></div>`).join("") +
      `<button class="cx-add" type="button" data-add="anniversaries">${icon("plus")}Add anniversary</button></section>` +
      `<section class="cx-sec cx-sec--wide"><h3>${icon("note")}Note</h3><textarea class="cx-in cx-in--note" data-key="note" placeholder="Notes …" aria-label="Note">${escape(contact.note.join("\n"))}</textarea></section>` +
      `</div></section>`;
  }

  function build() {
    board.innerHTML = `<aside class="cx-list" aria-label="Contact list">` +
      `<label class="cx-search">${icon("search")}<input id="contactsQuery" placeholder="Name, email, phone …" aria-label="Search contacts" autocomplete="off"></label>` +
      `<div class="cx-next" id="contactsNext" role="group" aria-label="Next up" hidden></div>` +
      `<div class="cx-bar"><div class="cx-sort" role="group" aria-label="Sort"><button type="button" data-sort="name" aria-pressed="true">A–Z</button>` +
      `<button type="button" data-sort="birthday" aria-pressed="false">${icon("gift")}Birthday</button></div>` +
      `<span class="cx-tools"><label class="cx-import">${icon("upload")}Import<input type="file" id="contactsImport" accept=".vcf,text/vcard" hidden></label>` +
      `<button class="cx-import" type="button" data-action="exportAll">${icon("download")}Export</button></span></div>` +
      `<div class="cx-scroll" id="contactsRows"></div><div class="cx-count" id="contactsCount"></div></aside><div class="cx-slot" id="contactsDetail"></div>`;
    built = true;
  }

  /** Re-renders the list and the detail and puts the focus back where it was. @param {MDCContacts} contacts @param {number} selected @param {string} today */
  function render(contacts, selected, today) {
    if (!built) build();
    const active = document.activeElement instanceof HTMLElement && board.contains(document.activeElement) ? document.activeElement : null;
    // Fields are found again by their key, buttons such as “vCard” by their action, so that Tab keeps working.
    const anchor = active?.dataset.key ? `[data-key="${CSS.escape(active.dataset.key)}"]` : active?.dataset.action ? `[data-action="${CSS.escape(active.dataset.action)}"]` : "";
    const selection = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? [active.selectionStart, active.selectionEnd] : null;
    const scroll = /** @type {HTMLElement | null} */ (board.querySelector(".cx-detail"))?.scrollTop || 0;
    const sameContact = shown?.selected === selected && shown.contacts === contacts;
    shown = { contacts, selected, today };
    for (const button of board.querySelectorAll("[data-sort]")) button.setAttribute("aria-pressed", String(/** @type {HTMLElement} */ (button).dataset.sort === sort));
    const next = /** @type {HTMLElement} */ (board.querySelector("#contactsNext"));
    next.innerHTML = nextUp(contacts, today);
    next.hidden = Boolean(query) || !next.childElementCount;
    /** @type {HTMLElement} */ (board.querySelector("#contactsRows")).innerHTML = rows(contacts, today);
    /** @type {HTMLElement} */ (board.querySelector("#contactsCount")).textContent = `${contacts.contacts.length} contact${contacts.contacts.length === 1 ? "" : "s"} · Contacts.md`;
    /** @type {HTMLElement} */ (board.querySelector("#contactsDetail")).innerHTML = detail(contacts, selected, today);
    const detailElement = /** @type {HTMLElement | null} */ (board.querySelector(".cx-detail"));
    if (detailElement && sameContact) detailElement.scrollTop = scroll;
    if (anchor && sameContact) {
      const target = /** @type {HTMLInputElement | null} */ (board.querySelector(anchor));
      if (target) {
        target.focus({ preventScroll: true });
        if (selection) try { target.setSelectionRange(selection[0], selection[1]); } catch { /* Not a text field. */ }
      }
    } else if (active?.id === "contactsQuery") /** @type {HTMLElement} */ (board.querySelector("#contactsQuery")).focus();
    board.hidden = false;
  }

  /** Scrolls the birthday order to the next birthday, its month heading included when it opens the month. */
  function scrollToNext() {
    const container = /** @type {HTMLElement} */ (board.querySelector("#contactsRows"));
    const row = container.querySelector(`.cx-row[data-contact="${nextContact}"]`);
    if (!row) return;
    const target = row.previousElementSibling?.classList.contains("cx-sec-h") ? row.previousElementSibling : row;
    const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTop = top;
  }

  /** Focuses a field of the detail, for example the name of a new contact. @param {string} key */
  function focusField(key) {
    const target = /** @type {HTMLInputElement | null} */ (board.querySelector(`[data-key="${CSS.escape(key)}"]`));
    target?.focus();
  }

  function hide() {
    board.hidden = true;
  }

  /** The selected contact as a changeable copy. */
  function current() {
    if (!shown) return null;
    const contact = shown.contacts.contacts[shown.selected];
    return contact ? /** @type {MDCContact} */ (JSON.parse(JSON.stringify(contact))) : null;
  }

  /** @param {MDCContact} updated @param {string} [field] the edited field, for one undo step per field */
  function commit(updated, field) {
    if (shown && handlers) handlers.update(shown.selected, updated, field);
  }

  /** Applies a changed field; invalid dates are rejected and the field returns to its value. @param {string} key @param {string} value */
  function changeField(key, value) {
    const contact = current();
    if (!contact) return;
    const [name, position] = key.split(":");
    const index = Number(position);
    const trimmed = value.trim();
    if (name === "birthday") {
      const birthday = trimmed ? app.contactsFormat.parseBirthday(trimmed) : "";
      if (trimmed && !birthday) {
        handlers?.reject("Invalid birthday", app.notifications.text`Use ${"DD.MM.YYYY"} or ${"DD.MM."}`);
        return;
      }
      contact.birthday = birthday;
    } else if (name === "anniversaryDate") {
      const date = app.calendar.parseDate(trimmed);
      if (!date) {
        handlers?.reject("Invalid date", app.notifications.text`Use ${"DD.MM.YYYY"}.`);
        return;
      }
      contact.anniversaries[index].date = date;
    } else if (name === "anniversaryLabel") contact.anniversaries[index].label = trimmed;
    else if (name === "note") contact.note = value.split(/\r?\n/).map(line => line.trimEnd());
    else if (name === "phones" || name === "emails" || name === "addresses") contact[name][index].value = trimmed;
    else if (name === "name") {
      // One field for the name: first word first name, rest last name (docs/ui/Views.md#detail).
      const words = trimmed.split(/\s+/).filter(Boolean);
      if (words.join(" ") === app.contacts.name(contact)) return;
      contact.firstName = words[0] || "";
      contact.lastName = words.slice(1).join(" ");
    }
    else return;
    while (contact.note.length && !contact.note[contact.note.length - 1]) contact.note.pop();
    commit(contact, key);
  }

  board.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    const element = /** @type {HTMLElement | null} */ (target?.closest("button, a"));
    if (!element || !shown || !handlers) return;
    const data = element.dataset;
    if (data.contact !== undefined) handlers.select(Number(data.contact));
    else if (data.sort) {
      sort = data.sort === "birthday" ? "birthday" : "name";
      render(shown.contacts, shown.selected, shown.today);
      if (sort === "birthday") scrollToNext();
      else /** @type {HTMLElement} */ (board.querySelector("#contactsRows")).scrollTop = 0;
    } else if (data.action === "exportAll") handlers.exportAll();
    else if (data.action === "delete") handlers.remove(shown.selected);
    else if (data.action === "export") handlers.exportOne(shown.selected);
    else if (data.copy !== undefined) handlers.copy(shown.contacts.contacts[shown.selected]?.addresses[Number(data.copy)]?.value || "");
    else {
      const contact = current();
      if (!contact) return;
      if (data.cycle) {
        const [kind, index] = data.cycle.split(":");
        const cycle = labelCycles[/** @type {keyof typeof labelCycles} */ (kind)];
        const item = contact[/** @type {keyof typeof labelCycles} */ (kind)][Number(index)];
        item.label = cycle[(cycle.indexOf(item.label) + 1) % cycle.length];
        commit(contact, `label:${data.cycle}`);
        return;
      } else if (data.add) {
        const kind = /** @type {keyof typeof labelCycles | "anniversaries"} */ (data.add);
        if (kind === "anniversaries") contact.anniversaries.push({ label: "", date: shown.today });
        else contact[kind].push({ label: labelCycles[kind][0], value: "" });
        commit(contact);
        focusField(kind === "anniversaries" ? `anniversaryLabel:${contact.anniversaries.length - 1}` : `${kind}:${contact[kind].length - 1}`);
        return;
      } else if (data.remove) {
        const [kind, index] = data.remove.split(":");
        if (kind === "birthday") contact.birthday = "";
        else contact[/** @type {keyof typeof labelCycles | "anniversaries"} */ (kind)].splice(Number(index), 1);
      } else return;
      commit(contact);
    }
  });

  board.addEventListener("change", event => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.id === "contactsImport") {
      const file = target.files?.[0];
      target.value = "";
      if (file && handlers) void file.text().then(text => handlers?.importText(text, file.name));
      return;
    }
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) || !target.dataset.key) return;
    const key = target.dataset.key;
    const value = target.value;
    // Commit after the focus has moved on, so that the re-render restores the next field (docs/ui/Interaction.md#editing).
    window.setTimeout(() => changeField(key, value), 0);
  });

  board.addEventListener("input", event => {
    if (!(event.target instanceof HTMLInputElement) || event.target.id !== "contactsQuery" || !shown) return;
    query = event.target.value;
    const next = /** @type {HTMLElement} */ (board.querySelector("#contactsNext"));
    next.hidden = Boolean(query) || !next.childElementCount;
    /** @type {HTMLElement} */ (board.querySelector("#contactsRows")).innerHTML = rows(shown.contacts, shown.today);
  });

  board.addEventListener("keydown", event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || event.key !== "Enter") return;
    if (target.dataset.key) target.blur();
  });

  /** @param {MDCContactsHandlers} next */
  function init(next) {
    handlers = next;
  }

  /** Offers a text as a file to save. @param {string} name @param {string} text @param {string} type */
  function download(name, text, type) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type }));
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  app.contactsView = { init, render, hide, focusField, download, isShown: () => !board.hidden };
})(window.MDCalendar);
