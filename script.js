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

console.log("SCRIPT LOADED");

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


function postStory() {
  const title = document.getElementById("title").value;
  const content = document.getElementById("content").value;

  if (!title || !content) return;

  db.collection("posts").add({
    title,
    content,
    user: displayName,
    ownerId: userId,
    time: Date.now(),
    likes: 0,
    likedBy: []
  });

  document.getElementById("title").value = "";
  document.getElementById("content").value = "";
}


function likePost(postId) {
  const postRef = db.collection("posts").doc(postId);

  postRef.get().then(doc => {
    const data = doc.data();

    const likes = data.likes || 0;
    const likedBy = data.likedBy || [];

    if (likedBy.includes(userId)) {
      alert("You already liked this post");
      return;
    }

    postRef.update({
      likes: likes + 1,
      likedBy: [...likedBy, userId]
    });
  });
}


function addComment(postId) {
  const input = document.getElementById(`comment-${postId}`);
  const text = input.value;

  if (!text) return;

  db.collection("posts")
    .doc(postId)
    .collection("comments")
    .add({
      text,
      user: displayName,
      time: Date.now()
    });

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


function deletePost(id) {
  const postRef = db.collection("posts").doc(id);

  postRef.get().then(doc => {
    const data = doc.data();

    if (data.ownerId !== userId) {
      alert("Not your post");
      return;
    }

    const ok = confirm("Delete this post?");
    if (!ok) return;

    postRef.delete();
  });
}


function editPost(id, oldTitle, oldContent) {
  const postRef = db.collection("posts").doc(id);

  postRef.get().then(doc => {
    const data = doc.data();

    if (data.ownerId !== userId) {
      alert("Not your post");
      return;
    }

    const newTitle = prompt("Edit title:", oldTitle);
    const newContent = prompt("Edit content:", oldContent);

    if (!newTitle || !newContent) return;

    postRef.update({
      title: newTitle,
      content: newContent
    });
  });
}


db.collection("posts")
.orderBy("time", "desc")
.onSnapshot(snapshot => {
  const postsDiv = document.getElementById("posts");
  postsDiv.innerHTML = "";

  snapshot.forEach(doc => {
    const post = doc.data();
    const id = doc.id;

    const isOwner = post.ownerId === userId;

    postsDiv.innerHTML += `
      <div class="post">
        <h3>${post.title}</h3>
        <p>${post.content}</p>
        <small>${post.user}</small>

        <br><br>

        <button onclick="likePost('${id}')">
          ♡ ${post.likes || 0}
        </button>

        ${isOwner ? `
          <button onclick="editPost('${id}', \`${post.title}\`, \`${post.content}\`)">✎</button>
          <button onclick="deletePost('${id}')">🗑</button>
        ` : ""}

        <div class="comments">
          <input id="comment-${id}" placeholder="Write a comment...">
          <button onclick="addComment('${id}')">Comment</button>

          <div id="comments-${id}"></div>
        </div>
      </div>
    `;

    loadComments(id);
  });
});
