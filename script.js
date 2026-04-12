// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBb59VjFAhgE2D6zM5O07m32MQR83N16Kk",
  authDomain: "lives-saved-through-shar-536f8.firebaseapp.com",
  projectId: "lives-saved-through-shar-536f8",
  storageBucket: "lives-saved-through-shar-536f8.firebasestorage.app",
  messagingSenderId: "898935254971",
  appId: "1:898935254971:web:57d7c4c0819a7aca931e9e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
function postStory() {
  const title = document.getElementById("title").value;
  const content = document.getElementById("content").value;

  db.collection("posts").add({
    title: title,
    content: content,
    user: "User" + Math.floor(Math.random() * 100000),
    time: Date.now()
  });
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
