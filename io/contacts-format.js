import { markdown } from "@zang3th/md-libs/core";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Parser and serializer for Contacts.md (see docs/DataFormat.md#contacts).
(function (app) {
  const itemPattern = /^- (.*)$/;
  /** Block order of a contact; also the order in which blocks are written. */
  const keys = ["FirstName", "LastName", "Birthday", "Phone", "Email", "Address", "Anniversary", "Note"];
  const single = ["FirstName", "LastName", "Birthday"];
  /** Blocks of earlier versions; they are read and dropped (docs/DataFormat.md#contacts). */
  const dropped = ["Nickname", "Company", "Position", "Groups", "Favorite"];
  const labelled = { Phone: "phones", Email: "emails", Address: "addresses" };

  /** DD.MM.YYYY or DD.MM. into YYYY-MM-DD or --MM-DD; "" when invalid. @param {string} value */
  function parseBirthday(value) {
    const partial = /^(\d{2})\.(\d{2})\.$/.exec(value.trim());
    if (!partial) return app.calendar.parseDate(value);
    // 29 February is a valid birthday without a year.
    return app.calendar.parseDate(`${partial[1]}.${partial[2]}.2000`) ? `--${partial[2]}-${partial[1]}` : "";
  }

  /** @param {string} birthday */
  function formatBirthday(birthday) {
    return birthday.startsWith("--") ? `${birthday.slice(5, 7)}.${birthday.slice(2, 4)}.` : app.calendar.formatDate(birthday);
  }

  /** @param {string} value @returns {MDCLabelled} */
  function labelledValue(value) {
    const separator = value.indexOf(": ");
    return separator < 0 ? { label: "", value } : { label: value.slice(0, separator), value: value.slice(separator + 2) };
  }

  /** @returns {MDCContact} */
  function emptyContact() {
    return {
      firstName: "", lastName: "", birthday: "", phones: [], emails: [], addresses: [], anniversaries: [], note: [], extra: []
    };
  }

  /** Display name: first name plus last name (docs/Domain.md#contact). @param {MDCContact} contact */
  function displayName(contact) {
    return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  }

  /**
   * Parses one ### contact. Unknown blocks and lines are kept at its end.
   * @param {Array<{line: string, index: number}>} lines @param {MDCFormatWarning[]} warnings
   */
  function parseContact(lines, warnings) {
    const contact = emptyContact();
    /** @param {{text: string, index: number}} line */
    const keep = line => {
      contact.extra.push(line.text);
      warnings.push({ lineNumber: lines[line.index + 1].index + 1, kind: "unknown-line", text: line.text });
    };
    for (const line of markdown.keyBlocks(lines.slice(1).map(entry => entry.line), { keys: [...keys, ...dropped], prose: ["Note"] })) {
      if (line.type === "key" || (line.type === "item" && dropped.includes(line.key))) continue;
      if (line.type === "unknown") {
        keep(line);
        continue;
      }
      if (line.type === "prose") {
        contact.note.push(line.text);
        continue;
      }
      const { key: mode, value } = line;
      const kept = { text: lines[line.index + 1].line, index: line.index };
      if (contact.extra.length) {
        keep(kept);
        continue;
      }
      if (mode === "FirstName" && !contact.firstName) contact.firstName = value;
      else if (mode === "LastName" && !contact.lastName) contact.lastName = value;
      else if (mode === "Birthday" && !contact.birthday && parseBirthday(value)) contact.birthday = parseBirthday(value);
      else if (mode in labelled && value) contact[/** @type {"phones" | "emails" | "addresses"} */ (labelled[/** @type {keyof typeof labelled} */ (mode)])].push(labelledValue(value));
      else if (mode === "Anniversary") {
        const anniversary = labelledValue(value);
        const date = app.calendar.parseDate(anniversary.value);
        if (date) contact.anniversaries.push({ label: anniversary.label, date });
        else keep(kept);
      } else keep(kept);
    }
    while (contact.note.length && contact.note[contact.note.length - 1].trim() === "") contact.note.pop();
    // A contact written by hand with only a heading takes its name from the heading.
    if (!contact.firstName && !contact.lastName) {
      const [first, ...rest] = lines[0].line.slice(4).trim().split(/\s+/);
      contact.firstName = first || "";
      contact.lastName = rest.join(" ");
    }
    return contact;
  }

  /**
   * @param {string} source
   * @returns {{contacts: MDCContacts, warnings: MDCFormatWarning[]}}
   */
  function parse(source) {
    const { lines, newline } = markdown.split(source);
    /** @type {MDCContacts} */
    const contacts = { newline, head: [], contacts: [], revision: 0 };
    /** @type {MDCFormatWarning[]} */
    const warnings = [];
    let hasHeader = false;
    /** @type {"groups" | "contacts" | null} `## Groups` of earlier versions is dropped. */
    let section = null;
    /** @type {Array<{line: string, index: number}> | null} */
    let contact = null;
    const flush = () => {
      if (contact) contacts.contacts.push(parseContact(contact, warnings));
      contact = null;
    };
    lines.forEach((line, index) => {
      if (line === "# Contacts" && !hasHeader && !section) {
        hasHeader = true;
        return;
      }
      if (line.startsWith("## ")) {
        flush();
        const name = line.trim();
        section = name === "## Groups" ? "groups" : name === "## Contacts" ? "contacts" : null;
        if (!section) {
          contacts.head.push(line);
          warnings.push({ lineNumber: index + 1, kind: "unknown-heading", text: line });
        }
        return;
      }
      if (section === "contacts" && line.startsWith("### ")) {
        flush();
        contact = [{ line, index }];
        return;
      }
      if (contact) {
        contact.push({ line, index });
        return;
      }
      if (line.trim() === "") return;
      if (section === "groups" && itemPattern.test(line)) return;
      contacts.head.push(line);
      warnings.push({ lineNumber: index + 1, kind: "unknown-line", text: line });
    });
    flush();
    if (!hasHeader) warnings.unshift({ lineNumber: 1, kind: "missing-header", text: lines[0] || "" });
    warnings.sort((left, right) => left.lineNumber - right.lineNumber);
    return { contacts, warnings };
  }

  /** @param {MDCContact} contact */
  function contactLines(contact) {
    /** @type {Record<string, string[]>} */
    const values = {
      FirstName: [contact.firstName], LastName: [contact.lastName],
      Birthday: [contact.birthday && formatBirthday(contact.birthday)],
      Phone: contact.phones.map(item => item.label ? `${item.label}: ${item.value}` : item.value),
      Email: contact.emails.map(item => item.label ? `${item.label}: ${item.value}` : item.value),
      Address: contact.addresses.map(item => item.label ? `${item.label}: ${item.value}` : item.value),
      Anniversary: contact.anniversaries.map(item => `${item.label}: ${app.calendar.formatDate(item.date)}`)
    };
    const lines = [`### ${displayName(contact) || "Unnamed"}`];
    for (const key of keys) {
      if (key === "Note") {
        if (contact.note.length) lines.push("#Note", ...contact.note);
        continue;
      }
      const written = values[key].filter(value => single.includes(key) ? value : value.trim());
      if (written.length) lines.push(`#${key}`, ...written.map(value => `- ${value}`));
    }
    return lines.concat(contact.extra);
  }

  /** @param {MDCContacts} contacts */
  function serialize(contacts) {
    const lines = ["# Contacts", ...contacts.head, "", "## Contacts"];
    for (const contact of contacts.contacts) lines.push("", ...contactLines(contact));
    return lines.join(contacts.newline) + contacts.newline;
  }

  app.contactsFormat = { parse, serialize, parseBirthday, formatBirthday, emptyContact, displayName };
})(window.MDCalendar);
