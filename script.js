import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check.js";
import {
  getFirestore, collection, doc, addDoc, getDoc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, increment, arrayUnion, arrayRemove,
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

const ADMIN_ID = "user_eb4fvj3kpy5";
const isAdmin = userId === ADMIN_ID;

let lastPostTime = parseInt(localStorage.getItem("lastPostTime")) || 0;
let lastCommentTime = parseInt(localStorage.getItem("lastCommentTime")) || 0;

let currentTab = "fyp";
let currentGroupId = null;
let currentGroupName = null;

// ── INTEREST TRACKING ──
let userInterests = JSON.parse(localStorage.getItem("userInterests") || "{}");
function trackInterest(text) {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  words.forEach(w => { userInterests[w] = (userInterests[w] || 0) + 1; });
  localStorage.setItem("userInterests", JSON.stringify(userInterests));
}
function getInterestScore(text) {
  if (!text) return 0;
  const words = text.toLowerCase().split(/\s+/);
  let score = 0;
  words.forEach(w => { if (userInterests[w]) score += userInterests[w]; });
  return score;
}

// ── MODERATION ──
const BANNED_WORDS = ["spam","scam","porn","xxx","onlyfans","nude","nudes","hack","hacker","free money","click here","buy now","badword1","badword2"];
const SPAM_PATTERNS = [/(.)\1{4,}/,/(https?:\/\/\S+)/i,/[A-Z\s]{20,}/,/\b\d{10,}\b/];
function moderateContent(text) {
  const lower = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) return { allowed: false, reason: "contains prohibited content", autoDelete: true };
  }
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) return { allowed: false, reason: "looks like spam", autoDelete: true };
  }
  const symbolRatio = (text.match(/[^a-zA-Z0-9\s]/g) || []).length / text.length;
  if (symbolRatio > 0.4 && text.length > 10) return { allowed: false, reason: "unusual characters", autoDelete: false };
  return { allowed: true };
}

// ── UTILS ──
function sanitize(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
function extractYoutubeId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? match[1] : null;
}

// ── REPORT MODAL ──
function showReportModal(title, onSubmit) {
  const modal = document.getElementById("modal-content");
  const overlay = document.getElementById("modal-overlay");
  modal.innerHTML = `
    <div class="modal-header">
      <h2>${title}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <p style="font-size:14px;color:#666;margin-bottom:14px;">Why are you reporting this?</p>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:10px;font-size:14px;padding:10px;background:#f9f9f9;border-radius:10px;cursor:pointer;"><input type="radio" name="report-reason" value="Spam or self-promotion"> Spam or self-promotion</label>
      <label style="display:flex;align-items:center;gap:10px;font-size:14px;padding:10px;background:#f9f9f9;border-radius:10px;cursor:pointer;"><input type="radio" name="report-reason" value="Hate speech or harassment"> Hate speech or harassment</label>
      <label style="display:flex;align-items:center;gap:10px;font-size:14px;padding:10px;background:#f9f9f9;border-radius:10px;cursor:pointer;"><input type="radio" name="report-reason" value="Misinformation"> Misinformation</label>
      <label style="display:flex;align-items:center;gap:10px;font-size:14px;padding:10px;background:#f9f9f9;border-radius:10px;cursor:pointer;"><input type="radio" name="report-reason" value="Inappropriate content"> Inappropriate content</label>
      <label style="display:flex;align-items:center;gap:10px;font-size:14px;padding:10px;background:#f9f9f9;border-radius:10px;cursor:pointer;"><input type="radio" name="report-reason" value="Dangerous or harmful"> Dangerous or harmful</label>
      <label style="display:flex;align-items:center;gap:10px;font-size:14px;padding:10px;background:#f9f9f9;border-radius:10px;cursor:pointer;"><input type="radio" name="report-reason" value="Other"> Other</label>
      <button class="btn btn-danger" style="margin-top:6px;" id="report-submit-btn">Submit Report</button>
    </div>
  `;
  overlay.classList.add("open");
  document.getElementById("report-submit-btn").onclick = onSubmit;
}

// ── COMMENT RENDERER ──
function renderCommentItem(c, collectionPath, postOwnerId) {
  const isCommentOwner = c.ownerId === userId;
  const isPostOwner = postOwnerId === userId;
  const liked = (c.likedBy || []).includes(userId);

  const div = document.createElement("div");
  div.className = "comment-item";
  div.id = `ci-${c.id}`;
  div.style.cssText = "padding:8px 0;border-bottom:1px solid #f5f5f5;";

  const meta = document.createElement("div");
  meta.innerHTML = `
    ${c.pinned ? `<span style="color:#00bcd4;font-size:11px;font-weight:600;">📌 Pinned</span><br>` : ""}
    ${c.flagged && isAdmin ? `<span style="color:#f57c00;font-size:11px;">⚠️ ${sanitize(c.flagReason)}</span><br>` : ""}
    <b>${sanitize(c.user)}:</b> ${sanitize(c.text)}
  `;
  div.appendChild(meta);

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;";

  // Like/Unlike
  const likeBtn = document.createElement("button");
  likeBtn.className = "btn btn-ghost";
  likeBtn.style.cssText = "font-size:11px;padding:2px 8px;";
  likeBtn.textContent = `${liked ? "♥" : "♡"} ${c.likes || 0}`;
  likeBtn.onclick = async () => {
    const ref = doc(db, ...collectionPath, c.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const isLiked = (data.likedBy || []).includes(userId);
    if (isLiked) {
      await updateDoc(ref, { likes: Math.max((data.likes || 1) - 1, 0), likedBy: arrayRemove(userId) });
    } else {
      await updateDoc(ref, { likes: (data.likes || 0) + 1, likedBy: arrayUnion(userId) });
    }
  };
  actions.appendChild(likeBtn);

  // Report
  const reportBtn = document.createElement("button");
  reportBtn.className = "btn btn-ghost";
  reportBtn.style.cssText = "font-size:11px;padding:2px 8px;";
  reportBtn.textContent = "🚩";
  reportBtn.onclick = () => {
    showReportModal("Report Comment", async () => {
      const selected = document.querySelector('input[name="report-reason"]:checked');
      if (!selected) return alert("Please select a reason");
      await updateDoc(doc(db, ...collectionPath, c.id), { flagged: true, flagReason: selected.value, reportedBy: arrayUnion(userId) });
      document.getElementById("modal-overlay").classList.remove("open");
      alert("Report submitted.");
    });
  };
  actions.appendChild(reportBtn);

  // Edit & Delete (comment owner or admin)
  if (isCommentOwner || isAdmin) {
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-ghost";
    editBtn.style.cssText = "font-size:11px;padding:2px 8px;";
    editBtn.textContent = "✎";
    editBtn.onclick = async () => {
      const newText = prompt("Edit comment:", c.text);
      if (!newText || !newText.trim()) return;
      const check = moderateContent(newText.trim());
      if (!check.allowed && check.autoDelete) return alert("Blocked: " + check.reason);
      await updateDoc(doc(db, ...collectionPath, c.id), { text: newText.trim() });
    };
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.style.cssText = "font-size:11px;padding:2px 8px;";
    deleteBtn.textContent = "🗑";
    deleteBtn.onclick = async () => {
      if (!confirm("Delete comment?")) return;
      await deleteDoc(doc(db, ...collectionPath, c.id));
    };
    actions.appendChild(deleteBtn);
  }

  // Pin (post owner or admin)
  if (isPostOwner || isAdmin) {
    const pinBtn = document.createElement("button");
    pinBtn.className = `btn ${c.pinned ? "btn-pinned" : "btn-pin"}`;
    pinBtn.style.cssText = "font-size:11px;padding:2px 8px;";
    pinBtn.textContent = c.pinned ? "📌 Unpin" : "📌 Pin";
    pinBtn.onclick = async () => {
      await updateDoc(doc(db, ...collectionPath, c.id), { pinned: !c.pinned });
    };
    actions.appendChild(pinBtn);
  }

  // Admin flagged controls
  if (isAdmin && c.flagged) {
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-danger";
    removeBtn.style.cssText = "font-size:11px;padding:2px 8px;";
    removeBtn.textContent = "🗑 Remove";
    removeBtn.onclick = async () => { await deleteDoc(doc(db, ...collectionPath, c.id)); };
    actions.appendChild(removeBtn);

    const keepBtn = document.createElement("button");
    keepBtn.className = "btn btn-ghost";
    keepBtn.style.cssText = "font-size:11px;padding:2px 8px;";
    keepBtn.textContent = "✅ Keep";
    keepBtn.onclick = async () => { await updateDoc(doc(db, ...collectionPath, c.id), { flagged: false, flagReason: "" }); };
    actions.appendChild(keepBtn);
  }

  div.appendChild(actions);
  return div;
}

// ── COMMENT LOADER ──
function loadCommentsGeneric(collectionPath, containerId, postOwnerId) {
  const q = query(collection(db, ...collectionPath), orderBy("time"));
  onSnapshot(q, snapshot => {
    const div = document.getElementById(containerId);
    if (!div) return;
    div.innerHTML = "";
    let comments = [];
    snapshot.forEach(d => {
      const c = d.data();
      if (c.flagged && !isAdmin) return;
      comments.push({ id: d.id, ...c });
    });
    // Pinned comments first
    comments.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    comments.forEach(c => div.appendChild(renderCommentItem(c, collectionPath, postOwnerId)));
  });
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
      <div class="modal-header"><h2>Share Your Story</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="form-group">
        <input type="text" id="modal-title" placeholder="Title (max 80 chars)">
        <textarea id="modal-content-text" placeholder="Tell your story... (max 500 chars)"></textarea>
        <button class="btn btn-primary" onclick="submitPost()">Post Anonymously</button>
      </div>`;
  } else if (currentTab === "videos") {
    html = `
      <div class="modal-header"><h2>Submit a Video</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="form-group">
        <input type="url" id="modal-video-url" placeholder="YouTube URL">
        <input type="text" id="modal-video-title" placeholder="Video title">
        <input type="text" id="modal-video-creator" placeholder="Creator name (give credit)">
        <button class="btn btn-primary" onclick="submitVideo()">Submit for Review</button>
      </div>`;
  } else if (currentTab === "groups") {
    if (currentGroupId) {
      html = `
        <div class="modal-header"><h2>Post in ${sanitize(currentGroupName)}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
        <div class="form-group">
          <input type="text" id="modal-gpost-title" placeholder="Title">
          <textarea id="modal-gpost-content" placeholder="Share your experience..."></textarea>
          <button class="btn btn-primary" onclick="submitGroupPost()">Post Anonymously</button>
        </div>`;
    } else {
      html = `
        <div class="modal-header"><h2>Create a Group</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
        <div class="form-group">
          <input type="text" id="modal-group-name" placeholder="Group name">
          <textarea id="modal-group-desc" placeholder="What is this group about?"></textarea>
          <input type="text" id="modal-group-emoji" placeholder="Emoji icon (e.g. 💙)">
          <button class="btn btn-primary" onclick="submitGroup()">Create Group</button>
        </div>`;
    }
  } else if (currentTab === "contact") {
    html = `
      <div class="modal-header"><h2>Add Contact Card</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
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

// ── FYP POSTS ──
window.submitPost = async function() {
  const title = document.getElementById("modal-title").value.trim();
  const content = document.getElementById("modal-content-text").value.trim();
  const now = Date.now();
  if (now - lastPostTime < 30000) return alert("Wait before posting again");
  if (!title || !content) return alert("Fill in all fields");
  if (title.length > 80) return alert("Title too long");
  if (content.length > 500) return alert("Story too long");
  const titleCheck = moderateContent(title);
  const contentCheck = moderateContent(content);
  if (!titleCheck.allowed && titleCheck.autoDelete) return alert("Post blocked: " + titleCheck.reason);
  if (!contentCheck.allowed && contentCheck.autoDelete) return alert("Post blocked: " + contentCheck.reason);
  const flagged = !titleCheck.allowed || !contentCheck.allowed;
  const flagReason = !titleCheck.allowed ? titleCheck.reason : contentCheck.reason;
  await addDoc(collection(db, "posts"), {
    title, content, user: displayName, ownerId: userId,
    createdAt: serverTimestamp(), likes: 0, likedBy: [], commentsCount: 0,
    pinned: false, flagged, flagReason: flagged ? flagReason : ""
  });
  lastPostTime = now;
  localStorage.setItem("lastPostTime", now);
  document.getElementById("modal-overlay").classList.remove("open");
  if (flagged) alert("Your post has been submitted for review.");
};

window.togglePostLike = async function(postId, title, content) {
  const ref = doc(db, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const liked = (data.likedBy || []).includes(userId);
  if (liked) {
    await updateDoc(ref, { likes: Math.max((data.likes || 1) - 1, 0), likedBy: arrayRemove(userId) });
  } else {
    await updateDoc(ref, { likes: (data.likes || 0) + 1, likedBy: arrayUnion(userId) });
    trackInterest((title || "") + " " + (content || ""));
  }
};

window.addComment = async function(postId) {
  const input = document.getElementById(`comment-${postId}`);
  const text = input.value.trim();
  const now = Date.now();
  if (now - lastCommentTime < 10000) return alert("Slow down");
  if (!text) return;
  if (text.length > 200) return alert("Too long");
  const check = moderateContent(text);
  if (!check.allowed && check.autoDelete) return alert("Comment blocked: " + check.reason);
  await addDoc(collection(db, "posts", postId, "comments"), {
    text, user: displayName, ownerId: userId, time: now,
    flagged: !check.allowed, likes: 0, likedBy: [], pinned: false
  });
  if (check.allowed) await updateDoc(doc(db, "posts", postId), { commentsCount: increment(1) });
  lastCommentTime = now;
  localStorage.setItem("lastCommentTime", now);
  input.value = "";
};

window.editPost = async function(id, oldTitle, oldContent) {
  const ref = doc(db, "posts", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().ownerId !== userId && !isAdmin) return alert("Not your post");
  const newTitle = prompt("Edit title:", oldTitle);
  const newContent = prompt("Edit content:", oldContent);
  if (!newTitle || !newContent) return;
  await updateDoc(ref, { title: newTitle, content: newContent });
};

window.deletePost = async function(id) {
  const ref = doc(db, "posts", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().ownerId !== userId && !isAdmin) return alert("Not your post");
  if (!confirm("Delete?")) return;
  await deleteDoc(ref);
};

window.adminDeletePost = async function(id) {
  await deleteDoc(doc(db, "posts", id));
};

window.reportPost = function(postId) {
  showReportModal("Report Post", async () => {
    const selected = document.querySelector('input[name="report-reason"]:checked');
    if (!selected) return alert("Please select a reason");
    await updateDoc(doc(db, "posts", postId), { flagged: true, flagReason: selected.value, reportedBy: arrayUnion(userId) });
    document.getElementById("modal-overlay").classList.remove("open");
    alert("Report submitted. Thank you.");
  });
};

window.unflagPost = async function(postId) {
  await updateDoc(doc(db, "posts", postId), { flagged: false, flagReason: "" });
};

window.pinPost = async function(postId, currentlyPinned) {
  await updateDoc(doc(db, "posts", postId), { pinned: !currentlyPinned });
};

// ── FYP LOAD ──
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
      if (raw.flagged && !isAdmin) return;
      const p = {
        title: raw.title || "", content: raw.content || "",
        user: raw.user || "Unknown", ownerId: raw.ownerId || "",
        createdAt: raw.createdAt || null,
        likes: Number(raw.likes) || 0,
        likedBy: Array.isArray(raw.likedBy) ? raw.likedBy : [],
        commentsCount: Number(raw.commentsCount) || 0,
        pinned: raw.pinned || false, flagged: raw.flagged || false, flagReason: raw.flagReason || ""
      };
      const id = d.id;
      const time = p.createdAt?.toMillis?.() || now;
      const hoursOld = (now - time) / (1000 * 60 * 60);
      const engagement = (p.likes * 3.0) + (p.commentsCount * 5.0);
      const viral = Math.log1p(p.likes + p.commentsCount * 2) * 3;
      const decay = Math.pow(hoursOld + 1, 0.4);
      const interestBoost = getInterestScore(p.title + " " + p.content) * 0.5;
      const score = (engagement + viral) / decay + interestBoost;
      posts.push({ id, ...p, score });
    });

    posts.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.score - a.score;
    });

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
      const liked = post.likedBy.includes(userId);
      const div = document.createElement("div");
      div.className = post.pinned ? "card pinned-card" : "card";
      div.innerHTML = `
        ${post.pinned ? `<div class="pinned-label">📌 Pinned</div>` : ""}
        ${post.flagged && isAdmin ? `
          <div style="background:#fff3e0;padding:10px;border-radius:10px;font-size:13px;color:#f57c00;display:flex;flex-direction:column;gap:8px;">
            <span>⚠️ Reported: <b>${sanitize(post.flagReason)}</b></span>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-danger" onclick="window.adminDeletePost('${post.id}')">🗑 Remove</button>
              <button class="btn btn-ghost" onclick="window.unflagPost('${post.id}')">✅ Keep</button>
            </div>
          </div>
        ` : ""}
        <h3>${sanitize(post.title)}</h3>
        <p>${sanitize(post.content)}</p>
        <small>${sanitize(post.user)}</small>
        <div class="card-actions">
          <button class="btn btn-ghost" onclick="window.togglePostLike('${post.id}', \`${sanitize(post.title)}\`, \`${sanitize(post.content)}\`)">${liked ? "♥" : "♡"} ${post.likes}</button>
          <button class="btn btn-ghost" onclick="window.reportPost('${post.id}')">🚩</button>
          ${isOwner || isAdmin ? `
            <button class="btn btn-ghost" onclick="window.editPost('${post.id}', \`${sanitize(post.title)}\`, \`${sanitize(post.content)}\`)">✎ Edit</button>
            <button class="btn btn-danger" onclick="window.deletePost('${post.id}')">🗑</button>
          ` : ""}
          ${isAdmin ? `<button class="btn ${post.pinned ? 'btn-pinned' : 'btn-pin'}" onclick="window.pinPost('${post.id}', ${post.pinned})">${post.pinned ? "📌 Unpin" : "📌 Pin"}</button>` : ""}
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
      loadCommentsGeneric(["posts", post.id, "comments"], `comments-${post.id}`, post.ownerId);

      if ((i + 1) % 5 === 0 && injected.length > 0) {
        const item = injected[injectIndex % injected.length];
        injectIndex++;
        const injectDiv = document.createElement("div");
        if (item.type === "video") {
          injectDiv.className = "card";
          injectDiv.innerHTML = `
            <small style="color:#00bcd4;font-weight:600;">📺 Recommended Video</small>
            <div class="yt-thumb" onclick="this.nextElementSibling.style.display='block';this.style.display='none'">
              <img src="https://img.youtube.com/vi/${sanitize(item.data.youtubeId)}/hqdefault.jpg">
              <div class="yt-play">▶</div>
            </div>
            <div class="yt-player" style="display:none">
              <iframe src="https://www.youtube.com/embed/${sanitize(item.data.youtubeId)}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
            </div>
            <div class="yt-title">${sanitize(item.data.title)}</div>
            <div class="yt-creator">🎬 ${sanitize(item.data.creator)}</div>
          `;
        } else if (item.type === "group") {
          injectDiv.className = "group-card";
          injectDiv.onclick = () => { window.switchTab("groups"); window.openGroup(item.data.id, item.data.name); };
          injectDiv.innerHTML = `
            <small style="color:#00bcd4;font-weight:600;">👥 Featured Group</small>
            <div class="group-card-top">
              <span class="group-emoji">${sanitize(item.data.emoji || "👥")}</span>
              <span class="group-name">${sanitize(item.data.name)}</span>
            </div>
            <div class="group-desc">${sanitize(item.data.desc)}</div>
            <div class="group-meta">${item.data.memberCount || 0} members</div>
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

// ── VIDEOS ──
window.submitVideo = async function() {
  const url = document.getElementById("modal-video-url").value.trim();
  const title = document.getElementById("modal-video-title").value.trim();
  const creator = document.getElementById("modal-video-creator").value.trim();
  if (!url || !title || !creator) return alert("Fill in all fields");
  const youtubeId = extractYoutubeId(url);
  if (!youtubeId) return alert("Invalid YouTube URL");
  await addDoc(collection(db, "videos"), {
    youtubeId, title, creator, status: "pending",
    submittedBy: userId, ownerId: userId, createdAt: serverTimestamp(),
    likes: 0, likedBy: [], comments: 0,
    flagged: false, flagReason: "", pinned: false
  });
  alert("Video submitted for review!");
  document.getElementById("modal-overlay").classList.remove("open");
};

window.toggleVideoLike = async function(videoId) {
  const ref = doc(db, "videos", videoId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const liked = (data.likedBy || []).includes(userId);
  if (liked) {
    await updateDoc(ref, { likes: Math.max((data.likes || 1) - 1, 0), likedBy: arrayRemove(userId) });
  } else {
    await updateDoc(ref, { likes: (data.likes || 0) + 1, likedBy: arrayUnion(userId) });
  }
};

window.addVideoComment = async function(videoId) {
  const input = document.getElementById(`vcomment-${videoId}`);
  const text = input.value.trim();
  const now = Date.now();
  if (now - lastCommentTime < 10000) return alert("Slow down");
  if (!text) return;
  if (text.length > 200) return alert("Too long");
  const check = moderateContent(text);
  if (!check.allowed && check.autoDelete) return alert("Comment blocked: " + check.reason);
  await addDoc(collection(db, "videos", videoId, "comments"), {
    text, user: displayName, ownerId: userId, time: now,
    flagged: !check.allowed, likes: 0, likedBy: [], pinned: false
  });
  await updateDoc(doc(db, "videos", videoId), { comments: increment(1) });
  lastCommentTime = now;
  localStorage.setItem("lastCommentTime", now);
  input.value = "";
};

window.editVideo = async function(id, oldTitle, oldCreator) {
  const ref = doc(db, "videos", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().ownerId !== userId && !isAdmin) return alert("Not your video");
  const newTitle = prompt("Edit title:", oldTitle);
  const newCreator = prompt("Edit creator:", oldCreator);
  if (!newTitle || !newCreator) return;
  await updateDoc(ref, { title: newTitle, creator: newCreator });
};

window.deleteVideo = async function(id) {
  const ref = doc(db, "videos", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().ownerId !== userId && !isAdmin) return alert("Not your video");
  if (!confirm("Delete?")) return;
  await deleteDoc(ref);
};

window.adminDeleteVideo = async function(id) {
  await deleteDoc(doc(db, "videos", id));
};

window.reportVideo = function(videoId) {
  showReportModal("Report Video", async () => {
    const selected = document.querySelector('input[name="report-reason"]:checked');
    if (!selected) return alert("Please select a reason");
    await updateDoc(doc(db, "videos", videoId), { flagged: true, flagReason: selected.value, reportedBy: arrayUnion(userId) });
    document.getElementById("modal-overlay").classList.remove("open");
    alert("Report submitted. Thank you.");
  });
};

window.unflagVideo = async function(id) {
  await updateDoc(doc(db, "videos", id), { flagged: false, flagReason: "" });
};

window.pinVideo = async function(id, currentlyPinned) {
  await updateDoc(doc(db, "videos", id), { pinned: !currentlyPinned });
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
    let videos = [];
    snapshot.forEach(d => {
      const data = d.data();
      if (data.flagged && !isAdmin) return;
      videos.push({ id: d.id, ...data });
    });
    videos.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return getInterestScore(b.title + " " + (b.creator || "")) - getInterestScore(a.title + " " + (a.creator || ""));
    });
    videos.forEach(v => {
      const isOwner = v.ownerId === userId;
      const liked = (v.likedBy || []).includes(userId);
      const div = document.createElement("div");
      div.className = "yt-card";
      div.innerHTML = `
        ${v.pinned ? `<div style="padding:4px 10px;font-size:11px;color:#00bcd4;font-weight:600;">📌 Pinned</div>` : ""}
        ${v.flagged && isAdmin ? `
          <div style="background:#fff3e0;padding:8px 10px;font-size:12px;color:#f57c00;display:flex;align-items:center;justify-content:space-between;">
            <span>⚠️ ${sanitize(v.flagReason)}</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-danger" style="font-size:11px;padding:3px 8px;" onclick="window.adminDeleteVideo('${v.id}')">🗑 Remove</button>
              <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px;" onclick="window.unflagVideo('${v.id}')">✅ Keep</button>
            </div>
          </div>
        ` : ""}
        <div class="yt-thumb" onclick="this.nextElementSibling.style.display='block';this.style.display='none';window.trackInterest('${sanitize(v.title)}')">
          <img src="https://img.youtube.com/vi/${sanitize(v.youtubeId)}/hqdefault.jpg" onerror="this.src='https://img.youtube.com/vi/${sanitize(v.youtubeId)}/mqdefault.jpg'">
          <div class="yt-play">▶</div>
        </div>
        <div class="yt-player" style="display:none">
          <iframe src="https://www.youtube.com/embed/${sanitize(v.youtubeId)}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
        </div>
        <div class="yt-info">
          <div class="yt-title">${sanitize(v.title)}</div>
          <div class="yt-creator">🎬 ${sanitize(v.creator)}</div>
          <div class="card-actions" style="margin-top:8px;flex-wrap:wrap;">
            <button class="btn btn-ghost" onclick="window.toggleVideoLike('${v.id}')">${liked ? "♥" : "♡"} ${v.likes || 0}</button>
            <button class="btn btn-ghost" onclick="window.reportVideo('${v.id}')">🚩</button>
            ${isOwner || isAdmin ? `
              <button class="btn btn-ghost" onclick="window.editVideo('${v.id}', \`${sanitize(v.title)}\`, \`${sanitize(v.creator)}\`)">✎ Edit</button>
              <button class="btn btn-danger" onclick="window.deleteVideo('${v.id}')">🗑</button>
            ` : ""}
            ${isAdmin ? `<button class="btn ${v.pinned ? 'btn-pinned' : 'btn-pin'}" onclick="window.pinVideo('${v.id}', ${v.pinned || false})">${v.pinned ? "📌 Unpin" : "📌 Pin"}</button>` : ""}
          </div>
          <div class="comments-section">
            <div id="vcomments-${v.id}"></div>
            <div class="comment-input-row">
              <input id="vcomment-${v.id}" placeholder="Write a comment...">
              <button class="btn btn-primary" onclick="window.addVideoComment('${v.id}')">→</button>
            </div>
          </div>
        </div>
      `;
      feed.appendChild(div);
      loadCommentsGeneric(["videos", v.id, "comments"], `vcomments-${v.id}`, v.ownerId);
    });
  }, err => console.error("Videos error:", err));
}

// ── GROUPS ──
window.submitGroup = async function() {
  const name = document.getElementById("modal-group-name").value.trim();
  const desc = document.getElementById("modal-group-desc").value.trim();
  const emoji = document.getElementById("modal-group-emoji").value.trim() || "👥";
  if (!name || !desc) return alert("Fill in all fields");
  if (name.length > 50) return alert("Name too long");
  await addDoc(collection(db, "groups"), {
    name, desc, emoji, createdBy: userId, ownerId: userId,
    memberCount: 1, createdAt: serverTimestamp(), pinned: false
  });
  document.getElementById("modal-overlay").classList.remove("open");
};

window.openGroup = function(groupId, groupName) {
  currentGroupId = groupId;
  currentGroupName = groupName;
  trackInterest(groupName);
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

window.pinGroup = async function(groupId, currentlyPinned) {
  await updateDoc(doc(db, "groups", groupId), { pinned: !currentlyPinned });
};

window.adminDeleteGroup = async function(id) {
  await deleteDoc(doc(db, "groups", id));
};

function loadGroups() {
  onSnapshot(collection(db, "groups"), snapshot => {
    const feed = document.getElementById("groups-feed");
    feed.innerHTML = "";
    if (snapshot.empty) {
      feed.innerHTML = `<div class="empty-msg">No groups yet. Create one!</div>`;
      return;
    }
    let groups = [];
    snapshot.forEach(d => groups.push({ id: d.id, ...d.data() }));
    groups.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return getInterestScore(b.name + " " + b.desc) - getInterestScore(a.name + " " + a.desc);
    });
    groups.forEach(g => {
      const isOwner = g.ownerId === userId || g.createdBy === userId;
      const div = document.createElement("div");
      div.className = g.pinned ? "group-card pinned-card" : "group-card";
      div.onclick = () => window.openGroup(g.id, g.name);
      div.innerHTML = `
        ${g.pinned ? `<div class="pinned-label">📌 Pinned</div>` : ""}
        <div class="group-card-top">
          <span class="group-emoji">${sanitize(g.emoji || "👥")}</span>
          <span class="group-name">${sanitize(g.name)}</span>
        </div>
        <div class="group-desc">${sanitize(g.desc)}</div>
        <div class="group-meta">
          <span>${g.memberCount || 0} members</span>
          <div style="display:flex;gap:6px;">
            ${isAdmin ? `<button class="btn ${g.pinned ? 'btn-pinned' : 'btn-pin'}" onclick="event.stopPropagation();window.pinGroup('${g.id}', ${g.pinned || false})">${g.pinned ? "📌 Unpin" : "📌 Pin"}</button>` : ""}
            ${isOwner || isAdmin ? `<button class="btn btn-danger" style="font-size:12px;padding:4px 8px;" onclick="event.stopPropagation();window.adminDeleteGroup('${g.id}')">🗑</button>` : ""}
          </div>
        </div>
      `;
      feed.appendChild(div);
    });
  }, err => console.error("Groups error:", err));
}

// ── GROUP POSTS ──
window.submitGroupPost = async function() {
  const title = document.getElementById("modal-gpost-title").value.trim();
  const content = document.getElementById("modal-gpost-content").value.trim();
  const now = Date.now();
  if (!title || !content) return alert("Fill in all fields");
  if (title.length > 80) return alert("Title too long");
  if (content.length > 500) return alert("Too long");
  const check = moderateContent(title + " " + content);
  if (!check.allowed && check.autoDelete) return alert("Post blocked: " + check.reason);
  await addDoc(collection(db, "groups", currentGroupId, "posts"), {
    title, content, user: displayName, ownerId: userId,
    createdAt: serverTimestamp(), likes: 0, likedBy: [], commentsCount: 0,
    flagged: !check.allowed, pinned: false
  });
  document.getElementById("modal-overlay").classList.remove("open");
};

window.toggleGroupPostLike = async function(groupId, postId) {
  const ref = doc(db, "groups", groupId, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const liked = (data.likedBy || []).includes(userId);
  if (liked) {
    await updateDoc(ref, { likes: Math.max((data.likes || 1) - 1, 0), likedBy: arrayRemove(userId) });
  } else {
    await updateDoc(ref, { likes: (data.likes || 0) + 1, likedBy: arrayUnion(userId) });
    trackInterest((data.title || "") + " " + (data.content || ""));
  }
};

window.addGroupComment = async function(groupId, postId) {
  const input = document.getElementById(`gcomment-${postId}`);
  const text = input.value.trim();
  const now = Date.now();
  if (now - lastCommentTime < 10000) return alert("Slow down");
  if (!text) return;
  if (text.length > 200) return alert("Too long");
  const check = moderateContent(text);
  if (!check.allowed && check.autoDelete) return alert("Comment blocked: " + check.reason);
  await addDoc(collection(db, "groups", groupId, "posts", postId, "comments"), {
    text, user: displayName, ownerId: userId, time: now,
    flagged: !check.allowed, likes: 0, likedBy: [], pinned: false
  });
  await updateDoc(doc(db, "groups", groupId, "posts", postId), { commentsCount: increment(1) });
  lastCommentTime = now;
  localStorage.setItem("lastCommentTime", now);
  input.value = "";
};

window.editGroupPost = async function(groupId, postId, oldTitle, oldContent) {
  const ref = doc(db, "groups", groupId, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().ownerId !== userId && !isAdmin) return alert("Not your post");
  const newTitle = prompt("Edit title:", oldTitle);
  const newContent = prompt("Edit content:", oldContent);
  if (!newTitle || !newContent) return;
  await updateDoc(ref, { title: newTitle, content: newContent });
};

window.deleteGroupPost = async function(groupId, postId) {
  const ref = doc(db, "groups", groupId, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().ownerId !== userId && !isAdmin) return alert("Not your post");
  if (!confirm("Delete?")) return;
  await deleteDoc(ref);
};

window.adminDeleteGroupPost = async function(groupId, postId) {
  await deleteDoc(doc(db, "groups", groupId, "posts", postId));
};

window.reportGroupPost = function(groupId, postId) {
  showReportModal("Report Post", async () => {
    const selected = document.querySelector('input[name="report-reason"]:checked');
    if (!selected) return alert("Please select a reason");
    await updateDoc(doc(db, "groups", groupId, "posts", postId), { flagged: true, flagReason: selected.value, reportedBy: arrayUnion(userId) });
    document.getElementById("modal-overlay").classList.remove("open");
    alert("Report submitted. Thank you.");
  });
};

window.unflagGroupPost = async function(groupId, postId) {
  await updateDoc(doc(db, "groups", groupId, "posts", postId), { flagged: false, flagReason: "" });
};

window.pinGroupPost = async function(groupId, postId, currentlyPinned) {
  await updateDoc(doc(db, "groups", groupId, "posts", postId), { pinned: !currentlyPinned });
};

function loadGroupPosts(groupId) {
  onSnapshot(collection(db, "groups", groupId, "posts"), snapshot => {
    const feed = document.getElementById("group-posts-feed");
    const now = Date.now();
    let posts = [];
    snapshot.forEach(d => {
      const raw = d.data();
      if (raw.flagged && !isAdmin) return;
      const p = {
        title: raw.title || "", content: raw.content || "",
        user: raw.user || "Unknown", ownerId: raw.ownerId || "",
        createdAt: raw.createdAt || null,
        likes: Number(raw.likes) || 0,
        likedBy: Array.isArray(raw.likedBy) ? raw.likedBy : [],
        commentsCount: Number(raw.commentsCount) || 0,
        pinned: raw.pinned || false,
        flagged: raw.flagged || false, flagReason: raw.flagReason || ""
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
    posts.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.score - a.score;
    });
    feed.innerHTML = "";
    if (posts.length === 0) {
      feed.innerHTML = `<div class="empty-msg">No posts yet. Be the first!</div>`;
      return;
    }
    posts.forEach(post => {
      const isOwner = post.ownerId === userId;
      const liked = post.likedBy.includes(userId);
      const div = document.createElement("div");
      div.className = post.pinned ? "card pinned-card" : "card";
      div.innerHTML = `
        ${post.pinned ? `<div class="pinned-label">📌 Pinned</div>` : ""}
        ${post.flagged && isAdmin ? `
          <div style="background:#fff3e0;padding:10px;border-radius:10px;font-size:13px;color:#f57c00;display:flex;flex-direction:column;gap:8px;">
            <span>⚠️ Reported: <b>${sanitize(post.flagReason)}</b></span>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-danger" onclick="window.adminDeleteGroupPost('${groupId}', '${post.id}')">🗑 Remove</button>
              <button class="btn btn-ghost" onclick="window.unflagGroupPost('${groupId}', '${post.id}')">✅ Keep</button>
            </div>
          </div>
        ` : ""}
        <h3>${sanitize(post.title)}</h3>
        <p>${sanitize(post.content)}</p>
        <small>${sanitize(post.user)}</small>
        <div class="card-actions">
          <button class="btn btn-ghost" onclick="window.toggleGroupPostLike('${groupId}', '${post.id}')">${liked ? "♥" : "♡"} ${post.likes}</button>
          <button class="btn btn-ghost" onclick="window.reportGroupPost('${groupId}', '${post.id}')">🚩</button>
          ${isOwner || isAdmin ? `
            <button class="btn btn-ghost" onclick="window.editGroupPost('${groupId}', '${post.id}', \`${sanitize(post.title)}\`, \`${sanitize(post.content)}\`)">✎ Edit</button>
            <button class="btn btn-danger" onclick="window.deleteGroupPost('${groupId}', '${post.id}')">🗑</button>
          ` : ""}
          ${isAdmin ? `<button class="btn ${post.pinned ? 'btn-pinned' : 'btn-pin'}" onclick="window.pinGroupPost('${groupId}', '${post.id}', ${post.pinned})">${post.pinned ? "📌 Unpin" : "📌 Pin"}</button>` : ""}
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
      loadCommentsGeneric(["groups", groupId, "posts", post.id, "comments"], `gcomments-${post.id}`, post.ownerId);
    });
  }, err => console.error("Group posts error:", err));
}

// ── CONTACTS ──
window.submitContact = async function() {
  const name = document.getElementById("modal-contact-name").value.trim();
  const note = document.getElementById("modal-contact-note").value.trim();
  const number = document.getElementById("modal-contact-number").value.trim();
  const textNumber = document.getElementById("modal-contact-text").value.trim();
  if (!name) return alert("Add a display name");
  await addDoc(collection(db, "contacts"), {
    name, note, number, textNumber, createdAt: serverTimestamp(),
    ownerId: userId, pinned: false, flagged: false, flagReason: "",
    likes: 0, likedBy: []
  });
  document.getElementById("modal-overlay").classList.remove("open");
};

window.toggleContactLike = async function(contactId) {
  const ref = doc(db, "contacts", contactId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const liked = (data.likedBy || []).includes(userId);
  if (liked) {
    await updateDoc(ref, { likes: Math.max((data.likes || 1) - 1, 0), likedBy: arrayRemove(userId) });
  } else {
    await updateDoc(ref, { likes: (data.likes || 0) + 1, likedBy: arrayUnion(userId) });
  }
};

window.addContactComment = async function(contactId) {
  const input = document.getElementById(`ccomment-${contactId}`);
  const text = input.value.trim();
  const now = Date.now();
  if (now - lastCommentTime < 10000) return alert("Slow down");
  if (!text) return;
  if (text.length > 200) return alert("Too long");
  const check = moderateContent(text);
  if (!check.allowed && check.autoDelete) return alert("Comment blocked: " + check.reason);
  await addDoc(collection(db, "contacts", contactId, "comments"), {
    text, user: displayName, ownerId: userId, time: now,
    flagged: !check.allowed, likes: 0, likedBy: [], pinned: false
  });
  lastCommentTime = now;
  localStorage.setItem("lastCommentTime", now);
  input.value = "";
};

window.editContact = async function(id, oldName, oldNote) {
  const ref = doc(db, "contacts", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().ownerId !== userId && !isAdmin) return alert("Not your card");
  const newName = prompt("Edit name:", oldName);
  const newNote = prompt("Edit note:", oldNote);
  if (!newName) return;
  await updateDoc(ref, { name: newName, note: newNote || "" });
};

window.deleteContact = async function(id) {
  const ref = doc(db, "contacts", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().ownerId !== userId && !isAdmin) return alert("Not your card");
  if (!confirm("Delete?")) return;
  await deleteDoc(ref);
};

window.adminDeleteContact = async function(id) {
  await deleteDoc(doc(db, "contacts", id));
};

window.reportContact = function(contactId) {
  showReportModal("Report Contact", async () => {
    const selected = document.querySelector('input[name="report-reason"]:checked');
    if (!selected) return alert("Please select a reason");
    await updateDoc(doc(db, "contacts", contactId), { flagged: true, flagReason: selected.value, reportedBy: arrayUnion(userId) });
    document.getElementById("modal-overlay").classList.remove("open");
    alert("Report submitted. Thank you.");
  });
};

window.unflagContact = async function(id) {
  await updateDoc(doc(db, "contacts", id), { flagged: false, flagReason: "" });
};

window.pinContact = async function(contactId, currentlyPinned) {
  await updateDoc(doc(db, "contacts", contactId), { pinned: !currentlyPinned });
};

function loadContacts() {
  onSnapshot(collection(db, "contacts"), snapshot => {
    const feed = document.getElementById("contacts-feed");
    feed.innerHTML = "";
    if (snapshot.empty) {
      feed.innerHTML = `<div class="empty-msg">No contact cards yet.</div>`;
      return;
    }
    let contacts = [];
    snapshot.forEach(d => {
      const data = d.data();
      if (data.flagged && !isAdmin) return;
      contacts.push({ id: d.id, ...data });
    });
    contacts.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return getInterestScore(b.name + " " + (b.note || "")) - getInterestScore(a.name + " " + (a.note || ""));
    });
    contacts.forEach(c => {
      const isOwner = c.ownerId === userId;
      const liked = (c.likedBy || []).includes(userId);
      const div = document.createElement("div");
      div.className = c.pinned ? "contact-card pinned-card" : "contact-card";
      div.innerHTML = `
        ${c.pinned ? `<div class="pinned-label">📌 Pinned</div>` : ""}
        ${c.flagged && isAdmin ? `
          <div style="background:#fff3e0;padding:10px;border-radius:10px;font-size:13px;color:#f57c00;display:flex;flex-direction:column;gap:8px;">
            <span>⚠️ Reported: <b>${sanitize(c.flagReason)}</b></span>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-danger" onclick="window.adminDeleteContact('${c.id}')">🗑 Remove</button>
              <button class="btn btn-ghost" onclick="window.unflagContact('${c.id}')">✅ Keep</button>
            </div>
          </div>
        ` : ""}
        <div class="contact-name">${sanitize(c.name)}</div>
        ${c.note ? `<div class="contact-note">${sanitize(c.note)}</div>` : ""}
        <div class="contact-btns">
          ${c.number ? `<a href="tel:${sanitize(c.number)}" class="btn btn-call">📞 ${sanitize(c.number)}</a>` : ""}
          ${c.textNumber ? `<a href="sms:${sanitize(c.textNumber)}" class="btn btn-primary">💬 ${sanitize(c.textNumber)}</a>` : ""}
          <button class="btn btn-ghost" onclick="window.toggleContactLike('${c.id}')">${liked ? "♥" : "♡"} ${c.likes || 0}</button>
          <button class="btn btn-ghost" onclick="window.reportContact('${c.id}')">🚩</button>
          ${isOwner || isAdmin ? `
            <button class="btn btn-ghost" onclick="window.editContact('${c.id}', \`${sanitize(c.name)}\`, \`${sanitize(c.note || '')}\`)">✎ Edit</button>
            <button class="btn btn-danger" onclick="window.deleteContact('${c.id}')">🗑</button>
          ` : ""}
          ${isAdmin ? `<button class="btn ${c.pinned ? 'btn-pinned' : 'btn-pin'}" onclick="window.pinContact('${c.id}', ${c.pinned || false})">${c.pinned ? "📌 Unpin" : "📌 Pin"}</button>` : ""}
        </div>
        <div class="comments-section">
          <div id="ccomments-${c.id}"></div>
          <div class="comment-input-row">
            <input id="ccomment-${c.id}" placeholder="Write a comment...">
            <button class="btn btn-primary" onclick="window.addContactComment('${c.id}')">→</button>
          </div>
        </div>
      `;
      feed.appendChild(div);
      loadCommentsGeneric(["contacts", c.id, "comments"], `ccomments-${c.id}`, c.ownerId);
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

window.switchTab = window.switchTab;
window.openPostModal = window.openPostModal;
window.closeModal = window.closeModal;
window.trackInterest = trackInterest;
