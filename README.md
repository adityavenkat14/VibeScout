## How It Works

1. Open the app — you're automatically assigned an anonymous device identity, no sign-up or login needed.
2. Add a discovery — pick a category (cafe, event, study spot, etc.), give it a title and short description, hit submit.
3. Your discovery is saved to Firestore and instantly pushed to everyone else's open tab/device via a real-time listener — no refresh required.
4. Browse and filter the feed by category to find what's nearby.
5. Lose your connection? The app keeps working off a local cache — anything you add while offline syncs automatically the moment you're back online.

## Tech Stack

| Layer | Tech | Purpose |
|---|---|---|
| Frontend | Vanilla JS + Vite | Renders the UI, handles form submissions and filtering |
| Database | Cloud Firestore | Stores discoveries as documents, real-time sync via `onSnapshot()` |
| Auth | Firebase Anonymous Auth | Silent per-device ID, no login screen |
| Offline support | Firestore persistent local cache (multi-tab) | Local IndexedDB cache, auto-syncs when reconnected |
| Hosting | Firebase Hosting | Public URL for deployment |
