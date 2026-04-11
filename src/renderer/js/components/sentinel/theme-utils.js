function resolveThemeId(explicitThemeId) {
  if (explicitThemeId) {
    return String(explicitThemeId);
  }

  if (typeof document !== 'undefined' && document.documentElement) {
    const fromDom = document.documentElement.getAttribute('data-sentinel-theme-id');
    if (fromDom) {
      return String(fromDom);
    }
  }

  return 'dark-steel';
}

function isDarkTheme(explicitThemeId) {
  return resolveThemeId(explicitThemeId).startsWith('dark-');
}

function getMonacoTheme(explicitThemeId) {
  return isDarkTheme(explicitThemeId) ? 'vs-dark' : 'vs';
}

function getStatusTextColor(statusType, explicitThemeId) {
  const normalized = String(statusType || 'default').toLowerCase();

  if (normalized === 'error') {
    return 'severity.critical';
  }

  if (normalized === 'warning') {
    return 'severity.high';
  }

  if (normalized === 'success') {
    return isDarkTheme(explicitThemeId) ? 'green.300' : 'green.700';
  }

  if (normalized === 'info') {
    return 'severity.info';
  }

  return 'fg.default';
}

function getOverlayScrim(explicitThemeId) {
  return isDarkTheme(explicitThemeId)
    ? 'rgba(5, 10, 16, 0.65)'
    : 'rgba(232, 238, 247, 0.82)';
}

export {
  isDarkTheme,
  getMonacoTheme,
  getStatusTextColor,
  getOverlayScrim,
};
