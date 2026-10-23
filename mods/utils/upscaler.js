// First native SGSR1 build. Earlier APKs use the same JNI method for APK URLs.
export function supportsUpscaler(bridge) {
    if (!bridge || typeof bridge.GetVersion !== 'function' || typeof bridge.InstallAppFromURL !== 'function') return false;
    try {
        const match = /^v?(\d+)\.(\d+)\.(\d+)-amoled\.(\d+)$/.exec(bridge.GetVersion());
        if (!match) return false;
        const version = match.slice(1).map(Number);
        return version[0] > 2 || (version[0] === 2 && (version[1] > 0 || version[2] > 3 || (version[2] === 3 && version[3] >= 5)));
    } catch (_) { return false; }
}

export function upscalerCommand(mode) {
    return `tizentube://upscaler/${['off', 'auto', 'quality'].indexOf(mode) >= 0 ? mode : 'off'}`;
}
