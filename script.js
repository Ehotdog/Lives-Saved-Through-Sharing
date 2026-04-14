function postStory() {
  const title = document.getElementById("title").value;
  const content = document.getElementById("content").value;

  if (!title || !content) return;

  const post = document.createElement("div");
  post.classList.add("post");

  const username = "User" + Math.floor(Math.random() * 10000);

  post.innerHTML = `
    <h3>${title}</h3>
    <p>${content}</p>
    <small>${username}</small>
  `;

  document.getElementById("posts").prepend(post);

  document.getElementById("title").value = "";
  document.getElementById("content").value = "";
}

const firebaseConfig = {
  apiKey: "AIzaSyBb59VjFAhgE2D6zM5O07m32MQR83N16Kk",
  authDomain: "lives-saved-through-shar-536f8.firebaseapp.com",
  projectId: "lives-saved-through-shar-536f8",
  storageBucket: "lives-saved-through-shar-536f8.firebasestorage.app",
  messagingSenderId: "898935254971",
  appId: "1:898935254971:web:57d7c4c0819a7aca931e9e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
