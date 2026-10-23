# Android video upscaler

Open **TizenTube Settings → Video Player Settings → Video upscaler (SGSR1)**.
The first supporting APK is **v2.0.3-amoled.5**. Older APKs and non-Android
userscript installations do not show the control.

- **Auto** (default): use SGSR1 for eligible SDR video smaller than its output
  surface. Reduce processing to bilinear if repeated renderer stalls occur.
- **Quality**: keep SGSR1 enabled for eligible upscales, without the stall guard.
- **Off**: use the normal decoder output on the next video.

The choice is saved. Start the next video after changing it. An already attached
renderer can change its shader immediately, but changing from direct output to
SGSR1, or fully removing the extra render surface, requires the next decoder.
Native-resolution frames and downscales use bilinear within an attached renderer.
HDR/BT.2020, encrypted/secure, tunneled, and decode-to-texture/preview paths bypass
the upscaler. Unsupported GPU initialization falls back to direct output.

Keep your preferred resolution at the best quality your device/network supports.
The upscaler never lowers the requested stream resolution or changes bitrate
selection. Native 2160p remains preferable to reconstructing a lower-resolution
stream. SGSR1 improves edge reconstruction when enlargement is needed; it cannot
restore missing original detail.

## Research and choice

| Open-source option | Android evidence and processing | Fit here |
| --- | --- | --- |
| [Qualcomm SGSR1](https://github.com/SnapdragonGameStudios/snapdragon-gsr/tree/main/sgsr/v1) | Mobile GLSL, one pass, 12-tap edge-aware scaling and sharpening; BSD-3-Clause | Chosen for a general video player with a small memory/bandwidth budget. Adreno optimized; this fork's portable OES adaptation can run on other GLES GPUs. |
| [AMD FSR1](https://gpuopen.com/manuals/fidelityfx_sdk/techniques/super-resolution-spatial/) | Spatial EASU and RCAS passes, no motion vectors | Strong alternative, but adds a second pass and an intermediate image in the straightforward integration. |
| [Anime4K](https://github.com/bloc97/Anime4K), [mpv-android-anime4k](https://github.com/azxcvn/mpv-android-anime4k), [Sakuro](https://github.com/LinDevHard/sakuro) | Existing Android players demonstrate shader-based upscaling | Optimized for anime; shader graphs/player backends are not drop-in Cobalt renderers. |
| [Real-ESRGAN Android/NCNN deployment](https://github.com/IbrahimGhadre/realesrgan-mobile) | Android neural image enhancement with model inference | Requires a much larger inference pipeline; no established efficiency advantage for this app's continuous high-resolution video. |
| [Arm ASR](https://github.com/arm/accuracy-super-resolution) / SGSR2 | Temporal game reconstruction | Needs game rendering inputs absent from decoded YouTube video; unsuitable as a direct decoder filter. |

SGSR1 is our best integration fit, not a claim that it wins every perceptual-quality
benchmark or runs fastest on every Android TV. Qualcomm's published Snapdragon
timings describe their own configurations, not this app or the user's device.
No physical-device FPS, battery or 4K60 benchmark is claimed.

The Cobalt fork contains the renderer, pinned upstream shader/license, comparison
notes and Android decoder/GPU smoke checks under `tools/amoled/`. It samples the
decoder's external texture directly in one pass; there is no CPU readback, neural
model download or full-size intermediate image. YouTube controls/subtitles remain
in the original UI path. The final EGL presentation receives the decoder's scheduled
timestamp to preserve the player's audio/video clock.
