// --- STATE & PERSISTENCE CONFIGURATION ---
const STORAGE_KEY_POSTS = 'vibescout_posts_data';
const STORAGE_KEY_USER_ID = 'vibescout_anon_uid';
const STORAGE_KEY_SAVED = 'vibescout_saved_ids';

// Anonymous UID Assignment
let currentUserId = localStorage.getItem(STORAGE_KEY_USER_ID);
if (!currentUserId) {
  currentUserId = 'anon_' + Math.random().toString(36).substring(2, 10);
  localStorage.setItem(STORAGE_KEY_USER_ID, currentUserId);
}

let savedPostIds = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY_SAVED) || '[]'));
let activeFilter = 'all';
let currentBase64Image = null;

// Initial Local Store Fallback
function getStoredPosts() {
  const data = localStorage.getItem(STORAGE_KEY_POSTS);
  return data ? JSON.parse(data) : [];
}

function persistPosts(posts) {
  localStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(posts));
}

// --- DOM ELEMENTS ---
const feedList = document.getElementById('feed-list');
const modalOverlay = document.getElementById('modal-overlay');
const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelBtn = document.getElementById('cancel-btn');
const discoveryForm = document.getElementById('discovery-form');
const mapBtn = document.getElementById('map-btn');
const seedBtn = document.getElementById('seed-btn');
const statusBadge = document.getElementById('connection-status');
const photoInput = document.getElementById('post-photo');
const previewContainer = document.getElementById('photo-preview-container');
const previewImg = document.getElementById('photo-preview');
const filterPills = document.querySelectorAll('.filter-pill');

// --- NETWORK STATUS TRACKING ---
function updateOnlineStatus() {
  if (navigator.onLine) {
    statusBadge.textContent = '🟢 Live Sync';
    statusBadge.className = 'status-badge online';
  } else {
    statusBadge.textContent = '🟠 Offline Mode';
    statusBadge.className = 'status-badge offline';
  }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// --- IMAGE COMPRESSION LOGIC ---
photoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) {
    currentBase64Image = null;
    previewContainer.classList.add('hidden');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      // Scale down image to 500px width max for tiny payload footprint
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 500;
      const scale = MAX_WIDTH / img.width;
      canvas.width = MAX_WIDTH;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      currentBase64Image = canvas.toDataURL('image/jpeg', 0.65);
      previewImg.src = currentBase64Image;
      previewContainer.classList.remove('hidden');
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

// --- RENDER FEED ---
function renderFeed() {
  const posts = getStoredPosts();
  feedList.innerHTML = '';

  const filtered = activeFilter === 'all' 
    ? posts 
    : posts.filter(p => p.category.toLowerCase() === activeFilter.toLowerCase());

  if (filtered.length === 0) {
    feedList.innerHTML = `<div style="text-align:center; padding: 40px; color: #808e9b;">No vibes here yet. Be the first to share one!</div>`;
    return;
  }

  const now = Date.now();

  filtered.forEach(post => {
    const isConfirmed = (post.reactions || 0) >= 3;
    const isSaved = savedPostIds.has(post.id);
    const ageMinutes = Math.floor((now - post.timestamp) / (1000 * 60));
    const isStale = ageMinutes >= 180; // 3 hours

    const card = document.createElement('div');
    card.className = `card ${isStale ? 'faded' : ''}`;

    // Google Maps Search link generator
    const mapsQuery = encodeURIComponent(`${post.venue} BITS Pilani Dubai Campus`);
    const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

    card.innerHTML = `
      <div class="card-header">
        <div>
          <h3>${post.title}</h3>
          <div class="card-venue">
            📍 ${post.venue} 
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="directions-link">Directions →</a>
          </div>
        </div>
        ${isConfirmed ? '<span class="badge-confirmed">✓ Confirmed</span>' : ''}
      </div>

      <p style="font-size: 0.9rem; margin-top: 6px;">${post.description || ''}</p>

      ${post.photo ? `<img src="${post.photo}" alt="${post.title}" class="card-image" loading="lazy" />` : ''}

      <div class="card-footer">
        <span style="font-size: 0.75rem; color: #808e9b;">${ageMinutes < 1 ? 'Just now' : `${ageMinutes}m ago`}</span>
        <div class="footer-actions">
          <button class="action-btn react-btn" data-id="${post.id}">
            🔥 <span class="react-count">${post.reactions || 0}</span>
          </button>
          <button class="action-btn bookmark-btn ${isSaved ? 'saved' : ''}" data-id="${post.id}">
            ${isSaved ? '♥ Saved' : '♡ Save'}
          </button>
        </div>
      </div>
    `;

    feedList.appendChild(card);
  });

  // Attach Reaction Click Handlers
  document.querySelectorAll('.react-btn').forEach(btn => {
    btn.onclick = () => handleReaction(btn.dataset.id);
  });

  // Attach Bookmark Click Handlers
  document.querySelectorAll('.bookmark-btn').forEach(btn => {
    btn.onclick = () => handleSaveToggle(btn.dataset.id);
  });
}

// --- REACTIONS & SAVES ---
function handleReaction(id) {
  const posts = getStoredPosts();
  const target = posts.find(p => p.id === id);
  if (target) {
    target.reactions = (target.reactions || 0) + 1;
    persistPosts(posts);
    renderFeed();
  }
}

function handleSaveToggle(id) {
  if (savedPostIds.has(id)) {
    savedPostIds.delete(id);
  } else {
    savedPostIds.add(id);
  }
  localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(Array.from(savedPostIds)));
  renderFeed();
}

// --- POST SUBMISSION ---
discoveryForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const newPost = {
    id: 'post_' + Date.now(),
    title: document.getElementById('post-title').value.trim(),
    category: document.getElementById('post-category').value,
    venue: document.getElementById('post-venue').value.trim(),
    description: document.getElementById('post-desc').value.trim(),
    photo: currentBase64Image || null,
    reactions: 0,
    timestamp: Date.now(),
    createdBy: currentUserId
  };

  const posts = getStoredPosts();
  posts.unshift(newPost);
  persistPosts(posts);

  // Form Reset
  discoveryForm.reset();
  currentBase64Image = null;
  previewContainer.classList.add('hidden');
  modalOverlay.classList.add('hidden');

  renderFeed();
});

// --- FILTER HANDLING ---
filterPills.forEach(pill => {
  pill.addEventListener('click', () => {
    filterPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeFilter = pill.dataset.category;
    renderFeed();
  });
});

// --- SEED SAMPLE DATA ---
seedBtn.addEventListener('click', () => {
  const samplePosts = [
    {
      id: 'demo_1',
      title: 'Free Karak Chai & Donuts',
      category: 'food',
      venue: 'Student Lounge - Ground Floor',
      description: 'ACM-W table has hot chai and snacks running for the next 30 minutes!',
      reactions: 4,
      timestamp: Date.now() - 1000 * 60 * 12,
      photo: null
    },
    {
      id: 'demo_2',
      title: 'Open Robotics Arena Demo',
      category: 'events',
      venue: 'Main Auditorium Foyer',
      description: 'Robo-soccer match happening right now. Come watch the autonomous matches.',
      reactions: 3,
      timestamp: Date.now() - 1000 * 60 * 35,
      photo: null
    },
    {
      id: 'demo_3',
      title: 'Quiet Study Tables Free',
      category: 'study',
      venue: 'Library 2nd Floor West Wing',
      description: 'Back pods are completely empty and have power outlets functional.',
      reactions: 1,
      timestamp: Date.now() - 1000 * 60 * 55,
      photo: null
    }
  ];

  persistPosts(samplePosts);
  renderFeed();
});

// --- MODAL TOGGLES ---
openModalBtn.onclick = () => modalOverlay.classList.remove('hidden');
closeModalBtn.onclick = () => modalOverlay.classList.add('hidden');
cancelBtn.onclick = () => modalOverlay.classList.add('hidden');

// Header Map Button Target
mapBtn.onclick = () => {
  window.open('https://www.google.com/maps/search/?api=1&query=BITS+Pilani+Dubai+Campus', '_blank');
};

// Initial Render
renderFeed();
