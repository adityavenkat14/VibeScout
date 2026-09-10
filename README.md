# VibeScout

A real-time, offline-first hyper-local discovery platform built for the ACM-W Broken Brief Hackathon.

## Key Assumptions & Resolving the Brief

The brief presented deliberate contradictions that we resolved through the following product and technical assumptions:

* **No Accounts vs. Persisting Saved Spots:** Rather than forcing email/password signups, we implemented **Anonymous Authentication**. Every visitor gets a unique persistent device UID. Saved spots are backed by server-side records tied to this identity, persisting across reloads without requiring onboarding friction.
* **Offline-First vs. Real-Time Social Magic:** We used a local IndexedDB cache alongside real-time Firestore listeners. Users can explore, post, and bookmark spots with zero reception; mutations queue locally and automatically sync the moment connection returns.
* **Crowd Trust & Recency:** To prevent stale or low-quality crowd submissions, posts fade after 3 hours. We introduced a **3-reaction "✓ Confirmed" verification badge** to let the community validate live spots organically.
* **Location Context:** Instead of battery-draining continuous GPS tracking, the app utilizes localized campus queries and Google Maps deep-links for immediate venue routing.
