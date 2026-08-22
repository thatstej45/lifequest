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

**Prerequisites:** [Android Studio](https://developer.android.com/studio) (installs the JDK, Android SDK, and platform tools). Enable **Developer options** and **USB debugging** on the phone.

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
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The first sideload requires allowing **Install unknown apps** for Files or Chrome. Debug APKs are signed with the default Android debug key, which is enough for personal devices.

After changing the React UI, run `npm run android:sync` again (or rebuild from Android Studio) so the native shell picks up the new `dist/` assets.
