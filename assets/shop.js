// ============================================
// מצב קניה - לוגיקה
// ============================================

let state = {
  categories: [],
  products: [],
};

const container = document.getElementById('categoriesContainer');
const receiptBar = document.getElementById('receiptBar');
const receiptTotalAmount = document.getElementById('receiptTotalAmount');
const receiptAmount = document.getElementById('receiptAmount');
const receiptSub = document.getElementById('receiptSub');
const finishBtn = document.getElementById('finishBtn');
const finishModal = document.getElementById('finishModal');
const finishModalText = document.getElementById('finishModalText');

// ===== collapsed state persisted locally per-device (UI-only, not synced data) =====
function getCollapsed() {
  try { return JSON.parse(localStorage.getItem('collapsedCats') || '{}'); }
  catch { return {}; }
}
function setCollapsed(id, val) {
  const c = getCollapsed();
  c[id] = val;
  localStorage.setItem('collapsedCats', JSON.stringify(c));
}

async function loadData() {
  setSyncStatus('syncing');
  try {
    const [categories, products] = await Promise.all([
      DataLayer.getCategories(),
      DataLayer.getActiveProducts(),
    ]);
    state.categories = categories;
    state.products = products;
    setSyncStatus('synced');
    render();
  } catch (err) {
    console.error(err);
    setSyncStatus('offline');
    container.innerHTML = `
      <div class="empty-state">
        <span class="emoji">📡</span>
        <div class="title">לא הצלחנו להתחבר</div>
        <div class="sub">בדקו חיבור לאינטרנט ונסו שוב.<br>${err.message || ''}</div>
      </div>`;
  }
}

// קטגוריות שנסגרו אוטומטית (לא ע"י המשתמש)
const autoCollapsed = new Set();
// קטגוריות שהמשתמש פתח ידנית - לא יסגרו אוטומטית שוב
const manuallyOpened = new Set();

function render() {
  const collapsed = getCollapsed();

  if (state.products.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="emoji">🛒</span>
        <div class="title">אין רשימת קניות פעילה</div>
        <div class="sub">לכו ל"עריכת רשימת קניות", סמנו מוצרים ולחצו "צור רשימת קניות".</div>
      </div>`;
    receiptBar.style.display = 'none';
    return;
  }

  let html = '';
  const sortedCategories = [...state.categories].sort((a, b) => a.sort_order - b.sort_order);
  for (const cat of sortedCategories) {
    const items = state.products.filter(p => p.category_id === cat.id);
    if (items.length === 0) continue;

    const allDone = items.every(p => p.status === 'bought');

    // קיפול אוטומטי - לא יקרה אם המשתמש פתח ידנית
    if (allDone && !collapsed[cat.id] && !manuallyOpened.has(cat.id)) {
      autoCollapsed.add(cat.id);
    } else if (!allDone) {
      autoCollapsed.delete(cat.id);
      manuallyOpened.delete(cat.id); // אפס כשמוצרים חוזרים ל-pending
    }

    const isCollapsed = !!collapsed[cat.id] || autoCollapsed.has(cat.id);
    const catTotal = items
      .filter(p => p.status !== 'bought')
      .reduce((sum, p) => sum + lineTotal(p), 0);

    html += `
      <div class="category ${isCollapsed ? 'collapsed' : ''} ${allDone ? 'all-done' : ''}" data-cat="${cat.id}">
        <div class="category-header" data-toggle="${cat.id}">
          <span class="category-emoji">${escapeHtml(cat.emoji || emojiForCategory(cat.name))}</span>
          <span class="category-name">${escapeHtml(cat.name)}</span>
          <span class="category-meta">${allDone ? 'הושלם ✓' : '₪' + formatPrice(catTotal)}</span>
          <span class="category-chevron">▾</span>
        </div>
        <div class="category-body">
          ${items.map(p => productRow(p)).join('')}
          <div class="add-product-row" data-quick-add="${cat.id}" data-cat-name="${escapeHtml(cat.name)}">
            <span class="plus-circle">+</span>
            <span>משהו לא ברשימה? הוספת מוצר</span>
          </div>
        </div>
      </div>`;
  }

  // ===== חוסר במלאי: בלוק מסכם בסוף הרשימה =====
  const missingItems = state.products.filter(p => p.status === 'missing');
  if (missingItems.length > 0) {
    html += `
      <div class="missing-block">
        <div class="missing-block-header">
          <span class="missing-block-emoji">⚠️</span>
          <span class="missing-block-title">חוסר במלאי</span>
          <span class="missing-block-count">${missingItems.length} מוצרים</span>
        </div>
        <div>
          ${missingItems.map(p => productRow(p)).join('')}
        </div>
      </div>`;
  }

  container.innerHTML = html;
  bindEvents();
  updateReceipt();
}

function productRow(p) {
  const qty = Number(p.quantity) || 1;
  const qtyBadge = qty !== 1 ? `<span class="product-qty">× ${formatQuantity(qty)}</span>` : '';
  const thumb = p.image_url
    ? `<img src="${escapeHtml(p.image_url)}" class="product-thumb" data-lightbox="${escapeHtml(p.image_url)}" alt="">`
    : '';
  return `
    <div class="product-row tap-target status-${p.status}" data-id="${p.id}">
      <span class="status-icon">${p.status === 'bought' ? '✓' : (p.status === 'missing' ? '!' : '')}</span>
      ${thumb}
      <span class="product-name">${escapeHtml(p.name)}</span>
      ${qtyBadge}
      <span class="product-price">₪${formatPrice(lineTotal(p))}</span>
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function bindEvents() {
  container.querySelectorAll('[data-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.toggle;
      // בודקים את המצב הויזואלי בפועל מה-DOM (לא מה-state)
      const catEl = el.closest('.category');
      const currentlyCollapsed = catEl && catEl.classList.contains('collapsed');

      if (currentlyCollapsed) {
        // פתיחה ידנית
        autoCollapsed.delete(id);
        manuallyOpened.add(id);
        setCollapsed(id, false);
      } else {
        // סגירה ידנית
        manuallyOpened.delete(id);
        autoCollapsed.delete(id);
        setCollapsed(id, true);
      }
      render();
    });
  });

  container.querySelectorAll('.product-row.tap-target').forEach(el => {
    el.addEventListener('click', async (e) => {
      // אם לחצו על תמונת המוצר, פותחים lightbox ולא מסמנים סטטוס
      if (e.target.closest('[data-lightbox]')) return;

      const id = el.dataset.id;
      const product = state.products.find(p => p.id === id);
      if (!product) return;

      // cycle: pending -> bought -> missing -> pending
      const next = product.status === 'pending' ? 'bought'
                  : product.status === 'bought' ? 'missing'
                  : 'pending';

      product.status = next; // optimistic update
      render();

      try {
        await DataLayer.updateProduct(id, { status: next });
      } catch (err) {
        console.error(err);
        showToast('שגיאה בשמירה, בדקו חיבור');
      }
    });
  });

  container.querySelectorAll('[data-lightbox]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openLightbox(el.dataset.lightbox);
    });
  });

  container.querySelectorAll('[data-quick-add]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openAddProductModal(el.dataset.quickAdd, el.dataset.catName);
    });
  });
}

function updateReceipt() {
  const remaining = state.products.filter(p => p.status === 'pending');
  const bought = state.products.filter(p => p.status === 'bought');
  const missing = state.products.filter(p => p.status === 'missing');

  // צפי רשימה: סכום קבוע של כל המוצרים ברשימה, ללא קשר לסימון
  const listTotal = state.products.reduce((s, p) => s + lineTotal(p), 0);

  // סכום קניה נוכחית: רק מה שכבר סומן כ"נקנה", מתחיל מ-0
  const cartTotal = bought.reduce((s, p) => s + lineTotal(p), 0);

  receiptTotalAmount.textContent = '₪' + formatPrice(listTotal);

  const prevCart = receiptAmount.dataset.value;
  receiptAmount.textContent = '₪' + formatPrice(cartTotal);
  receiptAmount.dataset.value = cartTotal;
  if (prevCart !== undefined && Number(prevCart) !== cartTotal) {
    receiptAmount.classList.remove('pulse');
    // restart animation
    void receiptAmount.offsetWidth;
    receiptAmount.classList.add('pulse');
  }

  receiptSub.textContent = `${remaining.length} ממתינים · ${bought.length} נקנו` +
    (missing.length ? ` · ${missing.length} חסרים במלאי` : '');
  receiptBar.style.display = 'block';

  finishBtn.disabled = bought.length === 0;
}

// ===== Finish shopping flow =====
finishBtn.addEventListener('click', () => {
  const bought = state.products.filter(p => p.status === 'bought');
  const missing = state.products.filter(p => p.status === 'missing');
  const total = bought.reduce((s, p) => s + lineTotal(p), 0);

  finishModalText.textContent =
    `נקנו ${bought.length} מוצרים בסך ₪${formatPrice(total)}. ` +
    (missing.length ? `${missing.length} מוצרים יישארו מסומנים כ"חסר במלאי". ` : '') +
    `הרשימה תתאפס ותהיה מוכנה לקניה הבאה.`;

  finishModal.classList.add('open');
});

document.getElementById('cancelFinish').addEventListener('click', () => {
  finishModal.classList.remove('open');
});

document.getElementById('confirmFinish').addEventListener('click', async () => {
  const bought = state.products.filter(p => p.status === 'bought');
  const missing = state.products.filter(p => p.status === 'missing');
  const total = bought.reduce((s, p) => s + lineTotal(p), 0);

  const snapshot = bought.map(p => ({ name: p.name, price: Number(p.price), quantity: Number(p.quantity) || 1 }));

  try {
    await DataLayer.finishShoppingTrip(snapshot, total);
    // bought items: reset status to pending AND remove from active list (back to general pool)
    // missing items stay in the active list, marked missing, as a reminder for next time
    await Promise.all(
      bought.map(p => DataLayer.updateProduct(p.id, { status: 'pending', in_active_list: false }))
    );
    finishModal.classList.remove('open');
    showToast('הקניה נשמרה בהיסטוריה 🧾');
    await loadData();

    if (missing.length > 0) {
      sendMissingItemsWhatsApp(missing); // לא חוסם - שולח ברקע, כשלון בשליחה לא משפיע על שמירת הקניה
    }
  } catch (err) {
    console.error(err);
    showToast('שגיאה בשמירת הקניה');
  }
});

// ===== WhatsApp: שליחת חוסרי מלאי למספרים שהוגדרו למשפחה הפעילה בהגדרות =====
async function sendMissingItemsWhatsApp(missingProducts) {
  try {
    const phones = await DataLayer.getMissingItemsPhonesForActiveWorkspace();
    if (!phones || phones.length === 0) return;

    const lines = missingProducts.map(p => `• ${p.name}`).join('\n');
    const message = `חוסרי מלאי מהסופר:\n\n${lines}`;

    await Promise.all(phones.map(phone =>
      fetch('https://whatsapp-bot-production-120a.up.railway.app/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message }),
      }).catch(err => console.error('שגיאה בשליחת הודעה ל-' + phone, err))
    ));
  } catch (err) {
    console.error('שגיאה כללית בשליחת התראת חוסרי מלאי:', err);
  }
}

// ===== Topbar scroll shadow =====
window.addEventListener('scroll', () => {
  document.getElementById('topbar').classList.toggle('scrolled', window.scrollY > 4);
});

// ===== Lightbox (fullscreen product image) =====
const imageLightbox = document.getElementById('imageLightbox');
const lightboxImg = document.getElementById('lightboxImg');

function openLightbox(url) {
  lightboxImg.src = url;
  imageLightbox.classList.add('open');
}
function closeLightbox() {
  imageLightbox.classList.remove('open');
  lightboxImg.src = '';
}
imageLightbox.addEventListener('click', closeLightbox);

// ===== Quick add product (from shopping mode) =====
const addProductModal = document.getElementById('addProductModal');
const addProductCatName = document.getElementById('addProductCatName');
const addProductName = document.getElementById('addProductName');
const addProductPrice = document.getElementById('addProductPrice');
let addProductCatId = null;

function openAddProductModal(catId, catName) {
  addProductCatId = catId;
  addProductCatName.textContent = catName;
  addProductName.value = '';
  addProductPrice.value = '';
  addProductModal.classList.add('open');
  setTimeout(() => addProductName.focus(), 100);
}

document.getElementById('cancelAddProduct').addEventListener('click', () => {
  addProductModal.classList.remove('open');
});

document.getElementById('confirmAddProduct').addEventListener('click', async () => {
  const name = addProductName.value.trim();
  const priceRaw = addProductPrice.value.replace(/[^0-9.]/g, '');
  const price = parseFloat(priceRaw);

  if (!name) {
    showToast('צריך להזין שם מוצר');
    addProductName.focus();
    return;
  }
  if (!priceRaw || isNaN(price) || price <= 0) {
    showToast('צריך להזין מחיר תקין');
    addProductPrice.focus();
    return;
  }

  try {
    const items = state.products.filter(p => p.category_id === addProductCatId);
    const maxSort = items.reduce((m, p) => Math.max(m, p.sort_order), -1);
    const newProduct = await DataLayer.addProduct(addProductCatId, name, price, maxSort + 1, { inActiveList: true });
    state.products.push(newProduct);
    addProductModal.classList.remove('open');
    showToast(`"${name}" נוסף לרשימה`);
    render();
  } catch (err) {
    console.error(err);
    showToast('שגיאה בהוספת המוצר');
  }
});

(async () => {
  if (!(await requireWorkspace())) return; // requireWorkspace כבר מפנה ל-login.html אם צריך
  renderWorkspaceBadge();
  renderSettingsNavLink();

  // ===== Realtime sync (debounced to avoid overlapping reloads) =====
  let realtimeReloadTimer = null;
  DataLayer.subscribeToChanges(() => {
    clearTimeout(realtimeReloadTimer);
    realtimeReloadTimer = setTimeout(() => loadData(), 600);
  });

  loadData();
})();
