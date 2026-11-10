window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// vCard conversion for import and export (docs/Domain.md#imports-and-exports). Reads vCard 2.1, 3.0 and 4.0; writes 3.0.
(function (app) {
  /** vCard TYPE values → labels of the data format. */
  const phoneTypes = [["CELL", "Mobile"], ["HOME", "Home"], ["WORK", "Work"]];
  const otherTypes = [["HOME", "Home"], ["WORK", "Work"]];
  const anniversaryLabel = /^_\$!<(.*)>!\$_$/;

  /** @param {string} value */
  function unescape(value) {
    return value.replace(/\\([nN,;:\\])/g, (_, character) => character === "n" || character === "N" ? "\n" : character);
  }

  /** @param {string} value */
  function escape(value) {
    return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  }

  /** Splits a structured value at unescaped semicolons. @param {string} value */
  function components(value) {
    return value.split(/(?<!\\);/).map(unescape);
  }

  /** @param {string} value */
  function decodeQuotedPrintable(value) {
    const bytes = value.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
    try { return decodeURIComponent(escapeBytes(bytes)); } catch { return bytes; }
  }

  /** @param {string} bytes */
  function escapeBytes(bytes) {
    return Array.from(bytes, character => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`).join("");
  }

  /** YYYYMMDD, YYYY-MM-DD, --MMDD or --MM-DD into a birthday (YYYY-MM-DD or --MM-DD); "" otherwise. @param {string} value */
  function vcardDate(value) {
    const full = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(value.trim());
    if (full) return app.calendar.parseDate(`${full[3]}.${full[2]}.${full[1]}`);
    const partial = /^--(\d{2})-?(\d{2})$/.exec(value.trim());
    return partial ? app.contactsFormat.parseBirthday(`${partial[2]}.${partial[1]}.`) : "";
  }

  /** @param {string[]} types @param {string[][]} table */
  function label(types, table) {
    return table.find(([type]) => types.includes(type))?.[1] || "Other";
  }

  /**
   * Parses all vCards of a file into contacts.
   * @param {string} text @returns {MDCContact[]}
   */
  function parse(text) {
    const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
    /** @type {MDCContact[]} */
    const result = [];
    /** @type {MDCContact | null} */
    let contact = null;
    /** Apple and Google write anniversaries as itemN.X-ABDATE with a separate itemN.X-ABLabel. */
    /** @type {Map<string, {date?: string, label?: string}>} */
    let items = new Map();
    let formatted = "";
    for (let index = 0; index < lines.length; index += 1) {
      let line = lines[index];
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const [nameWithGroup, ...parameters] = line.slice(0, colon).split(";");
      let value = line.slice(colon + 1);
      const dot = nameWithGroup.indexOf(".");
      const group = dot < 0 ? "" : nameWithGroup.slice(0, dot).toLowerCase();
      const property = nameWithGroup.slice(dot + 1).toUpperCase();
      if (parameters.some(parameter => /ENCODING=QUOTED-PRINTABLE/i.test(parameter))) {
        while (value.endsWith("=") && index + 1 < lines.length) {
          index += 1;
          value = `${value.slice(0, -1)}${lines[index]}`;
        }
        line = value;
        value = decodeQuotedPrintable(value);
      }
      const types = parameters.flatMap(parameter => parameter.replace(/^TYPE=/i, "").toUpperCase().split(","));
      if (property === "BEGIN" && value.toUpperCase() === "VCARD") {
        contact = app.contactsFormat.emptyContact();
        items = new Map();
        formatted = "";
        continue;
      }
      if (!contact) continue;
      if (property === "END") {
        for (const item of items.values()) {
          if (item.date) contact.anniversaries.push({ label: item.label || "Anniversary", date: item.date });
        }
        if (!contact.firstName && !contact.lastName && formatted) {
          const [first, ...rest] = formatted.split(/\s+/);
          contact.firstName = first;
          contact.lastName = rest.join(" ");
        }
        if (contact.firstName || contact.lastName || contact.phones.length || contact.emails.length) result.push(contact);
        contact = null;
        continue;
      }
      if (property === "N") {
        const [last = "", first = ""] = components(value);
        contact.firstName = first.trim();
        contact.lastName = last.trim();
      } else if (property === "FN") formatted = unescape(value).trim();
      else if (property === "NICKNAME") contact.nickname = unescape(value).split(",")[0].trim();
      else if (property === "ORG") contact.company = components(value)[0].trim();
      else if (property === "TITLE") contact.position = unescape(value).trim();
      else if (property === "BDAY") contact.birthday = vcardDate(value);
      else if (property === "ANNIVERSARY") {
        const date = vcardDate(value);
        if (date && !date.startsWith("--")) contact.anniversaries.push({ label: "Anniversary", date });
      } else if (property === "X-ABDATE") {
        const date = vcardDate(value);
        if (date && !date.startsWith("--")) items.set(group, { ...items.get(group), date });
      } else if (property === "X-ABLABEL") {
        const text = unescape(value).trim();
        items.set(group, { ...items.get(group), label: anniversaryLabel.exec(text)?.[1] || text });
      } else if (property === "TEL" && value.trim()) contact.phones.push({ label: label(types, phoneTypes), value: unescape(value).replace(/^tel:/i, "").trim() });
      else if (property === "EMAIL" && value.trim()) contact.emails.push({ label: label(types, otherTypes), value: unescape(value).trim() });
      else if (property === "ADR") {
        const [, extended = "", street = "", city = "", region = "", code = "", country = ""] = components(value).map(part => part.replace(/\n/g, ", ").trim());
        const address = [[extended, street].filter(Boolean).join(" "), [code, city].filter(Boolean).join(" "), region, country].filter(Boolean).join(", ");
        if (address) contact.addresses.push({ label: label(types, otherTypes), value: address });
      } else if (property === "NOTE" && value.trim()) contact.note = unescape(value).split("\n");
    }
    return result;
  }

  /** Folds a content line at 75 characters (RFC 6350). @param {string} line */
  function fold(line) {
    const parts = [];
    for (let rest = line; rest.length; rest = rest.slice(parts.length === 1 ? 75 : 74)) parts.push(rest.slice(0, parts.length ? 74 : 75));
    return parts.join("\r\n ");
  }

  /** @param {string} labelName @param {string[][]} table */
  function type(labelName, table) {
    return table.find(([, name]) => name === labelName)?.[0];
  }

  /** @param {MDCContact} contact */
  function card(contact) {
    const name = app.contactsFormat.displayName(contact);
    const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${escape(contact.lastName)};${escape(contact.firstName)};;;`, `FN:${escape(name || contact.nickname)}`];
    if (contact.nickname) lines.push(`NICKNAME:${escape(contact.nickname)}`);
    if (contact.company) lines.push(`ORG:${escape(contact.company)}`);
    if (contact.position) lines.push(`TITLE:${escape(contact.position)}`);
    if (contact.birthday) lines.push(`BDAY:${contact.birthday.startsWith("--") ? `--${contact.birthday.slice(2, 4)}${contact.birthday.slice(5, 7)}` : contact.birthday}`);
    for (const item of contact.phones) {
      const tel = type(item.label, phoneTypes);
      lines.push(`TEL${tel ? `;TYPE=${tel}` : ""}:${escape(item.value)}`);
    }
    for (const item of contact.emails) {
      const kind = type(item.label, otherTypes);
      lines.push(`EMAIL;TYPE=INTERNET${kind ? `,${kind}` : ""}:${escape(item.value)}`);
    }
    for (const item of contact.addresses) {
      const kind = type(item.label, otherTypes);
      lines.push(`ADR${kind ? `;TYPE=${kind}` : ""}:;;${escape(item.value)};;;;`);
    }
    contact.anniversaries.forEach((item, index) => {
      lines.push(`item${index + 1}.X-ABDATE:${item.date}`, `item${index + 1}.X-ABLabel:${escape(item.label)}`);
    });
    if (contact.note.length) lines.push(`NOTE:${escape(contact.note.join("\n"))}`);
    lines.push("END:VCARD");
    return lines.map(fold).join("\r\n") + "\r\n";
  }

  /** @param {MDCContact[]} contacts */
  function serialize(contacts) {
    return contacts.map(card).join("");
  }

  app.vcard = { parse, serialize };
})(window.MDCalendar);
