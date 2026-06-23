// ============================================
// מסך כניסה - לוגיקה
// ============================================

const familyList = document.getElementById('familyList');
const pinModal = document.getElementById('pinModal');
const pinModalTitle = document.getElementById('pinModalTitle');
const pinModalEmoji = document.getElementById('pinModalEmoji');
const pinError = document.getElementById('pinError');
const pinDigits = Array.from(document.querySelectorAll('[data-pin-digit]'));

const FAMILY_ACCENTS = {
  adir: { accent: '#4A7C59', soft: '#E3EDE3' },
  gal: { accent: '#C9622D', soft: '#FBE9DD' },
  chaya: { accent: '#B5453A', soft: '#F8E2DF' },
};

// פלטת צבעים נוספת למשפחות שנוצרות דינמית דרך הגדרות, כדי שלא כולן יקבלו את אותו צבע ברירת מחדל
const FALLBACK_PALETTE = [
  { accent: '#4A7C59', soft: '#E3EDE3' },
  { accent: '#C9622D', soft: '#FBE9DD' },
  { accent: '#B5453A', soft: '#F8E2DF' },
  { accent: '#3D6B8A', soft: '#DFEAF1' },
  { accent: '#8A5DA8', soft: '#EEE3F4' },
  { accent: '#A67C2E', soft: '#F2E9D8' },
];

function colorsForWorkspace(w, idx) {
  return FAMILY_ACCENTS[w.id] || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

let activeAttemptWorkspace = null;

function renderFamilyList() {
  familyList.innerHTML = WORKSPACES.map((w, idx) => {
    const colors = colorsForWorkspace(w, idx);
    return `
    <button class="family-card" data-family="${w.id}" style="--family-accent:${colors.accent}; --family-accent-soft:${colors.soft};">
      <span class="family-emoji-circle">${w.emoji}</span>
      <span class="family-name">${w.name}</span>
      <span class="family-tap-hint">הקלידו קוד כניסה</span>
      <span class="family-arrow">‹</span>
    </button>
  `;
  }).join('');

  familyList.querySelectorAll('[data-family]').forEach(btn => {
    btn.addEventListener('click', () => openPinModal(btn.dataset.family));
  });
}

function openPinModal(workspaceId) {
  activeAttemptWorkspace = workspaceId;
  const ws = getWorkspaceById(workspaceId);
  pinModalEmoji.textContent = ws.emoji;
  pinModalTitle.textContent = ws.name;
  pinError.style.display = 'none';
  pinDigits.forEach(d => d.value = '');
  pinModal.classList.add('open');
  setTimeout(() => pinDigits[0].focus(), 150);
}

function closePinModal() {
  pinModal.classList.remove('open');
  activeAttemptWorkspace = null;
}

document.getElementById('cancelPin').addEventListener('click', closePinModal);

pinModal.addEventListener('click', (e) => {
  if (e.target === pinModal) closePinModal();
});

pinDigits.forEach((input, idx) => {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^0-9]/g, '').slice(0, 1);
    if (input.value && idx < pinDigits.length - 1) {
      pinDigits[idx + 1].focus();
    }
    if (pinDigits.every(d => d.value.length === 1)) {
      attemptLogin();
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && idx > 0) {
      pinDigits[idx - 1].focus();
    }
  });
});

function attemptLogin() {
  const entered = pinDigits.map(d => d.value).join('');
  const ws = getWorkspaceById(activeAttemptWorkspace);

  if (ws && entered === ws.pin) {
    setActiveWorkspace(ws.id);
    window.location.href = 'index.html';
  } else {
    pinError.style.display = 'block';
    pinDigits.forEach(d => d.value = '');
    pinDigits[0].focus();
    const sheet = document.querySelector('#pinModal .modal-sheet');
    sheet.classList.remove('shake');
    void sheet.offsetWidth;
    sheet.classList.add('shake');
  }
}

(async () => {
  familyList.innerHTML = '<div class="loading-spinner"></div>';
  await loadWorkspaces();
  renderFamilyList();
})();
