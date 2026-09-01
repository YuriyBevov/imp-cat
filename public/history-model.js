(function exposeHistoryModel(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ICATHistory = api;
}(typeof globalThis !== "undefined" ? globalThis : window, () => {
  function create(limit = 100) {
    return {
      entries: [],
      limit: Math.max(1, Math.round(Number(limit) || 100)),
    };
  }

  function record(history, before, after, label, signature = JSON.stringify) {
    if (signature(before) === signature(after)) return false;
    history.entries.push({ label, snapshot: before });
    if (history.entries.length > history.limit) history.entries.shift();
    return true;
  }

  function undo(history) {
    return history.entries.pop() || null;
  }

  function clear(history) {
    history.entries.length = 0;
  }

  return { create, record, undo, clear };
}));
