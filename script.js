import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check.js";
import {
  getFirestore, collection, doc, addDoc, getDoc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, increment, arrayUnion,
  serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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

let userId = localStorage.getItem("userId");
if (!userId) { userId = crypto.randomUUID(); localStorage.setItem("userId", userId); }

let displayName = localStorage.getItem("displayName");
if (!displayName) { displayName = "User" + Math.floor(Math.random() * 9999); localStorage.setItem("displayName", displayName); }

let lastPostTime = parseInt(localStorage.getItem("lastPostTime")) || 0;
let lastCommentTime = parseInt(localStorage.getItem("lastCommentTime")) || 0;

let currentTab = "fyp";
let currentGroupId = null;
let currentGroupName = null;

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

window.switchTab = function(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
  document.querySelectorAll(".tab-btn")[["fyp","videos","groups","contact"].indexOf(tab)].classList.add("active");
};

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
        <input type="text" id="modal-contact-name" placeholder="Display name">
        <textarea id="modal-contact-note" placeholder="A note about yourself..."></textarea>
        <input type="tel" id="modal-contact-number" placeholder="Phone number for calls (optional)">
        <input type="tel" id="modal-contact-text" placeholder="Number to text (optional)">
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
    title, content, user: displayName, ownerId: userId,
    createdAt: serverTimestamp(), likes: 0, likedBy: [], commentsCount: 0
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

function loadComments(postId) {
  const q = query(collection(db, "posts", postId, "comments"), orderBy("time"));
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

async function loadFYP() {
  const [videosSnap, groupsSnap, contactsSnap] = await Promise.all([
    new Promise(res => onSnapshot(query(collection(db, "videos"), where("status", "==", "approved")), res)),
    new Promise(res => onSnapshot(collection(db, "groups"), res)),
    new Promise(res => onSnapshot(collection(db, "contacts"), res))
  ]);

  onSnapshot(collection(db, "posts"), snapshot => {
    const feed = document.getElementById("fyp-feed");
    const now = Date.now();
    let posts = [];

    snapshot.forEach(d => {
      const raw = d.data();
      const p = {
        title: raw.title || "", content: raw.content || "",
        user: raw.user || "Unknown", ownerId: raw.ownerId || "",
        createdAt: raw.createdAt || null,
        likes: Number(raw.likes) || 0,
        likedBy: Array.isArray(raw.likedBy) ? raw.likedBy : [],
        commentsCount: Number(raw.commentsCount) || 0
      };
      const id = d.id;
      const time = p.createdAt?.toMillis?.() || now;
      const hoursOld = (now - time) / (1000 * 60 * 60);
      const engagement = (p.likes * 3.0) + (p.commentsCount * 5.0);
      const viral = Math.log1p(p.likes + p.commentsCount * 2) * 3;
      const decay = Math.pow(hoursOld + 1, 0.4);
      const score = (engagement + viral) / decay;
      posts.push({ id, ...p, score });
    });

    posts.sort((a, b) => b.score - a.score);
    feed.innerHTML = "";

    if (posts.length === 0) {
      feed.innerHTML = `<div class="empty-msg">No stories yet. Be the first to share!</div>`;
      return;
    }

    let injected = [];
    videosSnap.forEach(d => injected.push({ type: "video", data: d.data() }));
    groupsSnap.forEach(d => injected.push({ type: "group", data: { ...d.data(), id: d.id } }));
    contactsSnap.forEach(d => injected.push({ type: "contact", data: d.data() }));
    injected.sort(() => Math.random() - 0.5);
    let injectIndex = 0;

    posts.forEach((post, i) => {
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

      if ((i + 1) % 5 === 0 && injected.length > 0) {
        const item = injected[injectIndex % injected.length];
        injectIndex++;
        const injectDiv = document.createElement("div");

        if (item.type === "video") {
          injectDiv.className = "video-card";
          injectDiv.innerHTML = `
            <div style="background:#f0f2f5;padding:6px 12px;font-size:11px;color:#999;">📺 Recommended Video</div>
            <div class="yt-thumb" onclick="this.nextElementSibling.style.display='block';this.style.display='none'">
              <img src="https://img.youtube.com/vi/${sanitize(item.data.youtubeId)}/hqdefault.jpg">
              <div class="yt-play">▶</div>
            </div>
            <div class="yt-player" style="display:none">
              <iframe src="https://www.youtube.com/embed/${sanitize(item.data.youtubeId)}"
                allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
              </iframe>
            </div>
            <div class="yt-info">
              <div class="yt-title">${sanitize(item.data.title)}</div>
              <div class="yt-creator">🎬 ${sanitize(item.data.creator)}</div>
            </div>
          `;
        } else if (item.type === "group") {
          injectDiv.className = "group-card";
          injectDiv.onclick = () => { window.switchTab("groups"); window.openGroup(item.data.id, item.data.name); };
          injectDiv.innerHTML = `
            <div class="group-icon">${sanitize(item.data.emoji || "👥")}</div>
            <div class="group-info">
              <small style="color:#00bcd4;font-weight:600;">👥 Featured Group</small>
              <h3>${sanitize(item.data.name)}</h3>
              <p>${sanitize(item.data.desc)}</p>
            </div>
            <span>›</span>
          `;
        } else if (item.type === "contact") {
          injectDiv.className = "contact-card";
          injectDiv.innerHTML = `
            <small style="color:#00bcd4;font-weight:600;">📞 Connect Anonymously</small>
            <div class="contact-name">${sanitize(item.data.name)}</div>
            ${item.data.note ? `<div class="contact-note">${sanitize(item.data.note)}</div>` : ""}
            <div class="contact-btns">
              ${item.data.number ? `<a href="tel:${sanitize(item.data.number)}" class="btn btn-call">📞 ${sanitize(item.data.number)}</a>` : ""}
              ${item.data.textNumber ? `<a href="sms:${sanitize(item.data.textNumber)}" class="btn btn-primary">💬 ${sanitize(item.data.textNumber)}</a>` : ""}
            </div>
          `;
        }
        feed.appendChild(injectDiv);
      }
    });
  }, err => console.error("FYP error:", err));
}

window.submitVideo = async function() {
  const url = document.getElementById("modal-video-url").value.trim();
  const title = document.getElementById("modal-video-title").value.trim();
  const creator = document.getElementById("modal-video-creator").value.trim();
  if (!url || !title || !creator) return alert("Fill in all fields");
  const youtubeId = extractYoutubeId(url);
  if (!youtubeId) return alert("Invalid YouTube URL");
  await addDoc(collection(db, "videos"), {
    youtubeId, title, creator, status: "pending",
    submittedBy: userId, createdAt: serverTimestamp()
  });
  alert("Video submitted for review!");
  document.getElementById("modal-overlay").classList.remove("open");
};

function loadVideos() {
  const q = query(collection(db, "videos"), where("status", "==", "approved"));
  onSnapshot(q, snapshot => {
    const feed = document.getElementById("videos-feed");
    feed.innerHTML = "";
    if (snapshot.empty) {
      feed.innerHTML = `<div class="empty-msg" style="grid-column:1/-1">No videos yet. Submit one!</div>`;
      return;
    }
    snapshot.forEach(d => {
      const v = d.data();
      const div = document.createElement("div");
      div.className = "yt-card";
      div.innerHTML = `
        <div class="yt-thumb" onclick="this.nextElementSibling.style.display='block';this.style.display='none'">
          <img src="https://img.youtube.com/vi/${sanitize(v.youtubeId)}/hqdefault.jpg"
            onerror="this.src='https://img.youtube.com/vi/${sanitize(v.youtubeId)}/mqdefault.jpg'">
          <div class="yt-play">▶</div>
        </div>
        <div class="yt-player" style="display:none">
          <iframe src="https://www.youtube.com/embed/${sanitize(v.youtubeId)}"
            allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
          </iframe>
        </div>
        <div class="yt-info">
          <div class="yt-title">${sanitize(v.title)}</div>
          <div class="yt-creator">🎬 ${sanitize(v.creator)}</div>
        </div>
      `;
      feed.appendChild(div);
    });
  }, err => console.error("Videos error:", err));
}

window.submitGroup = async function() {
  const name = document.getElementById("modal-group-name").value.trim();
  const desc = document.getElementById("modal-group-desc").value.trim();
  const emoji = document.getElementById("modal-group-emoji").value.trim() || "👥";
  if (!name || !desc) return alert("Fill in all fields");
  if (name.length > 50) return alert("Name too long");
  await addDoc(collection(db, "groups"), {
    name, desc, emoji, createdBy: userId,
    memberCount: 1, createdAt: serverTimestamp()
  });
  document.getElementById("modal-overlay").classList.remove("open");
};

window.openGroup = function(groupId, groupName) {
  currentGroupId = groupId;
  currentGroupName = groupName;
  document.getElementById("groups-list-view").style.display = "none";
  document.getElementById("group-detail-view").style.display = "block";
  document.getElementById("group-detail-header").innerHTML = `
    <div class="card" style="margin-bottom:16px"><h3>${sanitize(groupName)}</h3></div>`;
  loadGroupPosts(groupId);
};

window.closeGroup = function() {
  currentGroupId = null;
  currentGroupName = null;
  document.getElementById("groups-list-view").style.display = "block";
  document.getElementById("group-detail-view").style.display = "none";
};

window.submitGroupPost = async function() {
  const title = document.getElementById("modal-gpost-title").value.trim();
  const content = document.getElementById("modal-gpost-content").value.trim();
  const now = Date.now();
  if (!title || !content) return alert("Fill in all fields");
  if (title.length > 80) return alert("Title too long");
  if (content.length > 500) return alert("Too long");
  if (containsBadWords(title) || containsBadWords(content)) return alert("Blocked");
  await addDoc(collection(db, "groups", currentGroupId, "posts"), {
    title, content, user: displayName, ownerId: userId,
    createdAt: serverTimestamp(), likes: 0, likedBy: [], commentsCount: 0
  });
  document.getElementById("modal-overlay").classList.remove("open");
};

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
        title: raw.title || "", content: raw.content || "",
        user: raw.user || "Unknown", ownerId: raw.ownerId || "",
        createdAt: raw.createdAt || null,
        likes: Number(raw.likes) || 0,
        likedBy: Array.isArray(raw.likedBy) ? raw.likedBy : [],
        commentsCount: Number(raw.commentsCount) || 0
      };
      const id = d.id;
      const time = p.createdAt?.toMillis?.() || now;
      const hoursOld = (now - time) / (1000 * 60 * 60);
      const engagement = (p.likes * 3.0) + (p.commentsCount * 5.0);
      const viral = Math.log1p(p.likes + p.commentsCount * 2) * 3;
      const decay = Math.pow(hoursOld + 1, 0.4);
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

window.submitContact = async function() {
  const name = document.getElementById("modal-contact-name").value.trim();
  const note = document.getElementById("modal-contact-note").value.trim();
  const number = document.getElementById("modal-contact-number").value.trim();
  const textNumber = document.getElementById("modal-contact-text").value.trim();
  if (!name) return alert("Add a display name");
  await addDoc(collection(db, "contacts"), {
    name, note, number, textNumber, createdAt: serverTimestamp()
  });
  document.getElementById("modal-overlay").classList.remove("open");
};

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
          ${c.number ? `<a href="tel:${sanitize(c.number)}" class="btn btn-call">📞 ${sanitize(c.number)}</a>` : ""}
          ${c.textNumber ? `<a href="sms:${sanitize(c.textNumber)}" class="btn btn-primary">💬 ${sanitize(c.textNumber)}</a>` : ""}
        </div>
      `;
      feed.appendChild(div);
    });
  }, err => console.error("Contacts error:", err));
}

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

window.switchTab = window.switchTab;
window.openPostModal = window.openPostModal;
window.closeModal = window.closeModal;
