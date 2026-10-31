# Earthclique Engineer (Android)

Flutter app for field engineers: go online, get a ringing job request, accept, travel, start with the company's OTP, fix, close with the close OTP.

Not a pnpm workspace member. Contract: `apps/api/src/routes/engineer.ts`, `auth.ts`, `ws.ts` and `packages/shared`.

## Run against the local API

The API must be running on the Mac on port 4000 (`pnpm dev` at the repo root), with `SMS_PROVIDER=console` so the login OTP comes back as `devCode`.

### Android emulator

```sh
cd apps/engineer
flutter run                       # API_URL defaults to http://10.0.2.2:4000 (the host Mac)
```

The emulator's default GPS is in California, which is outside the seeded city. Move it next to the seeded demo engineer before going online (note: longitude first):

```sh
adb emu geo fix 72.5794 23.0345    # Ahmedabad, near SEED_LAT/SEED_LNG
```

Sign in with demo engineer `9000000001`. In debug builds the OTP field is pre-filled from the API's `devCode`.

### Physical phone on the same Wi-Fi

1. Find the Mac's LAN IP: `ipconfig getifaddr en0` (e.g. `192.168.1.20`).
2. The API already listens on `0.0.0.0`; make sure the macOS firewall allows incoming connections on port 4000.
3. Enable USB debugging on the phone, plug it in, then:

```sh
flutter run --dart-define=API_URL=http://192.168.1.20:4000
```

Cleartext HTTP is only allowed in debug builds (`android/app/src/debug/AndroidManifest.xml`). Release builds need an `https://` API.

## Dart defines

| Define | Default | Purpose |
|--------|---------|---------|
| `API_URL` | `http://10.0.2.2:4000` | API base URL. The WebSocket URL is derived from it (`ws(s)://…/ws?as=engineer`). |
| `FIREBASE_API_KEY` | — | Firebase Android API key |
| `FIREBASE_APP_ID` | — | Firebase Android app id (`1:…:android:…`) |
| `FIREBASE_SENDER_ID` | — | Cloud Messaging sender id (project number) |
| `FIREBASE_PROJECT_ID` | — | Firebase project id |

Firebase is only initialised when all four `FIREBASE_*` values are set. Without them the app gets rings over the WebSocket only, which means the app process must be alive.

## Enabling Firebase (FCM) later

1. In the Firebase console, add an Android app with package name `com.earthclique.amc_engineer`.
2. Copy the four values from the downloaded `google-services.json` (`api_key.current_key`, `mobilesdk_app_id`, `project_info.project_number`, `project_info.project_id`). The json file itself is not needed and the google-services Gradle plugin is deliberately not applied.
3. Put them in a local file, for example `firebase.json` (git-ignore it):

   ```json
   {
     "FIREBASE_API_KEY": "...",
     "FIREBASE_APP_ID": "...",
     "FIREBASE_SENDER_ID": "...",
     "FIREBASE_PROJECT_ID": "..."
   }
   ```

   and run `flutter run --dart-define-from-file=firebase.json`.
4. On the API, set `FIREBASE_SERVICE_ACCOUNT` (service account JSON) so it sends pushes.

After login the app posts its FCM registration token to `POST /engineer/fcm-token`. Rings arrive as high-priority data messages; a background handler shows the full-screen ringing notification even when the app is killed.

## How the ring works

- Foreground: `ring` over the WebSocket. Background or killed: FCM data message handled in `firebaseBackgroundHandler`.
- Either way a notification is posted on the `job_rings` channel: max importance, `category=call`, full-screen intent, the system ringtone, and `FLAG_INSISTENT` so the sound loops until it is answered, cancelled or expires (`timeoutAfter`).
- `MainActivity` sets `showWhenLocked` / `turnScreenOn`, so the full-screen intent opens the in-app ring screen over the lock screen.
- On launch, resume and every WebSocket reconnect the app calls `GET /engineer/offers/pending`, so a live ring is shown even if the push was missed.
- `ring.cancel` dismisses both the notification and the ring screen.

## Location

- Online and idle: `POST /engineer/location` every 60 s. Active job `EN_ROUTE`: every 10 s. Offline: nothing is tracked.
- Uses a geolocator foreground service (persistent "You are online" notification) with while-in-use location permission. `ACCESS_BACKGROUND_LOCATION` is not requested.

## Layout

```
lib/
  core/       api client, models, WebSocket, notifications, FCM, location, session, router, theme, shared UI
  features/   auth, onboarding (profile, KYC, waiting, permissions), home, ring, jobs, earnings, splash
```

## Known gaps / not working yet

- Not tested on a real device or with real FCM. The full-screen ring, lock-screen behaviour and OEM battery killers (Xiaomi, Oppo, Vivo) need checking on hardware.
- If the engineer swipes the app away while online, location heartbeats stop and the dispatcher drops them after 5 minutes (stale location), even though the server still shows them online.
- Without Firebase, nothing rings while the app process is dead.
- Android 14+: full-screen intents are only auto-granted to calling and alarm apps. If the engineer doesn't enable it, the ring falls back to a loud heads-up notification.
- Signing out deletes the device's FCM token, but the API has no endpoint to clear it server-side, so the server keeps a stale token until the next login.
- The ring notification has no Accept/Decline buttons; tapping it opens the ring screen.
- No offline cache: the app needs the network to show jobs.
- The release build is signed with the debug key, and the launcher icon is still the Flutter default.
- iOS is not set up (Android only, per spec §6.3).
