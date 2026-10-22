import { availableQualities, qualityKey, selectQuality } from '../utils/videoQuality.js';

export class QualityController {
    constructor({ getPlayer, readConfig, now = () => Date.now() }) {
        this.getPlayer = getPlayer;
        this.readConfig = readConfig;
        this.now = now;
        this.player = null;
        this.videoId = null;
        this.manual = null;
        this.applied = null;
        this.forced = false;
        this.lastSet = 0;
        this.busy = false;
        this.listener = () => this.tick();
    }

    start() {
        const poll = () => {
            this.tick();
            this.timer = setTimeout(poll, 1000);
        };
        poll();
    }

    stop() {
        clearTimeout(this.timer);
        this.attach(null);
    }

    attach(player) {
        if (this.player === player) return;
        for (const event of ['onStateChange', 'onPlaybackQualityChange', 'onVideoDataChange']) {
            this.player?.removeEventListener?.(event, this.listener);
            player?.addEventListener?.(event, this.listener);
        }
        this.player = player;
        this.videoId = null;
        this.manual = null;
        this.applied = null;
        this.forced = false;
    }

    configChanged() {
        this.manual = null;
        this.applied = null;
        this.tick();
    }

    setManualQuality(parameters) {
        this.tick();
        if (!this.player || parameters.videoId !== this.videoId) return false;
        if (parameters.mode === 'auto' || parameters.mode === 'highest') {
            this.manual = { mode: parameters.mode };
            if (parameters.mode === 'auto') this.forced = true;
        } else {
            const choice = availableQualities(this.player).find(item => qualityKey(item) === parameters.key);
            if (!choice) return false;
            this.manual = { mode: 'variant', key: qualityKey(choice) };
        }
        this.applied = null;
        this.tick();
        return true;
    }

    tick() {
        if (this.busy) return;
        this.busy = true;
        try {
            this.attach(this.getPlayer());
            if (!this.player) return;
            const id = this.player.getVideoData?.()?.video_id;
            if (id !== this.videoId) {
                this.videoId = id;
                this.manual = null;
                this.applied = null;
            }
            if (!id || this.player.isInline?.()) return;
            const preference = this.manual?.mode || this.readConfig('preferredVideoQuality');
            if (!preference || preference === 'auto') {
                if (this.forced) {
                    this.player.setPlaybackQualityRange('tiny', 'highres');
                    this.player.setPlaybackQuality?.('auto');
                    this.forced = false;
                }
                return;
            }
            const choices = availableQualities(this.player);
            const selected = preference === 'variant'
                ? choices.find(choice => qualityKey(choice) === this.manual.key)
                : selectQuality(choices, preference, this.readConfig('preferHighestBitrate') !== false);
            if (!selected) return; // Retry when quality metadata arrives.
            const key = qualityKey(selected);
            const current = this.player.getPlaybackQuality?.();
            const downshifted = current && current !== selected.quality && current !== 'auto';
            if (this.applied === key && (!downshifted || this.now() - this.lastSet < 3000)) return;
            const pinFormat = preference === 'variant' || this.readConfig('preferHighestBitrate') !== false;
            if (pinFormat && selected.formatId != null) {
                this.player.setPlaybackQualityRange(selected.quality, selected.quality, selected.formatId);
            } else {
                this.player.setPlaybackQualityRange(selected.quality, selected.quality);
            }
            this.applied = key;
            this.forced = true;
            this.lastSet = this.now();
        } catch (error) {
            console.warn('[PreferredQuality] Failed to apply quality:', error);
        } finally {
            this.busy = false;
        }
    }
}
