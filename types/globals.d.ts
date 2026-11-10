// Global namespace shared by the classic scripts (see docs/Architecture.md#runtime).
// Layers add their members here as they are implemented.
interface MDCalendarNamespace {
  calendar: {
    parseDate(value: string): string;
    formatDate(key: string): string;
    parseTime(value: string): string;
    todayKey(now: Date): string;
    addDays(key: string, days: number): string;
    addMonths(key: string, months: number): string;
    weekStart(key: string): string;
    weekDays(key: string): string[];
    isoWeek(key: string): number;
    entries(calendar: MDCCalendar, key: string): readonly MDCEntry[];
    dayList(calendar: MDCCalendar, key: string): MDCEntry[];
    createEntry(calendar: MDCCalendar, key: string, fields: MDCEntryFields & Partial<Pick<MDCEntry, "tag" | "extra">>): MDCDayAction;
    updateEntry(calendar: MDCCalendar, ref: MDCEntryRef, key: string, fields: MDCEntryFields): MDCDayAction | null;
    deleteEntry(calendar: MDCCalendar, ref: MDCEntryRef): MDCDayAction;
    toggleDone(calendar: MDCCalendar, ref: MDCEntryRef): MDCDayAction;
    moveEntry(calendar: MDCCalendar, from: MDCEntryRef, to: MDCEntryRef): MDCDayAction | null;
    isOverdue(entry: { done: boolean }, key: string, today: string): boolean;
    combine(label: string, actions: MDCDayAction[]): MDCDayAction;
    createSeries(calendar: MDCCalendar, series: MDCSeries): MDCDayAction;
    updateSeries(calendar: MDCCalendar, index: number, series: MDCSeries): MDCDayAction | null;
    deleteSeries(calendar: MDCCalendar, index: number): MDCDayAction;
    toggleOccurrence(calendar: MDCCalendar, index: number, key: string): MDCDayAction;
    deleteOccurrence(calendar: MDCCalendar, index: number, key: string): MDCDayAction;
    endSeries(calendar: MDCCalendar, index: number, key: string): MDCDayAction | null;
    createMultiDay(calendar: MDCCalendar, item: MDCMultiDay): MDCDayAction;
    updateMultiDay(calendar: MDCCalendar, index: number, item: MDCMultiDay): MDCDayAction | null;
    deleteMultiDay(calendar: MDCCalendar, index: number): MDCDayAction;
    segments(calendar: MDCCalendar, start: string, count: number): { segments: MDCSegment[]; lanes: number; dayLanes: number[] };
    taggedPeriods(calendar: MDCCalendar, tag: string, year: number): MDCPeriod[];
    changeOccurrences(calendar: MDCCalendar, occurrences: Array<{ index: number; key: string }>, mode: "done" | "open" | "delete"): MDCDayAction[];
    importEvents(calendar: MDCCalendar, events: MDCIcsEvent[], today: string): { action: MDCDayAction | null; entries: number; series: number; multiDay: number; duplicates: number; simplified: number };
  };
  contacts: {
    name(contact: MDCContact): string;
    occasionsOn(contacts: MDCContacts, key: string): Array<MDCOccasion & { age: number | null }>;
    nextBirthday(contact: MDCContact, today: string): { days: number; date: string; age: number | null } | null;
    matches(contact: MDCContact, query: string): boolean;
    sortName(contact: MDCContact): string;
    create(contacts: MDCContacts, contact: MDCContact): MDCContactAction;
    update(contacts: MDCContacts, index: number, updated: MDCContact, groupsAfter?: string[]): MDCContactAction | null;
    remove(contacts: MDCContacts, index: number): MDCContactAction;
    addGroup(contacts: MDCContacts, index: number, group: string): MDCContactAction | null;
    importContacts(contacts: MDCContacts, incoming: MDCContact[]): { action: MDCContactAction | null; added: number; merged: number };
    isLeap(year: string): boolean;
  };
  search: {
    search(calendar: MDCCalendar, backlog: MDCBacklog, version: number, query: string, today: string, limit: number): MDCSearchItem[];
    nextOccurrence(series: MDCSeries, from: string): string;
    normalize(value: string): string;
  };
  recurrence: {
    parseRule(text: string): MDCRule | null;
    serializeRule(rule: MDCRule): string;
    occursOn(rule: MDCRule, start: string, key: string): boolean;
    occurrences(calendar: MDCCalendar, key: string): readonly MDCOccurrence[];
    describe(rule: MDCRule, start: string): string;
    weekday(key: string): number;
    weekdays: string[];
  };
  history: {
    create(): MDCHistory;
    execute(history: MDCHistory, action: MDCUndoAction): boolean;
    undo(history: MDCHistory): MDCUndoEntry | null;
    redo(history: MDCHistory): MDCUndoEntry | null;
    markSaved(history: MDCHistory, position?: number): void;
    unsaved(history: MDCHistory): number;
    canUndo(history: MDCHistory): boolean;
    canRedo(history: MDCHistory): boolean;
    undoLabel(history: MDCHistory): string;
    redoLabel(history: MDCHistory): string;
  };
  backlog: {
    entryAt(calendar: MDCCalendar, backlog: MDCBacklog, ref: MDCEntryRef): MDCEntry;
    create(calendar: MDCCalendar, backlog: MDCBacklog, group: number, fields: MDCEntryFields & Partial<Pick<MDCEntry, "tag" | "extra">>): MDCDayAction;
    update(calendar: MDCCalendar, backlog: MDCBacklog, ref: MDCEntryRef, target: { key: string; group?: number }, fields: Partial<MDCEntry>): MDCDayAction | null;
    remove(calendar: MDCCalendar, backlog: MDCBacklog, ref: MDCEntryRef): MDCDayAction;
    toggle(calendar: MDCCalendar, backlog: MDCBacklog, ref: MDCEntryRef): MDCDayAction;
    move(calendar: MDCCalendar, backlog: MDCBacklog, from: MDCEntryRef, to: MDCEntryRef): MDCDayAction | null;
    isBacklog(ref: MDCEntryRef): boolean;
    removeEntries(calendar: MDCCalendar, backlog: MDCBacklog, refs: MDCEntryRef[], label: string): MDCDayAction;
    toggleEntries(calendar: MDCCalendar, backlog: MDCBacklog, refs: MDCEntryRef[]): MDCDayAction;
    moveEntries(calendar: MDCCalendar, backlog: MDCBacklog, refs: MDCEntryRef[], target: MDCEntryRef): MDCDayAction;
    pasteEntries(calendar: MDCCalendar, backlog: MDCBacklog, entries: MDCEntry[], key: string): MDCDayAction;
  };
  calendarFormat: {
    parse(text: string): { calendar: MDCCalendar; warnings: MDCFormatWarning[] };
    serialize(calendar: MDCCalendar): string;
    entry: {
      pattern: RegExp;
      subItemPattern: RegExp;
      locationPrefix: string;
      text(text: string): Pick<MDCEntry, "start" | "end" | "title" | "tag">;
      lines(entry: MDCEntry): string[];
    };
  };
  backlogFormat: {
    parse(text: string): { backlog: MDCBacklog; warnings: MDCFormatWarning[] };
    serialize(backlog: MDCBacklog): string;
    inbox: string;
  };
  holidaysFormat: { parse(text: string): { holidays: MDCHolidays; warnings: MDCFormatWarning[] } };
  configFormat: { parse(text: string): { config: MDCConfig; warnings: MDCFormatWarning[] }; hue(color: string): number };
  contactsFormat: {
    parse(text: string): { contacts: MDCContacts; warnings: MDCFormatWarning[] };
    serialize(contacts: MDCContacts): string;
    parseBirthday(value: string): string;
    formatBirthday(birthday: string): string;
    emptyContact(): MDCContact;
    displayName(contact: MDCContact): string;
  };
  vcard: { parse(text: string): MDCContact[]; serialize(contacts: MDCContact[]): string };
  ics: { parse(text: string): { events: MDCIcsEvent[]; skipped: number } };
  storage: {
    pickFolder(): Promise<MDCStorageAdapter>;
    rememberedFolder(): Promise<{ name: string; granted: boolean } | null>;
    reopenFolder(): Promise<MDCStorageAdapter | null>;
    forgetFolder(): Promise<void>;
    missingApis(): string[];
  };
  notifications: {
    show(severity: MDCSeverity, title: string, body: MDCNotificationBody, options?: MDCNotificationOptions): { dismiss(): void; isOpen(): boolean };
    fatal(title: string, body: string, details: string, code: string): void;
  };
  tooltips: { hide(): void };
  sounds: { play(): Promise<void>; setMuted(value: boolean): void; isMuted(): boolean };
  header: { update(state: MDCHeaderState): void; flashSaved(): void };
  contactsView: {
    init(handlers: MDCContactsHandlers): void;
    render(contacts: MDCContacts, selected: number, today: string): void;
    hide(): void;
    focusField(key: string): void;
    download(name: string, text: string, type: string): void;
    isShown(): boolean;
  };
  pickers: { hide(): void; isOpen(): boolean };
  menus: {
    toggleOptions(): void;
    showContext(items: MDCMenuItem[], x: number, y: number): void;
    hideContext(): void;
    showHelp(): void;
    onImport(handler: (text: string, name: string) => void): void;
    isModalOpen(): boolean;
  };
  searchPanel: { init(search: (query: string) => MDCSearchItem[], jump: (item: MDCSearchItem) => void): void; toggle(): void; isOpen(): boolean };
  start: { show(remembered: string | null): void; hide(): void };
  tiles: {
    escape(value: string): string;
    icon(name: string): string;
    tint(tag: string): { className: string; style: string; hue: number | null };
    tagIcon(tag: string, className?: string): string;
    tagIconIds(): string[];
    setContacts(contacts: MDCContacts | null): void;
    slide(id: string, direction: number): void;
    dayTiles(calendar: MDCCalendar, key: string, today: string, options?: { limit?: number; compact?: boolean }): { html: string; hidden: number };
    backlogTiles(entries: readonly MDCEntry[]): string;
    bar(segment: MDCSegment, today: string, withRange: boolean): string;
    badges(key: string, max: number): string;
    setTags(tags: MDCTag[]): MDCTag[];
    setHolidays(holidays: MDCHolidays): void;
    pulse(element: HTMLElement): void;
  };
  backlogPanel: { render(backlog: MDCBacklog, open: boolean): boolean; lists(): HTMLElement[] };
  holidaysPanel: { update(holidays: MDCHolidays, today: string): void; toggle(holidays: MDCHolidays, today: string, vacations: (year: number) => MDCPeriod[]): void; isOpen(): boolean };
  week: MDCViewRenderer;
  month: MDCViewRenderer;
  dialog: { open(request: MDCDialogRequest, handlers: MDCDialogHandlers): void; close(): void; isOpen(): boolean };
  interactions: {
    init(handlers: MDCInteractionHandlers): void;
    bindLists(lists: HTMLElement[]): void;
    refreshSelection(): void;
    clearSelection(): void;
    selected(): MDCPick[];
    sortableReady(): boolean;
  };
}

// UI contracts.
type MDCView = "week" | "month" | "contacts";
type MDCViewRenderer = {
  /** Shows the period of `anchor`; returns true when the day lists were rebuilt. */
  render(calendar: MDCCalendar, anchor: string, today: string): boolean;
  renderDays(calendar: MDCCalendar, keys: string[], today: string): void;
  lists(): HTMLElement[];
  cell(key: string): HTMLElement | null;
  hide(): void;
};
type MDCSeverity = "info" | "warning" | "error";
type MDCFileName = "Calendar.md" | "Backlog.md" | "Contacts.md" | "Holidays.md" | "Config.md";
type MDCFileText = { text: string; stamp: string } | null;
type MDCFileState = {
  disk: MDCFileText;
  /** What the model serializes to right after loading; a missing file is created only when this changes. */
  baseline: string;
  /** A version on disk that differs from `disk` while local changes exist. */
  external: { text: string | null; stamp: string | null } | null;
  writable: boolean;
};
type MDCNotificationBody = string | Array<string | { value: string }>;
type MDCNotificationOptions = {
  /** Stable error code (MDC-…), errors only. */
  code?: string;
  /** Copyable details, errors only. */
  details?: MDCNotificationBody;
  /** Stays until dismissed; errors always stay. */
  persistent?: boolean;
  actions?: Array<{ label: string; run(): void; primary?: boolean }>;
};
type MDCHeaderState = {
  open: boolean;
  view: MDCView;
  backlogOpen: boolean;
  anchor: string;
  unsaved: number;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string;
  redoLabel: string;
  muted: boolean;
  conflict: boolean;
};
type MDCItemKind = "entry" | "series" | "multiDay";
/** What the dialog shows; `date` is the day, the series start or the range start. */
type MDCDialogRequest = {
  kind: MDCItemKind;
  isNew: boolean;
  /** A backlog entry: the date may stay empty. */
  inBacklog: boolean;
  tag: string;
  /** Tags of Config.md, offered as chips. */
  tags: MDCTag[];
  title: string;
  location: string;
  note: string[];
  date: string;
  end: string;
  startTime: string;
  endTime: string;
  rule: MDCRule | null;
  /** Day of the occurrence the dialog was opened from, or "" */
  occurrence: string;
};
/** `date` is "" for an entry that stays in or goes into the backlog. */
type MDCDialogResult = Omit<MDCDialogRequest, "isNew" | "occurrence" | "inBacklog" | "tags">;
type MDCDialogHandlers = {
  apply(result: MDCDialogResult): void;
  toBacklog(result: MDCDialogResult): void;
  remove(): void;
  deleteOccurrence(): void;
  endSeries(): void;
};
/** A selected or clicked tile: an entry of a day or backlog group, or an occurrence of a series. */
type MDCPick = { ref?: MDCEntryRef; series?: number; key: string };
type MDCMenuItem = { label: string; icon: string; key?: string; danger?: boolean; run(): void };
type MDCContactsHandlers = {
  select(index: number): void;
  update(index: number, updated: MDCContact, groups?: string[]): void;
  addGroup(index: number, group: string): void;
  remove(index: number): void;
  importText(text: string, name: string): void;
  exportOne(index: number): void;
  exportAll(): void;
  copy(text: string): void;
  reject(message: string): void;
};
type MDCInteractionHandlers = {
  pickFolder(): void;
  reopenFolder(): void;
  today(): void;
  previous(): void;
  next(): void;
  showView(view: MDCView): void;
  toggleBacklog(): void;
  toggleHolidays(): void;
  toggleSearch(): void;
  showHelp(): void;
  openContact(index: number): void;
  isContactsView(): boolean;
  notice(title: string, body: string): void;
  contextMenu(picks: MDCPick[], x: number, y: number, key: string): void;
  toggleMany(picks: MDCPick[]): void;
  removeMany(picks: MDCPick[]): void;
  copy(picks: MDCPick[]): void;
  paste(key: string): void;
  moveMany(refs: MDCEntryRef[], dragged: MDCEntryRef, target: MDCEntryRef): void;
  moveMultiDay(index: number, start: string, end: string): void;
  openWeek(key: string): void;
  newEntry(key?: string): void;
  openEntry(ref: MDCEntryRef): void;
  openOccurrence(index: number, key: string): void;
  openMultiDay(index: number): void;
  toggle(ref: MDCEntryRef): void;
  toggleOccurrence(index: number, key: string): void;
  move(from: MDCEntryRef, to: MDCEntryRef): void;
  undo(): void;
  redo(): void;
  save(): void;
  toggleSound(): void;
};

interface Window {
  MDCalendar: MDCalendarNamespace;
  showDirectoryPicker(options?: { id?: string; mode?: "read" | "readwrite" }): Promise<FileSystemDirectoryHandle>;
}

// File System Access API members missing from TypeScript's DOM library.
interface FileSystemHandle {
  queryPermission(options: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "read" | "readwrite" }): Promise<PermissionState>;
}

// Storage adapter (see docs/Architecture.md#storage-adapter).
type MDCStorageAdapter = {
  name: string;
  listFiles(): Promise<string[]>;
  read(name: string): Promise<{ text: string; stamp: string } | null>;
  stat(name: string): Promise<string | null>;
  write(name: string, text: string, expected: string | null): Promise<string>;
};
/** Thrown by write() when the file no longer matches the expected stamp; text and stamp are null for a deleted file. */
type MDCStorageConflictError = Error & { name: "StorageConflictError"; file: string; text: string | null; stamp: string | null };

// Calendar model (see docs/Domain.md#entry and docs/DataFormat.md#calendar).
type MDCEntry = {
  done: boolean;
  /** HH:MM or "" */
  start: string;
  /** HH:MM or ""; only set together with start */
  end: string;
  title: string;
  /** Tag name without "#", or "" */
  tag: string;
  location: string;
  note: string[];
  /** Unknown lines preserved after the entry */
  extra: string[];
};
type MDCDay = {
  /** ISO date YYYY-MM-DD */
  key: string;
  entries: MDCEntry[];
  /** Unknown lines preserved after the day heading */
  extra: string[];
};
/** RRULE subset (see docs/Domain.md#recurring-entry). */
type MDCRule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  /** Weekdays (MO…SU) for weekly rules; one positional weekday (2TU, -1FR) for monthly rules. */
  byDay: string[];
  /** Day of the month for monthly rules, or 0 */
  byMonthDay: number;
  /** Last possible day (ISO key), or "" */
  until: string;
};
type MDCSeries = {
  title: string;
  tag: string;
  /** First day (ISO key) */
  start: string;
  startTime: string;
  endTime: string;
  rule: MDCRule;
  /** Deleted occurrences (ISO keys) */
  except: string[];
  /** Checked-off occurrences (ISO keys) */
  done: string[];
  location: string;
  note: string[];
  extra: string[];
};
type MDCMultiDay = { title: string; tag: string; start: string; end: string; location: string; note: string[]; extra: string[] };
/** An item of ## Multi-day or ## Recurring that could not be understood; written back verbatim. */
type MDCRawBlock = { raw: string[] };
type MDCOccurrence = { series: MDCSeries; index: number; key: string; done: boolean };
type MDCSegment = { item: MDCMultiDay; index: number; column: number; span: number; lane: number; continuesBefore: boolean; continuesAfter: boolean };
type MDCCalendar = {
  newline: string;
  /** Unknown lines preserved after the file heading */
  head: string[];
  days: Map<string, MDCDay>;
  multiDay: Array<MDCMultiDay | MDCRawBlock>;
  series: Array<MDCSeries | MDCRawBlock>;
  /** Unknown lines preserved after the ## Multi-day and ## Recurring headings */
  multiDayHead: string[];
  seriesHead: string[];
  /** Changes with every series change; keys the occurrence cache. */
  seriesRevision: number;
};
type MDCFormatWarningKind = "missing-header" | "unknown-heading" | "invalid-date" | "unknown-line" | "outside-day" | "invalid-item";
type MDCFormatWarning = { lineNumber: number; kind: MDCFormatWarningKind; text: string };

/** An entry is addressed by its day (or backlog group) and its position in that list (see docs/DataFormat.md#entry-identity). */
type MDCEntryRef = { key: string; index: number; group?: number };
type MDCBacklogGroup = { name: string; entries: MDCEntry[]; extra: string[] };
type MDCBacklog = { newline: string; head: string[]; groups: MDCBacklogGroup[] };
type MDCHolidays = { holidays: Array<{ date: string; name: string }>; vacations: Array<{ start: string; end: string; name: string }> };
type MDCTag = { name: string; color: string; icon: string };
type MDCPeriod = { start: string; end: string; title: string };

// Contacts (see docs/Domain.md#contact and docs/DataFormat.md#contacts).
type MDCLabelled = { label: string; value: string };
type MDCContact = {
  firstName: string;
  lastName: string;
  nickname: string;
  /** YYYY-MM-DD, --MM-DD without a year, or "" */
  birthday: string;
  phones: MDCLabelled[];
  emails: MDCLabelled[];
  addresses: MDCLabelled[];
  company: string;
  position: string;
  groups: string[];
  /** Date as an ISO key */
  anniversaries: Array<{ label: string; date: string }>;
  favorite: boolean;
  note: string[];
  /** Unknown lines preserved at the end of the contact */
  extra: string[];
};
type MDCContacts = {
  newline: string;
  /** Unknown lines and headings preserved after the file heading */
  head: string[];
  groups: string[];
  contacts: MDCContact[];
  /** Changes with every change; keys the birthday cache. */
  revision: number;
};
/** A birthday (empty label) or an anniversary of a contact; `year` is "" when unknown. */
type MDCOccasion = { index: number; name: string; label: string; year: string };
type MDCContactAction = MDCUndoAction & { days: string[]; contacts: true; selectAfter: number; selectBefore: number };

// Search (see docs/Domain.md#search).
type MDCSearchItem = {
  kind: "entry" | "series" | "multiDay" | "backlog";
  title: string;
  tag?: string;
  /** Normalized title, and normalized title, location, note and tag */
  words: string;
  text: string;
  /** Day key of the entry, series start or range start; "" in the backlog */
  key: string;
  end?: string;
  ref?: MDCEntryRef;
  series?: number;
  multi?: number;
};

// ICS import (see docs/Domain.md#imports-and-exports).
type MDCIcsEvent = {
  uid: string;
  title: string;
  location: string;
  note: string[];
  start: string;
  end: string;
  startTime: string;
  endTime: string;
  rule: MDCRule | null;
  /** The event had a rule outside the allowed subset; it is imported as a single entry. */
  unsupportedRule: boolean;
  except: string[];
};
type MDCConfig = { tags: MDCTag[] };
/** Fields the entry dialog edits. */
type MDCEntryFields = { title: string; start: string; end: string; location: string; note: string[] };

// Undo history (see docs/Architecture.md#undo-history).
type MDCViewState = { view: MDCView; anchor: string; contact?: number };
type MDCUndoAction = {
  label: string;
  /** Day keys the action changes, for targeted re-rendering. */
  days?: string[];
  /** Changes series or multi-day bars beyond single days; the whole view is rendered again. */
  layout?: boolean;
  /** Changes the backlog. */
  backlog?: boolean;
  /** For a move between Calendar.md and Backlog.md: the file that receives the entry. */
  target?: string;
  /** Changes contacts; `selectAfter` and `selectBefore` are the contacts to show after redo and undo. */
  contacts?: boolean;
  selectAfter?: number;
  selectBefore?: number;
  undo(): void;
  redo(): void;
  size?: number;
  beforeViewState?: MDCViewState;
  afterViewState?: MDCViewState;
};
type MDCUndoEntry = MDCUndoAction & { size: number };
/** A calendar action; `days` lists the day keys it changes. */
type MDCDayAction = MDCUndoAction & { days: string[] };
type MDCHistory = {
  entries: MDCUndoEntry[];
  index: number;
  totalSize: number;
  /** Actions applied since the history was created, minus undone ones. */
  position: number;
  savedPosition: number;
  /** Extra distance to the saved state after its branch was discarded. */
  savedDetour: number;
};

// Vendored libraries loaded as classic scripts (see docs/Architecture.md#production-dependencies).
// Only the members in use are declared; extend as needed.
interface DayjsValue {
  add(value: number, unit: "day" | "month"): DayjsValue;
  startOf(unit: "isoWeek" | "month"): DayjsValue;
  isoWeek(): number;
  format(template: string): string;
}
declare const dayjs: {
  (value?: string | Date): DayjsValue;
  extend(plugin: unknown): void;
  locale(name?: string): string;
};
declare const dayjs_plugin_isoWeek: unknown;
declare const dayjs_plugin_customParseFormat: unknown;
declare const Sortable: {
  create(element: HTMLElement, options: object): { destroy(): void };
};
