<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# LifeQuest

React + Vite life RPG. The `feature/android-sideload` branch wraps the same app with Capacitor so you can install a debug APK on a phone without the Play Store.

## Run locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Set `GEMINI_API_KEY` in `.env.local`
3. Run: `npm run dev`

## Sideload on Android

This is the existing web app inside a native WebView, not a second React project.

**Prerequisites:** JDK 21 (not 26) and the Android SDK. `npm run android:apk` looks for JDK 21 at `~/.local/jdk-21` and the SDK at `~/Library/Android/sdk`.

1. `npm install`
2. `npm run android:sync` — builds the web app and copies it into `android/`
3. Open the native project: `npm run android:open`
4. In Android Studio, pick your USB device (or an emulator) and press Run

To build an APK you can copy onto the phone:

```bash
npm run android:apk
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Transfer it to the device and open it, or install over USB:

```bash
~/Library/Android/sdk/platform-tools/adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The first sideload requires allowing **Install unknown apps** for Files or Chrome. Debug APKs are signed with the default Android debug key, which is enough for personal devices.

## GitHub + automatic phone updates

The app repo is [thatstej45/lifequest](https://github.com/thatstej45/lifequest). Every push to `main` runs `.github/workflows/release-mobile.yml`, which:

1. Builds the web app
2. Publishes the built app **and** an OTA bundle on the `gh-pages` branch, so
   `https://thatstej45.github.io/lifequest/` is the live app and
   `https://raw.githubusercontent.com/thatstej45/lifequest/gh-pages/update.json` is the Android update channel
3. Builds a debug APK artifact you can sideload when native code changes

After the APK that includes the live-update plugin is installed once, later UI/logic pushes update the phone automatically the next time the app is opened (or brought back to the foreground). Native changes (new plugins, permissions, icons) still need a fresh APK install.

## Install on iPhone as a PWA

LifeQuest uses the Home Screen PWA path on iPhone, with no Apple Developer
membership or seven-day expiry:

1. Use iOS/iPadOS 16.4 or newer.
2. Open `https://thatstej45.github.io/lifequest/` in Safari.
3. Tap **Share → Add to Home Screen → Add**.
4. Launch LifeQuest from its new Home Screen icon, not from a Safari tab.
5. Open Profile/Settings and tap **Enable notifications**.
6. Tap **Test** and background or lock the phone.

Apple supports standards-based Web Push for installed Home Screen apps. It does
not require an Apple Developer account, but background reminders do require a
server to send each push. This repository includes a Cloudflare Worker + D1
scheduler in `push-worker/`; both services have free tiers. Follow
`push-worker/README.md` for the one-time deployment.

Without the push worker, reminders still appear while LifeQuest is open, but
iOS cannot wake a closed PWA at a future local time by itself.

Repo **Settings → Pages** must be set to deploy from the `gh-pages` branch (root) for this URL to work. The build uses relative asset paths, so it runs from the `/lifequest/` project path as well as a custom domain.
