// 共通データ保持
const STORAGE_KEYS = {
  title: 'split_title',
  members: 'split_members',
  payments: 'split_payments'
};

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function getFromStorage(key) {
  return JSON.parse(localStorage.getItem(key) || '[]');
}

// index.html ロジック
function addMember() {
  const name = document.getElementById('memberName').value.trim();
  if (!name) return;
  const members = getFromStorage(STORAGE_KEYS.members);
  members.push(name);
  saveToStorage(STORAGE_KEYS.members, members);
  renderMemberList();
  document.getElementById('memberName').value = '';
}

function renderMemberList() {
  const list = document.getElementById('memberList');
  const members = getFromStorage(STORAGE_KEYS.members);
  list.innerHTML = '';
  members.forEach((name, i) => {
    const li = document.createElement('li');
    li.textContent = name + ' ';
    const btn = document.createElement('button');
    btn.textContent = '削除';
    btn.onclick = () => {
      members.splice(i, 1);
      saveToStorage(STORAGE_KEYS.members, members);
      renderMemberList();
    };
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function createSplit() {
  const title = document.getElementById('title').value.trim();
  if (!title) return alert('タイトルを入力してください');
  saveToStorage(STORAGE_KEYS.title, title);
  location.href = 'setting.html';
}

// setting.html ロジック
function populateSettingPage() {
  const members = getFromStorage(STORAGE_KEYS.members);
  const payerSelect = document.getElementById('payerSelect');
  const payeeCheckboxes = document.getElementById('payeeCheckboxes');
  const paymentList = document.getElementById('paymentList');
  if (!payerSelect) return;

  payerSelect.innerHTML = '';
  payeeCheckboxes.innerHTML = '';

  members.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    payerSelect.appendChild(opt);

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = name;
    label.appendChild(checkbox);
    label.append(name);
    payeeCheckboxes.appendChild(label);
    payeeCheckboxes.appendChild(document.createElement('br'));
  });

  const payments = getFromStorage(STORAGE_KEYS.payments);
  if (paymentList) {
    paymentList.innerHTML = '';
    payments.forEach((p, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `${p.split_what} (${p.split_paywho}が立替) - ${p.split_howmuch}円 
        <button onclick="editPayment(${idx})">編集</button>
        <button onclick="deletePayment(${idx})">削除</button>`;
      paymentList.appendChild(li);
    });
  }
}

function savePayment() {
  const payer = document.getElementById('payerSelect').value;
  const payeeElems = document.querySelectorAll('#payeeCheckboxes input:checked');
  const what = document.getElementById('what').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);

  if (!payer || payeeElems.length === 0 || !what || !amount) {
    alert('すべての項目を入力してください');
    return;
  }

  const payees = Array.from(payeeElems).map(cb => cb.value);
  const payments = getFromStorage(STORAGE_KEYS.payments);

  payments.push({
    split_paywho: payer,
    split_whopayed: payees,
    split_what: what,
    split_howmuch: amount
  });
  saveToStorage(STORAGE_KEYS.payments, payments);
  alert('保存しました');
  location.href = 'summary.html';
}

function deletePayment(index) {
  const payments = getFromStorage(STORAGE_KEYS.payments);
  payments.splice(index, 1);
  saveToStorage(STORAGE_KEYS.payments, payments);
  populateSettingPage();
}

function editPayment(index) {
  // 簡易版：削除→入力欄に反映して再保存
  const payments = getFromStorage(STORAGE_KEYS.payments);
  const p = payments[index];
  document.getElementById('payerSelect').value = p.split_paywho;
  document.getElementById('what').value = p.split_what;
  document.getElementById('amount').value = p.split_howmuch;

  document.querySelectorAll('#payeeCheckboxes input').forEach(cb => {
    cb.checked = p.split_whopayed.includes(cb.value);
  });

  deletePayment(index);
}

// summary.html ロジック
function displaySummary() {
  const title = localStorage.getItem(STORAGE_KEYS.title);
  const recordsDiv = document.getElementById('paymentRecords');
  const settlementDiv = document.getElementById('settlement');
  const payments = getFromStorage(STORAGE_KEYS.payments);
  const members = getFromStorage(STORAGE_KEYS.members);

  if (!recordsDiv || !settlementDiv) return;

  const totalPaid = {};
  const totalShouldPay = {};

  recordsDiv.innerHTML = `<h2>${title}</h2>`;

  payments.forEach(payment => {
    const { split_paywho, split_whopayed, split_what, split_howmuch } = payment;
    const perPerson = split_howmuch / split_whopayed.length;

    recordsDiv.innerHTML += `<p>${split_what}（${split_paywho}が立て替え）：${split_howmuch.toLocaleString()}円</p>`;

    totalPaid[split_paywho] = (totalPaid[split_paywho] || 0) + split_howmuch;
    split_whopayed.forEach(p => {
      totalShouldPay[p] = (totalShouldPay[p] || 0) + perPerson;
    });
  });

  const netBalance = {};
  members.forEach(name => {
    netBalance[name] = (totalPaid[name] || 0) - (totalShouldPay[name] || 0);
  });

  // 精算計算：正→もらう側、負→払う側
  const creditors = [];
  const debtors = [];
  for (const person in netBalance) {
    if (netBalance[person] > 0) creditors.push({ name: person, amount: netBalance[person] });
    else if (netBalance[person] < 0) debtors.push({ name: person, amount: -netBalance[person] });
  }

  let resultHTML = '';
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  while (creditors.length && debtors.length) {
    const creditor = creditors[0];
    const debtor = debtors[0];
    const payment = Math.min(creditor.amount, debtor.amount);
    resultHTML += `<p>${debtor.name}⇒${creditor.name}　${Math.round(payment).toLocaleString()}円</p>`;

    creditor.amount -= payment;
    debtor.amount -= payment;

    if (creditor.amount === 0) creditors.shift();
    if (debtor.amount === 0) debtors.shift();
  }

  settlementDiv.innerHTML = resultHTML;
}

// ページロード時の処理振り分け
window.onload = () => {
  const pathname = window.location.pathname;
  if (pathname.includes('index.html')) renderMemberList();
  if (pathname.includes('setting.html')) populateSettingPage();
  if (pathname.includes('summary.html')) displaySummary();
};