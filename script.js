const firebaseConfig = {
  apiKey: "AIzaSyBzegyz_g4EsaQd09wgAnIFlf8iYERY0sw",
  authDomain: "lives-saved-through-shar-4b7e4.firebaseapp.com",
  projectId: "lives-saved-through-shar-4b7e4",
  storageBucket: "lives-saved-through-shar-4b7e4.firebasestorage.app",
  messagingSenderId: "916853783639",
  appId: "1:916853783639:web:827800545fc482e79b3712"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

firebase.appCheck().activate(
  "6Lfkt78sAAAAABnmMnOAVnRjsT_5WfuQ9WKq3K4i",
  true
);

// ---------------- USER ----------------
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

let lastPostTime = localStorage.getItem("lastPostTime") || 0;
let lastCommentTime = localStorage.getItem("lastCommentTime") || 0;

// ---------------- FILTER ----------------
function containsBadWords(text) {
  const banned = ["spam", "badword1", "badword2"];
  return banned.some(w => text.toLowerCase().includes(w));
}

// ---------------- POST ----------------
function postStory() {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();

  const now = Date.now();

  if (now - lastPostTime < 30000) return alert("Wait before posting again");
  if (!title || !content) return;
  if (title.length > 80) return alert("Title too long");
  if (content.length > 500) return alert("Story too long");
  if (containsBadWords(title) || containsBadWords(content)) return alert("Inappropriate content");

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

// ---------------- LIKE ----------------
function likePost(postId) {
  const ref = db.collection("posts").doc(postId);

  ref.get().then(doc => {
    const data = doc.data();

    if ((data.likedBy || []).includes(userId)) {
      return alert("Already liked");
    }

    ref.update({
      likes: (data.likes || 0) + 1,
      likedBy: [...(data.likedBy || []), userId]
    });
  });
}

// ---------------- COMMENT ----------------
function addComment(postId) {
  const input = document.getElementById(`comment-${postId}`);
  const text = input.value.trim();

  const now = Date.now();

  if (now - lastCommentTime < 10000) return alert("Slow down");
  if (!text) return;
  if (text.length > 200) return alert("Too long");
  if (containsBadWords(text)) return alert("Blocked");

  db.collection("posts").doc(postId).collection("comments").add({
    text,
    user: displayName,
    time: now
  });

  db.collection("posts").doc(postId).update({
    commentsCount: firebase.firestore.FieldValue.increment(1)
  });

  lastCommentTime = now;
  localStorage.setItem("lastCommentTime", now);

  input.value = "";
}

// ---------------- COMMENTS LOAD ----------------
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
        html += `<p><b>${c.user}:</b> ${c.text}</p>`;
      });

      div.innerHTML = html;
    });
}

// ---------------- EDIT ----------------
function editPost(id, oldTitle, oldContent) {
  const ref = db.collection("posts").doc(id);

  ref.get().then(doc => {
    const data = doc.data();
    if (data.ownerId !== userId) return alert("Not your post");

    const newTitle = prompt("Edit title:", oldTitle);
    const newContent = prompt("Edit content:", oldContent);

    if (!newTitle || !newContent) return;

    ref.update({
      title: newTitle,
      content: newContent
    });
  });
}

// ---------------- DELETE ----------------
function deletePost(id) {
  const ref = db.collection("posts").doc(id);

  ref.get().then(doc => {
    const data = doc.data();
    if (data.ownerId !== userId) return alert("Not your post");

    if (!confirm("Delete?")) return;

    ref.delete();
  });
}

// ---------------- SAFE FEED ----------------
function loadPosts() {
  const postsDiv = document.getElementById("posts");

  if (!postsDiv) {
    console.log("Missing #posts div");
    return;
  }

  db.collection("posts")
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {

      console.log("Snapshot fired:", snapshot.size);

      let html = "";

      snapshot.forEach(doc => {
        const p = doc.data();
        const id = doc.id;
        const isOwner = p.ownerId === userId;

        html += `
          <div class="post">
            <h3>${p.title || ""}</h3>
            <p>${p.content || ""}</p>
            <small>${p.user || "Unknown"}</small>

            <br><br>

            <button onclick="likePost('${id}')">
              ♡ ${p.likes || 0}
            </button>

            ${isOwner ? `
              <button onclick="editPost('${id}', \`${p.title}\`, \`${p.content}\`)">✎</button>
              <button onclick="deletePost('${id}')">🗑</button>
            ` : ""}

            <div class="comments">
              <input id="comment-${id}" placeholder="Write a comment...">
              <button onclick="addComment('${id}')">Comment</button>

              <div id="comments-${id}"></div>
            </div>
          </div>
        `;
      });

      postsDiv.innerHTML = html;

      // attach comments AFTER render
      snapshot.forEach(doc => {
        loadComments(doc.id);
      });

    }, err => {
      console.log("Feed error:", err);
    });
}

// ---------------- START ----------------
loadPosts();
