window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Contacts: editing actions, derived birthdays and anniversaries, list search and order (docs/Domain.md#contact).
(function (app) {
  /** Occasions per MM-DD, rebuilt when the contacts change. @type {{source: MDCContacts | null, revision: number, byDay: Map<string, MDCOccasion[]>}} */
  const cache = { source: null, revision: -1, byDay: new Map() };

  /** @param {string} year */
  function isLeap(year) {
    const value = Number(year);
    return value % 4 === 0 && (value % 100 !== 0 || value % 400 === 0);
  }

  /** @param {MDCContact} contact */
  function name(contact) {
    return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  }

  /** @param {MDCContacts} contacts */
  function occasionsByDay(contacts) {
    if (cache.source === contacts && cache.revision === contacts.revision) return cache.byDay;
    /** @type {Map<string, MDCOccasion[]>} */
    const byDay = new Map();
    /** @param {string} monthDay @param {MDCOccasion} occasion */
    const add = (monthDay, occasion) => byDay.set(monthDay, [...(byDay.get(monthDay) || []), occasion]);
    contacts.contacts.forEach((contact, index) => {
      if (contact.birthday) add(contact.birthday.slice(-5), { index, name: name(contact), label: "", year: contact.birthday.startsWith("--") ? "" : contact.birthday.slice(0, 4) });
      for (const anniversary of contact.anniversaries) add(anniversary.date.slice(5), { index, name: name(contact), label: anniversary.label, year: anniversary.date.slice(0, 4) });
    });
    Object.assign(cache, { source: contacts, revision: contacts.revision, byDay });
    return byDay;
  }

  /**
   * Birthdays and anniversaries of a day with the age or the number of years.
   * 29 February shows on 28 February in non-leap years.
   * @param {MDCContacts} contacts @param {string} key @returns {Array<MDCOccasion & {age: number | null}>}
   */
  function occasionsOn(contacts, key) {
    const byDay = occasionsByDay(contacts);
    const monthDay = key.slice(5);
    const year = key.slice(0, 4);
    const list = [...(byDay.get(monthDay) || []), ...(monthDay === "02-28" && !isLeap(year) ? byDay.get("02-29") || [] : [])];
    return list.filter(occasion => !occasion.year || occasion.year <= year)
      .map(occasion => ({ ...occasion, age: occasion.year ? Number(year) - Number(occasion.year) : null }))
      .sort((left, right) => Number(Boolean(left.label)) - Number(Boolean(right.label)) || left.name.localeCompare(right.name, "de"));
  }

  /** Days until the next birthday from `today`, its date and the age then. @param {MDCContact} contact @param {string} today */
  function nextBirthday(contact, today) {
    if (!contact.birthday) return null;
    const monthDay = contact.birthday.slice(-5);
    /** @param {number} year */
    const dateIn = year => `${year}-${monthDay === "02-29" && !isLeap(String(year)) ? "02-28" : monthDay}`;
    let year = Number(today.slice(0, 4));
    if (dateIn(year) < today) year += 1;
    const date = dateIn(year);
    const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
    return { days, date, age: contact.birthday.startsWith("--") ? null : year - Number(contact.birthday.slice(0, 4)) };
  }

  /** Whether a contact matches the search text (name, nickname, company, email, phone). @param {MDCContact} contact @param {string} query */
  function matches(contact, query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const text = [name(contact), contact.nickname, contact.company, contact.position, ...contact.emails.map(item => item.value), ...contact.phones.map(item => item.value)].join(" ").toLowerCase();
    const digits = text.replace(/[^\d+]/g, "");
    return words.every(word => text.includes(word) || (/^[\d+\s]+$/.test(word) && digits.includes(word.replace(/\s/g, ""))));
  }

  /** Sort key by name: last name, then first name. @param {MDCContact} contact */
  function sortName(contact) {
    return `${contact.lastName || contact.firstName} ${contact.firstName}`.trim();
  }

  // ---------- Actions ----------

  /** @param {MDCContact} contact */
  function sizeOf(contact) {
    return 2 * JSON.stringify(contact).length + 64;
  }

  /**
   * Replaces, inserts or removes one contact; `select` is the contact to show afterwards.
   * @param {MDCContacts} contacts @param {string} label
   * @param {{index: number, contact: MDCContact} | null} from @param {{index: number, contact: MDCContact} | null} to
   * @param {string[]} [groupsAfter] the group list after the action
   * @returns {MDCContactAction}
   */
  function action(contacts, label, from, to, groupsAfter) {
    const groupsBefore = [...contacts.groups];
    /** @param {{index: number, contact: MDCContact} | null} removed @param {{index: number, contact: MDCContact} | null} inserted @param {string[]} groups */
    function apply(removed, inserted, groups) {
      if (removed) contacts.contacts.splice(removed.index, 1);
      if (inserted) contacts.contacts.splice(inserted.index, 0, inserted.contact);
      contacts.groups = [...groups];
      contacts.revision += 1;
    }
    const after = groupsAfter || groupsBefore;
    return {
      label, days: [], contacts: true,
      size: (from ? sizeOf(from.contact) : 0) + (to ? sizeOf(to.contact) : 0),
      selectAfter: to ? to.index : Math.min(from?.index ?? 0, contacts.contacts.length - 2),
      selectBefore: from ? from.index : -1,
      redo() { apply(from, to, after); },
      undo() { apply(to, from, groupsBefore); }
    };
  }

  /** @param {MDCContacts} contacts @param {number} index */
  function contactAt(contacts, index) {
    const contact = contacts.contacts[index];
    if (!contact) throw new Error(`No contact #${index}.`);
    return contact;
  }

  /** @param {MDCContacts} contacts @param {MDCContact} contact */
  function create(contacts, contact) {
    return action(contacts, "Neuer Kontakt", null, { index: contacts.contacts.length, contact });
  }

  /**
   * Replaces a contact with a changed copy. Returns null when nothing changed.
   * @param {MDCContacts} contacts @param {number} index @param {MDCContact} updated @param {string[]} [groupsAfter]
   * @returns {MDCContactAction | null}
   */
  function update(contacts, index, updated, groupsAfter) {
    const current = contactAt(contacts, index);
    if (JSON.stringify(current) === JSON.stringify(updated) && (!groupsAfter || JSON.stringify(groupsAfter) === JSON.stringify(contacts.groups))) return null;
    return action(contacts, name(updated) || "Kontakt", { index, contact: current }, { index, contact: updated }, groupsAfter);
  }

  /** @param {MDCContacts} contacts @param {number} index */
  function remove(contacts, index) {
    const current = contactAt(contacts, index);
    return action(contacts, name(current) || "Kontakt", { index, contact: current }, null);
  }

  /** Adds a group to the group list and to the contact. @param {MDCContacts} contacts @param {number} index @param {string} group */
  function addGroup(contacts, index, group) {
    const current = contactAt(contacts, index);
    const groups = contacts.groups.includes(group) ? contacts.groups : [...contacts.groups, group];
    return update(contacts, index, { ...current, groups: current.groups.includes(group) ? current.groups : [...current.groups, group] }, groups);
  }

  // ---------- Import with merge (docs/Domain.md#imports-and-exports) ----------

  /** @param {string} value */
  function phoneKey(value) {
    return value.replace(/[^\d+]/g, "").replace(/^00/, "+").replace(/^0/, "+49");
  }

  /** Index of an existing contact with the same name, phone number or email address, or -1. @param {MDCContact[]} list @param {MDCContact} contact */
  function duplicateOf(list, contact) {
    const contactName = name(contact).toLowerCase();
    const phones = new Set(contact.phones.map(item => phoneKey(item.value)).filter(Boolean));
    const emails = new Set(contact.emails.map(item => item.value.toLowerCase()));
    return list.findIndex(existing => (contactName && name(existing).toLowerCase() === contactName) ||
      existing.phones.some(item => phones.has(phoneKey(item.value))) || existing.emails.some(item => emails.has(item.value.toLowerCase())));
  }

  /** Adds what `incoming` has and `existing` lacks; nothing is overwritten. @param {MDCContact} existing @param {MDCContact} incoming */
  function merge(existing, incoming) {
    /** @param {MDCLabelled[]} list @param {MDCLabelled[]} more @param {(value: string) => string} key */
    const union = (list, more, key) => [...list, ...more.filter(item => !list.some(own => key(own.value) === key(item.value)))];
    const lower = (/** @type {string} */ value) => value.trim().toLowerCase();
    return {
      ...existing,
      firstName: existing.firstName || incoming.firstName,
      lastName: existing.lastName || incoming.lastName,
      nickname: existing.nickname || incoming.nickname,
      birthday: existing.birthday || incoming.birthday,
      company: existing.company || incoming.company,
      position: existing.position || incoming.position,
      phones: union(existing.phones, incoming.phones, phoneKey),
      emails: union(existing.emails, incoming.emails, lower),
      addresses: union(existing.addresses, incoming.addresses, lower),
      anniversaries: [...existing.anniversaries, ...incoming.anniversaries.filter(item => !existing.anniversaries.some(own => own.date === item.date))],
      note: existing.note.length ? existing.note : incoming.note
    };
  }

  /**
   * Imports contacts as one action: duplicates are merged, the rest is appended.
   * @param {MDCContacts} contacts @param {MDCContact[]} incoming
   * @returns {{action: MDCContactAction | null, added: number, merged: number}}
   */
  function importContacts(contacts, incoming) {
    const before = contacts.contacts;
    const after = [...before];
    let added = 0;
    let merged = 0;
    for (const contact of incoming) {
      const index = duplicateOf(after, contact);
      if (index < 0) {
        after.push(contact);
        added += 1;
        continue;
      }
      const combined = merge(after[index], contact);
      if (JSON.stringify(combined) !== JSON.stringify(after[index])) merged += 1;
      after[index] = combined;
    }
    if (!added && !merged) return { action: null, added, merged };
    /** @param {MDCContact[]} list */
    const set = list => {
      contacts.contacts = list;
      contacts.revision += 1;
    };
    return {
      added, merged,
      action: {
        label: "vCard-Import", days: [], contacts: true, size: after.reduce((total, contact) => total + sizeOf(contact), 0),
        selectAfter: added ? before.length : -1, selectBefore: -1,
        redo() { set(after); },
        undo() { set(before); }
      }
    };
  }

  app.contacts = { name, occasionsOn, nextBirthday, matches, sortName, create, update, remove, addGroup, importContacts, isLeap };
})(window.MDCalendar);
