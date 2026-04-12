// Post a story (no database version)
function postStory() {
  const title = document.getElementById("title").value;
  const content = document.getElementById("content").value;

  const post = document.createElement("div");

  post.innerHTML = `
    <h3>${title}</h3>
    <p>${content}</p>
    <hr>
  `;

  document.getElementById("posts").prepend(post);

  // clear inputs
  document.getElementById("title").value = "";
  document.getElementById("content").value = "";
}
