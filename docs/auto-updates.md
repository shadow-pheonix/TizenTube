# Fork updates

Install the APK with the native fork updater once to enable this flow. Earlier
APKs pin an older feature bundle and cannot acquire the new updater themselves.
After that, **Automatically download fork updates** is enabled by default in
**TizenTube Settings → TizenTube Cobalt Updater**. It checks this fork's latest
stable release at startup, hourly while the app is open, and when returning to
the app after an hour. It does not run while the app is closed.

The app downloads the APK for its installed architecture and verifies its size,
SHA-256 digest, package identity, fork version, architecture, and signing
certificate. It then asks **Install** or **Later**. Install opens Android's
package installer, where the user confirms the update. Installation is never
silent. Android may first require **Allow installs from this app**; the updater
returns to the installer after that permission is granted.

**Later** keeps the verified download and postpones automatic prompts for a day.
**Check for updates** is always available for a manual retry, even when automatic
checks are disabled, and reuses a matching verified cached APK. Failed downloads
are not offered for installation.

The installed version includes the fork revision, such as `v2.0.3-amoled.4`.
Comparisons include that revision, so feature-only releases are detected and the
installed release is not offered repeatedly.
