import "./style.css";
import { watchDiscoveries, addDiscovery, watchSavedIds, toggleSaved, toggleReaction } from "./firebase.js";

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
};

let state = {
  tab: "discover",
  filter: "For you",
  online: navigator.onLine,
  loading: true, // true until the first Firestore snapshot arrives
  discoveries: [], // now populated live from Firebase, not seeded locally
  savedIds: new Set(), // populated live from users/{uid}/saved in Firestore — follows this device's identity
  liked: new Set(store.get("vibescout-liked", [])), // "did I tap the reaction button" — local UI convenience only
  toast: ""
};

const app = document.querySelector("#app");
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function persist() {
  // Only the "did I tap like" convenience set stays local — saved spots and
  // discoveries both live in Firestore now, so they survive reinstalls/tabs.
  store.set("vibescout-liked", [...state.liked]);
}

function timeAgo(timestamp) {
  if (!timestamp?.toDate) return null;
  const minutes = Math.max(0, Math.round((Date.now() - timestamp.toDate().getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function isFading(timestamp) {
  if (!timestamp?.toDate) return false;
  return (Date.now() - timestamp.toDate().getTime()) / 60000 > 180; // fades after 3 hours
}

function showToast(message) {
  state.toast = message;
  render();
  window.setTimeout(() => { state.toast = ""; render(); }, 2600);
}

function favouriteIcon(id) {
  return state.savedIds.has(id) ? "♥" : "♡";
}

// --- Photo helpers -----------------------------------------------------
// We store photos as compressed base64 data URLs directly on the Firestore
// document (no Firebase Storage, which now requires a billing account).
// Firestore documents cap out at 1MB, so we resize + compress client-side,
// and retry smaller if the first pass is still too big.
async function encodeImage(file, maxWidth, quality) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function compressAndEncode(file) {
  if (!file || !file.size) return null;
  let dataUrl = await encodeImage(file, 900, 0.75);
  if (dataUrl.length > 700_000) dataUrl = await encodeImage(file, 600, 0.5); // still too big — shrink harder
  return dataUrl;
}

function clearPhotoPreview() {
  const input = document.getElementById("add-photo-input");
  const preview = document.getElementById("photo-preview");
  if (input) input.value = "";
  if (preview) preview.innerHTML = "";
}

function card(item) {
  const saved = state.savedIds.has(item.id);
  const liked = state.liked.has(item.id);
  const reactionCount = item.reactionCount || 0;
  const confirmed = reactionCount >= 3;
  const fresh = timeAgo(item.createdAt) || item.time || "Just now";
  const fading = isFading(item.createdAt);
  return `<article class="vibe-card ${item.accent || "orange"} ${fading ? "is-fading" : ""}">
    <div class="card-visual ${item.photoURL ? "has-photo" : ""}">${item.photoURL ? `<img class="card-photo" src="${item.photoURL}" alt="${escapeHtml(item.title)}" />` : `<span>${item.emoji || "✨"}</span>`}<div class="visual-glow"></div><span class="live-pill">${fresh}</span>${confirmed ? `<span class="confirmed-pill">✓ Confirmed</span>` : ""}</div>
    <div class="card-body">
      <div class="card-meta"><span>${item.category}</span><span>•</span><span>${item.distance || "Near you"}</span></div>
      <div class="card-title-row"><h3>${escapeHtml(item.title)}</h3><button class="heart ${saved ? "is-saved" : ""}" data-save="${item.id}" aria-label="Save ${escapeHtml(item.title)}">${favouriteIcon(item.id)}</button></div>
      <p class="venue">📍 ${escapeHtml(item.venue)} <a class="directions-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.venue + " BITS Pilani Dubai Campus")}" target="_blank" rel="noopener">Directions →</a></p>
      <p class="description">${escapeHtml(item.description || "")}</p>
      <div class="card-footer"><button class="react-button ${liked ? "is-liked" : ""}" data-react="${item.id}" aria-label="React to ${escapeHtml(item.title)}">🔥 ${reactionCount}</button><button class="share-button" data-share="${item.id}">Share</button></div>
    </div>
  </article>`;
}

function skeletonCard() {
  return `<div class="vibe-card skeleton"><div class="card-visual"></div><div class="card-body"><div class="sk-line sk-meta"></div><div class="sk-line sk-title"></div><div class="sk-line sk-desc"></div></div></div>`;
}

function discoverView() {
  const filtered = state.filter === "For you" ? state.discoveries : state.discoveries.filter((x) => x.category === state.filter);
  return `<main>
    <section class="hero">
      <div><p class="eyebrow">YOUR LOCAL PULSE</p><h1>Good things are<br><em>happening nearby.</em></h1><p class="hero-copy">Fresh finds from your community, even when the signal disappears.</p></div>
      <div class="avatar-stack"><span>🧑🏽</span><span>👩🏻</span><span>🧑🏾</span><b>+24</b></div>
    </section>
    ${!state.online ? `<section class="offline-banner"><span>☁</span><div><b>You're offline</b><small>Showing your cached local finds — anything you add will sync once you're back online</small></div></section>` : `<section class="pulse-banner"><span>✦</span><div><b>Live nearby pulse</b><small>Updates in real time as people nearby discover things</small></div><span class="pulse-dot"></span></section>`}
    <div class="section-head"><h2>Explore nearby</h2><button class="map-button" data-open-campus-map>⌖ Map</button></div>
    <div class="filters">${["For you", "Food", "Music", "Study", "Sport"].map((filter) => `<button data-filter="${filter}" class="filter ${state.filter === filter ? "active" : ""}">${filter}</button>`).join("")}</div>
    <section class="cards">${state.loading ? Array.from({ length: 3 }, skeletonCard).join("") : filtered.length ? filtered.map(card).join("") : `<div class="empty"><span>🔎</span><h3>No vibes here yet</h3><p>Try another category or add the first find.</p></div>`}</section>
  </main>`;
}

function savedView() {
  const saved = state.discoveries.filter((x) => state.savedIds.has(x.id));
  return `<main class="saved-page"><section class="simple-hero"><p class="eyebrow">YOUR COLLECTION</p><h1>Saved <em>for later.</em></h1><p>These are always with you, online or off.</p></section><section class="cards">${saved.length ? saved.map(card).join("") : `<div class="empty"><span>♡</span><h3>Nothing saved yet</h3><p>Tap the heart on a vibe you want to revisit.</p><button class="primary" data-tab="discover">Discover nearby</button></div>`}</section></main>`;
}

function addView() {
  return `<main class="add-page"><section class="simple-hero"><p class="eyebrow">SHARE THE PULSE</p><h1>Found something<br><em>worth sharing?</em></h1><p>Your neighbours will thank you.</p></section>
  <form id="add-form" class="add-form"><label>What did you find?<input required name="title" maxlength="55" placeholder="e.g. Free matcha at the food court" /></label><label>Where is it?<input required name="venue" maxlength="55" placeholder="e.g. Student Centre" /></label><div class="form-row"><label>Category<select name="category"><option>Food</option><option>Music</option><option>Study</option><option>Sport</option><option>Event</option></select></label><label>When?<input required name="time" maxlength="28" placeholder="e.g. Happening now" /></label></div><label>Tell people why it's good <span>(optional)</span><textarea name="description" maxlength="160" placeholder="A small detail makes a great discovery."></textarea></label><label>Add a photo <span>(optional)</span><input type="file" id="add-photo-input" name="photo" accept="image/*" capture="environment" /></label><div id="photo-preview" class="photo-preview"></div><div class="location-row"><span>⌖</span><div><b>Near your current location</b><small>Campus, Dubai</small></div><span class="check">✓</span></div><button class="primary" type="submit">${state.online ? "Share with nearby people" : "Save for when you're online"}</button><p class="form-note">${state.online ? "✦ Your discovery will appear in the live community feed." : "☁ This will be safely queued and shared as soon as you're connected."}</p></form></main>`;
}

function bottomNav() {
  return `<nav class="bottom-nav"><button data-tab="discover" class="${state.tab === "discover" ? "active" : ""}"><span>⌂</span>Discover</button><button class="nav-add" data-tab="add" aria-label="Add a vibe">+</button><button data-tab="saved" class="${state.tab === "saved" ? "active" : ""}"><span>♡</span>Saved</button></nav>`;
}

function render() {
  const view = state.tab === "discover" ? discoverView() : state.tab === "saved" ? savedView() : addView();
  app.innerHTML = `<div class="app-shell"><header><a class="brand" href="#" data-tab="discover"><span class="brand-mark">✦</span>vibe<span>scout</span></a><div class="header-right"><button class="online-toggle" data-online>${state.online ? "● Live" : "☁ Offline"}</button><button class="profile" aria-label="Profile">M</button></div></header>${view}${bottomNav()}${state.toast ? `<div class="toast">${state.toast}</div>` : ""}</div>`;
}

document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-tab]")?.dataset.tab;
  if (tab) { event.preventDefault(); state.tab = tab; render(); return; }
  const filter = event.target.closest("[data-filter]")?.dataset.filter;
  if (filter) { state.filter = filter; render(); return; }
  const save = event.target.closest("[data-save]")?.dataset.save;
  if (save) {
    const isSaved = state.savedIds.has(save);
    // Optimistic — the live users/{uid}/saved listener will confirm this in ~milliseconds,
    // but flipping locally first keeps the tap feeling instant, online or off.
    isSaved ? state.savedIds.delete(save) : state.savedIds.add(save);
    render();
    toggleSaved(save, isSaved).catch((err) => console.error("toggleSaved failed:", err));
    return;
  }
  const react = event.target.closest("[data-react]")?.dataset.react;
  if (react) {
    const alreadyLiked = state.liked.has(react);
    state.liked = alreadyLiked ? new Set([...state.liked].filter((id) => id !== react)) : new Set([...state.liked, react]);
    persist();
    render();
    toggleReaction(react, alreadyLiked).catch((err) => console.error("toggleReaction failed:", err));
    return;
  }
  if (event.target.closest("[data-remove-photo]")) {
    clearPhotoPreview();
    return;
  }
  if (event.target.closest("[data-open-campus-map]")) {
    window.open("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("BITS Pilani Dubai Campus"), "_blank", "noopener");
    return;
  }
  if (event.target.closest("[data-online]")) { state.online = !state.online; render(); showToast(state.online ? "Back online" : "Offline mode on — your finds are safe"); }
  if (event.target.closest("[data-share]")) showToast("Link copied — invite someone to this vibe!");
});

// Live thumbnail preview when a photo is picked — deliberately NOT calling
// render() here, since that would wipe out whatever else the user has
// already typed into the add-discovery form.
document.addEventListener("change", (event) => {
  const input = event.target.closest("#add-photo-input");
  if (!input) return;
  const preview = document.getElementById("photo-preview");
  if (!preview) return;
  const file = input.files?.[0];
  if (!file) { preview.innerHTML = ""; return; }
  const url = URL.createObjectURL(file);
  preview.innerHTML = `<img src="${url}" alt="Photo preview" /><button type="button" class="remove-photo" data-remove-photo aria-label="Remove photo">✕</button>`;
});

document.addEventListener("submit", async (event) => {
  if (event.target.id !== "add-form") return;
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  const file = data.get("photo");

  let photoURL = null;
  if (file && file.size) {
    try {
      photoURL = await compressAndEncode(file);
    } catch (err) {
      console.error("Photo compression failed:", err);
      showToast("Couldn't process that photo — posting without it");
    }
  }

  const item = {
    title: data.get("title"),
    venue: data.get("venue"),
    category: data.get("category"),
    time: data.get("time"),
    description: data.get("description") || "A fresh find from someone nearby.",
    emoji: "✨",
    accent: "orange",
    distance: "Near you",
    people: 1,
    reactionCount: 0,
    photoURL
  };
  // Firestore handles offline queueing on its own — this call succeeds
  // even with no signal, and syncs automatically once reconnected.
  addDiscovery(item);
  form.reset();
  clearPhotoPreview();
  state.tab = "discover";
  showToast(state.online ? "✨ Shared with people nearby" : "☁ Saved safely — it will sync when online");
  render();
});

window.addEventListener("online", () => { state.online = true; render(); });
window.addEventListener("offline", () => { state.online = false; render(); });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));

// Live subscription — fires immediately with cached data (even offline),
// then again automatically every time Firestore has new data.
watchDiscoveries((discoveries) => {
  state.discoveries = discoveries;
  state.loading = false;
  render();
});

// Live subscription to this (anonymous) device's saved spots — real
// Firestore data, not localStorage, so it's offline-safe and consistent
// with how discoveries and reactions sync.
watchSavedIds((savedIds) => {
  state.savedIds = savedIds;
  render();
});

render();
