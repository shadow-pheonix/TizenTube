# Video quality and default resolution

Open **TizenTube Settings → Video Player Settings → Default resolution**.
Choose **2160p** to request 2160p on every video that offers it. If unavailable,
the app chooses the highest playable resolution below 2160p: for example, 1440p
or 1080p. It does not jump to 4320p when 2160p is missing. **Highest available**
uses the highest playable resolution without a fixed limit; **Auto** restores
YouTube's adaptive quality selection.

The preference is saved across restarts and reapplied when videos change, when
the player is replaced, or when quality metadata arrives late. Inline previews
are excluded. Manual quality choices apply only to the current video; the next
video returns to the saved default.

The playback gear's **Video quality** menu shows all playable qualities reported
by the player, including resolutions above 2160p when offered. It also includes
**Auto** and **Highest available**. Bitrates are video stream metadata reported
by YouTube, not measured network speed. An exact format's bitrate is displayed
when known. A tier without format metadata is labeled unavailable rather than
estimated from resolution or from another stream.

**Prefer highest bitrate**, enabled by default, selects the highest reported
bitrate among playable variants at the chosen resolution. If the player exposes
a specific format ID it is passed to the quality API. Otherwise only the
resolution is pinned and YouTube chooses the encoding. Account restrictions,
device decoding support, and YouTube's available formats still apply; the app
does not unlock unsupported or paywalled streams.

Checks: `npm run test:quality`, `npm run test:quality:browser`, and `npm run
test:theme` from `mods/`. Browser tests run on GitHub Actions with Chromium.
