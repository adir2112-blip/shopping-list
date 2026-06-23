// ============================================
// הגדרות - גלוי רק למשפחת אדיר ויקירה
// ============================================

const container = document.getElementById('settingsContainer');

const addFamilyModal = document.getElementById('addFamilyModal');
const newFamilyName = document.getElementById('newFamilyName');
const newFamilyEmoji = document.getElementById('newFamilyEmoji');
const newFamilyPin = document.getElementById('newFamilyPin');

const resetPinModal = document.getElementById('resetPinModal');
const resetPinTitle = document.getElementById('resetPinTitle');
const resetPinValue = document.getElementById('resetPinValue');

let activeResetWorkspaceId = null;
let phonesState = {}; // { workspaceId: [phone1, phone2, ...] }

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function render() {
  await loadWorkspaces();
  phonesState = await DataLayer.getMissingItemsPhones();

  container.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-title">משפחות</div>
      <div class="settings-card-list">
        ${WORKSPACES.map(w => `
          <div class="settings-family-row">
            <span class="family-emoji-circle settings-family-emoji">${escapeHtml(w.emoji)}</span>
            <span class="settings-family-name">${escapeHtml(w.name)}</span>
            <button class="modal-btn secondary settings-reset-btn" data-reset-pin="${escapeHtml(w.id)}" data-name="${escapeHtml(w.name)}">איפוס קוד</button>
          </div>
        `).join('')}
      </div>
      <button class="add-category-btn" id="addFamilyBtn">+ הוספת משפחה</button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">התראת חוסרי מלאי בוואטסאפ</div>
      <p class="edit-hint">לכל משפחה אפשר להגדיר מספר/י טלפון שיקבלו הודעה אוטומטית כשהמשפחה הזו מסיימת קניה עם מוצרים שחסרים במלאי.</p>
      <div id="phonesByFamily"></div>
    </div>
  `;

  renderPhonesByFamily();
  bindEvents();
}

function renderPhonesByFamily() {
  const wrap = document.getElementById('phonesByFamily');
  if (!wrap) return;

  wrap.innerHTML = WORKSPACES.map(w => {
    const phones = phonesState[w.id] || [];
    return `
      <div class="settings-family-phones-block">
        <div class="settings-family-phones-title">
          <span class="family-emoji-circle settings-family-emoji">${escapeHtml(w.emoji)}</span>
          <span>${escapeHtml(w.name)}</span>
        </div>
        <div data-phones-list="${escapeHtml(w.id)}">
          ${phones.length === 0
            ? `<p class="edit-hint" style="margin-right:0;">לא הוגדרו מספרים עדיין.</p>`
            : phones.map((phone, idx) => `
                <div class="settings-phone-row">
                  <span class="settings-phone-number">${escapeHtml(phone)}</span>
                  <button class="delete-btn" data-delete-phone="${escapeHtml(w.id)}:${idx}">✕</button>
                </div>
              `).join('')
          }
        </div>
        <div class="settings-add-phone-row">
          <input class="modal-input" data-phone-input="${escapeHtml(w.id)}" placeholder="מספר טלפון, לדוגמה 0501234567" inputmode="tel">
          <button class="modal-btn primary" data-add-phone="${escapeHtml(w.id)}">הוספה</button>
        </div>
      </div>
    `;
  }).join('');

  wrap.querySelectorAll('[data-delete-phone]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [wsId, idxStr] = btn.dataset.deletePhone.split(':');
      const idx = Number(idxStr);
      phonesState[wsId] = (phonesState[wsId] || []).filter((_, i) => i !== idx);
      try {
        await DataLayer.setMissingItemsPhones(phonesState);
        renderPhonesByFamily();
        showToast('המספר הוסר');
      } catch (err) {
        console.error(err);
        showToast('שגיאה בהסרת המספר');
      }
    });
  });

  wrap.querySelectorAll('[data-add-phone]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const wsId = btn.dataset.addPhone;
      const input = wrap.querySelector(`[data-phone-input="${wsId}"]`);
      let raw = input.value.replace(/[^0-9]/g, '');

      // נורמליזציה: מספר ישראלי מקומי שמתחיל ב-0 (כמו 0501234567) -> פורמט בינלאומי 972501234567
      if (raw.startsWith('0') && raw.length === 10) {
        raw = '972' + raw.slice(1);
      }

      if (!raw || raw.length < 11) {
        showToast('יש להזין מספר טלפון תקין (לדוגמה 972501234567 או 0501234567)');
        return;
      }
      const existing = phonesState[wsId] || [];
      if (existing.includes(raw)) {
        showToast('המספר הזה כבר קיים למשפחה הזו');
        return;
      }
      phonesState[wsId] = [...existing, raw];
      try {
        await DataLayer.setMissingItemsPhones(phonesState);
        renderPhonesByFamily();
        showToast('המספר נוסף');
      } catch (err) {
        console.error(err);
        showToast('שגיאה בהוספת המספר');
      }
    });
  });
}

function bindEvents() {
  document.getElementById('addFamilyBtn').addEventListener('click', () => {
    newFamilyName.value = '';
    newFamilyEmoji.value = '';
    newFamilyPin.value = '';
    addFamilyModal.classList.add('open');
    setTimeout(() => newFamilyName.focus(), 100);
  });

  container.querySelectorAll('[data-reset-pin]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeResetWorkspaceId = btn.dataset.resetPin;
      resetPinTitle.textContent = `איפוס קוד — ${btn.dataset.name}`;
      resetPinValue.value = '';
      resetPinModal.classList.add('open');
      setTimeout(() => resetPinValue.focus(), 100);
    });
  });

  document.getElementById('addPhoneBtn').addEventListener('click', async () => {
    const input = document.getElementById('newPhoneInput');
    let raw = input.value.replace(/[^0-9]/g, '');

    // נורמליזציה: מספר ישראלי מקומי שמתחיל ב-0 (כמו 0501234567) -> פורמט בינלאומי 972501234567
    if (raw.startsWith('0') && raw.length === 10) {
      raw = '972' + raw.slice(1);
    }

    if (!raw || raw.length < 11) {
      showToast('יש להזין מספר טלפון תקין (לדוגמה 972501234567 או 0501234567)');
      return;
    }
    if (phonesState.includes(raw)) {
      showToast('המספר הזה כבר קיים');
      return;
    }
    phonesState = [...phonesState, raw];
    try {
      await DataLayer.setMissingItemsPhones(phonesState);
      input.value = '';
      renderPhonesList();
      showToast('המספר נוסף');
    } catch (err) {
      console.error(err);
      showToast('שגיאה בהוספת המספר');
    }
  });
}

document.getElementById('cancelAddFamily').addEventListener('click', () => {
  addFamilyModal.classList.remove('open');
});

document.getElementById('confirmAddFamily').addEventListener('click', async () => {
  const name = newFamilyName.value.trim();
  const emoji = newFamilyEmoji.value.trim() || '🛒';
  const pin = newFamilyPin.value.trim();

  if (!name) {
    showToast('יש להזין שם משפחה');
    newFamilyName.focus();
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    showToast('הקוד חייב להיות בדיוק 4 ספרות');
    newFamilyPin.focus();
    return;
  }

  // יוצרים מזהה פשוט מהשם (אותיות לטיניות/מספרים בלבד), עם נפילה לחזרה ל-uuid קצר אם השם לא לטיני
  let id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id) id = 'family-' + Math.random().toString(36).slice(2, 8);

  try {
    await DataLayer.createWorkspace(id, name, emoji, pin);
    addFamilyModal.classList.remove('open');
    showToast(`משפחת "${name}" נוצרה`);
    workspacesLoadPromise = null; // מאלצים טעינה מחדש כדי שהמשפחה החדשה תופיע
    render();
  } catch (err) {
    console.error(err);
    showToast('שגיאה ביצירת המשפחה - ודאו שלא קיימת משפחה בשם דומה');
  }
});

document.getElementById('cancelResetPin').addEventListener('click', () => {
  resetPinModal.classList.remove('open');
});

document.getElementById('confirmResetPin').addEventListener('click', async () => {
  const pin = resetPinValue.value.trim();
  if (!/^\d{4}$/.test(pin)) {
    showToast('הקוד חייב להיות בדיוק 4 ספרות');
    resetPinValue.focus();
    return;
  }
  try {
    await DataLayer.updateWorkspacePin(activeResetWorkspaceId, pin);
    resetPinModal.classList.remove('open');
    showToast('הקוד עודכן בהצלחה');
    workspacesLoadPromise = null;
    render();
  } catch (err) {
    console.error(err);
    showToast('שגיאה בעדכון הקוד');
  }
});

// ===== Topbar scroll shadow =====
window.addEventListener('scroll', () => {
  document.getElementById('topbar').classList.toggle('scrolled', window.scrollY > 4);
});

(async () => {
  if (!(await requireWorkspace())) return;
  if (!isAdirWorkspace()) {
    // הגנה כפולה: גם אם מישהו מנווט ישירות ל-URL בלי לראות את הלינק בתפריט
    window.location.href = 'index.html';
    return;
  }
  renderWorkspaceBadge();
  renderSettingsNavLink();
  render();
})();
