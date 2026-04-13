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
