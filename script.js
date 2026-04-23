import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check.js";
import {
  getFirestore, collection, doc, addDoc, getDoc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, increment, arrayUnion,
  serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ── FIREBASE SETUP ──
const firebaseConfig = {
  apiKey: "AIzaSyBzegyz_g4EsaQd09wgAnIFlf8iYERY0sw",
  authDomain: "lives-saved-through-shar-4b7e4.firebaseapp.com",
  projectId: "lives-saved-through-shar-4b7e4",
  storageBucket: "lives-saved-through-shar-4b7e4.firebasestorage.app",
  messagingSenderId: "916853783639",
  appId: "1:916853783639:web:d6ef4757f560a61e9b3712"
};

const app = initializeApp(firebaseConfig);
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("6Ld-W8AsAAAAAFb16D3uMshuM2lRQ6HyHkUAXwR9"),
  isTokenAutoRefreshEnabled: true
});
const db = getFirestore(app);

// ── USER IDENTITY ──
let userId = localStorage.getItem("userId");
if (!userId) { userId = crypto.randomUUID(); localStorage.setItem("userId", userId); }

let displayName = localStorage.getItem("displayName");
if (!displayName) { displayName = "User" + Math.floor(Math.random() * 9999); localStorage.setItem("displayName", displayName); }

let lastPostTime = parseInt(localStorage.getItem("lastPostTime")) || 0;
let lastCommentTime = parseInt(localStorage.getItem("lastCommentTime")) || 0;

// ── STATE ──
let currentTab = "fyp";
let currentGroupId = null;
let currentGroupName = null;

// ── UTILS ──
function sanitize(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function containsBadWords(text) {
  const banned = ["spam", "badword1", "badword2"];
  return banned.some(w => text.toLowerCase().includes(w));
}

function extractYoutubeId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? match[1] : null;
}

// ── TAB SWITCHING ──
window.switchTab = function(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
  document.querySelectorAll(".tab-btn")[["fyp","videos","groups","contact"].indexOf(tab)].classList.add("active");
};

// ── MODAL ──
window.openPostModal = function() {
  const modal = document.getElementById("modal-content");
  const overlay = document.getElementById("modal-overlay");

  let html = "";

  if (currentTab === "fyp") {
    html = `
      <div class="modal-header">
        <h2>Share Your Story</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="form-group">
        <input type="text" id="modal-title" placeholder="Title (max 80 chars)">
        <textarea id="modal-content-text" placeholder="Tell your story... (max 500 chars)"></textarea>
        <button class="btn btn-primary" onclick="submitPost()">Post Anonymously</button>
      </div>`;
  } else if (currentTab === "videos") {
    html = `
      <div class="modal-header">
        <h2>Submit a Video</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="form-group">
        <input type="url" id="modal-video-url" placeholder="YouTube URL">
        <input type="text" id="modal-video-title" placeholder="Video title">
        <input type="text" id="modal-video-creator" placeholder="Creator name (give credit)">
        <button class="btn btn-primary" onclick="submitVideo()">Submit for Review</button>
      </div>`;
  } else if (currentTab === "groups") {
    if (currentGroupId) {
      html = `
        <div class="modal-header">
          <h2>Post in ${sanitize(currentGroupName)}</h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="form-group">
          <input type="text" id="modal-gpost-title" placeholder="Title">
          <textarea id="modal-gpost-content" placeholder="Share your experience..."></textarea>
          <button class="btn btn-primary" onclick="submitGroupPost()">Post Anonymously</button>
        </div>`;
    } else {
      html = `
        <div class="modal-header">
          <h2>Create a Group</h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="form-group">
          <input type="text" id="modal-group-name" placeholder="Group name">
          <textarea id="modal-group-desc" placeholder="What is this group about?"></textarea>
          <input type="text" id="modal-group-emoji" placeholder="Emoji icon (e.g. 💙)">
          <button class="btn btn-primary" onclick="submitGroup()">Create Group</button>
        </div>`;
    }
  } else if (currentTab === "contact") {
    html = `
      <div class="modal-header">
        <h2>Add Contact Card</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="form-group">
        <input type="text" id="modal-contact-name" placeholder="Display name (anonymous is fine)">
        <textarea id="modal-contact-note" placeholder="A note about yourself or why you want to connect..."></textarea>
        <input type="tel" id="modal-contact-number" placeholder="Phone number (optional)">
        <input type="email" id="modal-contact-email" placeholder="Email (optional)">
        <button class="btn btn-primary" onclick="submitContact()">Post Card</button>
      </div>`;
  }

  modal.innerHTML = html;
  overlay.classList.add("open");
};

window.closeModal = function(e) {
  if (!e || e.target === document.getElementById("modal-overlay")) {
    document.getElementById("modal-overlay").classList.remove("open");
  }
};

// ── FYP: POST ──
window.submitPost = async function() {
  const title = document.getElementById("modal-title").value.trim();
  const content = document.getElementById("modal-content-text").value.trim();
  const now = Date.now();

  if (now - lastPostTime < 30000) return alert("Wait before posting again");
  if (!title || !content) return alert("Fill in all fields");
  if (title.length > 80) return alert("Title too long");
  if (content.length > 500) return alert("Story too long");
  if (containsBadWords(title) || containsBadWords(content)) return alert("Blocked");

  await addDoc(collection(db, "posts"), {
    title, content,
    user: displayName,
    ownerId: userId,
    createdAt: serverTimestamp(),
    likes: 0, likedBy: [], commentsCount: 0
  });

  lastPostTime = now;
  localStorage.setItem("lastPostTime", now);
  document.getElementById("modal-overlay").classList.remove("open");
};

window.likePost = async function(postId) {
  const ref = doc(db, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if ((data.likedBy || []).includes(userId)) return alert("Already liked");
  await updateDoc(ref, { likes: (data.likes || 0) + 1, likedBy: arrayUnion(userId) });
};

window.addComment = async function(postId) {
  const input = document.getElementById(`comment-${postId}`);
  const text = input.value.trim();
  const now = Date.now();
  if (now - lastCommentTime < 10000) return alert("Slow down");
  if (!text) return;
  if (text.length > 200) return alert("Too long");
  if (containsBadWords(text)) return alert("Blocked");
  await addDoc(collection(db, "posts", postId, "comments"), { text, user: displayName, time: now });
  await updateDoc(doc(db, "posts", postId), { commentsCount: increment(1) });
  lastCommentTime = now;
  localStorage.setItem("lastCommentTime", now);
  input.value = "";
};

window.editPost = async function(id, oldTitle, oldContent) {
  const ref = doc(db, "posts", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().ownerId !== userId) return alert("Not your post");
  const newTitle = prompt("Edit title:", oldTitle);
  const newContent = prompt("Edit content:", oldContent);
  if (!newTitle || !newContent) return;
  await updateDoc(ref, { title: newTitle, content: newContent });
};

window.deletePost = async function(id) {
  const ref = doc(db, "posts", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().ownerId !== userId) return alert("Not your post");
  if (!confirm("Delete?")) return;
  await deleteDoc(ref);
};

function loadComments(postId, collectionPath) {
  const path = collectionPath || ["posts", postId, "comments"];
  const q = query(collection(db, ...path), orderBy("time"));
  onSnapshot(q, snapshot => {
    const div = document.getElementById(`comments-${postId}`);
    if (!div) return;
    let html = "";
    snapshot.forEach(d => {
      const c = d.data();
      html += `<p class="comment-item"><b>${sanitize(c.user)}:</b> ${sanitize(c.text)}</p>`;
    });
    div.innerHTML = html;
  });
}

// ── FYP: LOAD ──
function loadFYP() {
  onSnapshot(collection(db, "posts"), snapshot => {
    const feed = document.getElementById("fyp-feed");
    const now = Date.now();
    let posts = [];

    snapshot.forEach(d => {
      const raw = d.data();
      const p = {
        title: raw.title || "",
        content: raw.content || "",
        user: raw.user || "Unknown",
        ownerId: raw.ownerId || "",
        createdAt: raw.createdAt || null,
        likes: Number(raw.likes) || 0,
        likedBy: Array.isArray(raw.likedBy) ? raw.likedBy : [],
        commentsCount: Number(raw.commentsCount) || 0
      };
      const id = d.id;
      const time = p.createdAt?.toMillis?.() || now;
      const hoursOld = (now - time) / (1000 * 60 * 60);
      const engagement = (p.likes * 2.0) + (p.commentsCount * 3.0);
      const viral = Math.log1p(p.likes + p.commentsCount * 2);
      const decay = Math.pow(hoursOld + 1, 0.6);
      const score = (engagement + viral) / decay;
      posts.push({ id, ...p, score });
    });

    posts.sort((a, b) => b.score - a.score);
    feed.innerHTML = "";

    posts.forEach(post => {
      const isOwner = post.ownerId === userId;
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <h3>${sanitize(post.title)}</h3>
        <p>${sanitize(post.content)}</p>
        <small>${sanitize(post.user)}</small>
        <div class="card-actions">
          <button class="btn btn-ghost" onclick="window.likePost('${post.id}')">♡ ${post.likes}</button>
          ${isOwner ? `
            <button class="btn btn-ghost" onclick="window.editPost('${post.id}', \`${sanitize(post.title)}\`, \`${sanitize(post.content)}\`)">✎ Edit</button>
            <button class="btn btn-danger" onclick="window.deletePost('${post.id}')">🗑</button>
          ` : ""}
        </div>
        <div class="comments-section">
          <div id="comments-${post.id}"></div>
          <div class="comment-input-row">
            <input id="comment-${post.id}" placeholder="Write a comment...">
            <button class="btn btn-primary" onclick="window.addComment('${post.id}')">→</button>
          </div>
        </div>
      `;
      feed.appendChild(div);
      loadComments(post.id);
    });

    if (posts.length === 0) {
      feed.innerHTML = `<div class="empty-msg">No stories yet. Be the first to share!</div>`;
    }
  }, err => console.error("FYP error:", err));
}

// ── VIDEOS: SUBMIT ──
window.submitVideo = async function() {
  const url = document.getElementById("modal-video-url").value.trim();
  const title = document.getElementById("modal-video-title").value.trim();
  const creator = document.getElementById("modal-video-creator").value.trim();

  if (!url || !title || !creator) return alert("Fill in all fields");
  const youtubeId = extractYoutubeId(url);
  if (!youtubeId) return alert("Invalid YouTube URL");

  await addDoc(collection(db, "videos"), {
    youtubeId, title, creator,
    status: "pending",
    submittedBy: userId,
    createdAt: serverTimestamp()
  });

  alert("Video submitted for review!");
  document.getElementById("modal-overlay").classList.remove("open");
};

// ── VIDEOS: LOAD ──
function loadVideos() {
  const q = query(collection(db, "videos"), where("status", "==", "approved"));
  onSnapshot(q, snapshot => {
    const feed = document.getElementById("videos-feed");
    feed.innerHTML = "";

    if (snapshot.empty) {
      feed.innerHTML = `<div class="empty-msg">No videos yet. Submit one!</div>`;
      return;
    }

    snapshot.forEach(d => {
      const v = d.data();
      const div = document.createElement("div");
      div.className = "video-card";
      div.innerHTML = `
        <iframe src="https://www.youtube.com/embed/${sanitize(v.youtubeId)}"
          allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
        </iframe>
        <div class="video-info">
          <h3>${sanitize(v.title)}</h3>
          <small>🎬 ${sanitize(v.creator)}</small>
        </div>
      `;
      feed.appendChild(div);
    });
  }, err => console.error("Videos error:", err));
}

// ── GROUPS: SUBMIT ──
window.submitGroup = async function() {
  const name = document.getElementById("modal-group-name").value.trim();
  const desc = document.getElementById("modal-group-desc").value.trim();
  const emoji = document.getElementById("modal-group-emoji").value.trim() || "👥";

  if (!name || !desc) return alert("Fill in all fields");
  if (name.length > 50) return alert("Name too long");

  await addDoc(collection(db, "groups"), {
    name, desc, emoji,
    createdBy: userId,
    memberCount: 1,
    createdAt: serverTimestamp()
  });

  document.getElementById("modal-overlay").classList.remove("open");
};

// ── GROUPS: OPEN ──
window.openGroup = function(groupId, groupName) {
  currentGroupId = groupId;
  currentGroupName = groupName;
  document.getElementById("groups-list-view").style.display = "none";
  document.getElementById("group-detail-view").style.display = "block";
  document.getElementById("group-detail-header").innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <h3>${sanitize(groupName)}</h3>
    </div>
  `;
  loadGroupPosts(groupId);
};

window.closeGroup = function() {
  currentGroupId = null;
  currentGroupName = null;
  document.getElementById("groups-list-view").style.display = "block";
  document.getElementById("group-detail-view").style.display = "none";
};

// ── GROUPS: SUBMIT POST ──
window.submitGroupPost = async function() {
  const title = document.getElementById("modal-gpost-title").value.trim();
  const content = document.getElementById("modal-gpost-content").value.trim();
  const now = Date.now();

  if (!title || !content) return alert("Fill in all fields");
  if (title.length > 80) return alert("Title too long");
  if (content.length > 500) return alert("Too long");
  if (containsBadWords(title) || containsBadWords(content)) return alert("Blocked");

  await addDoc(collection(db, "groups", currentGroupId, "posts"), {
    title, content,
    user: displayName,
    ownerId: userId,
    createdAt: serverTimestamp(),
    likes: 0, likedBy: [], commentsCount: 0
  });

  document.getElementById("modal-overlay").classList.remove("open");
};

// ── GROUPS: LOAD LIST ──
function loadGroups() {
  onSnapshot(collection(db, "groups"), snapshot => {
    const feed = document.getElementById("groups-feed");
    feed.innerHTML = "";

    if (snapshot.empty) {
      feed.innerHTML = `<div class="empty-msg">No groups yet. Create one!</div>`;
      return;
    }

    snapshot.forEach(d => {
      const g = d.data();
      const div = document.createElement("div");
      div.className = "group-card";
      div.onclick = () => window.openGroup(d.id, g.name);
      div.innerHTML = `
        <div class="group-icon">${sanitize(g.emoji || "👥")}</div>
        <div class="group-info">
          <h3>${sanitize(g.name)}</h3>
          <p>${sanitize(g.desc)}</p>
          <small>${g.memberCount || 0} members</small>
        </div>
        <span>›</span>
      `;
      feed.appendChild(div);
    });
  }, err => console.error("Groups error:", err));
}

// ── GROUPS: LOAD POSTS ──
window.likeGroupPost = async function(groupId, postId) {
  const ref = doc(db, "groups", groupId, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if ((data.likedBy || []).includes(userId)) return alert("Already liked");
  await updateDoc(ref, { likes: (data.likes || 0) + 1, likedBy: arrayUnion(userId) });
};

window.addGroupComment = async function(groupId, postId) {
  const input = document.getElementById(`gcomment-${postId}`);
  const text = input.value.trim();
  const now = Date.now();
  if (now - lastCommentTime < 10000) return alert("Slow down");
  if (!text) return;
  if (text.length > 200) return alert("Too long");
  await addDoc(collection(db, "groups", groupId, "posts", postId, "comments"), {
    text, user: displayName, time: now
  });
  await updateDoc(doc(db, "groups", groupId, "posts", postId), { commentsCount: increment(1) });
  lastCommentTime = now;
  localStorage.setItem("lastCommentTime", now);
  input.value = "";
};

function loadGroupPosts(groupId) {
  onSnapshot(collection(db, "groups", groupId, "posts"), snapshot => {
    const feed = document.getElementById("group-posts-feed");
    const now = Date.now();
    let posts = [];

    snapshot.forEach(d => {
      const raw = d.data();
      const p = {
        title: raw.title || "",
        content: raw.content || "",
        user: raw.user || "Unknown",
        ownerId: raw.ownerId || "",
        createdAt: raw.createdAt || null,
        likes: Number(raw.likes) || 0,
        likedBy: Array.isArray(raw.likedBy) ? raw.likedBy : [],
        commentsCount: Number(raw.commentsCount) || 0
      };
      const id = d.id;
      const time = p.createdAt?.toMillis?.() || now;
      const hoursOld = (now - time) / (1000 * 60 * 60);
      const engagement = (p.likes * 2.0) + (p.commentsCount * 3.0);
      const viral = Math.log1p(p.likes + p.commentsCount * 2);
      const decay = Math.pow(hoursOld + 1, 0.6);
      const score = (engagement + viral) / decay;
      posts.push({ id, ...p, score });
    });

    posts.sort((a, b) => b.score - a.score);
    feed.innerHTML = "";

    if (posts.length === 0) {
      feed.innerHTML = `<div class="empty-msg">No posts yet. Be the first!</div>`;
      return;
    }

    posts.forEach(post => {
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <h3>${sanitize(post.title)}</h3>
        <p>${sanitize(post.content)}</p>
        <small>${sanitize(post.user)}</small>
        <div class="card-actions">
          <button class="btn btn-ghost" onclick="window.likeGroupPost('${groupId}', '${post.id}')">♡ ${post.likes}</button>
        </div>
        <div class="comments-section">
          <div id="gcomments-${post.id}"></div>
          <div class="comment-input-row">
            <input id="gcomment-${post.id}" placeholder="Write a comment...">
            <button class="btn btn-primary" onclick="window.addGroupComment('${groupId}', '${post.id}')">→</button>
          </div>
        </div>
      `;
      feed.appendChild(div);

      const q = query(collection(db, "groups", groupId, "posts", post.id, "comments"), orderBy("time"));
      onSnapshot(q, snap => {
        const div2 = document.getElementById(`gcomments-${post.id}`);
        if (!div2) return;
        let html = "";
        snap.forEach(d => {
          const c = d.data();
          html += `<p class="comment-item"><b>${sanitize(c.user)}:</b> ${sanitize(c.text)}</p>`;
        });
        div2.innerHTML = html;
      });
    });
  }, err => console.error("Group posts error:", err));
}

// ── CONTACT: SUBMIT ──
window.submitContact = async function() {
  const name = document.getElementById("modal-contact-name").value.trim();
  const note = document.getElementById("modal-contact-note").value.trim();
  const number = document.getElementById("modal-contact-number").value.trim();
  const email = document.getElementById("modal-contact-email").value.trim();

  if (!name) return alert("Add a display name");
  if (!number && !email && !note) return alert("Add at least a note, number, or email");

  await addDoc(collection(db, "contacts"), {
    name, note, number, email,
    createdAt: serverTimestamp()
  });

  document.getElementById("modal-overlay").classList.remove("open");
};

// ── CONTACT: LOAD ──
function loadContacts() {
  onSnapshot(collection(db, "contacts"), snapshot => {
    const feed = document.getElementById("contacts-feed");
    feed.innerHTML = "";

    if (snapshot.empty) {
      feed.innerHTML = `<div class="empty-msg">No contact cards yet.</div>`;
      return;
    }

    snapshot.forEach(d => {
      const c = d.data();
      const div = document.createElement("div");
      div.className = "contact-card";
      div.innerHTML = `
        <div class="contact-name">${sanitize(c.name)}</div>
        ${c.note ? `<div class="contact-note">${sanitize(c.note)}</div>` : ""}
        <div class="contact-btns">
          ${c.number ? `<a href="tel:${sanitize(c.number)}" class="btn btn-call">📞 Call (*67 first)</a>` : ""}
          ${c.email ? `<a href="mailto:${sanitize(c.email)}" class="btn btn-email">✉️ Email</a>` : ""}
        </div>
      `;
      feed.appendChild(div);
    });
  }, err => console.error("Contacts error:", err));
}

// ── BOOT ──
getToken(appCheck, false).then(() => {
  console.log("App Check ready");
  const msg = document.getElementById("loading-msg");
  if (msg) msg.remove();
  loadFYP();
  loadVideos();
  loadGroups();
  loadContacts();
}).catch(err => {
  console.error("App Check failed:", err);
  const msg = document.getElementById("loading-msg");
  if (msg) msg.textContent = "Security check failed. Please refresh.";
});

// ── EXPOSE ──
window.switchTab = window.switchTab;
window.openPostModal = window.openPostModal;
window.closeModal = window.closeModal;

jsrules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read, write: if true;
      match /comments/{commentId} {
        allow read, write: if true;
      }
    }
    match /videos/{videoId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false;
    }
    match /groups/{groupId} {
      allow read, write: if true;
      match /posts/{postId} {
        allow read, write: if true;
        match /comments/{commentId} {
          allow read, write: if true;
        }
      }
    }
    match /contacts/{contactId} {
      allow read, write: if true;
    }
  }
}
