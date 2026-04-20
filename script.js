const firebaseConfig = {
  apiKey: "AIzaSyBzegyz_g4EsaQd09wgAnIFlf8iYERY0sw",
  authDomain: "lives-saved-through-shar-4b7e4.firebaseapp.com",
  projectId: "lives-saved-through-shar-4b7e4",
  storageBucket: "lives-saved-through-shar-4b7e4.firebasestorage.app",
  messagingSenderId: "916853783639",
  appId: "1:916853783639:web:d6ef4757f560a61e9b3712"
};

// 1. Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Add this at the VERY top of your script
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  console.log("Debug mode enabled. Checking for token...");
}

// ... your firebase.initializeApp(firebaseConfig) ...

const appCheck = firebase.appCheck();
appCheck.activate("6Ld-W8AsAAAAAFb16D3uMshuM2lRQ6HyHkUAXwR9", true);

let db = firebase.firestore(); // Initialize DB immediately

// 4. Single-run initialization check
let appInitialized = false;

firebase.appCheck().getToken().then(() => {
    console.log("App Check verified successfully");
    if (!appInitialized) {
        startApp();
        appInitialized = true;
    }
}).catch((err) => {
    console.error("App Check failed to verify:", err);
    // Even if it fails, we start the app so the user sees a message 
    // rather than a white screen, but saving will be blocked if Enforced.
    startApp(); 
});

function startApp() {
  console.log("Starting App...");
  
  const msg = document.getElementById("loading-msg");
  if (msg) msg.style.opacity = "0";
  setTimeout(() => { if (msg) msg.remove(); }, 500);

  const btn = document.getElementById("post-btn");
  if (btn) btn.disabled = false;

  loadPosts();
}

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

function postStory() {
  if (!db) return alert("Still loading, please wait a moment and try again.");

  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const now = Date.now();

  if (now - lastPostTime < 30000) return alert("Wait before posting again");
  if (!title || !content) return;
  if (title.length > 80) return alert("Title too long");
  if (content.length > 500) return alert("Story too long");
  if (containsBadWords(title) || containsBadWords(content)) return alert("Blocked");

  db.collection("posts").add({
    title,
    content,
    user: displayName,
    ownerId: userId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    likes: 0,
    likedBy: [],
    commentsCount: 0
  });

  lastPostTime = now;
  localStorage.setItem("lastPostTime", now);
  document.getElementById("title").value = "";
  document.getElementById("content").value = "";
}

function likePost(postId) {
  if (!db) return alert("Still loading, please try again.");
  const ref = db.collection("posts").doc(postId);

  ref.get().then(doc => {
    if (!doc.exists) return;
    const data = doc.data();
    if ((data.likedBy || []).includes(userId)) return alert("Already liked");

    ref.update({
      likes: (data.likes || 0) + 1,
      likedBy: firebase.firestore.FieldValue.arrayUnion(userId)
    });
  });
}

function addComment(postId) {
  if (!db) return alert("Still loading, please try again.");
  const input = document.getElementById(`comment-${postId}`);
  const text = input.value.trim();
  const now = Date.now();

  if (now - lastCommentTime < 10000) return alert("Slow down");
  if (!text) return;
  if (text.length > 200) return alert("Too long");
  if (containsBadWords(text)) return alert("Blocked");

  const postRef = db.collection("posts").doc(postId);

  postRef.collection("comments").add({
    text,
    user: displayName,
    time: now
  });

  postRef.update({
    commentsCount: firebase.firestore.FieldValue.increment(1)
  });

  lastCommentTime = now;
  localStorage.setItem("lastCommentTime", now);
  input.value = "";
}

function loadComments(postId) {
  db.collection("posts")
    .doc(postId)
    .collection("comments")
    .orderBy("time")
    .onSnapshot(snapshot => {
      const div = document.getElementById(`comments-${postId}`);
      if (!div) return;
      let html = "";
      snapshot.forEach(doc => {
        const c = doc.data();
        html += `<p><b>${sanitize(c.user)}:</b> ${sanitize(c.text)}</p>`;
      });
      div.innerHTML = html;
    });
}

function editPost(id, oldTitle, oldContent) {
  if (!db) return alert("Still loading, please try again.");
  const ref = db.collection("posts").doc(id);

  ref.get().then(doc => {
    if (!doc.exists) return;
    const data = doc.data();
    if (data.ownerId !== userId) return alert("Not your post");

    const newTitle = prompt("Edit title:", oldTitle);
    const newContent = prompt("Edit content:", oldContent);
    if (!newTitle || !newContent) return;
    if (newTitle.length > 80) return alert("Title too long");
    if (newContent.length > 500) return alert("Story too long");

    ref.update({ title: newTitle, content: newContent });
  });
}

function deletePost(id) {
  if (!db) return alert("Still loading, please try again.");
  const ref = db.collection("posts").doc(id);

  ref.get().then(doc => {
    if (!doc.exists) return;
    const data = doc.data();
    if (data.ownerId !== userId) return alert("Not your post");
    if (!confirm("Delete?")) return;
    ref.delete();
  });
}

function loadPosts() {
  db.collection("posts").onSnapshot(snapshot => {
    console.log("Snapshot fired");
    const postsDiv = document.getElementById("posts");
    const now = Date.now();
    let posts = [];

    snapshot.forEach(doc => {
      const p = doc.data();
      const id = doc.id;
      const time = p.createdAt?.toMillis?.() || now;
      const hoursOld = (now - time) / (1000 * 60 * 60);

      const likes = p.likes || 0;
      const comments = p.commentsCount || 0;
      const engagement = (likes * 1.0) + (comments * 1.5);
      const decay = Math.pow(hoursOld + 2, 1.5);
      const boost = hoursOld < 1 ? 2.0 : 1.0;
      const score = (engagement / decay) * boost;

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
        <button onclick="likePost('${post.id}')">♡ ${post.likes || 0}</button>
        ${isOwner ? `
          <button onclick="editPost('${post.id}', \`${sanitize(post.title)}\`, \`${sanitize(post.content)}\`)">✎</button>
          <button onclick="deletePost('${post.id}')">🗑</button>
        ` : ""}
        <div class="comments">
          <input id="comment-${post.id}" placeholder="Write a comment...">
          <button onclick="addComment('${post.id}')">Comment</button>
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
