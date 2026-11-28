// Global namespace shared by the classic scripts (see docs/Architecture.md#runtime).
// Layers add their members here as they are implemented.
interface MDCalendarNamespace {
  calendar: {
    parseDate(value: string): string;
    formatDate(key: string): string;
    formatDay(key: string, pattern: string): string;
    parseTime(value: string): string;
    todayKey(now: Date): string;
    addDays(key: string, days: number): string;
    addMonths(key: string, months: number): string;
    weekStart(key: string): string;
    weekDays(key: string): string[];
    isoWeek(key: string): number;
    entries(calendar: MDCCalendar, key: string): readonly MDCEntry[];
    dayList(calendar: MDCCalendar, key: string): MDCEntry[];
    pins(calendar: MDCCalendar, key: string): readonly MDCPin[];
    placedAt(calendar: MDCCalendar, key: string): Map<number, number>;
    repin(before: readonly MDCEntry[], after: readonly MDCEntry[], pins: readonly MDCPin[], moved?: Set<MDCEntry>, replaced?: Map<MDCEntry, MDCEntry>): MDCPin[];
    keepPins(calendar: MDCCalendar, keys: string[], change: () => void, options?: { moved?: Set<MDCEntry>; replaced?: Map<MDCEntry, MDCEntry>; placed?: { key: string; pins: MDCPin[] } | null; slotted?: MDCSlotted[] }): Array<{ key: string; pins: readonly MDCPin[] }>;
    restorePins(calendar: MDCCalendar, states: Array<{ key: string; pins: readonly MDCPin[] }>): void;
    pinOptions(from: { ref: MDCEntryRef; entry: MDCEntry } | null, to: { ref: MDCEntryRef; entry: MDCEntry } | null): { moved?: Set<MDCEntry>; replaced?: Map<MDCEntry, MDCEntry> };
    toPins(calendar: MDCCalendar, key: string, placed: MDCPlacement[]): MDCPin[];
    slug(title: string, taken: ReadonlySet<string>): string;
    placeOccurrences(calendar: MDCCalendar, key: string, placed: MDCPlacement[], label: string): MDCDayAction | null;
    timeSlot(calendar: MDCCalendar, key: string, time: string, skip?: number): { index: number; stay: Set<string> };
    insertTimed(calendar: MDCCalendar, key: string, list: MDCEntry[], placed: readonly MDCPin[], entry: MDCEntry): MDCPin[];
    createEntry(calendar: MDCCalendar, key: string, fields: MDCEntryFields & Partial<Pick<MDCEntry, "tag" | "extra" | "sync">>): MDCDayAction;
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
    vacationTag: string;
    dayOffTag: string;
    daysOff(calendar: MDCCalendar, key: string): string[];
    taggedPeriods(calendar: MDCCalendar, tag: string, year: number): MDCPeriod[];
    nestPeriods(periods: readonly MDCPeriod[]): Array<{ period: MDCPeriod; depth: number }>;
    changeOccurrences(calendar: MDCCalendar, occurrences: Array<{ index: number; key: string }>, mode: "done" | "open" | "delete"): MDCDayAction[];
    importEvents(calendar: MDCCalendar, events: MDCIcsEvent[], today: string): { action: MDCDayAction | null; entries: number; series: number; multiDay: number; duplicates: number; simplified: number };
  };
  contacts: {
    name(contact: MDCContact): string;
    occasionsOn(contacts: MDCContacts, key: string): Array<MDCOccasion & { age: number | null }>;
    nextBirthday(contact: MDCContact, today: string): { days: number; date: string; age: number | null } | null;
    nextBirthdayIndex(contacts: MDCContacts, today: string): number;
    upcoming(contacts: MDCContacts, today: string, count: number): MDCUpcoming[];
    matches(contact: MDCContact, query: string): boolean;
    sortName(contact: MDCContact): string;
    create(contacts: MDCContacts, contact: MDCContact): MDCContactAction;
    update(contacts: MDCContacts, index: number, updated: MDCContact): MDCContactAction | null;
    remove(contacts: MDCContacts, index: number): MDCContactAction;
    importContacts(contacts: MDCContacts, incoming: MDCContact[]): { action: MDCContactAction | null; added: number; merged: number };
    isLeap(year: string): boolean;
  };
  search: {
    search(calendar: MDCCalendar, backlog: MDCBacklog, version: number, query: string, today: string, limit: number): MDCSearchItem[];
    nextOccurrence(series: MDCSeries, from: string): string;
  };
  recurrence: {
    parseRule(text: string): MDCRule | null;
    serializeRule(rule: MDCRule): string;
    occursOn(rule: MDCRule, start: string, key: string): boolean;
    occurrences(calendar: MDCCalendar, key: string): readonly MDCOccurrence[];
    dayOrder(occurrences: readonly MDCOccurrence[], entries: readonly MDCEntry[], placed?: ReadonlyMap<number, number>): Array<{ occurrence: MDCOccurrence } | { entry: MDCEntry; index: number }>;
    weekday(key: string): number;
    weekdays: string[];
  };
  backlog: {
    /** Group number that addresses the ungrouped entries in an entry place. */
    ungrouped: number;
    entryAt(calendar: MDCCalendar, backlog: MDCBacklog, ref: MDCEntryRef): MDCEntry;
    /** Creates a backlog entry in the group of its tag (ungrouped without a tag). */
    create(calendar: MDCCalendar, backlog: MDCBacklog, fields: MDCEntryFields & Partial<Pick<MDCEntry, "tag" | "extra">>): MDCDayAction;
    update(calendar: MDCCalendar, backlog: MDCBacklog, ref: MDCEntryRef, target: { key: string; group?: number }, fields: Partial<MDCEntry>): MDCDayAction | null;
    remove(calendar: MDCCalendar, backlog: MDCBacklog, ref: MDCEntryRef): MDCDayAction;
    toggle(calendar: MDCCalendar, backlog: MDCBacklog, ref: MDCEntryRef): MDCDayAction;
    move(calendar: MDCCalendar, backlog: MDCBacklog, from: MDCEntryRef, to: MDCEntryRef, placed?: MDCPlacement[] | null): MDCDayAction | null;
    moveGroup(backlog: MDCBacklog, from: number, to: number): MDCDayAction | null;
    isBacklog(ref: MDCEntryRef): boolean;
    removeEntries(calendar: MDCCalendar, backlog: MDCBacklog, refs: MDCEntryRef[], label: string): MDCDayAction;
    toggleEntries(calendar: MDCCalendar, backlog: MDCBacklog, refs: MDCEntryRef[]): MDCDayAction;
    moveEntries(calendar: MDCCalendar, backlog: MDCBacklog, refs: MDCEntryRef[], target: MDCEntryRef): MDCDayAction;
    pasteEntries(calendar: MDCCalendar, backlog: MDCBacklog, entries: MDCEntry[], target: MDCEntryRef): MDCDayAction;
  };
  calendarFormat: {
    parse(text: string): { calendar: MDCCalendar; warnings: MDCFormatWarning[] };
    serialize(calendar: MDCCalendar): string;
    entry: {
      pattern: RegExp;
      text(text: string): Pick<MDCEntry, "start" | "end" | "title" | "tag" | "sync">;
      subLine(entry: MDCEntry, line: string): boolean;
      lines(entry: MDCEntry): string[];
      reportDuplicateSyncIds(items: Array<MDCEntry | MDCMultiDay | MDCSeries | MDCRawBlock>, lines: Map<object, number>, warnings: MDCFormatWarning[]): void;
    };
  };
  backlogFormat: {
    parse(text: string): { backlog: MDCBacklog; warnings: MDCFormatWarning[] };
    serialize(backlog: MDCBacklog): string;
  };
  holidaysFormat: { parse(text: string): { holidays: MDCHolidays; warnings: MDCFormatWarning[] } };
  configFormat: {
    parse(text: string): { config: MDCConfig; warnings: MDCFormatWarning[] };
    hue(color: string): number;
  };
  contactsFormat: {
    parse(text: string): { contacts: MDCContacts; warnings: MDCFormatWarning[] };
    serialize(contacts: MDCContacts): string;
    parseBirthday(value: string): string;
    formatBirthday(birthday: string): string;
    emptyContact(): MDCContact;
    displayName(contact: MDCContact): string;
  };
  sync: {
    /** Items from this day on are synchronized. */
    cutover: string;
    colorId(hex: string): string;
    eventTag(event: any, tags: MDCTag[]): string;
    localFields(kind: MDCSyncKind, item: any, key?: string): Record<string, string>;
    fingerprints(fields: Record<string, string>): MDCSyncFields;
    collect(calendar: MDCCalendar, backlog: MDCBacklog): MDCSyncLocal;
    fromEvent(event: any, timeZone: string, tags: MDCTag[]): MDCSyncRemote;
    toEvent(kind: MDCSyncKind, fields: Record<string, string>, timeZone: string, tags: MDCTag[], tag?: string): Record<string, unknown>;
    compare(input: { local: MDCSyncLocal; base: Record<string, MDCSyncItem>; events: any[]; full: boolean; timeZone: string; tags: MDCTag[] }): MDCSyncComparison;
    localChanges(local: MDCSyncLocal, base: Record<string, MDCSyncItem>): MDCSyncLocalChanges;
    order(differences: MDCSyncDifference[]): MDCSyncDifference[];
    combined(difference: MDCSyncDifference): Record<string, string>;
  };
  syncDialog: {
    open(handlers: MDCSyncDialogHandlers): void;
    close(): void;
    render(view: MDCSyncView): void;
    rowState(key: string, state: string): void;
    progress(value: { done: number; total: number; label: string }): void;
    notice(text: string): void;
    isOpen(): boolean;
  };
  syncPlan: {
    plan(comparison: MDCSyncComparison, choices: Record<string, MDCSyncChoice | null>, context: { base: Record<string, MDCSyncItem>; timeZone: string; tags: MDCTag[]; newId: () => string; by: string; startedAt: string; syncToken: string }): MDCSyncJournal;
    run(options: { journal: MDCSyncJournal; client: MDCGoogleClient; cancelled?: () => boolean; progress?: (operation: MDCSyncOperation) => void; persist?: (journal: MDCSyncJournal) => Promise<void>; signal?: AbortSignal }): Promise<void>;
    applyLocal(calendar: MDCCalendar, backlog: MDCBacklog, journal: MDCSyncJournal): MDCUndoAction | null;
    record(base: Record<string, MDCSyncItem>, journal: MDCSyncJournal): { items: Record<string, MDCSyncItem>; open: string[]; counts: MDCSyncCounts };
  };
  google: {
    readKey(text: string): MDCGoogleKey;
    client(options: MDCGoogleClientOptions): MDCGoogleClient;
    newId(crypto?: Crypto): string;
    GoogleError: new (code: MDCGoogleErrorCode, message: string, detail?: string) => MDCGoogleError;
  };
  folderState: {
    fileName: string;
    create(): MDCFolderState;
    opened(document: Record<string, any>, device: MDCDevice, now: Date): MDCFolderState;
    saved(document: Record<string, any>, device: MDCDevice, hashes: Record<string, string>, now: Date): MDCFolderState;
    file(folder: MDCStorageAdapter, unreadable: () => void): ReturnType<typeof import("@zang3th/md-libs/platform").jsonFile.create>;
    read(text: string): MDCFolderState | null;
    summary(state: Record<string, any>, deviceId: string): MDCFolderInfo;
    sync(state: Record<string, any>): MDCSyncState | null;
    connected(state: Record<string, any>, calendarId: string): MDCFolderState;
    journal(state: Record<string, any>, journal: MDCSyncJournal | null): MDCFolderState;
    synced(state: Record<string, any>, device: MDCDevice, result: MDCSyncResult, now: Date): MDCFolderState;
    checked(state: Record<string, any>, device: MDCDevice, result: MDCSyncCheck, now: Date): MDCFolderState;
    stamp(now: Date): string;
  };
  vcard: { parse(text: string): MDCContact[]; serialize(contacts: MDCContact[]): string };
  ics: { parse(text: string): { events: MDCIcsEvent[]; skipped: number } };
  storage: {
    pickFolder(): Promise<MDCOpenAttempt>;
    createCalendar(setUp: (folder: MDCStorageAdapter) => Promise<unknown>): Promise<MDCStorageAdapter>;
    device(): MDCDevice;
    fingerprint(text: string): Promise<string>;
    recentFolders(): Promise<MDCRecentFolder[]>;
    rememberInfo(folder: MDCStorageAdapter, info: MDCFolderInfo): Promise<void>;
    refreshInfo(id: string, summarize: (text: string) => MDCFolderInfo | null): Promise<MDCFolderInfo | null>;
    openRecent(id: string): Promise<MDCOpenAttempt>;
    openLast(): Promise<MDCOpenAttempt | null>;
    forgetFolder(id: string): Promise<void>;
    skipNextAutoOpen(): void;
    takeSkipAutoOpen(): boolean;
    missingApis(): string[];
  };
  notifications: {
    show(severity: MDCSeverity, title: MDCNotificationBody, body: MDCNotificationBody, options?: MDCNotificationOptions): { dismiss(): void; isOpen(): boolean };
    fatal(title: string, body: MDCNotificationBody, details: string, code: string): void;
    text(strings: TemplateStringsArray, ...values: unknown[]): Exclude<MDCNotificationBody, string>;
    control(label: string): Exclude<MDCNotificationBody, string>[number];
    key(keys: string): Exclude<MDCNotificationBody, string>[number];
  };
  tooltips: { hide(): void };
  sounds: { play(): Promise<void>; setMuted(value: boolean): void; isMuted(): boolean };
  header: { update(state: MDCHeaderState): void; flashSaved(): void; saving(active: boolean): void; failed(message: string): void; setVersion(version: string): void; syncState(state: { changed: boolean; interrupted: boolean; busy: boolean }): void };
  contactsView: {
    init(handlers: MDCContactsHandlers): void;
    render(contacts: MDCContacts, selected: number, today: string): void;
    hide(): void;
    focusField(key: string): void;
    download(name: string, text: string, type: string): void;
    isShown(): boolean;
  };
  menus: {
    hideContext(): void;
    showHelp(open?: boolean): void;
    showNewMenu(items: MDCMenuItem[]): void;
    showOptions(): void;
    isModalOpen(): boolean;
  };
  searchPanel: { init(search: (query: string) => MDCSearchItem[], jump: (item: MDCSearchItem) => void): void; toggle(): void; isOpen(): boolean };
  start: { show(folders: MDCRecentFolder[]): void; hide(): void };
  tiles: {
    escape(value: string): string;
    icon(name: string): string;
    tint(tag: string): { className: string; style: string; hue: number | null };
    tagIcon(tag: string, className?: string): string;
    tagIconIds(): string[];
    setContacts(contacts: MDCContacts | null): void;
    slide(id: string, direction: number): void;
    dayTiles(calendar: MDCCalendar, key: string, today: string, options?: { limit?: number; compact?: boolean; details?: boolean }): { html: string; hidden: number; shown: number };
    backlogTiles(entries: readonly MDCEntry[]): string;
    bar(segment: MDCSegment, today: string, withRange: boolean): string;
    badges(key: string, max: number, compact?: boolean): string;
    dayOccasions(key: string): Record<MDCBadgeKind, Array<{ index: number; name: string; label: string; age: number | null }>>;
    describeOccasion(item: { name: string; label: string; age: number | null }): string;
    setTags(tags: MDCTag[]): MDCTag[];
    setHolidays(holidays: MDCHolidays): void;
    setCalendar(calendar: MDCCalendar | null): void;
    highlight(element: HTMLElement): void;
  };
  backlogPanel: { render(backlog: MDCBacklog, open: boolean): boolean; lists(): HTMLElement[] };
  holidaysPanel: { update(holidays: MDCHolidays, today: string): void; toggle(holidays: MDCHolidays, today: string, periods: (year: number) => MDCPeriod[]): void; show(holidays: MDCHolidays, today: string, periods: (year: number) => MDCPeriod[], tab: "vacation" | "holidays", day: string): void; isOpen(): boolean };
  focus: {
    open(calendar: MDCCalendar, key: string, today: string): void;
    close(): void;
    refresh(calendar: MDCCalendar, today: string): void;
    step(direction: number): void;
    isOpen(): boolean;
    /** The focused day, or "" while closed. */
    day(): string;
  };
  week: Omit<MDCViewRenderer, "render"> & {
    /** Shows `count` days (seven by default) from `start`; returns true when the day lists were rebuilt. */
    render(calendar: MDCCalendar, start: string, today: string, count?: number): boolean;
    panBegin(calendar: MDCCalendar, start: string, today: string): boolean;
    /** Pixels the pointer moved right and down since the drag began; only the days' axis counts. */
    panMove(x: number, y: number): void;
    /** The snapped first day and the pixels the days still stand off it, or null without a drag. */
    panEnd(): { start: string; rest: number } | null;
    settle(rest: number): void;
    /** Size of one day along the days' axis: a column's width, or a row's height in portrait. */
    daySize(): number;
  };
  month: MDCViewRenderer & { toggle(key: string): void; collapse(): void };
  dialog: { open(request: MDCDialogRequest, handlers: MDCDialogHandlers): void; close(): void; isOpen(): boolean };
  interactions: {
    init(handlers: MDCInteractionHandlers): void;
    bindLists(lists: HTMLElement[]): void;
    /** Binds the entry list of the focus card for reordering, or releases it (null). */
    bindFocusList(list: HTMLElement | null): void;
    refreshSelection(): void;
    clearSelection(): void;
    chooseCalendarFile(): void;
    selected(): MDCPick[];
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
type MDCNotificationBody = import("@zang3th/md-libs/ui").notifications.MDLNotificationBody;
type MDCNotificationOptions = {
  /** Stable error code (MDC-…), errors only. */
  code?: string;
  /** Copyable details, errors only. */
  details?: MDCNotificationBody;
  /** Stays until dismissed; errors always stay. */
  persistent?: boolean;
  actions?: Array<{ label: string; run(): void; primary?: boolean; tone?: "warning" | "success" }>;
};
type MDCHeaderState = {
  open: boolean;
  view: MDCView;
  backlogOpen: boolean;
  anchor: string;
  /** First shown day of the week view, which a drag can move off Monday. */
  start: string;
  unsaved: number;
  history: MDCHistory;
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
  /** Locations used before, most recent first, offered in the location popover. */
  locations: string[];
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
type MDCDialogResult = Omit<MDCDialogRequest, "isNew" | "occurrence" | "inBacklog" | "tags" | "locations">;
type MDCDialogHandlers = {
  apply(result: MDCDialogResult): void;
  /** Creates a new item from the dialog's values; Apply uses it once Duplicate has turned the dialog into a new item. */
  create(result: MDCDialogResult): void;
  remove(): void;
  deleteOccurrence(): void;
  endSeries(): void;
};
/** A selected or clicked tile: an entry of a day or backlog group, or an occurrence of a series. */
type MDCPick = { ref?: MDCEntryRef; series?: number; key: string };
/** `label` may mark a file type in braces, shown as code: "Import {.ics} event". */
type MDCMenuItem = { label: string; icon: string; danger?: boolean; run(): void };
type MDCContactsHandlers = {
  select(index: number): void;
  /** `field` names the edited field, so that repeated edits of it are one undo step. */
  update(index: number, updated: MDCContact, field?: string): void;
  remove(index: number): void;
  importText(text: string, name: string): void;
  exportOne(index: number): void;
  exportAll(): void;
  copy(text: string): void;
  reject(title: string, body: MDCNotificationBody): void;
};
type MDCInteractionHandlers = {
  pickFolder(): void;
  createCalendar(): void;
  openRecent(id: string): void;
  forgetRecent(id: string): void;
  importCalendar(text: string, name: string): void;
  showStart(): void;
  today(): void;
  previous(): void;
  next(): void;
  /** Returns to the mostly shown week after the days were dragged; false when there is nothing to snap. */
  snapToWeek(): boolean;
  /** Starts dragging the days of the week view; false when the view does not allow it. */
  panStart(): boolean;
  /** @param x pixels the pointer moved right since the drag began @param y pixels it moved down */
  panMove(x: number, y: number): void;
  panEnd(): void;
  /** Opens the day `key` of the week view in focus mode. */
  openFocus(key: string): void;
  isFocusOpen(): boolean;
  showView(view: MDCView): void;
  toggleBacklog(): void;
  toggleHolidays(): void;
  toggleSearch(): void;
  showHelp(): void;
  showOptions(): void;
  showSync(): void;
  showNewMenu(): void;
  openContact(index: number): void;
  showContacts(key: string, kind: MDCBadgeKind): void;
  showOverview(tab: "vacation" | "holidays", key: string): void;
  isContactsView(): boolean;
  notice(title: string, body: MDCNotificationBody): void;
  toggleMany(picks: MDCPick[]): void;
  removeMany(picks: MDCPick[]): void;
  copy(picks: MDCPick[]): void;
  cut(picks: MDCPick[]): void;
  /** Pastes into a day or a backlog place; without a target into the preselected day. */
  paste(target: MDCEntryRef | null): void;
  /** Opens the dialog for a new backlog entry with the tag of `group` preset. */
  newBacklogEntry(group: number): void;
  hasClipboard(): boolean;
  dayPicks(key: string): MDCPick[];
  moveMany(refs: MDCEntryRef[], dragged: MDCEntryRef, target: MDCEntryRef): void;
  moveMultiDay(index: number, start: string, end: string): void;
  newEntry(key?: string): void;
  openEntry(ref: MDCEntryRef): void;
  openOccurrence(index: number, key: string): void;
  openMultiDay(index: number): void;
  toggle(ref: MDCEntryRef): void;
  toggleOccurrence(index: number, key: string): void;
  move(from: MDCEntryRef, to: MDCEntryRef, placed: MDCPlacement[] | null): void;
  /** Places the occurrences of a day as dropped; `dragged` is the series of the dropped one. */
  placeOccurrences(key: string, placed: MDCPlacement[], dragged: number): void;
  moveGroup(from: number, to: number): void;
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

// Storage adapter and session: MD_Libs platform/storage and platform/session (see docs/Architecture.md#storage-adapter).
/** The version from package.json, inserted by the build (tools/build.js). */
declare const MDC_VERSION: string;

/** An opened folder, or why it could not be opened; `uninitialized` when it has no MD_Calendar.json. */
type MDCOpenResult = MDCStorageAdapter | "denied" | "missing" | "uninitialized";
type MDCOpenAttempt = { name: string; result: MDCOpenResult };

// MD_Calendar.json (see docs/DataFormat.md#md_calendarjson). Unknown fields are kept.
type MDCDevice = { id: string; name: string };
type MDCFolderState = {
  format: number;
  devices: Record<string, { name?: string; path?: string; lastOpened?: string; lastSaved?: string; lastSynced?: string; [key: string]: unknown }>;
  files: Record<string, { hash?: string; savedAt?: string; savedBy?: string; [key: string]: unknown }>;
  sync?: MDCSyncState;
  [key: string]: unknown;
};
/** The `sync` section (see docs/DataFormat.md#md_calendarjson). */
type MDCSyncState = {
  calendarId: string;
  /** Google's sync token of the last query; absent before the first synchronization and after Google rejected it */
  syncToken?: string;
  last?: MDCSyncLast;
  checked?: MDCSyncChecked;
  items: Record<string, MDCSyncItem>;
  /** Events of differences left open, read again on the next synchronization */
  open?: string[];
  journal: MDCSyncJournal | null;
  [key: string]: unknown;
};
type MDCSyncCounts = { toGoogle: number; toCalendar: number; skipped: number; failed: number };
type MDCSyncLast = MDCSyncCounts & { at: string; by: string };
/** The last check, kept apart from the last synchronization. */
type MDCSyncChecked = { at: string; by: string; differences: number };
/** What a check records; `inSync` only when it found no differences. */
type MDCSyncCheck = { differences: number; inSync?: { syncToken: string; items: Record<string, MDCSyncItem>; open: string[] } };
type MDCSyncKind = "entry" | "series" | "multi-day" | "day-off";
/** Fingerprints of the synchronized fields, by field name. */
type MDCSyncFields = Record<string, string>;
/** The state of the last synchronization of one item; `google` only after “Ignore”. */
type MDCSyncItem = { kind: MDCSyncKind; etag: string; calendar: MDCSyncFields; google?: MDCSyncFields };
/** The plan of a synchronization being applied (see docs/Architecture.md#journal). */
type MDCSyncJournal = {
  startedAt: string;
  by: string;
  /** Google's sync token of the check; recorded when the synchronization completes */
  syncToken: string;
  operations: MDCSyncOperation[];
  same: MDCSyncSame[];
  forgotten: string[];
  open: string[];
  skipped: number;
};
/** One difference to apply: its Google part, its local part and the state recorded once both are done. */
type MDCSyncOperation = {
  key: string;
  id: string;
  kind: MDCSyncKind;
  choice: MDCSyncChoice;
  title: string;
  state: "pending" | "done" | "failed" | "open";
  google?: { action: "insert" | "patch" | "restore" | "delete"; body?: Record<string, unknown>; etag?: string };
  local?: { action: "import" | "change" | "remove" | "unlink" | "link"; fields?: Record<string, string>; ref?: MDCSyncRef; match?: string };
  record: MDCSyncItem | null;
  error?: string;
  /** Why the operation was left open: changed-meanwhile, deleted-meanwhile, missing-locally */
  reason?: string;
};
// Sync dialog (see docs/ui/Shell.md#sync-dialog).
type MDCSyncRetry = "check" | "complete" | "overview" | "";
/** A titled group of facts in the overview of the sync dialog. */
type MDCSyncFactGroup = { title: string; facts: MDCSyncFact[] };
/** Label, value and an optional quieter second line, tinted by its tone. */
type MDCSyncFact = [label: string, value: string, detail?: string, tone?: "ok" | "warn"];
type MDCSyncStep = { label: string; state: string; count?: string; detail?: string };
type MDCSyncView =
  | { phase: "setup"; calendarId: string; steps: MDCSyncStep[] | null; cancellable: boolean }
  | { phase: "overview"; groups: MDCSyncFactGroup[]; unsaved: number; interrupted: { done: number; total: number } | null }
  | { phase: "checking"; steps: MDCSyncStep[]; notice: string }
  | { phase: "review"; differences: MDCSyncDifference[]; tags: MDCTag[] }
  | { phase: "applying"; differences: MDCSyncDifference[]; tags: MDCTag[]; states: Record<string, string>; progress: { done: number; total: number; label: string } }
  | { phase: "done"; counts: MDCSyncCounts; cancelled: boolean; failures: Array<{ title: string; reason: string }> }
  | { phase: "error"; title: string; message: string; code: string; detail: string; retry: MDCSyncRetry };
type MDCSyncDialogHandlers = {
  close(): void;
  overview(): void;
  setup(): void;
  connect(keyText: string, calendarId: string): void;
  check(): void;
  saveAndCheck(): void;
  complete(): void;
  cancel(): void;
  apply(choices: Record<string, MDCSyncChoice | null>): void;
};

// Comparison of the synchronization (see docs/Domain.md#comparison).
/** Where a local item stands: a day entry, a backlog entry, a multi-day entry or a series. */
type MDCSyncRef = MDCEntryRef | { multiDay: number } | { series: number };
type MDCSyncLocalItem = { id: string; kind: MDCSyncKind; fields: Record<string, string>; ref: MDCSyncRef };
/** An item with a sync ID that left the synchronized range locally. */
type MDCSyncAway = { reason: "backlog" | "no-time" | "before-cutover"; ref: MDCSyncRef };
type MDCSyncLocal = { items: Map<string, MDCSyncLocalItem>; fresh: MDCSyncLocalItem[]; away: Map<string, MDCSyncAway>; duplicates: string[] };
type MDCSyncRemote =
  | { state: "deleted" }
  | { state: "instance"; master: string }
  | { state: "entry" | "several-days" | "before-cutover" | "all-day" | "series"; fields: Record<string, string> };
type MDCSyncCase = "new-local" | "new-google" | "changed-local" | "changed-google" | "conflict" | "deleted-local" | "deleted-google" | "left-local" | "left-google" | "export-changed" | "note";
type MDCSyncChoice = "to-google" | "to-calendar" | "combine" | "keep" | "ignore" | "delete-google" | "delete-calendar";
type MDCSyncDifference = {
  /** Identifies the difference in a selection: the sync ID, or new:N for a new local item */
  key: string;
  /** The sync ID; "" for a new local item, which gets one when it is applied */
  id: string;
  kind: MDCSyncKind;
  case: MDCSyncCase;
  /** Why an item left the range or cannot be imported, or how an export changed in Google */
  reason?: string;
  /** Fields changed since the last synchronization, per side */
  changed?: { calendar: string[]; google: string[] };
  choices: MDCSyncChoice[];
  preselected: MDCSyncChoice | null;
  /** The values on each side; `google` is null when Google did not change and its values are not at hand */
  calendar: Record<string, string> | null;
  google: Record<string, string> | null;
  etag: string;
  ref: MDCSyncRef | null;
};
/** An item whose sides agree but whose recorded state is out of date. */
type MDCSyncSame = { id: string; kind: MDCSyncKind; calendar: MDCSyncFields; etag: string };
type MDCSyncComparison = { differences: MDCSyncDifference[]; same: MDCSyncSame[]; forgotten: string[]; duplicates: string[] };

// Google client (see docs/Architecture.md#synchronization-with-google).
type MDCGoogleKey = { clientEmail: string; privateKey: string };
type MDCGoogleErrorCode = "MDC-401" | "MDC-402" | "MDC-403" | "MDC-404" | "MDC-405" | "MDC-406" | "MDC-407";
type MDCGoogleError = Error & { code: MDCGoogleErrorCode; detail: string };
type MDCGoogleClientOptions = {
  key: MDCGoogleKey;
  calendarId: string;
  fetch?: typeof fetch;
  crypto?: Crypto;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
  /** Called with the seconds the client waits before it asks Google again. */
  onWait?: (seconds: number) => void;
};
type MDCGoogleClient = {
  authorize(signal?: AbortSignal): Promise<string>;
  probe(signal?: AbortSignal): Promise<{ timeZone: string; accessRole: string }>;
  get(id: string, signal?: AbortSignal): Promise<any>;
  changes(options?: { syncToken?: string; signal?: AbortSignal; onPage?: (count: number) => void }): Promise<{ expired: true } | { expired: false; events: any[]; syncToken: string }>;
  insert(event: Record<string, unknown> & { id: string }, signal?: AbortSignal): Promise<{ status: "created"; event: any } | { status: "exists" }>;
  patch(id: string, fields: Record<string, unknown>, etag: string, signal?: AbortSignal): Promise<{ status: "updated"; event: any } | { status: "changed" } | { status: "gone" }>;
  remove(id: string, signal?: AbortSignal): Promise<{ status: "deleted" }>;
};
/** What a completed synchronization records. */
type MDCSyncResult = { syncToken: string; items: Record<string, MDCSyncItem>; open: string[]; counts: MDCSyncCounts };
/** Local changes since the last synchronization, by what they do in Google. */
type MDCSyncLocalChanges = { added: number; changed: number; removed: number };

type MDCRecentFolder = { id: string; name: string; openedAt: number; info?: MDCFolderInfo };
/** What the start card shows of a folder, from its MD_Calendar.json. */
type MDCFolderInfo = { path: string; devices: number; savedBy: string };
type MDCStorageAdapter = import("@zang3th/md-libs/platform").storage.MDLStorageAdapter;
type MDCSession = import("@zang3th/md-libs/platform").session.MDLSession;

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
  /** ID of its Google event, absent when not synchronized (docs/DataFormat.md#sync-ids) */
  sync?: string;
};
/** An occurrence placed by hand: the series ID and the number of normal entries before it (docs/Domain.md#day-list-order). */
type MDCPin = { id: string; at: number };
/** An entry that went into its time slot and the placed occurrences (series IDs) that stay before it. */
type MDCSlotted = { entry: MDCEntry; stay: ReadonlySet<string> };
/** A placement as dropped on screen: the series index and the number of normal entries before it. */
type MDCPlacement = { series: number; at: number };
type MDCDay = {
  /** ISO date YYYY-MM-DD */
  key: string;
  entries: MDCEntry[];
  /** Occurrences placed by hand, in display order; replaced, never changed in place */
  pins: MDCPin[];
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
  /** Readable ID, set when an occurrence is placed by hand for the first time; "" without */
  id: string;
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
  /** ID of its Google event, absent when not synchronized (docs/DataFormat.md#sync-ids) */
  sync?: string;
};
type MDCMultiDay = { title: string; tag: string; start: string; end: string; location: string; note: string[]; extra: string[]; sync?: string };
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
type MDCFormatWarningKind = "missing-header" | "unknown-heading" | "invalid-date" | "unknown-line" | "outside-day" | "invalid-item" | "duplicate-sync" | "day-off-time";
type MDCFormatWarning = { lineNumber: number; kind: MDCFormatWarningKind; text: string };

/** An entry is addressed by its day (or backlog group) and its position in that list (see docs/DataFormat.md#entry-identity). */
type MDCEntryRef = { key: string; index: number; group?: number };
type MDCBacklogGroup = { name: string; entries: MDCEntry[]; extra: string[] };
/** `ungrouped`: entries before the first group; entry places address them as group -1. */
type MDCBacklog = { newline: string; head: string[]; ungrouped: MDCEntry[]; groups: MDCBacklogGroup[] };
type MDCHolidays = { holidays: Array<{ date: string; name: string }>; vacations: Array<{ start: string; end: string; name: string }> };
type MDCTag = { name: string; color: string; icon: string };
/** A period of the holiday overview; `dayOff` marks a day off among the vacations. */
type MDCPeriod = { start: string; end: string; title: string; dayOff?: boolean };

// Contacts (see docs/Domain.md#contact and docs/DataFormat.md#contacts).
type MDCLabelled = { label: string; value: string };
type MDCContact = {
  firstName: string;
  lastName: string;
  /** YYYY-MM-DD, --MM-DD without a year, or "" */
  birthday: string;
  phones: MDCLabelled[];
  emails: MDCLabelled[];
  addresses: MDCLabelled[];
  /** Date as an ISO key */
  anniversaries: Array<{ label: string; date: string }>;
  note: string[];
  /** Unknown lines preserved at the end of the contact */
  extra: string[];
};
type MDCContacts = {
  newline: string;
  /** Unknown lines and headings preserved after the file heading */
  head: string[];
  contacts: MDCContact[];
  /** Changes with every change; keys the birthday cache. */
  revision: number;
};
/** A birthday (empty label) or an anniversary of a contact; `year` is "" when unknown. */
type MDCBadgeKind = "anniversary" | "birthday" | "holiday";
type MDCOccasion = { index: number; name: string; label: string; year: string };
/** A coming birthday or anniversary of a contact; `years` is the age or the number of years, null when unknown. */
type MDCUpcoming = { index: number; kind: "birthday" | "anniversary"; label: string; date: string; days: number; years: number | null };
type MDCContactAction = MDCUndoAction & { days: string[]; contacts: true; selectAfter: number; selectBefore: number };

// Search (see docs/Domain.md#search).
type MDCSearchItem = {
  kind: "entry" | "series" | "multiDay" | "backlog";
  title: string;
  tag?: string;
  /** Location, note and tag, searched after the title */
  details: string;
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

// Undo history: MD_Libs core/history (see docs/Architecture.md#undo-history).
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
  /** Actions with the same key that follow each other directly become one undo step (MD_Libs history). */
  coalesce?: string;
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
/** A calendar action; `days` lists the day keys it changes. */
type MDCDayAction = MDCUndoAction & { days: string[] };
type MDCHistory = import("@zang3th/md-libs/core").history.MDLHistory<MDCUndoAction>;

