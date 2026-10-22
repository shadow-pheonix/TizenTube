import { configRead, configChangeEmitter } from '../config.js';
import { QualityController } from './qualityController.js';

const controller = new QualityController({
    getPlayer: () => document.querySelector('.html5-video-player'),
    readConfig: configRead,
});
configChangeEmitter.addEventListener('configChange', (event) => {
    if (['preferredVideoQuality', 'preferHighestBitrate'].indexOf(event.detail.key) !== -1) {
        controller.configChanged();
    }
});
controller.start();
window.preferredVideoQualityHandler = controller;
