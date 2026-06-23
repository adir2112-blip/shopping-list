// ============================================
// מצב עריכה - לוגיקה
// ============================================

let state = {
  categories: [],
  products: [],
};

// בחירות checkbox שעדיין לא נשמרו ב-DB (נשמרות רק כשלוחצים "צור רשימת קניות").
// נדרש כדי שטעינות מחדש שמופעלות ע"י realtime sync לא "ימחקו" סימון שהמשתמש עשה הרגע.
let pendingActiveToggles = {};

const container = document.getElementById('categoriesContainer');
const categoryModal = document.getElementById('categoryModal');
const categoryModalTitle = document.getElementById('categoryModalTitle');
const categoryNameInput = document.getElementById('categoryNameInput');
const emojiPicker = document.getElementById('emojiPicker');
const deleteCategoryModal = document.getElementById('deleteCategoryModal');
const deleteCategoryText = document.getElementById('deleteCategoryText');
const createListBar = document.getElementById('createListBar');
const createListBtn = document.getElementById('createListBtn');
const checkedCount = document.getElementById('checkedCount');
const checkedTotal = document.getElementById('checkedTotal');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const resetListBtn = document.getElementById('resetListBtn');

let searchQuery = '';

let editingCategoryId = null; // null = creating new
let deletingCategoryId = null;
let selectedEmoji = '🛒';

const EMOJI_CHOICES = ['🥦','🍇','🥛','🧊','🥩','🥤','🧻','🧽','🍼','🫙','🍪','🍞','🐟','🧴','🛒','🍫'];

function getCollapsed() {
  try { return JSON.parse(localStorage.getItem('collapsedCatsEdit') || '{}'); }
  catch { return {}; }
}
function setCollapsed(id, val) {
  const c = getCollapsed();
  c[id] = val;
  localStorage.setItem('collapsedCatsEdit', JSON.stringify(c));
}

async function loadData() {
  setSyncStatus('syncing');
  try {
    const [categories, products] = await Promise.all([
      DataLayer.getCategories(),
      DataLayer.getProducts(),
    ]);
    // ממזגים בחירות checkbox שעדיין לא נשמרו, כדי שלא יימחקו ברענון
    for (const p of products) {
      if (Object.prototype.hasOwnProperty.call(pendingActiveToggles, p.id)) {
        p.in_active_list = pendingActiveToggles[p.id];
      }
    }
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  const collapsed = getCollapsed();

  if (state.categories.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="emoji">📝</span>
        <div class="title">אין עדיין מחלקות</div>
        <div class="sub">לחצו על "הוספת מחלקה" כדי להתחיל לבנות את הרשימה.</div>
      </div>`;
    return;
  }

  let html = '';
  const sortedCategories = [...state.categories].sort((a, b) => a.sort_order - b.sort_order);
  for (let catIdx = 0; catIdx < sortedCategories.length; catIdx++) {
    const cat = sortedCategories[catIdx];
    const items = state.products
      .filter(p => p.category_id === cat.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const isCollapsed = !!collapsed[cat.id];
    const catTotal = items.reduce((sum, p) => sum + lineTotal(p), 0);
    const catPosition = catIdx + 1; // מיקום נוכחי (1-based) לתצוגה בשדה

    html += `
      <div class="category ${isCollapsed ? 'collapsed' : ''}" data-cat="${cat.id}" data-sort="${cat.sort_order}">
        <div class="category-header" data-toggle="${cat.id}">
          <input type="number" min="1" max="${sortedCategories.length}" class="cat-sort-input" data-cat-sort="${cat.id}" value="${catPosition}" title="מיקום המחלקה (לשינוי סדר)">
          <span class="category-emoji">${escapeHtml(cat.emoji || emojiForCategory(cat.name))}</span>
          <span class="category-name">${escapeHtml(cat.name)}</span>
          <span class="category-meta">₪${formatPrice(catTotal)}</span>
          <span class="category-edit-btn" data-edit-cat="${cat.id}" title="עריכת מחלקה">✏️</span>
        </div>
        <div class="category-body" data-droplist="${cat.id}">
          ${items.map(p => editProductRow(p)).join('')}
          <div class="add-product-row" data-add-product="${cat.id}">
            <span class="plus-circle">+</span>
            <span>הוספת מוצר</span>
          </div>
        </div>
      </div>`;
  }

  container.innerHTML = html;
  bindEvents();
  updateCreateListButton();
  applySearchFilter();
}

function editProductRow(p) {
  const thumb = p.image_url
    ? `<img src="${escapeHtml(p.image_url)}" class="product-thumb" data-image-btn="${p.id}" alt="">`
    : `<span class="product-thumb-empty" data-image-btn="${p.id}">📷</span>`;
  return `
    <div class="product-row edit-row tap-row" data-id="${p.id}" data-sort="${p.sort_order}" data-active-tap="${p.id}">
      ${thumb}
      <span class="product-name-display">${escapeHtml(p.name)}</span>
      <span class="product-qty-display">${Number(p.quantity) !== 1 ? `× ${formatQuantity(p.quantity)}` : ''}</span>
      <span class="product-price-display">₪${formatPrice(lineTotal(p))}</span>
      <span class="product-edit-pencil" data-edit-product="${p.id}" title="עריכה">✏️</span>
      <input type="checkbox" class="active-checkbox" data-active-toggle="${p.id}" ${p.in_active_list ? 'checked' : ''}>
      <button class="delete-btn" data-delete-product="${p.id}">✕</button>
    </div>`;
}

// ===== debounced save for text inputs =====
const saveTimers = {};
function debouncedSave(id, fields, delay = 600) {
  clearTimeout(saveTimers[id]);
  saveTimers[id] = setTimeout(async () => {
    try {
      await DataLayer.updateProduct(id, fields);
    } catch (err) {
      console.error(err);
      showToast('שגיאה בשמירה');
    }
  }, delay);
}

function bindEvents() {
  // toggle collapse (chevron only)
  container.querySelectorAll('[data-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.toggle;
      const collapsed = getCollapsed();
      setCollapsed(id, !collapsed[id]);
      render();
    });
  });

  // edit category (emoji or name area) -> open modal
  container.querySelectorAll('[data-edit-cat]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openCategoryModal(el.dataset.editCat);
    });
  });

  // category sort-order number input
  container.querySelectorAll('[data-cat-sort]').forEach(input => {
    // עוצרים propagation כדי שלחיצה על השדה לא תפתח/תסגור את המחלקה
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('change', async () => {
      const catId = input.dataset.catSort;
      const newPos = parseInt(input.value, 10);
      const total = state.categories.length;
      if (isNaN(newPos) || newPos < 1 || newPos > total) {
        render(); // מחזיר את הערך הנכון
        return;
      }

      // בונה רשימה חדשה ממוינת: מסיר את הקטגוריה שזזה ומכניס אותה במיקום החדש
      const sorted = [...state.categories].sort((a, b) => a.sort_order - b.sort_order);
      const movingCat = sorted.find(c => c.id === catId);
      if (!movingCat) return;
      const rest = sorted.filter(c => c.id !== catId);
      rest.splice(newPos - 1, 0, movingCat);

      // מעדכן sort_order בזיכרון ושולח ל-DB
      rest.forEach((c, idx) => { c.sort_order = idx; });
      suppressRealtimeReload = true;
      try {
        await Promise.all(rest.map(c => DataLayer.updateCategory(c.id, { sort_order: c.sort_order })));
        render();
      } catch (err) {
        console.error(err);
        showToast('שגיאה בשמירת סדר המחלקות');
        render();
      } finally {
        setTimeout(() => { suppressRealtimeReload = false; }, 600);
      }
    });
  });
  // active-list checkbox - בחירה זמנית, נשמרת ל-DB רק בלחיצה על "צור רשימת קניות"
  container.querySelectorAll('[data-active-toggle]').forEach(el => {
    el.addEventListener('change', () => {
      const id = el.dataset.activeToggle;
      const product = state.products.find(p => p.id === id);
      if (product) product.in_active_list = el.checked;
      pendingActiveToggles[id] = el.checked;
      updateCreateListButton();
    });
  });

  // לחיצה על שורת המוצר = מסמן/מבטל סימון (כמו לחיצה על ה-checkbox)
  container.querySelectorAll('[data-active-tap]').forEach(row => {
    row.addEventListener('click', (e) => {
      // מתעלמים מלחיצה על כפתורים ספציפיים
      if (e.target.closest('[data-edit-product]') ||
          e.target.closest('[data-delete-product]') ||
          e.target.closest('[data-image-btn]') ||
          e.target.closest('.active-checkbox')) return;

      const id = row.dataset.activeTap;
      const checkbox = row.querySelector('.active-checkbox');
      if (!checkbox) return;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    });
  });

  // עיפרון ליד שם המוצר -> פתיחת מודל עריכה
  container.querySelectorAll('[data-edit-product]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openProductEditModal(el.dataset.editProduct);
    });
  });

  // image thumbnail / camera icon -> open image modal
  container.querySelectorAll('[data-image-btn]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openImageModal(el.dataset.imageBtn);
    });
  });

  // delete product
  container.querySelectorAll('[data-delete-product]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.dataset.deleteProduct;
      const row = el.closest('.product-row');
      row.style.transition = 'opacity 0.2s, transform 0.2s';
      row.style.opacity = '0';
      row.style.transform = 'translateX(20px)';
      setTimeout(async () => {
        state.products = state.products.filter(p => p.id !== id);
        render();
        try {
          await DataLayer.deleteProduct(id);
        } catch (err) {
          console.error(err);
          showToast('שגיאה במחיקה');
          loadData();
        }
      }, 180);
    });
  });

  // add product
  container.querySelectorAll('[data-add-product]').forEach(el => {
    el.addEventListener('click', async () => {
      const catId = el.dataset.addProduct;
      const items = state.products.filter(p => p.category_id === catId);
      const maxSort = items.reduce((m, p) => Math.max(m, p.sort_order), -1);
      try {
        const newProduct = await DataLayer.addProduct(catId, 'מוצר חדש', 0, maxSort + 1);
        state.products.push(newProduct);
        render();
        // פותח ישירות את מודל עריכת המוצר כדי שהמשתמש יוכל להזין שם ומחיר
        setTimeout(() => openProductEditModal(newProduct.id), 80);
      } catch (err) {
        console.error(err);
        showToast('שגיאה בהוספת מוצר');
      }
    });
  });

  bindDragAndDrop();
}

function updateCategoryTotalDisplay(catId) {
  if (!catId) return;
  const items = state.products.filter(p => p.category_id === catId);
  const total = items.reduce((sum, p) => sum + lineTotal(p), 0);
  const catEl = container.querySelector(`.category[data-cat="${catId}"] .category-meta`);
  if (catEl) catEl.textContent = '₪' + formatPrice(total);
}

// ============================================
// Drag and drop (products within/between categories, and categories)
// ============================================
function bindDragAndDrop() {
  // --- Product drag handles ---
  container.querySelectorAll('[data-drag]').forEach(handle => {
    handle.addEventListener('pointerdown', (e) => startProductDrag(e, handle));
  });
  // --- Category drag handles ---
  container.querySelectorAll('[data-cat-drag]').forEach(handle => {
    handle.addEventListener('pointerdown', (e) => startCategoryDrag(e, handle));
  });
}

function startProductDrag(e, handle) {
  e.preventDefault();
  const row = handle.closest('.product-row');
  const id = row.dataset.id;
  const startY = e.clientY;

  row.classList.add('dragging');
  const placeholder = document.createElement('div');
  placeholder.className = 'drop-indicator';
  row.parentNode.insertBefore(placeholder, row.nextSibling);

  const ghost = row.cloneNode(true);
  ghost.style.position = 'fixed';
  ghost.style.zIndex = '999';
  ghost.style.width = row.getBoundingClientRect().width + 'px';
  ghost.style.left = row.getBoundingClientRect().left + 'px';
  ghost.style.top = row.getBoundingClientRect().top + 'px';
  ghost.style.pointerEvents = 'none';
  ghost.style.background = 'var(--surface)';
  ghost.style.boxShadow = 'var(--shadow-lift)';
  ghost.style.borderRadius = '12px';
  ghost.style.opacity = '0.95';
  document.body.appendChild(ghost);
  row.style.display = 'none';

  let scrollInterval = null;
  let lastClientY = startY;

  function findAndPlacePlaceholder(clientY) {
    // find which row we're hovering over (skip rows hidden inside collapsed categories)
    const allRows = Array.from(document.querySelectorAll('.category-body .product-row:not(.dragging)'))
      .filter(r => r.offsetParent !== null);
    let closest = null;
    let closestDist = Infinity;
    for (const r of allRows) {
      const rect = r.getBoundingClientRect();
      const dist = Math.abs(clientY - (rect.top + rect.height / 2));
      if (dist < closestDist) { closestDist = dist; closest = r; }
    }
    if (closest) {
      const rect = closest.getBoundingClientRect();
      const before = clientY < rect.top + rect.height / 2;
      closest.parentNode.insertBefore(placeholder, before ? closest : closest.nextSibling);
    } else {
      // hovering over an empty category body or add-product row
      const dropLists = Array.from(document.querySelectorAll('[data-droplist]'))
        .filter(l => l.offsetParent !== null);
      for (const list of dropLists) {
        const rect = list.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          const addRow = list.querySelector('.add-product-row');
          list.insertBefore(placeholder, addRow);
        }
      }
    }
  }

  function handleEdgeScroll(clientY) {
    const margin = 90;
    const vh = window.innerHeight;
    clearInterval(scrollInterval);
    if (clientY < margin) {
      scrollInterval = setInterval(() => {
        window.scrollBy(0, -12);
        // הגלילה האוטומטית משנה את מיקום השורות על המסך גם בלי תזוזת אצבע/עכבר,
        // אז חשוב לעדכן את ה-placeholder גם כאן ולא רק ב-onMove
        findAndPlacePlaceholder(lastClientY);
      }, 16);
    } else if (clientY > vh - margin) {
      scrollInterval = setInterval(() => {
        window.scrollBy(0, 12);
        findAndPlacePlaceholder(lastClientY);
      }, 16);
    }
  }

  function onMove(ev) {
    const dy = ev.clientY - startY;
    ghost.style.transform = `translateY(${dy}px)`;
    lastClientY = ev.clientY;
    handleEdgeScroll(ev.clientY);
    findAndPlacePlaceholder(ev.clientY);
  }

  async function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    clearInterval(scrollInterval);
    ghost.remove();
    row.style.display = '';
    row.classList.remove('dragging');

    const newCatBody = placeholder.closest('[data-droplist]');
    const newCatId = newCatBody ? newCatBody.dataset.droplist : null;
    placeholder.parentNode.insertBefore(row, placeholder);
    placeholder.remove();

    // אם המחלקה שאליה הועבר המוצר היתה מכווצת, פותחים אותה כדי שהמוצר לא "יעלם" ויזואלית
    if (newCatId) {
      const collapsedNow = getCollapsed();
      if (collapsedNow[newCatId]) {
        setCollapsed(newCatId, false);
      }
    }

    // recompute sort orders for affected category(ies)
    const scrollBefore = window.scrollY;
    await persistProductOrder(newCatId, id);
    render();
    window.scrollTo(0, scrollBefore);
  }

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

async function persistProductOrder(newCatId, movedProductId) {
  // Update in-memory state to reflect new DOM order, then push sort_order + category_id to DB
  const rows = Array.from(document.querySelectorAll(`[data-droplist="${newCatId}"] .product-row`));
  const updates = [];

  rows.forEach((row, idx) => {
    const id = row.dataset.id;
    const product = state.products.find(p => p.id === id);
    if (!product) return;
    product.sort_order = idx;
    if (id === movedProductId) product.category_id = newCatId;
    updates.push({ id, sort_order: idx, category_id: id === movedProductId ? newCatId : undefined });
  });

  suppressRealtimeReload = true;
  try {
    await Promise.all(updates.map(u => {
      const fields = { sort_order: u.sort_order };
      if (u.category_id !== undefined) fields.category_id = u.category_id;
      return DataLayer.updateProduct(u.id, fields);
    }));
  } catch (err) {
    console.error(err);
    showToast('שגיאה בשמירת הסדר');
  } finally {
    setTimeout(() => { suppressRealtimeReload = false; }, 600);
  }
}

function startCategoryDrag(e, handle) {
  e.preventDefault();
  const catEl = handle.closest('.category');
  const startY = e.clientY;

  const placeholder = document.createElement('div');
  placeholder.style.height = '14px';
  catEl.parentNode.insertBefore(placeholder, catEl.nextSibling);

  const rect = catEl.getBoundingClientRect();
  const ghost = catEl.cloneNode(true);
  ghost.style.position = 'fixed';
  ghost.style.zIndex = '999';
  ghost.style.width = rect.width + 'px';
  ghost.style.left = rect.left + 'px';
  ghost.style.top = rect.top + 'px';
  ghost.style.pointerEvents = 'none';
  ghost.style.opacity = '0.95';
  ghost.style.boxShadow = 'var(--shadow-lift)';
  document.body.appendChild(ghost);
  catEl.style.display = 'none';

  let catScrollInterval = null;
  let lastClientYCat = startY;

  function findAndPlaceCatPlaceholder(clientY) {
    const allCats = Array.from(document.querySelectorAll('.category')).filter(c => c !== catEl);
    let closest = null, closestDist = Infinity;
    for (const c of allCats) {
      const r = c.getBoundingClientRect();
      const dist = Math.abs(clientY - (r.top + r.height / 2));
      if (dist < closestDist) { closestDist = dist; closest = c; }
    }
    if (closest) {
      const r = closest.getBoundingClientRect();
      const before = clientY < r.top + r.height / 2;
      closest.parentNode.insertBefore(placeholder, before ? closest : closest.nextSibling);
    }
  }

  function handleEdgeScrollCat(clientY) {
    const margin = 90;
    const vh = window.innerHeight;
    clearInterval(catScrollInterval);
    if (clientY < margin) {
      catScrollInterval = setInterval(() => {
        window.scrollBy(0, -12);
        findAndPlaceCatPlaceholder(lastClientYCat);
      }, 16);
    } else if (clientY > vh - margin) {
      catScrollInterval = setInterval(() => {
        window.scrollBy(0, 12);
        findAndPlaceCatPlaceholder(lastClientYCat);
      }, 16);
    }
  }

  function onMove(ev) {
    const dy = ev.clientY - startY;
    ghost.style.transform = `translateY(${dy}px)`;
    lastClientYCat = ev.clientY;
    handleEdgeScrollCat(ev.clientY);
    findAndPlaceCatPlaceholder(ev.clientY);
  }

  async function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    clearInterval(catScrollInterval);
    ghost.remove();
    catEl.style.display = '';
    placeholder.parentNode.insertBefore(catEl, placeholder);
    placeholder.remove();

    const catEls = Array.from(document.querySelectorAll('.category'));
    const updates = [];
    catEls.forEach((el, idx) => {
      const id = el.dataset.cat;
      const cat = state.categories.find(c => c.id === id);
      if (cat) cat.sort_order = idx;
      updates.push({ id, sort_order: idx });
    });

    suppressRealtimeReload = true;
    const scrollBefore = window.scrollY;
    try {
      await Promise.all(updates.map(u => DataLayer.updateCategory(u.id, { sort_order: u.sort_order })));
      render();
      window.scrollTo(0, scrollBefore);
    } catch (err) {
      console.error(err);
      showToast('שגיאה בשמירת סדר המחלקות');
      render();
    } finally {
      // מחכים קצת לפני שמשחררים את ה-suppression, כדי לתת ל-realtime events לסיים
      setTimeout(() => { suppressRealtimeReload = false; }, 600);
    }
  }

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// ============================================
// Category modal (add / edit)
// ============================================
const modalActions = document.querySelector('#categoryModal .modal-actions');
const deleteCategoryLink = document.createElement('button');
deleteCategoryLink.textContent = 'מחיקת מחלקה';
deleteCategoryLink.className = 'modal-btn danger';
deleteCategoryLink.style.display = 'none';
deleteCategoryLink.id = 'deleteCategoryFromModal';
modalActions.appendChild(deleteCategoryLink);

function renderEmojiPicker() {
  emojiPicker.innerHTML = EMOJI_CHOICES.map(em => `
    <div class="emoji-option ${em === selectedEmoji ? 'selected' : ''}" data-emoji="${em}">${em}</div>
  `).join('');
  emojiPicker.querySelectorAll('[data-emoji]').forEach(el => {
    el.addEventListener('click', () => {
      selectedEmoji = el.dataset.emoji;
      renderEmojiPicker();
    });
  });
}

function openCategoryModal(catId) {
  editingCategoryId = catId;
  const cat = state.categories.find(c => c.id === catId);
  categoryModalTitle.textContent = 'עריכת מחלקה';
  categoryNameInput.value = cat ? cat.name : '';
  selectedEmoji = (cat && cat.emoji) || emojiForCategory(cat?.name || '');
  renderEmojiPicker();
  categoryModal.classList.add('open');
  deleteCategoryLink.style.display = catId ? 'block' : 'none';
  setTimeout(() => categoryNameInput.focus(), 100);
}

document.getElementById('addCategoryBtn').addEventListener('click', () => {
  editingCategoryId = null;
  categoryModalTitle.textContent = 'מחלקה חדשה';
  categoryNameInput.value = '';
  selectedEmoji = '🛒';
  renderEmojiPicker();
  categoryModal.classList.add('open');
  deleteCategoryLink.style.display = 'none';
  setTimeout(() => categoryNameInput.focus(), 100);
});

document.getElementById('cancelCategory').addEventListener('click', () => {
  categoryModal.classList.remove('open');
});

document.getElementById('saveCategory').addEventListener('click', async () => {
  const name = categoryNameInput.value.trim();
  if (!name) {
    showToast('צריך להזין שם מחלקה');
    return;
  }

  try {
    if (editingCategoryId) {
      await DataLayer.updateCategory(editingCategoryId, { name, emoji: selectedEmoji });
      const cat = state.categories.find(c => c.id === editingCategoryId);
      if (cat) { cat.name = name; cat.emoji = selectedEmoji; }
      showToast('המחלקה עודכנה');
    } else {
      const maxSort = state.categories.reduce((m, c) => Math.max(m, c.sort_order), -1);
      const newCat = await DataLayer.addCategory(name, maxSort + 1);
      await DataLayer.updateCategory(newCat.id, { emoji: selectedEmoji });
      newCat.emoji = selectedEmoji;
      state.categories.push(newCat);
      showToast('המחלקה נוספה');
    }
    categoryModal.classList.remove('open');
    render();
  } catch (err) {
    console.error(err);
    showToast('שגיאה בשמירת המחלקה');
  }
});

deleteCategoryLink.addEventListener('click', () => {
  if (!editingCategoryId) return;
  categoryModal.classList.remove('open');
  deletingCategoryId = editingCategoryId;
  const cat = state.categories.find(c => c.id === deletingCategoryId);
  const itemCount = state.products.filter(p => p.category_id === deletingCategoryId).length;
  deleteCategoryText.textContent = itemCount > 0
    ? `המחלקה "${cat?.name}" כוללת ${itemCount} מוצרים. מחיקת המחלקה תמחק גם את כל המוצרים שבה. פעולה זו לא ניתנת לביטול.`
    : `למחוק את המחלקה "${cat?.name}"?`;
  deleteCategoryModal.classList.add('open');
});

document.getElementById('cancelDeleteCategory').addEventListener('click', () => {
  deleteCategoryModal.classList.remove('open');
});

document.getElementById('confirmDeleteCategory').addEventListener('click', async () => {
  try {
    await DataLayer.deleteCategory(deletingCategoryId);
    state.categories = state.categories.filter(c => c.id !== deletingCategoryId);
    state.products = state.products.filter(p => p.category_id !== deletingCategoryId);
    deleteCategoryModal.classList.remove('open');
    showToast('המחלקה נמחקה');
    render();
  } catch (err) {
    console.error(err);
    showToast('שגיאה במחיקת המחלקה');
  }
});

// ============================================
// "צור רשימת קניות" - מעביר מוצרים מסומנים למצב קניה
// ============================================
function updateCreateListButton() {
  const checked = state.products.filter(p => p.in_active_list);
  const total = checked.reduce((sum, p) => sum + lineTotal(p), 0);
  checkedCount.textContent = checked.length;
  checkedTotal.textContent = '₪' + formatPrice(total);
  createListBtn.disabled = checked.length === 0;
  createListBar.style.display = state.products.length > 0 ? 'block' : 'none';
}

// ============================================
// חיפוש מוצרים - מסנן שורות ומקפל קטגוריות ללא תוצאות
// ============================================
let collapsedBeforeSearch = null;

function applySearchFilter() {
  searchClear.style.display = searchQuery ? 'flex' : 'none';

  if (!searchQuery) {
    container.querySelectorAll('.product-row.search-no-match, .category.search-no-match')
      .forEach(el => el.classList.remove('search-no-match'));
    // restore the categories the user had collapsed before starting to search
    if (collapsedBeforeSearch) {
      container.querySelectorAll('.category').forEach(catEl => {
        const id = catEl.dataset.cat;
        catEl.classList.toggle('collapsed', !!collapsedBeforeSearch[id]);
      });
      collapsedBeforeSearch = null;
    }
    return;
  }

  if (collapsedBeforeSearch === null) {
    collapsedBeforeSearch = getCollapsed();
  }

  const q = searchQuery.trim().toLowerCase();

  container.querySelectorAll('.category').forEach(catEl => {
    let anyVisibleInCat = false;
    catEl.querySelectorAll('.product-row.edit-row').forEach(row => {
      const id = row.dataset.id;
      const product = state.products.find(p => p.id === id);
      const matches = product && product.name.toLowerCase().includes(q);
      row.classList.toggle('search-no-match', !matches);
      if (matches) anyVisibleInCat = true;
    });
    catEl.classList.toggle('search-no-match', !anyVisibleInCat);
    // expand categories that have matches, so the user doesn't need to manually open them
    if (anyVisibleInCat) catEl.classList.remove('collapsed');
  });
}

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  applySearchFilter();
});

searchClear.addEventListener('click', () => {
  searchQuery = '';
  searchInput.value = '';
  searchInput.focus();
  applySearchFilter();
});

createListBtn.addEventListener('click', async () => {
  const checkedIds = state.products.filter(p => p.in_active_list).map(p => p.id);
  if (checkedIds.length === 0) return;

  // מוצרים שהמשתמש הסיר מהם סימון (היו true ב-DB, עכשיו false מקומית) -
  // צריך לשמור את ההסרה גם כן, לא רק את ההוספות
  const uncheckedIds = Object.keys(pendingActiveToggles)
    .filter(id => pendingActiveToggles[id] === false);

  createListBtn.disabled = true;
  createListBtn.textContent = 'יוצר רשימה...';

  suppressRealtimeReload = true;
  try {
    await DataLayer.activateProducts(checkedIds);
    if (uncheckedIds.length > 0) {
      await Promise.all(uncheckedIds.map(id => DataLayer.updateProduct(id, { in_active_list: false })));
    }
    pendingActiveToggles = {};
    showToast(`רשימת הקניות עודכנה עם ${checkedIds.length} מוצרים 🛒`);
    await loadData();
  } catch (err) {
    console.error(err);
    showToast('שגיאה ביצירת הרשימה');
  } finally {
    suppressRealtimeReload = false;
    createListBtn.textContent = 'צור רשימת קניות 🛒';
  }
});

// ============================================
// מודל עריכת מוצר (שם, כמות, מחיר)
// ============================================
const editProductModal = document.getElementById('editProductModal');
const editProductName = document.getElementById('editProductName');
const editProductQty = document.getElementById('editProductQty');
const editProductPrice = document.getElementById('editProductPrice');
let editingProductId = null;

function openProductEditModal(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  editingProductId = productId;
  editProductName.value = product.name;
  editProductQty.value = formatQuantity(product.quantity);
  editProductPrice.value = Number(product.price).toFixed(2);
  editProductModal.classList.add('open');
  setTimeout(() => editProductName.focus(), 100);
}

document.getElementById('cancelEditProduct').addEventListener('click', () => {
  editProductModal.classList.remove('open');
});

document.getElementById('confirmEditProduct').addEventListener('click', async () => {
  if (!editingProductId) return;
  const product = state.products.find(p => p.id === editingProductId);
  if (!product) return;

  const name = editProductName.value.trim();
  const qty = parseFloat(editProductQty.value) || 1;
  const price = parseFloat(editProductPrice.value) || 0;

  if (!name) {
    showToast('יש להזין שם מוצר');
    editProductName.focus();
    return;
  }

  product.name = name;
  product.quantity = qty;
  product.price = price;

  try {
    await DataLayer.updateProduct(editingProductId, { name, quantity: qty, price });
    editProductModal.classList.remove('open');
    render();
  } catch (err) {
    console.error(err);
    showToast('שגיאה בשמירה');
  }
});

// ============================================
// תמונת מוצר - מודל הוספה/הסרה
// ============================================
const imageModal = document.getElementById('imageModal');
const imageModalTitle = document.getElementById('imageModalTitle');
const imagePreviewArea = document.getElementById('imagePreviewArea');
const imagePreview = document.getElementById('imagePreview');
const imagePreviewPlaceholder = document.getElementById('imagePreviewPlaceholder');
const imageFileInput = document.getElementById('imageFileInput');
const chooseImageBtn = document.getElementById('chooseImageBtn');
const removeImageBtn = document.getElementById('removeImageBtn');

let activeImageProductId = null;

function openImageModal(productId) {
  activeImageProductId = productId;
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  imageModalTitle.textContent = product.name;
  if (product.image_url) {
    imagePreview.src = product.image_url;
    imagePreview.style.display = 'block';
    imagePreviewPlaceholder.style.display = 'none';
    removeImageBtn.style.display = 'block';
    chooseImageBtn.textContent = 'החלפת תמונה';
  } else {
    imagePreview.style.display = 'none';
    imagePreviewPlaceholder.style.display = 'block';
    removeImageBtn.style.display = 'none';
    chooseImageBtn.textContent = 'הוסף תמונה';
  }
  chooseImageBtn.disabled = false;
  imageModal.classList.add('open');
}

document.getElementById('closeImageModal').addEventListener('click', () => {
  imageModal.classList.remove('open');
});

chooseImageBtn.addEventListener('click', () => {
  imageFileInput.click();
});

imageFileInput.addEventListener('change', async () => {
  const file = imageFileInput.files[0];
  imageFileInput.value = '';
  if (!file || !activeImageProductId) return;

  if (!file.type.startsWith('image/')) {
    showToast('יש לבחור קובץ תמונה');
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showToast('התמונה גדולה מ-8MB, נסו תמונה קטנה יותר');
    return;
  }

  chooseImageBtn.disabled = true;
  chooseImageBtn.textContent = 'מעלה תמונה...';

  try {
    const url = await DataLayer.uploadProductImage(activeImageProductId, file);
    const product = state.products.find(p => p.id === activeImageProductId);
    if (product) product.image_url = url;
    imagePreview.src = url;
    imagePreview.style.display = 'block';
    imagePreviewPlaceholder.style.display = 'none';
    removeImageBtn.style.display = 'block';
    chooseImageBtn.textContent = 'החלפת תמונה';
    showToast('התמונה נשמרה');
    renderProductThumb(activeImageProductId, url);
  } catch (err) {
    console.error(err);
    showToast('שגיאה בהעלאת התמונה');
    chooseImageBtn.textContent = 'הוסף תמונה';
  } finally {
    chooseImageBtn.disabled = false;
  }
});

removeImageBtn.addEventListener('click', async () => {
  if (!activeImageProductId) return;
  const product = state.products.find(p => p.id === activeImageProductId);
  if (!product) return;

  removeImageBtn.disabled = true;
  try {
    await DataLayer.deleteProductImage(activeImageProductId, product.image_url);
    product.image_url = null;
    imagePreview.style.display = 'none';
    imagePreviewPlaceholder.style.display = 'block';
    removeImageBtn.style.display = 'none';
    chooseImageBtn.textContent = 'הוסף תמונה';
    showToast('התמונה הוסרה');
    renderProductThumb(activeImageProductId, null);
  } catch (err) {
    console.error(err);
    showToast('שגיאה בהסרת התמונה');
  } finally {
    removeImageBtn.disabled = false;
  }
});

function renderProductThumb(productId, url) {
  // מעדכן רק את התמונה הקטנה בשורה, בלי לרנדר את כל הרשימה מחדש
  const oldEl = container.querySelector(`[data-image-btn="${productId}"]`);
  if (!oldEl) return;
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.className = 'product-thumb';
    img.dataset.imageBtn = productId;
    img.alt = '';
    img.addEventListener('click', () => openImageModal(productId));
    oldEl.replaceWith(img);
  } else {
    const span = document.createElement('span');
    span.className = 'product-thumb-empty';
    span.dataset.imageBtn = productId;
    span.textContent = '📷';
    span.addEventListener('click', () => openImageModal(productId));
    oldEl.replaceWith(span);
  }
}

resetListBtn.addEventListener('click', async () => {
  const checked = state.products.filter(p => p.in_active_list);
  if (checked.length === 0) {
    showToast('אין מוצרים מסומנים לאיפוס');
    return;
  }
  checked.forEach(p => { p.in_active_list = false; });
  pendingActiveToggles = {};
  suppressRealtimeReload = true;
  try {
    await Promise.all(checked.map(p => DataLayer.updateProduct(p.id, { in_active_list: false })));
    updateCreateListButton();
    render();
    showToast('הרשימה אופסה');
  } catch (err) {
    console.error(err);
    showToast('שגיאה באיפוס הרשימה');
  } finally {
    setTimeout(() => { suppressRealtimeReload = false; }, 600);
  }
});
window.addEventListener('scroll', () => {
  document.getElementById('topbar').classList.toggle('scrolled', window.scrollY > 4);
});

// ===== Realtime sync (skip refresh while actively typing to avoid losing focus) =====
let realtimeReloadTimer = null;
let suppressRealtimeReload = false;

(async () => {
  if (!(await requireWorkspace())) return; // requireWorkspace כבר מפנה ל-login.html אם צריך
  renderWorkspaceBadge();
  renderSettingsNavLink();

  DataLayer.subscribeToChanges(() => {
    if (suppressRealtimeReload) return;
    clearTimeout(realtimeReloadTimer);
    realtimeReloadTimer = setTimeout(() => {
      const active = document.activeElement;
      const isTyping = active && (active === categoryNameInput ||
        active === editProductName || active === editProductQty || active === editProductPrice);
      if (isTyping) return;
      loadData();
    }, 300);
  });

  loadData();
})();
