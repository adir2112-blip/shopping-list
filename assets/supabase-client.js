// ============================================
// חיבור ל-Supabase + שכבת דאטה משותפת
// ============================================

// >>> מלא כאן את הפרטים מהפרויקט שלך ב-Supabase <<<
const SUPABASE_URL = "https://byvirurdinudkelrktna.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5dmlydXJkaW51ZGtlbHJrdG5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTU3NjMsImV4cCI6MjA5NzI5MTc2M30.z9RX7GIix0DCi3N1wZFoMAKDiVjAk25AAA3sb6fw67U";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// emoji ברירת מחדל למחלקות (לפי שם)
const CATEGORY_EMOJI = {
  "ירקות": "🥦",
  "פירות": "🍇",
  "מוצרי חלב": "🥛",
  "קפואים": "🧊",
  "בשרי": "🥩",
  "שתיה קלה": "🥤",
  "חד פעמי": "🥤", // יוחלף אם יש כפילות
  "ניקיון": "🧽",
  "תינוקות": "🍼",
  "רטבים": "🫙",
  "חטיפים": "🍪",
};
CATEGORY_EMOJI["חד פעמי"] = "🧻";

function emojiForCategory(name) {
  return CATEGORY_EMOJI[name] || "🛒";
}

function formatPrice(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineTotal(product) {
  const qty = Number(product.quantity) || 1;
  return Number(product.price) * qty;
}

function formatQuantity(q) {
  const num = Number(q) || 1;
  // מציג מספרים שלמים בלי נקודה עשרונית, ועשרוניים עם עד 2 ספרות
  return num % 1 === 0 ? String(num) : num.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

// ===== Data access layer (מסונן לפי ה-workspace הפעיל) =====

const DataLayer = {
  async getCategories() {
    const ws = await requireWorkspace();
    const { data, error } = await supabaseClient
      .from('categories')
      .select('*')
      .eq('workspace_id', ws)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getProducts() {
    // מחזיר את כל המוצרים (המאגר הכללי) - לשימוש בעריכה
    const ws = await requireWorkspace();
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('workspace_id', ws)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getActiveProducts() {
    // מחזיר רק מוצרים שנמצאים ברשימת הקניות הפעילה - לשימוש במצב קניה
    const ws = await requireWorkspace();
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('workspace_id', ws)
      .eq('in_active_list', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  },

  async addCategory(name, sortOrder) {
    const ws = await requireWorkspace();
    const { data, error } = await supabaseClient
      .from('categories')
      .insert({ name, sort_order: sortOrder, workspace_id: ws })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateCategory(id, fields) {
    const ws = await requireWorkspace();
    const { error } = await supabaseClient
      .from('categories')
      .update(fields)
      .eq('id', id)
      .eq('workspace_id', ws);
    if (error) throw error;
  },

  async deleteCategory(id) {
    const ws = await requireWorkspace();
    const { error } = await supabaseClient
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('workspace_id', ws);
    if (error) throw error;
  },

  async addProduct(categoryId, name, price, sortOrder, opts = {}) {
    const ws = await requireWorkspace();
    const { data, error } = await supabaseClient
      .from('products')
      .insert({
        category_id: categoryId,
        name,
        price,
        sort_order: sortOrder,
        status: 'pending',
        workspace_id: ws,
        quantity: opts.quantity ?? 1,
        in_active_list: opts.inActiveList ?? false,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateProduct(id, fields) {
    const ws = await requireWorkspace();
    const { error } = await supabaseClient
      .from('products')
      .update(fields)
      .eq('id', id)
      .eq('workspace_id', ws);
    if (error) throw error;
  },

  async activateProducts(ids) {
    // מעביר מוצרים מהמאגר הכללי לרשימת הקניות הפעילה (in_active_list = true),
    // ומאפס את הסטטוס שלהם כדי שיתחילו "ממתינים" בקניה הבאה
    if (!ids || ids.length === 0) return;
    const ws = await requireWorkspace();
    const { error } = await supabaseClient
      .from('products')
      .update({ in_active_list: true, status: 'pending' })
      .in('id', ids)
      .eq('workspace_id', ws);
    if (error) throw error;
  },

  async deleteProduct(id) {
    const ws = await requireWorkspace();
    const { error } = await supabaseClient
      .from('products')
      .delete()
      .eq('id', id)
      .eq('workspace_id', ws);
    if (error) throw error;
  },

  async resetAllStatuses() {
    const ws = await requireWorkspace();
    const { error } = await supabaseClient
      .from('products')
      .update({ status: 'pending' })
      .eq('workspace_id', ws)
      .neq('status', 'pending');
    if (error) throw error;
  },

  async finishShoppingTrip(boughtItems, total) {
    const ws = await requireWorkspace();
    const { error } = await supabaseClient
      .from('shopping_history')
      .insert({ items: boughtItems, total, workspace_id: ws });
    if (error) throw error;
  },

  async getHistory(limit = 50) {
    const ws = await requireWorkspace();
    const { data, error } = await supabaseClient
      .from('shopping_history')
      .select('*')
      .eq('workspace_id', ws)
      .order('finished_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async deleteHistoryEntry(id) {
    const ws = await requireWorkspace();
    const { error } = await supabaseClient
      .from('shopping_history')
      .delete()
      .eq('id', id)
      .eq('workspace_id', ws);
    if (error) throw error;
  },

  subscribeToChanges(onChange) {
    const ws = getActiveWorkspace();
    const channel = supabaseClient
      .channel('shopping-list-changes-' + ws)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `workspace_id=eq.${ws}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `workspace_id=eq.${ws}` }, onChange)
      .subscribe();
    return channel;
  },

  async uploadProductImage(productId, file) {
    const ws = await requireWorkspace();
    // שם קובץ ייחודי: workspace/productId-timestamp.ext, כדי למנוע התנגשויות ולאפשר cache-busting
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${ws}/${productId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseClient
      .storage
      .from('product-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseClient
      .storage
      .from('product-images')
      .getPublicUrl(path);

    await this.updateProduct(productId, { image_url: urlData.publicUrl });
    return urlData.publicUrl;
  },

  async deleteProductImage(productId, imageUrl) {
    if (imageUrl) {
      // מחלץ את הנתיב היחסי מתוך ה-URL הציבורי כדי למחוק את הקובץ בפועל מהאחסון
      const marker = '/product-images/';
      const idx = imageUrl.indexOf(marker);
      if (idx !== -1) {
        const path = imageUrl.slice(idx + marker.length);
        await supabaseClient.storage.from('product-images').remove([path]);
      }
    }
    await this.updateProduct(productId, { image_url: null });
  },

  // ===== ניהול משפחות (workspaces) - גלוי רק בלשונית הגדרות, למשפחת אדיר ויקירה =====

  async createWorkspace(id, name, emoji, pin) {
    const { data: existing } = await supabaseClient
      .from('workspaces')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1);
    const nextSort = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { data, error } = await supabaseClient
      .from('workspaces')
      .insert({ id, name, emoji, pin, sort_order: nextSort })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateWorkspacePin(id, newPin) {
    const { error } = await supabaseClient
      .from('workspaces')
      .update({ pin: newPin })
      .eq('id', id);
    if (error) throw error;
  },

  // ===== הגדרות גלובליות (מספרי טלפון לדיווח חוסרי מלאי, לפי משפחה) =====
  // מבנה: { workspaceId: ["972501234567", ...], ... }

  async getMissingItemsPhones() {
    const { data, error } = await supabaseClient
      .from('app_settings')
      .select('value')
      .eq('key', 'missing_items_phones')
      .maybeSingle();
    if (error) throw error;
    return (data && data.value && typeof data.value === 'object' && !Array.isArray(data.value)) ? data.value : {};
  },

  async setMissingItemsPhones(phonesByWorkspace) {
    const { error } = await supabaseClient
      .from('app_settings')
      .upsert({ key: 'missing_items_phones', value: phonesByWorkspace });
    if (error) throw error;
  },

  // מחזיר רק את המספרים של המשפחה הפעילה הנוכחית - לשימוש בעת שליחת התראת חוסרי מלאי
  async getMissingItemsPhonesForActiveWorkspace() {
    const ws = getActiveWorkspace();
    const all = await this.getMissingItemsPhones();
    return all[ws] || [];
  },
};

// ===== Toast helper =====
function showToast(message, duration = 2000) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ===== Sync indicator =====
function setSyncStatus(status) {
  // status: 'synced' | 'syncing' | 'offline'
  document.querySelectorAll('.sync-dot').forEach(dot => {
    dot.classList.remove('offline', 'syncing');
    if (status === 'offline') dot.classList.add('offline');
    if (status === 'syncing') dot.classList.add('syncing');
  });
}

window.addEventListener('online', () => setSyncStatus('synced'));
window.addEventListener('offline', () => setSyncStatus('offline'));
