// ============================================
// היסטוריית קניות - לוגיקה
// ============================================

const historyContainer = document.getElementById('historyContainer');
const detailsModal = document.getElementById('detailsModal');
const detailsTitle = document.getElementById('detailsTitle');
const detailsList = document.getElementById('detailsList');

let historyData = [];
let activeTripId = null;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

async function loadHistory() {
  setSyncStatus('syncing');
  try {
    historyData = await DataLayer.getHistory(100);
    setSyncStatus('synced');
    render();
  } catch (err) {
    console.error(err);
    setSyncStatus('offline');
    historyContainer.innerHTML = `
      <div class="empty-state">
        <span class="emoji">📡</span>
        <div class="title">לא הצלחנו להתחבר</div>
        <div class="sub">בדקו חיבור לאינטרנט ונסו שוב.</div>
      </div>`;
  }
}

function render() {
  if (historyData.length === 0) {
    historyContainer.innerHTML = `
      <div class="empty-state">
        <span class="emoji">🧾</span>
        <div class="title">אין עדיין קניות בהיסטוריה</div>
        <div class="sub">כשתסיימו קניה ב"מצב קניה", היא תופיע כאן.</div>
      </div>`;
    return;
  }

  // summary stats
  const totalSpent = historyData.reduce((s, t) => s + Number(t.total), 0);
  const avgTrip = totalSpent / historyData.length;

  let html = `
    <div class="history-card" style="background:var(--surface-sunken); box-shadow:none;">
      <div class="history-card-top">
        <div class="history-date">סיכום כללי</div>
        <div class="history-total">₪${formatPrice(totalSpent)}</div>
      </div>
      <div class="history-meta">${historyData.length} קניות · ממוצע ₪${formatPrice(avgTrip)} לקניה</div>
    </div>
    <div class="section-title">קניות אחרונות</div>
  `;

  for (const trip of historyData) {
    const itemCount = Array.isArray(trip.items) ? trip.items.length : 0;
    html += `
      <div class="history-card" data-trip="${trip.id}">
        <div class="history-card-top">
          <div class="history-date">${formatDate(trip.finished_at)}</div>
          <div class="history-total">₪${formatPrice(trip.total)}</div>
        </div>
        <div class="history-meta">${itemCount} מוצרים · ${formatTime(trip.finished_at)}</div>
      </div>`;
  }

  historyContainer.innerHTML = html;

  historyContainer.querySelectorAll('[data-trip]').forEach(el => {
    el.addEventListener('click', () => openDetails(el.dataset.trip));
  });
}

function openDetails(tripId) {
  const trip = historyData.find(t => t.id === tripId);
  if (!trip) return;
  activeTripId = tripId;

  detailsTitle.textContent = `קניה מתאריך ${formatDate(trip.finished_at)}`;
  const items = Array.isArray(trip.items) ? trip.items : [];

  detailsList.innerHTML = items.map(item => {
    const qty = Number(item.quantity) || 1;
    const qtyBadge = qty !== 1 ? `<span class="product-qty">× ${formatQuantity(qty)}</span>` : '';
    return `
    <div class="product-row" style="padding:10px 0;">
      <span class="product-name">${escapeHtml(item.name)}</span>
      ${qtyBadge}
      <span class="product-price">₪${formatPrice(Number(item.price) * qty)}</span>
    </div>
  `;
  }).join('') + `
    <div class="product-row" style="padding:12px 0 0; border-top:2px solid var(--line); margin-top:6px; border-bottom:none;">
      <span class="product-name" style="font-weight:800;">סה״כ</span>
      <span class="product-price" style="color:var(--ember); font-size:17px;">₪${formatPrice(trip.total)}</span>
    </div>
  `;

  detailsModal.classList.add('open');
}

document.getElementById('closeDetails').addEventListener('click', () => {
  detailsModal.classList.remove('open');
});

document.getElementById('deleteTrip').addEventListener('click', async () => {
  if (!activeTripId) return;
  try {
    await DataLayer.deleteHistoryEntry(activeTripId);
    historyData = historyData.filter(t => t.id !== activeTripId);
    detailsModal.classList.remove('open');
    showToast('הרשומה נמחקה');
    render();
  } catch (err) {
    console.error(err);
    showToast('שגיאה במחיקה');
  }
});

// ===== Topbar scroll shadow =====
window.addEventListener('scroll', () => {
  document.getElementById('topbar').classList.toggle('scrolled', window.scrollY > 4);
});

(async () => {
  if (!(await requireWorkspace())) return; // requireWorkspace כבר מפנה ל-login.html אם צריך
  renderWorkspaceBadge();
  renderSettingsNavLink();
  loadHistory();
})();
