// ============================================
// באנר התקנה כאפליקציה (PWA)
// ============================================
// התנהגות: אם המשתמש מאשר התקנה - ההודעה נעלמת לתמיד.
// אם המשתמש סוגר/מתעלם - ההודעה תופיע שוב בפעם הבאה שהוא נכנס לאתר.

const INSTALL_DISMISSED_KEY = 'pwaInstallAccepted';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true; // iOS Safari legacy flag
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function wasInstallAccepted() {
  return localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true';
}

function markInstallAccepted() {
  localStorage.setItem(INSTALL_DISMISSED_KEY, 'true');
}

let deferredInstallEvent = null;

function buildInstallBanner() {
  if (document.getElementById('installBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'installBanner';
  banner.className = 'install-banner';
  banner.innerHTML = `
    <span class="install-banner-icon">📲</span>
    <div class="install-banner-text">
      <div class="install-banner-title">התקינו את האפליקציה</div>
      <div class="install-banner-sub" id="installBannerSub">גישה מהירה ישירות ממסך הבית</div>
    </div>
    <button class="install-banner-btn" id="installBannerBtn">התקנה</button>
    <button class="install-banner-close" id="installBannerClose" aria-label="סגירה">✕</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('installBannerClose').addEventListener('click', () => {
    banner.remove();
    // לא שומרים דבר - ההודעה תופיע שוב בכניסה הבאה, כפי שהתבקש
  });

  const installBtn = document.getElementById('installBannerBtn');
  const sub = document.getElementById('installBannerSub');

  if (isIOS()) {
    // ב-iOS Safari אין API להתקנה תכנותית - מציגים הוראות
    sub.textContent = 'הקש על שיתוף ⬆️ ואז "הוסף למסך הבית"';
    installBtn.textContent = 'הבנתי';
    installBtn.addEventListener('click', () => {
      // ב-iOS לא יודעים אם התקינו בפועל, אז לא שומרים "הותקן"
      // הבאנר יחזור בכניסה הבאה עד שהאפליקציה תרוץ כ-standalone
      banner.remove();
    });
  } else {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallEvent) return;
      deferredInstallEvent.prompt();
      const choice = await deferredInstallEvent.userChoice;
      if (choice.outcome === 'accepted') {
        markInstallAccepted();
      }
      banner.remove();
      deferredInstallEvent = null;
    });
  }

  requestAnimationFrame(() => banner.classList.add('show'));
}

function initInstallPrompt() {
  if (isStandalone()) return; // כבר מותקן ורץ כ-standalone - לא צריך באנר

  if (isIOS()) {
    // ב-iOS מנקים ערך ישן של "הבנתי" שנשמר בעבר בטעות (כי עכשיו רק standalone עוצר את הבאנר)
    if (localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true') {
      localStorage.removeItem(INSTALL_DISMISSED_KEY);
    }
    setTimeout(buildInstallBanner, 1200);
    return;
  }

  if (wasInstallAccepted()) return; // Android: המשתמש כבר אישר/דחה

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallEvent = e;
    buildInstallBanner();
  });
}

initInstallPrompt();
