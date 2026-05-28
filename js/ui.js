/**
 * RREADS — UI and transitions module
 */

function showLoading() {
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.classList.remove('hidden');
  }
}

function hideLoading() {
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.classList.add('hidden');
  }
}

/**
 * Changes the active stylesheet.
 * @param {string} themeName - 'default', 'dark', or 'sepia'
 */
function setTheme(themeName) {
  const link = document.getElementById('theme-link');
  if (link) {
    link.href = `themes/${themeName}.css`;
  }
}

/**
 * Shows a specific section and hides all others.
 * @param {string} sectionId 
 */
function navigateToSection(sectionId) {
  const sections = ['login-section', 'catalog-section', 'reader-section'];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === sectionId) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });
  
  // Scroll to top of window
  window.scrollTo(0, 0);
}

window.RReadsUI = {
  showLoading,
  hideLoading,
  setTheme,
  navigateToSection
};
