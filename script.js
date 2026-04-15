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


function postStory() {
  const title = document.getElementById("title").value;
  const content = document.getElementById("content").value;

  if (!title || !content) return;

  db.collection("posts").add({
    title: title,
    content: content,
    user: "User" + Math.floor(Math.random() * 10000),
    time: Date.now(),
    likes: 0
  });

  document.getElementById("title").value = "";
  document.getElementById("content").value = "";
}


function likePost(id) {
  const postRef = db.collection("posts").doc(id);

  postRef.get().then(doc => {
    const currentLikes = doc.data().likes || 0;

    postRef.update({
      likes: currentLikes + 1
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
      text: text,
      user: "User" + Math.floor(Math.random() * 10000),
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

        div.innerHTML += `
          <p><b>${c.user}:</b> ${c.text}</p>
        `;
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

    postsDiv.innerHTML += `
      <div class="post">
        <h3>${post.title}</h3>
        <p>${post.content}</p>
        <small>${post.user}</small>

        <br><br>

        <button onclick="likePost('${id}')">
          ❤️ ${post.likes || 0}
        </button>

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
