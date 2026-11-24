# Google Drive sync: one-time setup

The web version can keep characters in a "Character Sheets" folder in each player's Google Drive,
so the same characters appear on every device. It needs a free Google Cloud "OAuth client ID",
which tells Google which website is asking. This is done once by the owner of the site. Players
then just tap **Connect Google Drive**.

The app asks only for the **drive.file** permission: it can see and change only the files it
created itself, never anything else in a player's Drive. Google treats this as a non-sensitive
permission, so the app does not need Google's review to be used by anyone.

Google's screens get renamed from time to time; the steps below give the idea even if a label differs.

1. Go to https://console.cloud.google.com and sign in with your Google account.
2. Create a project (top bar, project picker, **New project**), for example "Character Sheet".
3. Turn on the Drive API: **APIs & Services**, **Library**, search **Google Drive API**, **Enable**.
4. Set up the sign-in screen: **APIs & Services**, **OAuth consent screen** (also called **Google Auth Platform**).
   - App name: Character Sheet. User support email and developer contact: your email.
   - Audience: **External**.
   - Data access (scopes): add `.../auth/drive.file`.
   - Then **Publish app** (Audience page). Left in "Testing", only test users you list can sign in, and their sign-in lapses after 7 days.
5. Create the client ID: **Clients** (or **Credentials**, **Create credentials**, **OAuth client ID**).
   - Application type: **Web application**.
   - Authorized JavaScript origins: `https://dheron.github.io` and, for testing on a computer, `http://localhost:1420`.
   - No redirect URIs are needed.
   - Copy the **Client ID** (it ends in `.apps.googleusercontent.com`). It is a public identifier, not a secret.
6. Give it to the web build: on GitHub, the repository's **Settings**, **Secrets and variables**, **Actions**,
   **Variables** tab, **New repository variable**: name `GOOGLE_CLIENT_ID`, value the Client ID.
7. Republish: **Actions**, **Web version**, **Run workflow** (or push any change).

After that the start screen of the web version shows **Connect Google Drive**.

## How syncing behaves

- Every save goes to Drive straight away while the player is signed in during that visit.
- Google gives a website a sign-in for about an hour and no lasting sign-in, so on a new visit the
  player taps **Sync now** once (Google remembers the consent, so the pop-up closes by itself).
- Without internet, saves stay on the device and go up at the next sync.
- If a character was changed on two devices, the newer save wins.
- Deleting a character deletes it everywhere at the next sync.
- To test on a computer: `VITE_GOOGLE_CLIENT_ID=<client id> npm run dev`.
