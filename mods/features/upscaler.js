import { configRead, configChangeEmitter } from '../config.js';
import { supportsUpscaler, upscalerCommand } from '../utils/upscaler.js';

function synchronize() {
    const bridge = window.h5vcc?.tizentube;
    if (supportsUpscaler(bridge)) bridge.InstallAppFromURL(upscalerCommand(configRead('videoUpscaler')));
}

synchronize();
configChangeEmitter.addEventListener('configChange', (event) => {
    if (event.detail.key === 'videoUpscaler') synchronize();
});
