import { useEffect, useState } from 'react';
import Modal from './Modal';
import { usePreferencesStore } from '../stores/preferencesStore';
import { useI18n } from '../i18n/useI18n';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * PWA install hint: Android `beforeinstallprompt` or iOS manual steps.
 */
export function InstallPrompt() {
  const { t } = useI18n();
  const dismissed = usePreferencesStore((s) => s.installDismissed);
  const dismiss = usePreferencesStore((s) => s.dismissInstallPrompt);
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState(null);

  useEffect(() => {
    if (dismissed || isStandalone()) return undefined;

    const timer = window.setTimeout(() => setOpen(true), 2200);

    function onBip(e) {
      e.preventDefault();
      setDeferred(e);
      setOpen(true);
    }

    window.addEventListener('beforeinstallprompt', onBip);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBip);
    };
  }, [dismissed]);

  async function handleInstall() {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    }
    setOpen(false);
    dismiss();
  }

  function handleDismiss() {
    setOpen(false);
    dismiss();
  }

  if (dismissed || isStandalone() || !open) return null;

  const ios = isIos();

  return (
    <Modal
      open={open}
      onClose={handleDismiss}
      title={t('install.title')}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={handleDismiss}>
            {t('install.dismiss')}
          </button>
          {!ios && (
            <button type="button" className="button button--primary" onClick={handleInstall}>
              {t('install.install')}
            </button>
          )}
        </>
      }
    >
      <p className="muted">{t('install.subtitle')}</p>
      <div className="install-steps glass-panel">
        <p>{ios ? t('install.ios') : t('install.android')}</p>
      </div>
    </Modal>
  );
}

export default InstallPrompt;
