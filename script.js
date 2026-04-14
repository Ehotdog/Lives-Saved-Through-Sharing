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
    time: Date.now()
  });

  document.getElementById("title").value = "";
  document.getElementById("content").value = "";
}


db.collection("posts")
.orderBy("time", "desc")
.onSnapshot(snapshot => {
  const postsDiv = document.getElementById("posts");
  postsDiv.innerHTML = "";

  snapshot.forEach(doc => {
    const post = doc.data();

    postsDiv.innerHTML += `
      <div class="post">
        <h3>${post.title}</h3>
        <p>${post.content}</p>
        <small>${post.user}</small>
      </div>
    `;
  });
});
