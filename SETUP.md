# Setup

Everything below happens outside the code — one-time setup on your side. Once done, drop the values into `.env.local` for local dev, and into Vercel's Environment Variables for production.

## 1. Weather — Open-Meteo

No signup. Just need your home coordinates:

- `HOME_LAT` / `HOME_LON` — get these from Google Maps: right-click your home → the lat/lon shows at the top of the context menu.

## 2. Commute — TomTom

1. Sign up at https://developer.tomtom.com/ (free, no credit card).
2. Create an app → copy the API key → `TOMTOM_API_KEY`.
3. `HOME_COORDS` / `WORK_COORDS` as `"lat,lon"` strings (same coordinate lookup as above). Work is the Pelion building in Draper, UT.

## 3. Calendar — Google (two accounts)

You need one OAuth client, authorized against both Google accounts, giving you two refresh tokens.

1. Go to https://console.cloud.google.com/ → create a project (or reuse one).
2. **APIs & Services → Library** → enable "Google Calendar API".
3. **APIs & Services → OAuth consent screen** → External → fill in the minimum (app name, your email) → add your own Google account(s) as test users if it stays in "Testing" mode (that's fine for personal use).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → type "Web application" → add `https://developers.google.com/oauthplayground` as an authorized redirect URI. Copy the client ID/secret → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. Go to https://developers.google.com/oauthplayground →  gear icon (top right) → check "Use your own OAuth credentials" → paste your client ID/secret.
6. In the left panel, find "Google Calendar API v3" → select the `https://www.googleapis.com/auth/calendar.readonly` scope → Authorize APIs → sign in with your **work** Google account → allow.
7. Click "Exchange authorization code for tokens" → copy the **Refresh token** → `GOOGLE_WORK_REFRESH_TOKEN`.
8. Repeat steps 6–7 signed in as your **personal** Google account → `GOOGLE_PERSONAL_REFRESH_TOKEN`.

Refresh tokens don't expire under normal use, so this is a one-time setup per account.

## 4. Garmin (optional, lowest priority)

No official personal API. Options, in order of effort:

- Skip it — the dashboard renders fine without `GARMIN_STATS_URL` set.
- Point `GARMIN_STATS_URL` at any endpoint that returns JSON like `{"steps":8000,"restingHeartRate":52,"sleepHours":7.5,"bodyBattery":68}` — e.g. a small scheduled script using a community tool (such as `garmin-givemydata`) that writes to a Gist, S3 bucket, or similar, run on a schedule outside of this app.

## 5. Deploy

1. Push this repo to GitHub.
2. Go to https://vercel.com → import the GitHub repo.
3. In the Vercel project's **Settings → Environment Variables**, add every variable from `.env.example`.
4. Deploy. Note the resulting URL.

## 6. Fire TV kiosk

1. On the Fire TV, install "Fully Kiosk Browser" (via Amazon Appstore, or sideload if unavailable).
2. Point it at your deployed Vercel URL, enable kiosk/full-screen mode.

## 7. Alexa Routine

1. In the Alexa app, create a Routine.
2. Trigger: scheduled time (e.g. 6:30 AM weekdays).
3. Actions: turn on the TV, then launch the Fully Kiosk Browser app (via a smart plug + HDMI-CEC, or an Alexa-compatible TV/Fire TV device action, depending on your setup).
