import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check.js";
import {
  getFirestore, collection, doc, addDoc, getDoc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, increment, arrayUnion,
  serverTimestamp
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

// Wait for a valid App Check token before doing ANYTHING with Firestore
getToken(appCheck, false).then(() => {
  console.log("App Check token ready");
  const msg = document.getElementById("loading-msg");
  if (msg) msg.remove();
  const btn = document.getElementById("post-btn");
  if (btn) btn.disabled = false;
  loadPosts();
}).catch(err => {
  console.error("App Check failed:", err);
  document.getElementById("loading-msg").textContent = "Security check failed. Please refresh.";
});

let userId = localStorage.getItem("userId");
if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem("userId", userId);
}

let displayName = localStorage.getItem("displayName");
if (!displayName) {
  displayName = "User" + Math.floor(Math.random() * 9999);
  localStorage.setItem("displayName", displayName);
}

let lastPostTime = parseInt(localStorage.getItem("lastPostTime")) || 0;
let lastCommentTime = parseInt(localStorage.getItem("lastCommentTime")) || 0;

function sanitize(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function containsBadWords(text) {
  const banned = ["spam", "badword1", "badword2"];
  return banned.some(w => text.toLowerCase().includes(w));
}

// Remove loading message and enable button
const msg = document.getElementById("loading-msg");
if (msg) msg.remove();
const btn = document.getElementById("post-btn");
if (btn) btn.disabled = false;

// Start app immediately — App Check token is auto-attached by SDK
loadPosts();

async function postStory() {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const now = Date.now();

  if (now - lastPostTime < 30000) return alert("Wait before posting again");
  if (!title || !content) return;
  if (title.length > 80) return alert("Title too long");
  if (content.length > 500) return alert("Story too long");
  if (containsBadWords(title) || containsBadWords(content)) return alert("Blocked");

  await addDoc(collection(db, "posts"), {
    title,
    content,
    user: displayName,
    ownerId: userId,
    createdAt: serverTimestamp(),
    likes: 0,
    likedBy: [],
    commentsCount: 0
  });

  lastPostTime = now;
  localStorage.setItem("lastPostTime", now);
  document.getElementById("title").value = "";
  document.getElementById("content").value = "";
}

async function likePost(postId) {
  const ref = doc(db, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if ((data.likedBy || []).includes(userId)) return alert("Already liked");
  await updateDoc(ref, {
    likes: (data.likes || 0) + 1,
    likedBy: arrayUnion(userId)
  });
}

async function addComment(postId) {
  const input = document.getElementById(`comment-${postId}`);
  const text = input.value.trim();
  const now = Date.now();

  if (now - lastCommentTime < 10000) return alert("Slow down");
  if (!text) return;
  if (text.length > 200) return alert("Too long");
  if (containsBadWords(text)) return alert("Blocked");

  await addDoc(collection(db, "posts", postId, "comments"), {
    text,
    user: displayName,
    time: now
  });
  await updateDoc(doc(db, "posts", postId), {
    commentsCount: increment(1)
  });

  lastCommentTime = now;
  localStorage.setItem("lastCommentTime", now);
  input.value = "";
}

function loadComments(postId) {
  const q = query(collection(db, "posts", postId, "comments"), orderBy("time"));
  onSnapshot(q, snapshot => {
    const div = document.getElementById(`comments-${postId}`);
    if (!div) return;
    let html = "";
    snapshot.forEach(d => {
      const c = d.data();
      html += `<p><b>${sanitize(c.user)}:</b> ${sanitize(c.text)}</p>`;
    });
    div.innerHTML = html;
  });
}

async function editPost(id, oldTitle, oldContent) {
  const ref = doc(db, "posts", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if (data.ownerId !== userId) return alert("Not your post");
  const newTitle = prompt("Edit title:", oldTitle);
  const newContent = prompt("Edit content:", oldContent);
  if (!newTitle || !newContent) return;
  if (newTitle.length > 80) return alert("Title too long");
  if (newContent.length > 500) return alert("Story too long");
  await updateDoc(ref, { title: newTitle, content: newContent });
}

async function deletePost(id) {
  const ref = doc(db, "posts", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if (data.ownerId !== userId) return alert("Not your post");
  if (!confirm("Delete?")) return;
  await deleteDoc(ref);
}

function loadPosts() {
  onSnapshot(collection(db, "posts"), snapshot => {
    console.log("Snapshot fired");
    const postsDiv = document.getElementById("posts");
    const now = Date.now();
    let posts = [];

    snapshot.forEach(d => {
      const p = d.data();
      const id = d.id;
      const time = p.createdAt?.toMillis?.() || now;
      const hoursOld = (now - time) / (1000 * 60 * 60);
      const likes = p.likes || 0;
      const comments = p.commentsCount || 0;

      const engagement = (likes * 2.0) + (comments * 3.0);
      const viral = Math.log1p(likes + comments * 2);
      const decay = Math.pow(hoursOld + 1, 0.6);
      const score = (engagement + viral) / decay;

      posts.push({ id, ...p, score });
    });

    posts.sort((a, b) => b.score - a.score);
    postsDiv.innerHTML = "";

    posts.forEach(post => {
      const isOwner = post.ownerId === userId;
      const div = document.createElement("div");
      div.className = "post";
      div.innerHTML = `
        <h3>${sanitize(post.title)}</h3>
        <p>${sanitize(post.content)}</p>
        <small>${sanitize(post.user || "Unknown")}</small>
        <br><br>
        <button onclick="window.likePost('${post.id}')">♡ ${post.likes || 0}</button>
        ${isOwner ? `
          <button onclick="window.editPost('${post.id}', \`${sanitize(post.title)}\`, \`${sanitize(post.content)}\`)">✎</button>
          <button onclick="window.deletePost('${post.id}')">🗑</button>
        ` : ""}
        <div class="comments">
          <input id="comment-${post.id}" placeholder="Write a comment...">
          <button onclick="window.addComment('${post.id}')">Comment</button>
          <div id="comments-${post.id}"></div>
        </div>
      `;
      postsDiv.appendChild(div);
      loadComments(post.id);
    });

  }, err => {
    console.error("Snapshot error:", err);
  });
}

// Expose functions to window since we're using type="module"
window.postStory = postStory;
window.likePost = likePost;
window.addComment = addComment;
window.editPost = editPost;
window.deletePost = deletePost;
