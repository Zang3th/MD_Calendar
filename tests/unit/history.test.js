const assert = require("node:assert/strict");
const test = require("node:test");
const load = require("./load-classic");

const { history } = load("domain/history.js");

/** @param {number[]} log @param {number} value */
function action(log, value) {
  return { label: `#${value}`, redo() { log.push(value); }, undo() { log.splice(log.lastIndexOf(value), 1); } };
}

test("undo and redo replay actions and expose labels", () => {
  /** @type {number[]} */
  const log = [];
  const state = history.create();
  history.execute(state, action(log, 1));
  history.execute(state, action(log, 2));
  assert.equal(history.undoLabel(state), "#2");
  history.undo(state);
  assert.deepEqual(log, [1]);
  assert.equal(history.redoLabel(state), "#2");
  history.redo(state);
  assert.deepEqual(log, [1, 2]);
  assert.equal(history.canRedo(state), false);
});

test("the unsaved count is the distance to the saved state, also after a discarded branch", () => {
  /** @type {number[]} */
  const log = [];
  const state = history.create();
  history.execute(state, action(log, 1));
  history.execute(state, action(log, 2));
  history.markSaved(state);
  assert.equal(history.unsaved(state), 0);
  history.undo(state);
  history.undo(state);
  assert.equal(history.unsaved(state), 2);
  history.redo(state);
  assert.equal(history.unsaved(state), 1);
  history.execute(state, action(log, 3));
  assert.equal(history.unsaved(state), 2, "undoing #3 and redoing the discarded #2 would reach the saved state");
  history.undo(state);
  assert.equal(history.unsaved(state), 1);
});

test("the history is capped by entry count without losing the unsaved count", () => {
  /** @type {number[]} */
  const log = [];
  const state = history.create();
  for (let value = 0; value < 120; value += 1) history.execute(state, action(log, value));
  assert.equal(state.entries.length, 100);
  assert.equal(history.unsaved(state), 120);
});
