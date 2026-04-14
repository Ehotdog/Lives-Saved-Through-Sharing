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
