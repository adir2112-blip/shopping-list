// ============================================
// ניהול המשפחות (workspaces) - נטען מ-Supabase
// ============================================
// המשפחות מנוהלות עכשיו דרך לשונית "הגדרות" (גלוי רק למשפחת אדיר ויקירה),
// לא דרך עריכת קוד. הקובץ הזה טוען את הרשימה מה-DB ומחזיק אותה בזיכרון.

const WORKSPACE_STORAGE_KEY = 'activeWorkspace';

let WORKSPACES = [];
let workspacesLoadPromise = null;

// טוען את רשימת המשפחות מ-Supabase (פעם אחת, עם cache בזיכרון לכל שאר הקריאות באותו טעינת עמוד)
function loadWorkspaces() {
  if (workspacesLoadPromise) return workspacesLoadPromise;
  workspacesLoadPromise = (async () => {
    const { data, error } = await supabaseClient
      .from('workspaces')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('שגיאה בטעינת משפחות:', error);
      WORKSPACES = [];
      return WORKSPACES;
    }
    WORKSPACES = data;
    return WORKSPACES;
  })();
  return workspacesLoadPromise;
}

function getActiveWorkspace() {
  return localStorage.getItem(WORKSPACE_STORAGE_KEY);
}

function setActiveWorkspace(id) {
  localStorage.setItem(WORKSPACE_STORAGE_KEY, id);
}

function clearActiveWorkspace() {
  localStorage.removeItem(WORKSPACE_STORAGE_KEY);
}

function getWorkspaceById(id) {
  return WORKSPACES.find(w => w.id === id);
}

function isAdirWorkspace() {
  return getActiveWorkspace() === 'adir';
}

// מגן בסיסי על דפי האפליקציה (לא login.html) - טוען את רשימת המשפחות,
// ואם אין workspace פעיל ותקין, מחזיר לדף הכניסה
async function requireWorkspace() {
  await loadWorkspaces();
  const id = getActiveWorkspace();
  if (!id || !getWorkspaceById(id)) {
    window.location.href = 'login.html';
    return null;
  }
  return id;
}

// מציג את תג המשפחה הפעילה בראש הדף, עם אפשרות יציאה
function renderWorkspaceBadge() {
  const badge = document.getElementById('workspaceBadge');
  if (!badge) return;
  const id = getActiveWorkspace();
  const ws = getWorkspaceById(id);
  if (!ws) return;
  badge.textContent = `${ws.emoji} ${ws.name}`;
  badge.title = 'לחיצה למעבר משפחה';
  badge.style.cursor = 'pointer';
  badge.addEventListener('click', () => {
    clearActiveWorkspace();
    window.location.href = 'login.html';
  });
}

// מציג/מסתיר את לשונית "הגדרות" בתפריט הניווט - גלויה רק למשפחת אדיר ויקירה
function renderSettingsNavLink() {
  const link = document.getElementById('settingsNavLink');
  if (!link) return;
  link.style.display = isAdirWorkspace() ? '' : 'none';
}
