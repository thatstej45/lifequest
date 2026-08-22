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
2. Publishes an OTA bundle to GitHub Pages (`https://thatstej45.github.io/lifequest/`)
3. Builds a debug APK artifact you can sideload when native code changes

After the APK that includes the live-update plugin is installed once, later UI/logic pushes update the phone automatically the next time the app is opened (or brought back to the foreground). Native changes (new plugins, permissions, icons) still need a fresh APK install.
