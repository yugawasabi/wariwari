// ユーティリティ関数
function loadProjects() {
  return JSON.parse(localStorage.getItem("projects") || "{}");
}

function saveProjects(projects) {
  localStorage.setItem("projects", JSON.stringify(projects));
}

function generateId() {
  return 'project_' + Date.now();
}

function getCurrentProjectId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("project");
}

function deleteProject(projectId) {
  const projects = loadProjects();
  delete projects[projectId];
  saveProjects(projects);
  location.reload();
}

function renderArchive(containerId = "splitArchive") {
  const archiveContainer = document.getElementById(containerId);
  if (!archiveContainer) return;

  const projects = loadProjects();
  archiveContainer.innerHTML = "";

  Object.keys(projects).forEach(projectId => {
    const project = projects[projectId];
    const item = document.createElement("div");
    item.className = "carousel-item";
    item.innerHTML = `
      <button onclick="event.stopPropagation(); deleteProject('${projectId}')">×</button>
      <div onclick="location.href='summary.html?project=${projectId}'">
        <strong>${project.title || "無題"}</strong><br>
        <small>${project.members?.join(', ') || "メンバーなし"}</small>
      </div>
    `;
    archiveContainer.appendChild(item);
  });
}

// ===== index.html 機能 =====
function addMember() {
  const name = document.getElementById("memberName").value.trim();
  if (!name) return;
  const ul = document.getElementById("memberList");
  const li = document.createElement("li");
  li.textContent = name;
  const delBtn = document.createElement("button");
  delBtn.textContent = "×";
  delBtn.onclick = () => ul.removeChild(li);
  li.appendChild(delBtn);
  ul.appendChild(li);
  document.getElementById("memberName").value = "";
}

function createSplit() {
  const title = document.getElementById("title").value.trim();
  const liElements = document.querySelectorAll("#memberList li");
  const members = Array.from(liElements).map(li => li.childNodes[0].nodeValue.trim());

  if (members.length === 0) return alert("メンバーを追加してください");

  const projects = loadProjects();
  const id = generateId();
  projects[id] = {
    title: title || "無題",
    members,
    payments: []
  };
  saveProjects(projects);
  location.href = `summary.html?project=${id}`;
}
function populateEditForm() {
  const projectId = getCurrentProjectId();
  if (!projectId) return;

  const projects = loadProjects();
  const project = projects[projectId];
  if (!project) return;

  // タイトルをセット
  document.getElementById("title").value = project.title;

  // メンバーをセット
  const ul = document.getElementById("memberList");
  ul.innerHTML = "";
  project.members.forEach(m => {
    const li = document.createElement("li");
    li.textContent = m;
    const delBtn = document.createElement("button");
    delBtn.textContent = "×";
    delBtn.onclick = () => ul.removeChild(li);
    li.appendChild(delBtn);
    ul.appendChild(li);
  });

  // 「保存」ボタン表示
  const saveBtn = document.getElementById("saveChanges");
  if (saveBtn) saveBtn.style.display = "block";

  // 「新規作成」ボタン非表示
  const createBtn = document.querySelector(".footer-button.green");
  if (createBtn) createBtn.style.display = "none";
}


// ===== summary.html 機能 =====
function calculateSettlement(payments, members) {
  const balances = {};
  members.forEach(m => balances[m] = 0);

  payments.forEach(p => {
    const split = p.split_whopayed.length;
    const share = p.split_howmuch / split;
    p.split_whopayed.forEach(person => {
      balances[person] -= share;
    });
    balances[p.split_paywho] += p.split_howmuch;
  });

  const settlement = [];
  const creditors = [], debtors = [];

  for (const m in balances) {
    const b = Math.round(balances[m]);
    if (b > 0) creditors.push({ name: m, amount: b });
    else if (b < 0) debtors.push({ name: m, amount: -b });
  }

  while (creditors.length && debtors.length) {
    const c = creditors[0], d = debtors[0];
    const pay = Math.min(c.amount, d.amount);
    settlement.push(`${d.name} ⇒ ${c.name}：${pay.toLocaleString()}円`);
    c.amount -= pay;
    d.amount -= pay;
    if (c.amount === 0) creditors.shift();
    if (d.amount === 0) debtors.shift();
  }
  return settlement;
}

function renderSummary() {
  const projectId = getCurrentProjectId();
  if (!projectId) return;
  const projects = loadProjects();
  const project = projects[projectId];
  if (!project) return;

  // --- タイトルとメンバー表示用のHTMLを構築 ---
  const summaryHeader = document.getElementById("summaryHeader");
  if (summaryHeader) {
    summaryHeader.innerHTML = `
      <div class="project-title">${project.title || "無題なプロジェクト"}</div>
      <div class="member-chips">
        ${project.members.map(m => `<span class="chip">${m}</span>`).join('')}
      </div>
    `;
  }

  // --- 立て替え記録一覧 ---
  const paymentRecords = document.getElementById("paymentRecords");
  paymentRecords.innerHTML = project.payments.map(p =>
    `<div class="payment-record">
      <span class="what">${p.split_what}</span>
      <span class="who">（${p.split_paywho}が立て替え）</span>
      <span class="amount">：${p.split_howmuch.toLocaleString()}円</span>
    </div>`
  ).join('');

  // --- 清算結果表示 ---
  const settlementDiv = document.getElementById("settlement");
  const results = calculateSettlement(project.payments, project.members);
  settlementDiv.innerHTML = results.map(r => `<div class="settlement-item">${r}</div>`).join('');
}

// ===== setting.html 機能 =====
function populateSettingForm() {
  const projectId = getCurrentProjectId();
  const project = loadProjects()[projectId];
  if (!project) return;

  const payerSelect = document.getElementById("payerSelect");
  const payeeCheckboxes = document.getElementById("payeeCheckboxes");

  payerSelect.innerHTML = "";
  payeeCheckboxes.innerHTML = "";

  project.members.forEach(m => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = m;
    payerSelect.appendChild(opt);

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = m;
    cb.id = `cb-${m}`;

    const label = document.createElement("label");
    label.htmlFor = cb.id;
    label.textContent = m;

    payeeCheckboxes.appendChild(cb);
    payeeCheckboxes.appendChild(label);
  });
}

function savePayment() {
  const projectId = getCurrentProjectId();
  const projects = loadProjects();
  const project = projects[projectId];
  if (!project) return;

  const payer = document.getElementById("payerSelect").value;
  const what = document.getElementById("what").value.trim();
  const amount = parseInt(document.getElementById("amount").value);
  const who = Array.from(document.querySelectorAll("#payeeCheckboxes input:checked"))
                   .map(cb => cb.value);

  if (!payer || !amount || who.length === 0) {
    alert("入力内容を確認してください。");
    return;
  }

  project.payments.push({
    split_paywho: payer,
    split_whopayed: who,
    split_what: what,
    split_howmuch: amount
  });

  saveProjects(projects);
  location.href = `summary.html?project=${projectId}`;
}

// ページ初期化処理
window.addEventListener("DOMContentLoaded", () => {
  renderArchive();
  if (document.getElementById("paymentRecords")) renderSummary();
  if (document.getElementById("payerSelect")) populateSettingForm();
  if (document.getElementById("saveChanges")) populateEditForm();
});

function goToAddPaymentPage() {
  const projectId = getCurrentProjectId();
  if (!projectId) {
    alert("プロジェクトが見つかりません");
    return;
  }
  location.href = `setting.html?project=${projectId}`;
}

function goBackToSummary() {
  const projectId = getCurrentProjectId();
  if (!projectId) {
    alert("プロジェクトが見つかりません");
    return;
  }
  location.href = `summary.html?project=${projectId}`;
}

function saveProjectChanges() {
  const projectId = getCurrentProjectId();
  if (!projectId) return;

  const projects = loadProjects();
  const project = projects[projectId];
  if (!project) return;

  const newTitle = document.getElementById("title").value.trim();
  const liElements = document.querySelectorAll("#memberList li");
  const members = Array.from(liElements).map(li => li.childNodes[0].nodeValue.trim());

  if (members.length === 0) {
    alert("メンバーを1人以上追加してください");
    return;
  }

  project.title = newTitle || "無題";
  project.members = members;

  saveProjects(projects);
  location.href = `summary.html?project=${projectId}`;
}