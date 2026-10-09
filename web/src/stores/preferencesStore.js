import { create } from 'zustand';

const STORAGE_KEY = 'sm.prefs';

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writePrefs(partial) {
  const next = { ...readPrefs(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
}

const boot = readPrefs();
applyTheme(boot.theme || 'dark');
document.documentElement.lang = (boot.locale || 'mn') === 'en' ? 'en' : 'mn';

export const usePreferencesStore = create((set, get) => ({
  theme: boot.theme || 'dark',
  locale: boot.locale || 'mn',
  alertsEnabled: boot.alertsEnabled === true,
  installDismissed: boot.installDismissed === true,

  setTheme(theme) {
    writePrefs({ theme });
    applyTheme(theme);
    set({ theme });
  },

  toggleTheme() {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark');
  },

  setLocale(locale) {
    writePrefs({ locale });
    document.documentElement.lang = locale === 'en' ? 'en' : 'mn';
    set({ locale });
  },

  setAlertsEnabled(alertsEnabled) {
    writePrefs({ alertsEnabled });
    set({ alertsEnabled });
  },

  dismissInstallPrompt() {
    writePrefs({ installDismissed: true });
    set({ installDismissed: true });
  },
}));
