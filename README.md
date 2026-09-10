# VibeScout

Live: https://vibe-scout-alpha.vercel.app

## Assumptions made to resolve the brief's contradictions (~180 words)

**"No accounts" + "saved list follows you around, once logged in":** resolved with Firebase Anonymous Auth. Every device gets a silent, persistent identity with zero sign-up screen — saved spots live in Firestore under that identity (`users/{uid}/saved`), so they survive reloads and reinstall-free reopens on the same device, without ever asking for an email or password.

**"Works great with no signal" + "live updates from nearby friends":** Firestore's `persistentLocalCache` (multi-tab) handles both — the feed reads from local cache first (instant, offline-safe) and reconciles with the server the moment connectivity returns, no manual sync logic needed. Adding a discovery, saving a spot, and reacting all queue safely offline.

**"Social and current" was under-specified**, so we added live reaction counts (atomic `increment()`, safe under concurrent taps) and an auto "✓ Confirmed" badge once a spot gets 3+ reactions — crowd-verification instead of one person's word, which felt closer to "social" than a static post.

**Scope**: campus-first (BITS Dubai), since "nearby" needs some real seed density to demo convincingly — architecture generalizes to any location.

## How It Works

1. Open the app — silent anonymous identity assigned, no login.
2. Post a discovery — title, venue, category — instantly live for everyone nearby via `onSnapshot()`.
3. React (🔥) to confirm something's real; 3+ reactions auto-tags it "Confirmed."
4. Save spots you like — synced via Firestore, not localStorage, so they're safe across reloads.
5. Offline? Everything above still works and queues silently until reconnected.

## Tech Stack

| Layer | Tech | Purpose |
|---|---|---|
| Frontend | Vanilla JS + Vite | UI, rendering, filtering |
| Database | Cloud Firestore | Discoveries, reactions, saved spots — all live via `onSnapshot()` |
| Auth | Firebase Anonymous Auth | Silent per-device identity, no login screen |
| Offline support | Firestore `persistentLocalCache` (multi-tab) | Local cache, auto-syncs on reconnect |
| Security | `firestore.rules` | Users can only write their own saves/reactions |
| Hosting | Vercel | Public deployment |
