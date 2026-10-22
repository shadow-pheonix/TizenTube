import { availableQualities, bitrateLabel, qualityKey, selectQuality } from '../utils/videoQuality.js';
import { configRead } from '../config.js';
import { showModal, buttonItem, overlayPanelItemListRenderer, overlayMessageRenderer } from './ytUI.js';
import { t } from 'i18next';

export function qualitySettings() {
    const player = document.querySelector('.html5-video-player');
    const choices = availableQualities(player);
    const videoId = player?.getVideoData?.()?.video_id;
    const buttons = [];
    const addChoice = (title, subtitle, parameters) => buttons.push(buttonItem(
        { title, subtitle }, { icon: 'VIDEO_QUALITY' }, [
            { signalAction: { signal: 'POPUP_BACK' } },
            { customAction: { action: 'SET_PLAYER_QUALITY', parameters: { ...parameters, videoId } } },
        ]
    ));
    if (choices.length && videoId) {
        addChoice(t('player.quality.auto'), t('player.quality.autoSubtitle'), { mode: 'auto' });
        const best = selectQuality(choices, 'highest');
        addChoice(t('player.quality.highest'), t('player.quality.highestSubtitle', { quality: best.qualityLabel }), { mode: 'highest' });
        for (const choice of choices) {
            const bitrate = bitrateLabel(choice);
            const subtitle = bitrate
                ? t('player.quality.bitrate', { bitrate })
                : t('player.quality.bitrateUnavailable');
            addChoice(choice.qualityLabel, subtitle, { mode: 'variant', key: qualityKey(choice) });
        }
    } else {
        buttons.push(overlayMessageRenderer(t('player.quality.notReady')));
    }
    showModal({ title: t('player.quality.title'), subtitle: t('player.quality.subtitle') },
        overlayPanelItemListRenderer(buttons), 'tt-quality');
}

export function patchQualityMenu(items) {
    let replaced = false;
    for (const item of items) {
        const renderer = item?.compactLinkRenderer;
        if (renderer && ['VIDEO_QUALITY', 'HD', 'HIGH_QUALITY'].indexOf(renderer.icon?.iconType) !== -1) {
            renderer.serviceEndpoint = { customAction: { action: 'TT_QUALITY_SETTINGS_SHOW' } };
            replaced = true;
        }
    }
    if (!replaced) {
        items.unshift(buttonItem({ title: t('player.quality.title') }, { icon: 'VIDEO_QUALITY' },
            [{ customAction: { action: 'TT_QUALITY_SETTINGS_SHOW' } }]));
    }
}
