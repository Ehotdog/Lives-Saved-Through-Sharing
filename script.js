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


function showTab(tab) {
  document.querySelectorAll(".tab").forEach(t => {
    t.style.display = "none";
  });

  const el = document.getElementById(tab);
  if (el) el.style.display = "block";
}


let lastPostTime = localStorage.getItem("lastPostTime") || 0;
let lastCommentTime = localStorage.getItem("lastCommentTime") || 0;


function containsBadWords(text) {
  const banned = ["spam", "badword1", "badword2"];
  return banned.some(word => text.toLowerCase().includes(word));
}


function postStory() {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();

  const now = Date.now();

  if (now - lastPostTime < 30000) {
    alert("Wait before posting again");
    return;
  }

  if (!title || !content) return;

  if (title.length > 80) {
    alert("Title too long");
    return;
  }

  if (content.length > 500) {
    alert("Story too long");
    return;
  }

  if (containsBadWords(title) || containsBadWords(content)) {
    alert("Inappropriate content");
    return;
  }

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

  showTab("fyp");
}


function likePost(postId) {
  const ref = db.collection("posts").doc(postId);

  ref.get().then(doc => {
    const data = doc.data();
    if (!data) return;

    const likedBy = data.likedBy || [];

    if (likedBy.includes(userId)) return;

    ref.update({
      likes: (data.likes || 0) + 1,
      likedBy: [...likedBy, userId]
    });
  });
}


function addComment(postId) {
  const input = document.getElementById(`comment-${postId}`);
  const text = input.value.trim();

  const now = Date.now();

  if (now - lastCommentTime < 10000) {
    alert("Slow down commenting");
    return;
  }

  if (!text) return;

  if (text.length > 200) {
    alert("Comment too long");
    return;
  }

  if (containsBadWords(text)) {
    alert("Inappropriate comment");
    return;
  }

  const ref = db.collection("posts").doc(postId);

  ref.collection("comments").add({
    text,
    user: displayName,
    time: now
  });

  ref.update({
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

      div.innerHTML = "";

      snapshot.forEach(doc => {
        const c = doc.data();
        div.innerHTML += `<p><b>${c.user}:</b> ${c.text}</p>`;
      });
    });
}


function editPost(id, oldTitle, oldContent) {
  const ref = db.collection("posts").doc(id);

  ref.get().then(doc => {
    const data = doc.data();
    if (!data || data.ownerId !== userId) return;

    const newTitle = prompt("Edit title:", oldTitle);
    const newContent = prompt("Edit content:", oldContent);

    if (!newTitle || !newContent) return;

    ref.update({
      title: newTitle,
      content: newContent
    });
  });
}


function deletePost(id) {
  const ref = db.collection("posts").doc(id);

  ref.get().then(doc => {
    const data = doc.data();
    if (!data || data.ownerId !== userId) return;

    if (!confirm("Delete this post?")) return;

    ref.delete();
  });
}


db.collection("posts").onSnapshot(snapshot => {
  const postsDiv = document.getElementById("posts");
  postsDiv.innerHTML = "";

  let posts = [];
  const now = Date.now();

  snapshot.forEach(doc => {
    const post = doc.data();
    const id = doc.id;

    const postTime = post.createdAt?.toMillis?.() || now;
    const hoursOld = (now - postTime) / (1000 * 60 * 60);

    const timeDecay = Math.pow(hoursOld + 2, 1.5);

    let score =
      ((post.likes || 0) + (post.commentsCount || 0) * 2) / timeDecay;

    if (hoursOld < 2) score *= 1.5;

    posts.push({
      id,
      ...post,
      score,
      trending: score > 5
    });
  });

  posts.sort((a, b) => b.score - a.score);

  posts.forEach(post => {
    const isOwner = post.ownerId === userId;

    postsDiv.innerHTML += `
      <div class="post">

        ${post.trending ? `<div style="color: orange; font-size:12px;">🔥 Trending</div>` : ""}

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
});
