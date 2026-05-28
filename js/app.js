/**
 * RREADS — SPA Router and Application Orchestrator
 */

let sessionKeyBytes = null; // In-memory session key bytes
let isGuestSession = false; // Is guest login session active

window.RReadsApp = {
  isGuest: () => isGuestSession
};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Router
  window.addEventListener('hashchange', router);
  
  // Set up event listeners
  setupEventListeners();
  
  // Run router for initial page load
  router();
});

/**
 * SPA Router
 */
async function router() {
  const hash = window.location.hash || '#login';
  
  // Case 1: Login Route
  if (hash === '#login') {
    if (sessionKeyBytes) {
      window.location.hash = '#catalog';
      return;
    }
    window.RReadsUI.navigateToSection('login-section');
    return;
  }
  
  // For all other routes, require authentication
  if (!sessionKeyBytes) {
    window.location.hash = '#login';
    return;
  }
  
  // Case 2: Catalog Route
  if (hash === '#catalog') {
    window.RReadsUI.navigateToSection('catalog-section');
    // If allBooks is empty (e.g. freshly logged in), load it
    const catalogGrid = document.getElementById('catalog-grid');
    if (catalogGrid && catalogGrid.children.length === 0) {
      await window.RReadsCatalog.loadCatalog(sessionKeyBytes);
    }
    return;
  }
  
  // Case 3: Reader Route (Format: #reader/uuid)
  if (hash.startsWith('#reader/')) {
    const uuid = hash.replace('#reader/', '');
    if (uuid) {
      await window.RReadsReader.loadBook(uuid, sessionKeyBytes);
    } else {
      window.location.hash = '#catalog';
    }
    return;
  }
  
  // Default fallback
  window.location.hash = '#catalog';
}

/**
 * Configure DOM event bindings
 */
function setupEventListeners() {
  // Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Guest Login Button
  const guestLoginBtn = document.getElementById('btn-guest-login');
  if (guestLoginBtn) {
    guestLoginBtn.addEventListener('click', handleGuestLogin);
  }
  
  // Search Input (Instant Search)
  const searchBar = document.getElementById('search-bar');
  if (searchBar) {
    searchBar.addEventListener('input', () => {
      window.RReadsCatalog.filterAndSortCatalog();
    });
  }
  
  // Sort Selection
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      window.RReadsCatalog.filterAndSortCatalog();
    });
  }
  
  // Global Theme Selector (UI)
  const globalThemeSelect = document.getElementById('global-theme-select');
  if (globalThemeSelect) {
    globalThemeSelect.addEventListener('change', (e) => {
      window.RReadsUI.setTheme(e.target.value);
    });
  }
  
  // Logo Clicks (Go to Catalog)
  const logoSection = document.getElementById('logo-section');
  if (logoSection) {
    logoSection.addEventListener('click', () => {
      if (sessionKeyBytes) {
        window.location.hash = '#catalog';
      }
    });
  }
  
  // Logout Buttons
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // Reader Control: Back to Catalog
  const readerBack = document.getElementById('btn-reader-back');
  if (readerBack) {
    readerBack.addEventListener('click', () => {
      window.location.hash = '#catalog';
    });
  }
  
  // Reader Control: Toggle Settings Panel
  const toggleSettings = document.getElementById('btn-reader-settings');
  const settingsPanel = document.getElementById('reader-settings-panel');
  if (toggleSettings && settingsPanel) {
    toggleSettings.addEventListener('click', () => {
      settingsPanel.classList.toggle('hidden');
    });
  }
  
  // Reader Configuration Panel Event Delegation
  const settingsPanelEl = document.getElementById('reader-settings-panel');
  if (settingsPanelEl) {
    settingsPanelEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      
      const setting = btn.getAttribute('data-setting');
      const val = btn.getAttribute('data-value');
      
      if (setting === 'font-size') {
        window.RReadsReader.changeFontSize(parseInt(val));
      } else if (setting === 'line-height') {
        window.RReadsReader.changeLineHeight(parseFloat(val));
        // Toggle active class on line-height buttons
        document.querySelectorAll('[data-setting="line-height"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      } else if (setting === 'theme') {
        window.RReadsReader.changeReaderTheme(val);
      } else if (setting === 'width') {
        window.RReadsReader.changeReaderWidth(val);
      }
    });
  }
  
  // Reader Control: Level Select
  const levelSelect = document.getElementById('reader-level-select');
  if (levelSelect) {
    levelSelect.addEventListener('change', (e) => {
      window.RReadsReader.changeReadLevel(e.target.value);
    });
  }
  
  // Reader Control: Toggle Level Indicators
  const toggleIndicators = document.getElementById('btn-toggle-indicators');
  if (toggleIndicators) {
    toggleIndicators.addEventListener('click', () => {
      window.RReadsReader.toggleIndicators();
    });
  }
}

/**
 * Handle Login Form Submission
 */
async function handleLogin(e) {
  e.preventDefault();
  
  const passwordInput = document.getElementById('password-input');
  const errorEl = document.getElementById('login-error');
  if (!passwordInput || !errorEl) return;
  
  errorEl.textContent = '';
  window.RReadsUI.showLoading();
  
  const password = passwordInput.value;
  if (!password) {
    errorEl.textContent = 'Introduce una contraseña.';
    window.RReadsUI.hideLoading();
    return;
  }
  
  try {
    // 1. Fetch hash.txt
    const hashRes = await fetch('hash.txt');
    if (!hashRes.ok) {
      throw new Error('El sistema no está inicializado. Genera hash.txt usando los scripts de Python.');
    }
    const storedHash = (await hashRes.text()).trim();
    
    // 2. Hash user input
    const inputHash = await window.RReadsCrypto.sha256(password);
    
    // 3. Verify
    if (inputHash === storedHash) {
      // Create session key bytes
      sessionKeyBytes = new TextEncoder().encode(password);
      isGuestSession = false;
      
      // Hide guest badge
      const badge = document.getElementById('guest-badge');
      if (badge) badge.classList.add('hidden');
      
      // Clear password field
      passwordInput.value = '';
      
      // Navigate to catalog
      window.location.hash = '#catalog';
    } else {
      errorEl.textContent = 'Contraseña incorrecta.';
    }
  } catch (err) {
    console.error(err);
    errorEl.textContent = `Error: ${err.message}`;
  } finally {
    window.RReadsUI.hideLoading();
  }
}

/**
 * Handle Guest Login
 */
function handleGuestLogin() {
  sessionKeyBytes = new TextEncoder().encode('invitado');
  isGuestSession = true;
  
  // Show guest badge
  const badge = document.getElementById('guest-badge');
  if (badge) badge.classList.remove('hidden');
  
  // Clear login errors and input
  const errorEl = document.getElementById('login-error');
  if (errorEl) errorEl.textContent = '';
  const passwordInput = document.getElementById('password-input');
  if (passwordInput) passwordInput.value = '';
  
  // Navigate to catalog
  window.location.hash = '#catalog';
}

/**
 * Clear memory session and log out
 */
function handleLogout() {
  sessionKeyBytes = null;
  isGuestSession = false;
  
  // Hide guest badge
  const badge = document.getElementById('guest-badge');
  if (badge) badge.classList.add('hidden');
  
  // Clear search bar on logout
  const searchBar = document.getElementById('search-bar');
  if (searchBar) searchBar.value = '';
  // Clear catalog UI
  const grid = document.getElementById('catalog-grid');
  if (grid) grid.innerHTML = '';
  
  window.location.hash = '#login';
}
