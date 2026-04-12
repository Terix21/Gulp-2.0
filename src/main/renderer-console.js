function isRendererConsoleMessagePayload(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return (
    Object.prototype.hasOwnProperty.call(value, 'message')
    || Object.prototype.hasOwnProperty.call(value, 'level')
    || Object.prototype.hasOwnProperty.call(value, 'line')
    || Object.prototype.hasOwnProperty.call(value, 'lineNumber')
    || Object.prototype.hasOwnProperty.call(value, 'sourceId')
  );
}

function normalizeRendererConsoleMessageArgs(args = []) {
  const [eventOrPayload, levelOrPayload, message, line, sourceId] = args;

  // New Electron shape: (event, payload) — detect by inspecting the second arg type
  if (isRendererConsoleMessagePayload(levelOrPayload)) {
    return {
      level: levelOrPayload.level,
      message: levelOrPayload.message,
      line: Number.isFinite(levelOrPayload.lineNumber) ? levelOrPayload.lineNumber : levelOrPayload.line,
      sourceId: levelOrPayload.sourceId,
    };
  }

  // Single-arg or no-event shape: (payload) — second arg already ruled out above; check first
  if (isRendererConsoleMessagePayload(eventOrPayload)) {
    return {
      level: eventOrPayload.level,
      message: eventOrPayload.message,
      line: Number.isFinite(eventOrPayload.lineNumber) ? eventOrPayload.lineNumber : eventOrPayload.line,
      sourceId: eventOrPayload.sourceId,
    };
  }

  // Legacy shape: (event, level, message, line, sourceId)
  return {
    level: levelOrPayload,
    message,
    line,
    sourceId,
  };
}

function mapRendererConsoleSeverity(level) {
  if (typeof level === 'number' && Number.isFinite(level)) {
    // Electron numeric levels: 0=verbose, 1=info, 2=warning, 3=error
    switch (level) {
      case 2:
        return 'warn';
      case 3:
        return 'error';
      case 0:
      case 1:
      default:
        return 'info';
    }
  }

  const normalizedLevel = String(level || '').trim().toLowerCase();
  if (normalizedLevel === 'warning' || normalizedLevel === 'warn') {
    return 'warn';
  }
  if (normalizedLevel === 'error') {
    return 'error';
  }
  if (
    normalizedLevel === 'debug'
    || normalizedLevel === 'verbose'
    || normalizedLevel === 'trace'
  ) {
    return 'debug';
  }

  return 'info';
}

module.exports = {
  isRendererConsoleMessagePayload,
  normalizeRendererConsoleMessageArgs,
  mapRendererConsoleSeverity,
};