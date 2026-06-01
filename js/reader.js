/**
 * RREADS — Book reader module
 */

let currentBookDoc = null; // Decrypted book DOM document kept in memory

let currentReaderSettings = {
  fontSize: 18,     // px
  lineHeight: 1.6,
  maxWidth: 720,    // px
  theme: 'default', // 'default', 'dark', 'sepia'
  showIndicators: true
};

/**
 * Downloads and decrypts the full book content, then renders it.
 * @param {string} uuid - The book UUID
 * @param {Uint8Array} keyBytes - The password bytes for XOR decryption
 */
async function loadBook(uuid, keyBytes) {
  window.RReadsUI.showLoading();
  currentBookDoc = null;
  
  const isGuest = window.RReadsApp.isGuest();
  const bookDir = isGuest ? 'preview' : 'enc';
  
  try {
    const res = await fetch(`${bookDir}/${uuid}.enc`);
    if (!res.ok) {
      throw new Error(`No se pudo descargar el libro: ${res.statusText}`);
    }
    
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 11) {
      throw new Error('Archivo de libro dañado o demasiado pequeño.');
    }
    
    // Parse header
    const magicArr = new Uint8Array(buffer, 0, 6);
    const magicStr = new TextDecoder('ascii').decode(magicArr);
    if (magicStr !== 'RREADS') {
      throw new Error('Formato de archivo inválido.');
    }
    
    const version = new Uint8Array(buffer, 6, 1)[0];
    const view = new DataView(buffer, 7, 4);
    const metaLen = view.getUint32(0, false); // big-endian
    
    if (buffer.byteLength < 11 + metaLen) {
      throw new Error('El archivo del libro está corrupto (datos de metadatos truncados).');
    }
    
    // Decrypt metadata (to display title in reader header)
    const metaXor = new Uint8Array(buffer, 11, metaLen);
    const metaBytes = window.RReadsCrypto.xorCrypt(metaXor, keyBytes);
    const metaStr = new TextDecoder().decode(metaBytes);
    const metadata = JSON.parse(metaStr);
    
    // Set title in header
    document.getElementById('reader-title').textContent = metadata.title;
    
    // Decrypt HTML content
    const htmlXor = new Uint8Array(buffer, 11 + metaLen);
    const htmlBytes = window.RReadsCrypto.xorCrypt(htmlXor, keyBytes);
    const htmlStr = new TextDecoder().decode(htmlBytes);
    
    // Strip body tags
    const parsedHtml = parseBodyContent(htmlStr);
    
    // Parse to Document in memory
    const parser = new DOMParser();
    currentBookDoc = parser.parseFromString(`<!DOCTYPE html><html><body>${parsedHtml}</body></html>`, 'text/html');
    
    // Auto-discover levels and populate UI select dropdown
    const levels = window.RReadsLevels.extractReadLevels(currentBookDoc);
    populateLevelsSelect(levels);
    
    // Initial render at Level 0
    const readerContent = document.getElementById('reader-content');
    readerContent.innerHTML = window.RReadsLevels.renderReadLevel(currentBookDoc, 0);
    
    // Apply default/active settings
    applyReaderSettings();
    
    // Show reader section
    window.RReadsUI.navigateToSection('reader-section');
    
  } catch (error) {
    console.error(error);
    alert(`Error al abrir el libro: ${error.message}`);
    window.location.hash = '#catalog';
  } finally {
    window.RReadsUI.hideLoading();
  }
}

/**
 * Extracts content from inside <body> if present, otherwise returns string as-is.
 * @param {string} html 
 * @returns {string}
 */
function parseBodyContent(html) {
  const bodyStartIdx = html.toLowerCase().indexOf('<body');
  if (bodyStartIdx === -1) return html;
  
  const contentStartIdx = html.indexOf('>', bodyStartIdx) + 1;
  const bodyEndIdx = html.toLowerCase().lastIndexOf('</body>');
  
  if (bodyEndIdx === -1) {
    return html.substring(contentStartIdx);
  }
  
  return html.substring(contentStartIdx, bodyEndIdx);
}

/**
 * Populates levels dropdown with detected book levels.
 * @param {Array<number>} levels 
 */
function populateLevelsSelect(levels) {
  const select = document.getElementById('reader-level-select');
  const wrapper = document.getElementById('wrapper-read-level');
  if (!select || !wrapper) return;
  
  select.innerHTML = '';
  
  // Show level dropdown only if there are levels other than 0
  if (levels.length > 1) {
    levels.forEach(lvl => {
      const opt = document.createElement('option');
      opt.value = lvl;
      opt.textContent = lvl === 0 ? 'Libro Completo' : `Nivel ${lvl}`;
      select.appendChild(opt);
    });
    select.value = '0';
    wrapper.classList.remove('hidden');
  } else {
    wrapper.classList.add('hidden');
  }
}

/**
 * Handles rendering the selected level.
 * @param {string|number} level 
 */
function changeReadLevel(level) {
  const readerContent = document.getElementById('reader-content');
  if (!readerContent || !currentBookDoc) return;
  
  window.RReadsUI.showLoading();
  
  // Delay slightly to let the loading spinner render
  setTimeout(() => {
    try {
      const lvl = parseInt(level);
      readerContent.innerHTML = window.RReadsLevels.renderReadLevel(currentBookDoc, lvl);
      applyReaderSettings();
    } catch (e) {
      console.error(e);
      alert('Error al filtrar niveles.');
    } finally {
      window.RReadsUI.hideLoading();
    }
  }, 100);
}

/**
 * Applies the current reader settings to the DOM.
 */
function applyReaderSettings() {
  const content = document.getElementById('reader-content');
  const body = document.getElementById('reader-body');
  if (!content || !body) return;
  
  // 1. Font size
  content.style.fontSize = `${currentReaderSettings.fontSize}px`;
  
  // 2. Line height
  content.style.lineHeight = currentReaderSettings.lineHeight;
  
  // 3. Max width
  content.style.maxWidth = currentReaderSettings.maxWidth === '100%' 
    ? '100%' 
    : `${currentReaderSettings.maxWidth}px`;
    
  // 4. Reader Theme class
  body.className = 'reader-body'; // Reset
  body.classList.add(`theme-${currentReaderSettings.theme}`);
  
  // 5. Indicators class
  if (currentReaderSettings.showIndicators) {
    content.classList.add('show-indicators');
  } else {
    content.classList.remove('show-indicators');
  }
  
  // 6. Update active status on control buttons
  updateControlButtons();
}

/**
 * Synchronizes UI control buttons with settings state.
 */
function updateControlButtons() {
  // Update theme buttons
  const themeBtns = document.querySelectorAll('[data-setting="theme"]');
  themeBtns.forEach(btn => {
    if (btn.getAttribute('data-value') === currentReaderSettings.theme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update width buttons
  const widthBtns = document.querySelectorAll('[data-setting="width"]');
  widthBtns.forEach(btn => {
    const val = btn.getAttribute('data-value');
    const isMatch = val === '100%' 
      ? currentReaderSettings.maxWidth === '100%'
      : parseInt(val) === currentReaderSettings.maxWidth;
      
    if (isMatch) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update indicators button
  const indBtn = document.getElementById('btn-toggle-indicators');
  if (indBtn) {
    if (currentReaderSettings.showIndicators) {
      indBtn.classList.add('active');
      indBtn.textContent = 'Mostrar';
    } else {
      indBtn.classList.remove('active');
      indBtn.textContent = 'Ocultar';
    }
  }
}

/**
 * Changes font size.
 * @param {number} delta - 2 or -2
 */
function changeFontSize(delta) {
  let newSize = currentReaderSettings.fontSize + delta;
  if (newSize < 12) newSize = 12;
  if (newSize > 36) newSize = 36;
  currentReaderSettings.fontSize = newSize;
  applyReaderSettings();
}

/**
 * Changes line height.
 * @param {number} value 
 */
function changeLineHeight(value) {
  currentReaderSettings.lineHeight = value;
  applyReaderSettings();
}

/**
 * Changes reader reading theme.
 * @param {string} themeName 
 */
function changeReaderTheme(themeName) {
  currentReaderSettings.theme = themeName;
  applyReaderSettings();
}

/**
 * Changes reading container maximum width.
 * @param {string|number} width 
 */
function changeReaderWidth(width) {
  currentReaderSettings.maxWidth = width === '100%' ? '100%' : parseInt(width);
  applyReaderSettings();
}

/**
 * Toggles colored read level indicators.
 */
function toggleIndicators() {
  currentReaderSettings.showIndicators = !currentReaderSettings.showIndicators;
  applyReaderSettings();
}

// Bind UI actions in Global scope
window.RReadsReader = {
  loadBook,
  changeFontSize,
  changeLineHeight,
  changeReaderTheme,
  changeReaderWidth,
  changeReadLevel,
  toggleIndicators
};
