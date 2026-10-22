# AMOLED / Pitch black theme

Open **TizenTube Settings → AMOLED / Pitch black theme** and enable the checkbox.
The choice is saved on the device and takes effect immediately, including on
newly opened pages and settings panels. Disable it to restore the navigation
and content colors previously chosen in Theme Configuration.

AMOLED uses `#000000` for page, navigation, search, and settings panel
backgrounds. Text, focus indicators, thumbnails, and video controls retain their
existing appearance. The video and picture-in-picture surfaces are not made
opaque.

## Build the feature bundle

```sh
cd mods
npm install
npm run build
```

The output is `dist/userScript.js`. The `amoled01` tag also includes an identical
release copy at `u.js`, used by the companion Android fork:
https://github.com/shadow-pheonix/TizenTubeCobalt/tree/feature/amoled-pitch-black

The Android build uses the official v2.0.3 native runtime and redirects its
userscript loader to this tagged bundle. It is repackaged and independently
signed; it is not a full native Chromium/Cobalt compilation. See the companion
fork's `tools/amoled/README.md` for the reproducible packaging command and
installation details.

## Browser checks

```sh
cd mods
npm ci
npx playwright install --with-deps chromium
npm run test:theme
```

The `Verify AMOLED theme` GitHub Actions workflow runs these checks and builds
the userscript, then checks that the committed `u.js` matches the result.
