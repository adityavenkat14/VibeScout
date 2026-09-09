import "./style.css";
import { watchDiscoveries, addDiscovery } from "./firebase.js";

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
};

let state = {
  tab: "discover",
  filter: "For you",
  online: navigator.onLine,
  discoveries: [], // now populated live from Firebase, not seeded locally
  favourites: store.get("vibescout-favourites", []),
  toast: ""
};

const app = document.querySelector("#app");
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function persist() {
  // Only favourites stay local now — discoveries live in Firestore
  store.set("vibescout-favourites", state.favourites);
}

function showToast(message) {
  state.toast = message;
  render();
  window.setTimeout(() => { state.toast = ""; render(); }, 2600);
}

function favouriteIcon(id) {
  return state.favourites.includes(id) ? "♥" : "♡";
}

function card(item) {
  const saved = state.favourites.includes(item.id);
  return `<article class="vibe-card ${item.accent || "orange"}">
    <div class="card-visual"><span>${item.emoji || "✨"}</span><div class="visual-glow"></div><span class="live-pill">${item.time || "Just now"}</span></div>
    <div class="card-body">
      <div class="card-meta"><span>${item.category}</span><span>•</span><span>${item.distance || "Near you"}</span></div>
      <div class="card-title-row"><h3>${escapeHtml(item.title)}</h3><button class="heart ${saved ? "is-saved" : ""}" data-save="${item.id}" aria-label="Save ${escapeHtml(item.title)}">${favouriteIcon(item.id)}</button></div>
      <p class="venue">📍 ${escapeHtml(item.venue)}</p>
      <p class="description">${escapeHtml(item.description || "")}</p>
      <div class="card-footer"><span class="people">◉ ${item.people || 1} people nearby</span><button class="share-button" data-share="${item.id}">Share</button></div>
    </div>
  </article>`;
}

function discoverView() {
  const filtered = state.filter === "For you" ? state.discoveries : state.discoveries.filter((x) => x.category === state.filter);
  return `<main>
    <section class="hero">
      <div><p class="eyebrow">YOUR LOCAL PULSE</p><h1>Good things are<br><em>happening nearby.</em></h1><p class="hero-copy">Fresh finds from your community, even when the signal disappears.</p></div>
      <div class="avatar-stack"><span>🧑🏽</span><span>👩🏻</span><span>🧑🏾</span><b>+24</b></div>
    </section>
    ${!state.online ? `<section class="offline-banner"><span>☁</span><div><b>You're offline</b><small>Showing your cached local finds — anything you add will sync once you're back online</small></div></section>` : `<section class="pulse-banner"><span>✦</span><div><b>Live nearby pulse</b><small>Updates in real time as people nearby discover things</small></div><span class="pulse-dot"></span></section>`}
    <div class="section-head"><h2>Explore nearby</h2><button class="map-button">⌖ Map</button></div>
    <div class="filters">${["For you", "Food", "Music", "Study", "Sport"].map((filter) => `<button data-filter="${filter}" class="filter ${state.filter === filter ? "active" : ""}">${filter}</button>`).join("")}</div>
    <section class="cards">${filtered.length ? filtered.map(card).join("") : `<div class="empty"><span>🔎</span><h3>No vibes here yet</h3><p>Try another category or add the first find.</p></div>`}</section>
  </main>`;
}

function savedView() {
  const saved = state.discoveries.filter((x) => state.favourites.includes(x.id));
  return `<main class="saved-page"><section class="simple-hero"><p class="eyebrow">YOUR COLLECTION</p><h1>Saved <em>for later.</em></h1><p>These are always with you, online or off.</p></section><section class="cards">${saved.length ? saved.map(card).join("") : `<div class="empty"><span>♡</span><h3>Nothing saved yet</h3><p>Tap the heart on a vibe you want to revisit.</p><button class="primary" data-tab="discover">Discover nearby</button></div>`}</section></main>`;
}

function addView() {
  return `<main class="add-page"><section class="simple-hero"><p class="eyebrow">SHARE THE PULSE</p><h1>Found something<br><em>worth sharing?</em></h1><p>Your neighbours will thank you.</p></section>
  <form id="add-form" class="add-form"><label>What did you find?<input required name="title" maxlength="55" placeholder="e.g. Free matcha at the food court" /></label><label>Where is it?<input required name="venue" maxlength="55" placeholder="e.g. Student Centre" /></label><div class="form-row"><label>Category<select name="category"><option>Food</option><option>Music</option><option>Study</option><option>Sport</option><option>Event</option></select></label><label>When?<input required name="time" maxlength="28" placeholder="e.g. Happening now" /></label></div><label>Tell people why it's good <span>(optional)</span><textarea name="description" maxlength="160" placeholder="A small detail makes a great discovery."></textarea></label><div class="location-row"><span>⌖</span><div><b>Near your current location</b><small>Campus, Dubai</small></div><span class="check">✓</span></div><button class="primary" type="submit">${state.online ? "Share with nearby people" : "Save for when you're online"}</button><p class="form-note">${state.online ? "✦ Your discovery will appear in the live community feed." : "☁ This will be safely queued and shared as soon as you're connected."}</p></form></main>`;
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
  if (save) { state.favourites = state.favourites.includes(save) ? state.favourites.filter((id) => id !== save) : [...state.favourites, save]; persist(); render(); return; }
  if (event.target.closest("[data-online]")) { state.online = !state.online; render(); showToast(state.online ? "Back online" : "Offline mode on — your finds are safe"); }
  if (event.target.closest("[data-share]")) showToast("Link copied — invite someone to this vibe!");
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "add-form") return;
  event.preventDefault();
  const data = new FormData(event.target);
  const item = {
    title: data.get("title"),
    venue: data.get("venue"),
    category: data.get("category"),
    time: data.get("time"),
    description: data.get("description") || "A fresh find from someone nearby.",
    emoji: "✨",
    accent: "orange",
    distance: "Near you",
    people: 1
  };
  // Firestore handles offline queueing on its own — this call succeeds
  // even with no signal, and syncs automatically once reconnected.
  addDiscovery(item);
  event.target.reset();
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
  render();
});

render();