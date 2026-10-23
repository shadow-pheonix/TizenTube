import { showToast } from '../ui/ytUI.js';
import { configRead } from '../config.js';
import { t } from 'i18next';
import { prepareUpdate, RELEASES_URL } from '../utils/forkUpdates.js';

let inFlight = null;
let lastCheck = 0;
const CHECK_INTERVAL = 60 * 60 * 1000;

async function fetchMetadata(url) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 20000) : null;
    try {
        return await fetch(url, { cache: 'no-store', ...(controller ? { signal: controller.signal } : {}) });
    } finally { if (timer) clearTimeout(timer); }
}

export default function checkForUpdates(manual = false) {
    const bridge = window.h5vcc?.tizentube;
    if (!bridge?.GetVersion || !bridge?.GetArchitecture || !bridge?.InstallAppFromURL) return Promise.resolve(false);
    if (!manual && (!configRead('enableUpdater') || configRead('dontCheckUpdateUntil') > Date.now() / 1000)) return Promise.resolve(false);
    if (inFlight) return inFlight;
    lastCheck = Date.now();
    inFlight = (async () => {
        try {
            const response = await fetchMetadata(RELEASES_URL);
            if (!response.ok) throw new Error(`Update check failed (${response.status})`);
            const release = await response.json();
            const current = bridge.GetVersion();
            const command = await prepareUpdate(release, current, bridge.GetArchitecture(), fetchMetadata, manual);
            if (!command) {
                if (manual) showToast(t('settings.options.updater.upToDate.title'), t('settings.options.updater.upToDate.subtitle', { version: current }));
                return false;
            }
            // Android downloads and verifies the APK, then asks the user whether
            // to open the system package installer. This never silently installs.
            bridge.InstallAppFromURL(command);
            return true;
        } catch (error) {
            console.warn('[ForkUpdater] Update check failed:', error);
            if (manual) showToast(t('settings.options.updater.checkFailed.title'), t('settings.options.updater.checkFailed.subtitle'));
            return false;
        } finally { inFlight = null; }
    })();
    return inFlight;
}

setTimeout(() => checkForUpdates(), 2500);
setInterval(() => {
    if (document.visibilityState !== 'hidden') checkForUpdates();
}, CHECK_INTERVAL);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck >= 60 * 60 * 1000) checkForUpdates();
});
