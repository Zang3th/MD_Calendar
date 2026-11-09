// Global namespace shared by the classic scripts (see docs/Architecture.md#runtime).
// Layers add their members here as they are implemented.
interface MDCalendarNamespace {}

interface Window {
  MDCalendar: MDCalendarNamespace;
}

// Vendored libraries loaded as classic scripts (see vendor/README.md).
// Only the members in use are declared; extend as needed.
declare const dayjs: {
  extend(plugin: unknown): void;
  locale(name?: string): string;
};
declare const dayjs_plugin_isoWeek: unknown;
declare const dayjs_plugin_customParseFormat: unknown;
