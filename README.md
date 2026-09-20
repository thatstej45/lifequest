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
4. Compiles and uploads an unsigned iOS simulator app to validate the native iOS project

After the APK that includes the live-update plugin is installed once, later UI/logic pushes update the phone automatically the next time the app is opened (or brought back to the foreground). Native changes (new plugins, permissions, icons) still need a fresh APK install.

## Native iPhone app

The native Capacitor project lives in `ios-native/`. Native iOS is required for
reliable scheduled quest reminders while LifeQuest is backgrounded or closed;
the home-screen web app cannot provide that behavior without a remote Web Push
service.

1. `npm install`
2. `npm run ios:sync`
3. `npm run ios:open`
4. Select an Apple development team and a physical iPhone in Xcode, then Run

Quest reminders are scheduled on-device, so they do not require a push server.
iOS delivers them to Notification Center even when the app is not running.
TestFlight/App Store distribution still requires Apple signing credentials and
an App Store Connect app for bundle ID `com.lifequest.app`.

Every push to `main` also builds the iOS app for the simulator in CI. That
unsigned simulator artifact validates the native project but cannot be installed
on a physical iPhone.

## Optional iPhone home-screen web app

The web app can still be installed from Safari via **Share → Add to Home
Screen**. It runs full-screen and offline, but use the native app when reliable
background notifications are required.

Repo **Settings → Pages** must be set to deploy from the `gh-pages` branch (root) for this URL to work. The build uses relative asset paths, so it runs from the `/lifequest/` project path as well as a custom domain.
