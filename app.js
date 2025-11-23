// public/app.js
const API = "http://localhost:3000";

// Elements
const loginForm = document.getElementById("login-form");
const loginUsername = document.getElementById("login-username");
const loginPassword = document.getElementById("login-password");
const authSection = document.getElementById("auth-section");
const userInfoBox = document.getElementById("user-info-box");
const userInfo = document.getElementById("user-info");
const logoutBtn = document.getElementById("logout-btn");
const createSection = document.getElementById("create-section");
const complaintForm = document.getElementById("complaint-form");
const complaintTitle = document.getElementById("complaint-title");
const complaintDesc = document.getElementById("complaint-desc");
const complaintCategory = document.getElementById("complaint-category");
const complaintImage = document.getElementById("complaint-image");
const imagePreview = document.getElementById("imagePreview");
const dashboard = document.getElementById("dashboard");
const complaintList = document.getElementById("complaint-list");
const listTitle = document.getElementById("list-title");
const adminPanel = document.getElementById("admin-panel");
const refreshAdminBtn = document.getElementById("refresh-admin");

// Session
let session = null;
function saveSession(){ localStorage.setItem("hh_session", JSON.stringify(session)); }
function loadSession(){ const s = localStorage.getItem("hh_session"); session = s ? JSON.parse(s) : null; }
function clearSession(){ localStorage.removeItem("hh_session"); session = null; }

// Image preview
complaintImage.addEventListener("change", ()=> {
  const f = complaintImage.files[0];
  if(!f){ imagePreview.style.display="none"; imagePreview.src=""; return; }
  imagePreview.src = URL.createObjectURL(f);
  imagePreview.style.display = "block";
});

// Login / register (register-if-not-exists)
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();
  if(!username || !password) return alert("Enter username & password");

  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if(!data.success) return alert(data.msg || "Login failed");

  session = { username, role: username === "admin" ? "admin" : "student" };
  saveSession();
  loginUsername.value = ""; loginPassword.value = "";
  await renderApp();
});

// Logout
logoutBtn.addEventListener("click", () => {
  clearSession();
  renderApp();
});

// Submit complaint (multipart)
complaintForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if(!session) return alert("Not logged in");

  const title = complaintTitle.value.trim();
  const description = complaintDesc.value.trim();
  const category = complaintCategory.value || "";
  const file = complaintImage.files[0] || null;

  if(!title || !description) return alert("Fill title & description");

  const fd = new FormData();
  fd.append("username", session.username);
  fd.append("title", title);
  fd.append("description", description);
  fd.append("category", category);
  if(file) fd.append("image", file);

  const res = await fetch(`${API}/complaints`, { method: "POST", body: fd });
  if(!res.ok) return alert("Failed to submit complaint");
  await res.json(); // created complaint (ignored here)
  complaintTitle.value = ""; complaintDesc.value = ""; complaintCategory.value=""; complaintImage.value=""; imagePreview.style.display="none";
  await renderApp();
});

// Admin refresh
if(refreshAdminBtn) refreshAdminBtn.addEventListener("click", renderApp);

// Change status (admin)
async function changeStatus(id, status){
  await fetch(`${API}/complaints/${id}`, {
    method: "PUT",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ status })
  });
  await renderApp();
}

// Post comment
async function postComment(id, text){
  if(!text) return;
  const res = await fetch(`${API}/complaints/${id}/comment`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ by: session.username, text })
  });
  if(res.ok) await renderApp();
}

// Delete complaint (admin)
async function deleteComplaint(id){
  if(!confirm("Delete complaint?")) return;
  await fetch(`${API}/complaints/${id}`, { method: "DELETE" });
  await renderApp();
}

// Render app
async function renderApp(){
  loadSession();
  if(!session){
    authSection.style.display = "block";
    userInfoBox.style.display = "none";
    createSection.style.display = "none";
    dashboard.style.display = "none";
    return;
  }

  // Logged in UI
  authSection.style.display = "none";
  userInfoBox.style.display = "block";
  createSection.style.display = "block";
  dashboard.style.display = "block";
  userInfo.innerHTML = `<b>${session.username}</b> (${session.role})`;

  if(session.role === "student"){
    listTitle.textContent = "My Complaints";
    adminPanel.style.display = "none";
    // load student complaints
    const res = await fetch(`${API}/complaints?username=${encodeURIComponent(session.username)}`);
    const data = await res.json();
    renderComplaints(data, false);
  } else {
    listTitle.textContent = "All Complaints (Admin)";
    adminPanel.style.display = "block";
    const res = await fetch(`${API}/admin/complaints`);
    const data = await res.json();
    renderComplaints(data, true);
  }
}

// Render complaints list
function renderComplaints(arr, isAdmin){
  complaintList.innerHTML = "";
  if(!arr || arr.length === 0){
    complaintList.innerHTML = "<p>No complaints yet.</p>";
    return;
  }

  arr.forEach(c => {
    const div = document.createElement("div");
    div.className = "complaint-item";

    const when = new Date(c.createdAt).toLocaleString();
    const imgHtml = c.image ? `<img class="preview" src="${API}/${c.image}" alt="issue image">` : "";

    // messages
    const msgs = (c.messages||[]).map(m => `<div class="msg"><b>${escapeHtml(m.by)}</b> <span class="meta">(${new Date(m.at).toLocaleString()})</span><div>${escapeHtml(m.text)}</div></div>`).join("");

    // comment input
    const commentInput = `<div style="margin-top:8px;"><input id="cmt-${c.id}" type="text" placeholder="Write a message..." style="width:70%;padding:6px;border-radius:6px;border:1px solid #d1d5db">
      <button onclick='(async()=>{ const t=document.getElementById("cmt-${c.id}").value.trim(); if(!t) return; await postComment(${c.id},t); })()'>Send</button></div>`;

    // admin buttons
    const adminBtns = isAdmin ? `<div style="margin-top:8px;">
        <button onclick='changeStatus(${c.id},"Open")'>Open</button>
        <button onclick='changeStatus(${c.id},"In Progress")'>In Progress</button>
        <button onclick='changeStatus(${c.id},"Resolved")'>Resolved</button>
        <button style="background:#ef4444;margin-left:6px" onclick='deleteComplaint(${c.id})'>Delete</button>
      </div>` : "";

    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <b>${escapeHtml(c.title)}</b>
          <div class="meta">${escapeHtml(c.category||"")} • by ${escapeHtml(c.username)} • ${when}</div>
        </div>
        <div class="status">${escapeHtml(c.status)}</div>
      </div>
      <div style="margin-top:8px">${escapeHtml(c.description)}</div>
      ${imgHtml}
      ${msgs}
      ${commentInput}
      ${adminBtns}
    `;
    complaintList.appendChild(div);
  });
}

function escapeHtml(s){
  if(s === undefined || s === null) return "";
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

// Start
renderApp();
