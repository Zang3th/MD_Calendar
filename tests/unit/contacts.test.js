const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const load = require("./load-classic");

const app = load("domain/calendar.js", "domain/contacts.js", "io/contacts-format.js", "io/vcard.js");
const golden = fs.readFileSync(path.join(__dirname, "../../data/parsing/Contacts.md"), "utf8");

/** @param {unknown} value */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("the contacts golden file round-trips with all fields", () => {
  const { contacts, warnings } = app.contactsFormat.parse(golden);
  assert.deepEqual(plain(warnings), []);
  assert.equal(app.contactsFormat.serialize(contacts), golden);
  assert.deepEqual(plain(contacts.contacts[0]), {
    firstName: "Max", lastName: "Example", birthday: "1990-05-17",
    phones: [{ label: "Mobile", value: "+49 170 0000000" }, { label: "Work", value: "+49 2151 000000" }],
    emails: [{ label: "Home", value: "max@example.com" }],
    addresses: [{ label: "Home", value: "Example Street 1, 47798 Krefeld, Germany" }],
    anniversaries: [{ label: "Wedding", date: "2018-06-09" }],
    note: ["Met at university.", "Prefers phone calls."], extra: []
  });
  assert.equal(contacts.contacts[1].birthday, "--05-17");
  assert.equal(app.contactsFormat.parseBirthday("17.05"), "--05-17");
});

test("unknown contact lines stay, the heading is rewritten from the name", () => {
  const text = "# Contacts\n\n## Contacts\n\n### Old heading\n#FirstName\n- Lena\n#Shoe\n- 42\n";
  const { contacts, warnings } = app.contactsFormat.parse(text);
  assert.deepEqual(plain(warnings).map((/** @type {any} */ warning) => warning.lineNumber), [8, 9]);
  assert.equal(app.contactsFormat.serialize(contacts), "# Contacts\n\n## Contacts\n\n### Lena\n#FirstName\n- Lena\n#Shoe\n- 42\n");
});

test("groups, favorites, nickname, company and position of earlier versions are dropped without warnings", () => {
  const text = "# Contacts\n\n## Groups\n- Friends\n\n## Contacts\n\n### Max\n#FirstName\n- Max\n#Nickname\n- Maxi\n#Phone\n- Mobile: 1\n" +
    "#Company\n- ACME\n#Position\n- Developer\n#Groups\n- Friends\n#Favorite\n- yes\n#Note\nHello\n";
  const { contacts, warnings } = app.contactsFormat.parse(text);
  assert.deepEqual(plain(warnings), []);
  assert.equal(app.contactsFormat.serialize(contacts), "# Contacts\n\n## Contacts\n\n### Max\n#FirstName\n- Max\n#Phone\n- Mobile: 1\n#Note\nHello\n");
});

test("birthdays show with age; 29 February shows on 28 February in non-leap years", () => {
  const { contacts } = app.contactsFormat.parse("# Contacts\n\n## Contacts\n\n### A B\n#FirstName\n- A\n#LastName\n- B\n#Birthday\n- 29.02.2000\n#Anniversary\n- Wedding: 28.02.2020\n");
  assert.deepEqual(plain(app.contacts.occasionsOn(contacts, "2027-02-28")).map((/** @type {any} */ item) => [item.name, item.label, item.age]), [["A B", "", 27], ["A B", "Wedding", 7]]);
  assert.deepEqual(plain(app.contacts.occasionsOn(contacts, "2028-02-28")).map((/** @type {any} */ item) => item.label), ["Wedding"]);
  assert.equal(app.contacts.occasionsOn(contacts, "2028-02-29")[0].age, 28);
  assert.deepEqual(plain(app.contacts.nextBirthday(contacts.contacts[0], "2027-03-01")), { days: 365, date: "2028-02-29", age: 28 });
});

test("vCards are read and written; duplicates are merged without overwriting", () => {
  const card = "BEGIN:VCARD\r\nVERSION:3.0\r\nN:Example;Max;;;\r\nFN:Max Example\r\nTEL;TYPE=CELL:+49 170 0000000\r\nTEL;TYPE=HOME:02151 1234\r\n" +
    "EMAIL;TYPE=INTERNET:max@example.com\r\nBDAY:--0517\r\nitem1.X-ABDATE:2018-06-09\r\nitem1.X-ABLabel:_$!<Anniversary>!$_\r\nNOTE:Line one\\nLine two\r\nEND:VCARD\r\n" +
    "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Lena Walker\r\nEMAIL:lena@example.com\r\nEND:VCARD\r\n";
  const parsed = app.vcard.parse(card);
  assert.deepEqual(plain(parsed[0].phones), [{ label: "Mobile", value: "+49 170 0000000" }, { label: "Home", value: "02151 1234" }]);
  assert.equal(parsed[0].birthday, "--05-17");
  assert.deepEqual(plain(parsed[0].anniversaries), [{ label: "Anniversary", date: "2018-06-09" }]);
  assert.deepEqual(plain(parsed[0].note), ["Line one", "Line two"]);
  assert.deepEqual([parsed[1].firstName, parsed[1].lastName], ["Lena", "Walker"]);

  const { contacts } = app.contactsFormat.parse(golden);
  const result = app.contacts.importContacts(contacts, parsed);
  assert.deepEqual([result.added, result.merged], [1, 1]);
  result.action.redo();
  const max = contacts.contacts[0];
  assert.equal(max.birthday, "1990-05-17");
  assert.deepEqual(plain(max.phones).map((/** @type {any} */ item) => item.value), ["+49 170 0000000", "+49 2151 000000", "02151 1234"]);
  assert.equal(contacts.contacts.length, 3);
  result.action.undo();
  assert.equal(contacts.contacts.length, 2);

  const exported = app.vcard.serialize([max]);
  assert.match(exported, /^BEGIN:VCARD\r\nVERSION:3\.0\r\nN:Example;Max;;;\r\nFN:Max Example\r\n/);
  assert.deepEqual(plain(app.vcard.parse(exported)[0]), plain(max));
});

test("next up lists the soonest birthdays and anniversaries from today, birthdays first on the same day", () => {
  const { contacts } = app.contactsFormat.parse("# Contacts\n\n## Contacts\n\n" +
    "### Ann\n#FirstName\n- Ann\n#Birthday\n- 19.11.1996\n\n" +
    "### Bob\n#FirstName\n- Bob\n#Anniversary\n- Wedding: 19.11.2018\n\n" +
    "### Cid\n#FirstName\n- Cid\n#Birthday\n- 18.11.\n#Anniversary\n- Met: 29.02.2020\n\n" +
    "### Dan\n#FirstName\n- Dan\n#Anniversary\n- Start: 01.12.2027\n");
  const next = plain(app.contacts.upcoming(contacts, "2026-11-19", 5)).map((/** @type {any} */ item) => [item.index, item.kind, item.date, item.years]);
  assert.deepEqual(next, [
    [0, "birthday", "2026-11-19", 30], [1, "anniversary", "2026-11-19", 8],
    [2, "anniversary", "2027-02-28", 7], [2, "birthday", "2027-11-18", null], [3, "anniversary", "2027-12-01", 0]
  ]);
  // The contact whose birthday comes next, ignoring anniversaries; none without birthdays.
  assert.equal(app.contacts.nextBirthdayIndex(contacts, "2026-11-20"), 2);
  assert.equal(app.contacts.nextBirthdayIndex(app.contactsFormat.parse("# Contacts\n\n## Contacts\n\n### Dan\n#FirstName\n- Dan\n").contacts, "2026-11-20"), -1);
});
