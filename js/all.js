const SPLIT_KEY = 'splitRecords';
let currentSplitId = localStorage.getItem('currentSplitId') || null;

// ==== 共通 ====
function getSplits() {
  return JSON.parse(localStorage.getItem(SPLIT_KEY) || '{}');
}

function saveSplits(data) {
  localStorage.setItem(SPLIT_KEY, JSON.stringify(data));
}

function generateId() {
  return 'split_' + Date.now();
}

function startNewSplit() {
  const splits = getSplits();
  const newId = generateId();
  splits[newId] = { title: '', members: [], payments: [] };
  saveSplits(splits);
  localStorage.setItem('currentSplitId', newId);
  location.href = 'index.html';
}

function getCurrentSplit() {
  const splits = getSplits();
  return splits[currentSplitId] || null;
}

function setCurrentSplitField(field, value) {
  const splits = getSplits();
  if (!splits[currentSplitId]) return;
  splits[currentSplitId][field] = value;
  saveSplits(splits);
}

function updateCurrentSplit() {
  const splits = getSplits();
  const updated = splits[currentSplitId];
  saveSplits(splits);
}

// ==== index.html 用 ====
if (location.pathname.includes('index.html')) {
  const titleInput = document.getElementById('title');
  const memberList = document.getElementById('memberList');
  const memberInput = document.getElementById('memberName');

  const split = getCurrentSplit();
  if (split) {
    titleInput.value = split.title || '';
    split.members.forEach(name => addMemberToUI(name));
  }

  titleInput?.addEventListener('input', () => {
    setCurrentSplitField('title', titleInput.value);
  });

  window.addMember = function () {
    const name = memberInput.value.trim();
    if (!name) return;
    if (!split.members.includes(name)) {
      split.members.push(name);
      updateCurrentSplit();
      addMemberToUI(name);
    }
    memberInput.value = '';
  };

  function addMemberToUI(name) {
    const li = document.createElement('li');
    li.textContent = name + ' ';
    const del = document.createElement('button');
    del.textContent = '削除';
    del.onclick = () => {
      split.members = split.members.filter(m => m !== name);
      updateCurrentSplit();
      li.remove();
    };
    li.appendChild(del);
    memberList.appendChild(li);
  }

  window.createSplit = function () {
    if (!split.title || split.members.length === 0) {
      alert('タイトルとメンバーを入力してください');
      return;
    }
    updateCurrentSplit();
    location.href = 'setting.html';
  };
}

// ==== setting.html 用 ====
if (location.pathname.includes('setting.html')) {
  const payerSelect = document.getElementById('payerSelect');
  const payeeBox = document.getElementById('payeeCheckboxes');
  const paymentList = document.getElementById('paymentList');
  const split = getCurrentSplit();

  function renderForm() {
    split.members.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      payerSelect.appendChild(opt);

      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = name;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(name));
      payeeBox.appendChild(label);
    });

    renderPayments();
  }

  window.savePayment = function () {
    const who = payerSelect.value;
    const whom = [...payeeBox.querySelectorAll('input:checked')].map(cb => cb.value);
    const what = document.getElementById('what').value;
    const howmuch = parseInt(document.getElementById('amount').value, 10);

    if (!who || whom.length === 0 || !what || isNaN(howmuch)) {
      alert('全項目を正しく入力してください');
      return;
    }

    split.payments.push({ who, whom, what, howmuch });
    updateCurrentSplit();
    location.reload();
  };

  function renderPayments() {
    paymentList.innerHTML = '';
    split.payments.forEach((p, i) => {
      const li = document.createElement('li');
      li.textContent = `${p.what}（${p.who}が立て替え）：${p.howmuch}円`;

      const del = document.createElement('button');
      del.textContent = '削除';
      del.onclick = () => {
        split.payments.splice(i, 1);
        updateCurrentSplit();
        renderPayments();
      };
      li.appendChild(del);
      paymentList.appendChild(li);
    });
  }

  renderForm();
}

// ==== summary.html 用 ====
if (location.pathname.includes('summary.html')) {
  const split = getCurrentSplit();
  const records = document.getElementById('paymentRecords');
  const settlement = document.getElementById('settlement');

  function renderPayments() {
    records.innerHTML = '';
    split.payments.forEach(p => {
      const div = document.createElement('div');
      div.textContent = `${p.what}（${p.who}が立て替え）：${p.howmuch}円`;
      records.appendChild(div);
    });
  }

  function renderSettlement() {
    const balances = {};
    split.members.forEach(name => balances[name] = 0);

    split.payments.forEach(p => {
      const amountPerPerson = p.howmuch / p.whom.length;
      p.whom.forEach(name => balances[name] -= amountPerPerson);
      balances[p.who] += p.howmuch;
    });

    const creditors = Object.entries(balances).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const debtors = Object.entries(balances).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);

    settlement.innerHTML = '';
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const [debtor, debt] = debtors[i];
      const [creditor, credit] = creditors[j];
      const amount = Math.min(-debt, credit);

      const p = document.createElement('p');
      p.textContent = `${debtor} ⇒ ${creditor} ${amount.toFixed(0)}円`;
      settlement.appendChild(p);

      debtors[i][1] += amount;
      creditors[j][1] -= amount;

      if (Math.abs(debtors[i][1]) < 1) i++;
      if (Math.abs(creditors[j][1]) < 1) j++;
    }
  }

  renderPayments();
  renderSettlement();
}

// ==== アーカイブ表示（全ページ） ====
const carousel = document.getElementById('splitCarousel');
const archive = document.getElementById('splitArchive');

function renderArchive() {
  const splits = getSplits();
  if (!carousel && !archive) return;

  [carousel, archive].forEach(container => {
    if (!container) return;
    container.innerHTML = '';
    Object.entries(splits).forEach(([id, split]) => {
      const div = document.createElement('div');
      div.className = 'carousel-item';
      div.innerHTML = `${split.title}<button onclick="deleteSplit('${id}')">×</button>`;
      div.onclick = () => {
        localStorage.setItem('currentSplitId', id);
        location.href = 'summary.html';
      };
      container.appendChild(div);
    });
  });
}

function deleteSplit(id) {
  const splits = getSplits();
  delete splits[id];
  saveSplits(splits);
  renderArchive();
}

renderArchive();