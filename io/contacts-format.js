window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Parser and serializer for Contacts.md (see docs/DataFormat.md#contacts).
(function (app) {
  const byteOrderMark = String.fromCharCode(0xFEFF);
  const keyPattern = /^#([A-Za-z]+)$/;
  const itemPattern = /^- (.*)$/;
  /** Block order of a contact; also the order in which blocks are written. */
  const keys = ["FirstName", "LastName", "Nickname", "Birthday", "Phone", "Email", "Address", "Company", "Position", "Groups", "Anniversary", "Favorite", "Note"];
  const single = ["FirstName", "LastName", "Nickname", "Birthday", "Company", "Position", "Favorite"];
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
      firstName: "", lastName: "", nickname: "", birthday: "", phones: [], emails: [], addresses: [],
      company: "", position: "", groups: [], anniversaries: [], favorite: false, note: [], extra: []
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
    /** @type {string | null} */
    let mode = null;
    const seen = new Set();
    /** @param {{line: string, index: number}} entry */
    const keep = entry => {
      contact.extra.push(entry.line);
      warnings.push({ lineNumber: entry.index + 1, kind: "unknown-line", text: entry.line });
    };
    for (const entry of lines.slice(1)) {
      const { line } = entry;
      const key = keyPattern.exec(line);
      if (key) {
        mode = keys.includes(key[1]) && !seen.has(key[1]) ? key[1] : null;
        if (mode) seen.add(mode);
        else keep(entry);
        continue;
      }
      if (mode === "Note") {
        contact.note.push(line);
        continue;
      }
      if (line.trim() === "") continue;
      const item = itemPattern.exec(line);
      const value = item ? item[1].trim() : "";
      if (!item || !mode || contact.extra.length) {
        keep(entry);
        continue;
      }
      if (mode === "FirstName" && !contact.firstName) contact.firstName = value;
      else if (mode === "LastName" && !contact.lastName) contact.lastName = value;
      else if (mode === "Nickname" && !contact.nickname) contact.nickname = value;
      else if (mode === "Company" && !contact.company) contact.company = value;
      else if (mode === "Position" && !contact.position) contact.position = value;
      else if (mode === "Birthday" && !contact.birthday && parseBirthday(value)) contact.birthday = parseBirthday(value);
      else if (mode === "Favorite" && !contact.favorite && value === "yes") contact.favorite = true;
      else if (mode === "Groups" && value) contact.groups.push(value);
      else if (mode in labelled && value) contact[/** @type {"phones" | "emails" | "addresses"} */ (labelled[/** @type {keyof typeof labelled} */ (mode)])].push(labelledValue(value));
      else if (mode === "Anniversary") {
        const anniversary = labelledValue(value);
        const date = app.calendar.parseDate(anniversary.value);
        if (date) contact.anniversaries.push({ label: anniversary.label, date });
        else keep(entry);
      } else keep(entry);
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
   * @param {string} text
   * @returns {{contacts: MDCContacts, warnings: MDCFormatWarning[]}}
   */
  function parse(text) {
    const source = text.startsWith(byteOrderMark) ? text.slice(1) : text;
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    const lines = source.split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();
    /** @type {MDCContacts} */
    const contacts = { newline, head: [], groups: [], contacts: [], revision: 0 };
    /** @type {MDCFormatWarning[]} */
    const warnings = [];
    let hasHeader = false;
    /** @type {"groups" | "contacts" | null} */
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
      const group = section === "groups" ? itemPattern.exec(line) : null;
      if (group && group[1].trim() && !contacts.groups.includes(group[1].trim())) {
        contacts.groups.push(group[1].trim());
        return;
      }
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
      FirstName: [contact.firstName], LastName: [contact.lastName], Nickname: [contact.nickname],
      Birthday: [contact.birthday && formatBirthday(contact.birthday)],
      Phone: contact.phones.map(item => item.label ? `${item.label}: ${item.value}` : item.value),
      Email: contact.emails.map(item => item.label ? `${item.label}: ${item.value}` : item.value),
      Address: contact.addresses.map(item => item.label ? `${item.label}: ${item.value}` : item.value),
      Company: [contact.company], Position: [contact.position], Groups: contact.groups,
      Anniversary: contact.anniversaries.map(item => `${item.label}: ${app.calendar.formatDate(item.date)}`),
      Favorite: [contact.favorite ? "yes" : ""]
    };
    const lines = [`### ${displayName(contact) || contact.nickname || "Unnamed"}`];
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
    const lines = ["# Contacts", ...contacts.head, "", "## Groups", ...contacts.groups.map(group => `- ${group}`), "", "## Contacts"];
    for (const contact of contacts.contacts) lines.push("", ...contactLines(contact));
    return lines.join(contacts.newline) + contacts.newline;
  }

  app.contactsFormat = { parse, serialize, parseBirthday, formatBirthday, emptyContact, displayName };
})(window.MDCalendar);
