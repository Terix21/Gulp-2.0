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
  mapRendererConsoleSeverity,
};