window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Undo history, adopted from MD_Manager domain/history.js (see docs/Architecture.md#undo-history).
// Added: the distance to the last saved state, which survives trimming and discarded redo branches.
(function (app) {
  const maxEntries = 100;
  const maxSize = 8 * 1024 * 1024;

  /** @param {MDCHistory} history */
  function discardRedo(history) {
    const discarded = history.entries.splice(history.index + 1);
    history.totalSize -= discarded.reduce((size, entry) => size + entry.size, 0);
    // The saved state was ahead on the discarded branch: it stays reachable only through the branch point.
    if (discarded.length && history.savedPosition > history.position) {
      history.savedDetour += history.savedPosition - history.position;
      history.savedPosition = history.position;
    }
  }

  /** @param {MDCHistory} history */
  function trim(history) {
    while (history.entries.length > 1 && (history.entries.length > maxEntries || history.totalSize > maxSize)) {
      const removed = history.entries.shift();
      if (removed) history.totalSize -= removed.size;
      history.index -= 1;
    }
  }

  app.history = {
    /** @returns {MDCHistory} */
    create() { return { entries: [], index: -1, totalSize: 0, position: 0, savedPosition: 0, savedDetour: 0 }; },
    /** @param {MDCHistory} history @param {MDCUndoAction} action @returns {boolean} */
    execute(history, action) {
      try { action.redo(); }
      catch (error) {
        try { action.undo(); } catch { /* Preserve the original action failure. */ }
        throw error;
      }
      discardRedo(history);
      const entry = { ...action, size: Math.max(0, action.size || 0) };
      history.entries.push(entry);
      history.index += 1;
      history.position += 1;
      history.totalSize += entry.size;
      trim(history);
      return true;
    },
    /** @param {MDCHistory} history @returns {MDCUndoEntry | null} */
    undo(history) {
      if (history.index < 0) return null;
      const entry = history.entries[history.index];
      entry.undo();
      history.index -= 1;
      history.position -= 1;
      return entry;
    },
    /** @param {MDCHistory} history @returns {MDCUndoEntry | null} */
    redo(history) {
      if (history.index >= history.entries.length - 1) return null;
      const entry = history.entries[history.index + 1];
      entry.redo();
      history.index += 1;
      history.position += 1;
      return entry;
    },
    /** Marks the state at `position` (default: the current one) as saved. @param {MDCHistory} history @param {number} [position] */
    markSaved(history, position = history.position) {
      history.savedPosition = position;
      history.savedDetour = 0;
    },
    /** Number of actions between the current state and the last saved state. @param {MDCHistory} history */
    unsaved(history) { return Math.abs(history.position - history.savedPosition) + history.savedDetour; },
    /** @param {MDCHistory} history */
    canUndo(history) { return history.index >= 0; },
    /** @param {MDCHistory} history */
    canRedo(history) { return history.index < history.entries.length - 1; },
    /** @param {MDCHistory} history */
    undoLabel(history) { return history.entries[history.index]?.label || ""; },
    /** @param {MDCHistory} history */
    redoLabel(history) { return history.entries[history.index + 1]?.label || ""; }
  };
})(window.MDCalendar);
