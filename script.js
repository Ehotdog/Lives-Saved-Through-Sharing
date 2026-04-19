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

// -----------------------------
// USER SETUP
// -----------------------------
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

// -----------------------------
// BASIC FILTER
// -----------------------------
function containsBadWords(text) {
  const banned = ["spam", "badword1", "badword2"];
  return banned.some(word => text.toLowerCase().includes(word));
}

// -----------------------------
// POST STORY
// -----------------------------
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

// -----------------------------
// LIKE POST
// -----------------------------
function likePost(postId) {
  const postRef = db.collection("posts").doc(postId);

  postRef.get().then(doc => {
    const data = doc.data();

    if ((data.likedBy || []).includes(userId)) {
      return alert("Already liked");
    }

    postRef.update({
      likes: (data.likes || 0) + 1,
      likedBy: [...(data.likedBy || []), userId]
    });
  });
}

// -----------------------------
// COMMENTS
// -----------------------------
function addComment(postId) {
  const input = document.getElementById(`comment-${postId}`);
  const text = input.value.trim();

  const now = Date.now();

  if (now - lastCommentTime < 10000) return alert("Slow down commenting");
  if (!text) return;
  if (text.length > 200) return alert("Comment too long");
  if (containsBadWords(text)) return alert("Inappropriate comment");

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

// -----------------------------
// LOAD COMMENTS
// -----------------------------
function loadComments(postId) {
  db.collection("posts")
    .doc(postId)
    .collection("comments")
    .orderBy("time")
    .onSnapshot(snapshot => {
      const div = document.getElementById(`comments-${postId}`);
      if (!div) return;

      div.innerHTML = "";

      snapshot.forEach(doc => {
        const c = doc.data();
        div.innerHTML += `<p><b>${c.user}:</b> ${c.text}</p>`;
      });
    });
}

// -----------------------------
// EDIT POST
// -----------------------------
function editPost(id, oldTitle, oldContent) {
  const postRef = db.collection("posts").doc(id);

  postRef.get().then(doc => {
    const data = doc.data();
    if (data.ownerId !== userId) return alert("Not your post");

    const newTitle = prompt("Edit title:", oldTitle);
    const newContent = prompt("Edit content:", oldContent);

    if (!newTitle || !newContent) return;

    postRef.update({
      title: newTitle,
      content: newContent
    });
  });
}

// -----------------------------
// DELETE POST
// -----------------------------
function deletePost(id) {
  const postRef = db.collection("posts").doc(id);

  postRef.get().then(doc => {
    const data = doc.data();
    if (data.ownerId !== userId) return alert("Not your post");

    if (!confirm("Delete this post?")) return;

    postRef.delete();
  });
}

// -----------------------------
// REALTIME FEED (FIXED VERSION)
// -----------------------------
function loadPosts() {
  db.collection("posts")
    .onSnapshot(snapshot => {
      console.log("Snapshot fired");

      const postsDiv = document.getElementById("posts");
      if (!postsDiv) return;

      postsDiv.innerHTML = "";

      let posts = [];

      snapshot.forEach(doc => {
        posts.push({ id: doc.id, ...doc.data() });
      });

      posts.reverse();

      posts.forEach(post => {
        const isOwner = post.ownerId === userId;

        postsDiv.innerHTML += `
          <div class="post">
            <h3>${post.title}</h3>
            <p>${post.content}</p>
            <small>${post.user}</small>

            <br><br>

            <button onclick="likePost('${post.id}')">
              ♡ ${post.likes || 0}
            </button>

            ${isOwner ? `
              <button onclick="editPost('${post.id}', \`${post.title}\`, \`${post.content}\`)">✎</button>
              <button onclick="deletePost('${post.id}')">🗑</button>
            ` : ""}

            <div class="comments">
              <input id="comment-${post.id}" placeholder="Write a comment...">
              <button onclick="addComment('${post.id}')">Comment</button>

              <div id="comments-${post.id}"></div>
            </div>
          </div>
        `;

        loadComments(post.id);
      });
    }, err => {
      console.log("Snapshot error:", err);
    });
}

// -----------------------------
// START APP
// -----------------------------
loadPosts();
