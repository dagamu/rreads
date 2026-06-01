/**
 * RREADS — Development Preview Orchestrator
 * This file handles loading raw HTML files directly from src/ (without decryption)
 * while maintaining the exact same layout and structure as the production catalog/reader.
 */

let allBooks = []; // In-memory cache of book metadata parsed from src/
let currentBookDoc = null; // Parsed DOM document of currently active book in reader
// No login required for dev environment

let currentReaderSettings = {
  fontSize: 18,     // px
  lineHeight: 1.6,
  maxWidth: 720,    // px
  theme: 'default', // 'default', 'dark', 'sepia'
  showIndicators: true
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
 * SPA Router for Development Preview
 */
async function router() {
  const hash = window.location.hash || '#catalog';
  
  // Case 1: Catalog Route
  if (hash === '#catalog') {
    window.RReadsUI.navigateToSection('catalog-section');
    const catalogGrid = document.getElementById('catalog-grid');
    if (catalogGrid && catalogGrid.children.length === 0) {
      await loadCatalog();
    }
    return;
  }
  
  // Case 2: Reader Route (Format: #reader/filename.html)
  if (hash.startsWith('#reader/')) {
    const filename = hash.replace('#reader/', '');
    if (filename) {
      await loadBook(filename);
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
  // Search Input (Instant Search)
  const searchBar = document.getElementById('search-bar');
  if (searchBar) {
    searchBar.addEventListener('input', () => {
      filterAndSortCatalog();
    });
  }
  
  // Sort Selection
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      filterAndSortCatalog();
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
      window.location.hash = '#catalog';
    });
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
        changeFontSize(parseInt(val));
      } else if (setting === 'line-height') {
        changeLineHeight(parseFloat(val));
        document.querySelectorAll('[data-setting="line-height"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      } else if (setting === 'theme') {
        changeReaderTheme(val);
      } else if (setting === 'width') {
        changeReaderWidth(val);
      }
    });
  }
  
  // Reader Control: Level Select
  const levelSelect = document.getElementById('reader-level-select');
  if (levelSelect) {
    levelSelect.addEventListener('change', (e) => {
      changeReadLevel(e.target.value);
    });
  }
  
  // Reader Control: Toggle Level Indicators
  const toggleIndicatorsBtn = document.getElementById('btn-toggle-indicators');
  if (toggleIndicatorsBtn) {
    toggleIndicatorsBtn.addEventListener('click', () => {
      toggleIndicators();
    });
  }
}

/**
 * Loads the raw books directory from src/ by looking at build metadata mapping
 */
async function loadCatalog() {
  window.RReadsUI.showLoading();
  allBooks = [];
  
  try {
    const res = await fetch('src/.build_metadata.json');
    if (!res.ok) {
      throw new Error('No se pudo encontrar "src/.build_metadata.json". Por favor, ejecuta "python scripts/main.py" primero para generar este archivo.');
    }
    
    const mapping = await res.json();
    const filenames = Object.keys(mapping);
    
    if (filenames.length === 0) {
      throw new Error('La carpeta "src/" está vacía o no tiene archivos registrados.');
    }
    
    const metadataPromises = filenames.map(async (filename, idx) => {
      try {
        const fileRes = await fetch(`src/${filename}`);
        if (!fileRes.ok) {
          console.error(`Error al cargar el archivo: src/${filename}`);
          return null;
        }
        
        const htmlStr = await fileRes.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlStr, 'text/html');
        
        // Extract metadata from meta tags
        const meta = {};
        const metaTags = doc.querySelectorAll('meta');
        metaTags.forEach(tag => {
          const name = tag.getAttribute('name');
          const content = tag.getAttribute('content');
          if (name && content) {
            meta[name.toLowerCase()] = content;
          }
        });
        
        const title = meta.title || doc.title || filename;
        const author = meta.author || 'Autor Desconocido';
        const tags = meta.tags ? meta.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
        const pages = parseInt(meta.pages) || null;
        const year = parseInt(meta.year) || null;
        const genre = meta.genre || null;
        const description = meta.description || null;
        const cover = meta.cover || null;
        
        return {
          filename,
          uuid: filename, // use filename as router lookup identifier
          title,
          author,
          year,
          genre,
          tags,
          pages,
          description,
          cover,
          addedOrder: idx
        };
      } catch (e) {
        console.error(`Fallo al extraer metadatos de src/${filename}:`, e);
        return null;
      }
    });
    
    const results = await Promise.all(metadataPromises);
    allBooks = results.filter(book => book !== null);
    filterAndSortCatalog();
    
  } catch (error) {
    console.error(error);
    const grid = document.getElementById('catalog-grid');
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary); max-width: 600px; margin: 0 auto;">
          <h3 style="color: var(--accent-color); margin-bottom: 12px;">Error al cargar el catálogo de desarrollo</h3>
          <p style="margin-bottom: 16px;">${error.message}</p>
          <div style="text-align: left; background: var(--glass-bg); border: 1px solid var(--glass-border); padding: 16px; border-radius: 12px; font-size: 13px; line-height: 1.5;">
            <p><strong>Causas comunes:</strong></p>
            <ul style="margin-left: 20px; margin-top: 8px;">
              <li>No estás utilizando un servidor local (por ejemplo, con <code>Live Server</code> o <code>python -m http.server</code>). Abrir el archivo <code>file:///</code> directamente causa restricciones CORS.</li>
              <li>Aún no has generado la base de datos de metadatos ejecutando <code>python scripts/main.py</code>.</li>
            </ul>
          </div>
        </div>
      `;
    }
  } finally {
    window.RReadsUI.hideLoading();
  }
}

/**
 * Filter books by search query and sort by selected criteria, then render.
 */
function filterAndSortCatalog() {
  const searchQuery = document.getElementById('search-bar').value.toLowerCase().trim();
  const sortBy = document.getElementById('sort-select').value;
  
  // 1. Filter
  let filtered = allBooks;
  if (searchQuery) {
    filtered = allBooks.filter(book => {
      const titleMatch = book.title && book.title.toLowerCase().includes(searchQuery);
      const authorMatch = book.author && book.author.toLowerCase().includes(searchQuery);
      const genreMatch = book.genre && book.genre.toLowerCase().includes(searchQuery);
      const tagMatch = book.tags && book.tags.some(tag => tag.toLowerCase().includes(searchQuery));
      return titleMatch || authorMatch || genreMatch || tagMatch;
    });
  }
  
  // 2. Sort
  filtered.sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    } else if (sortBy === 'author') {
      return a.author.localeCompare(b.author);
    } else if (sortBy === 'year') {
      const yearA = a.year || 0;
      const yearB = b.year || 0;
      return yearB - yearA; // Newest first
    } else if (sortBy === 'added') {
      return a.addedOrder - b.addedOrder; // Original order
    }
    return 0;
  });
  
  // 3. Render
  renderGrid(filtered);
}

/**
 * Renders the filtered books to the catalog grid
 */
function renderGrid(books) {
  const grid = document.getElementById('catalog-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  if (books.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
        <h3>No se encontraron archivos HTML</h3>
        <p style="margin-top: 8px;">Intenta cambiar el término de búsqueda o añade archivos a la carpeta <code>src/</code>.</p>
      </div>
    `;
    return;
  }
  
  books.forEach(book => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.onclick = () => {
      window.location.hash = `#reader/${book.filename}`;
    };
    
    const yearDisplay = book.year ? `<span class="book-year">${book.year}</span>` : '';
    const genreTag = book.genre ? `<span class="book-tag">${book.genre}</span>` : (book.tags && book.tags[0] ? `<span class="book-tag">${book.tags[0]}</span>` : '');
    
    // Generate dynamic cover if no custom cover is set
    const coverSrc = book.cover ? book.cover : generateCoverSVG(book.title, book.author);
    
    card.innerHTML = `
      <div class="book-cover-wrapper">
        <img class="book-cover" src="${coverSrc}" alt="Portada de ${book.title}" loading="lazy">
      </div>
      <div class="book-info">
        <h3 class="book-title" title="${book.title}">${book.title}</h3>
        <p class="book-author">${book.author}</p>
        <div class="book-meta-footer">
          ${genreTag}
          ${yearDisplay}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

/**
 * Fetches the raw HTML file and displays it in the reader view
 */
async function loadBook(filename) {
  window.RReadsUI.showLoading();
  currentBookDoc = null;
  
  try {
    const res = await fetch(`src/${filename}`);
    if (!res.ok) {
      throw new Error(`No se pudo descargar el archivo: src/${filename}`);
    }
    const htmlStr = await res.text();
    
    // Parse raw HTML to a DOM document
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlStr, 'text/html');
    
    // Extract metadata for the reader header title
    const titleMeta = doc.querySelector('meta[name="title"]');
    const title = titleMeta ? titleMeta.getAttribute('content') : (doc.title || filename);
    document.getElementById('reader-title').textContent = title;
    
    currentBookDoc = doc;
    
    // Auto-discover levels and populate selector
    const levels = window.RReadsLevels.extractReadLevels(currentBookDoc);
    populateLevelsSelect(levels);
    
    // Initial render at Level 0 (Full Book)
    const readerContent = document.getElementById('reader-content');
    readerContent.innerHTML = window.RReadsLevels.renderReadLevel(currentBookDoc, 0);
    
    // Apply default/active settings
    applyReaderSettings();
    
    // Switch view
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
 * Populates levels dropdown with detected book levels
 */
function populateLevelsSelect(levels) {
  const select = document.getElementById('reader-level-select');
  const wrapper = document.getElementById('wrapper-read-level');
  if (!select || !wrapper) return;
  
  select.innerHTML = '';
  
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
 */
function changeReadLevel(level) {
  const readerContent = document.getElementById('reader-content');
  if (!readerContent || !currentBookDoc) return;
  
  window.RReadsUI.showLoading();
  
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
  body.className = 'reader-body'; 
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
 * Control functions
 */
function changeFontSize(delta) {
  let newSize = currentReaderSettings.fontSize + delta;
  if (newSize < 12) newSize = 12;
  if (newSize > 36) newSize = 36;
  currentReaderSettings.fontSize = newSize;
  applyReaderSettings();
}

function changeLineHeight(value) {
  currentReaderSettings.lineHeight = value;
  applyReaderSettings();
}

function changeReaderTheme(themeName) {
  currentReaderSettings.theme = themeName;
  applyReaderSettings();
}

function changeReaderWidth(width) {
  currentReaderSettings.maxWidth = width === '100%' ? '100%' : parseInt(width);
  applyReaderSettings();
}

function toggleIndicators() {
  currentReaderSettings.showIndicators = !currentReaderSettings.showIndicators;
  applyReaderSettings();
}

/**
 * String HTML escape helper
 */
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates an SVG book cover dynamic Data URL locally.
 */
function generateCoverSVG(title, author) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  
  const words = title.split(' ');
  const lines = [];
  let currentLine = '';
  words.forEach(word => {
    if ((currentLine + ' ' + word).trim().length > 14) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += ' ' + word;
    }
  });
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }
  
  const lineSpacing = 36;
  const totalTextHeight = lines.length * lineSpacing;
  const startY = 260 - (totalTextHeight / 2);
  
  const spans = lines.map((line, idx) => {
    const yPos = startY + (idx * lineSpacing);
    return `<text x="200" y="${yPos}" font-family="'Inter', 'Outfit', serif" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeHTML(line)}</text>`;
  }).join('\n  ');
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">
  <defs>
    <linearGradient id="grad-${hue}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl(${hue}, 55%, 35%)" />
      <stop offset="100%" stop-color="hsl(${(hue + 40) % 360}, 65%, 18%)" />
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#grad-${hue})" rx="16"/>
  <rect x="20" y="20" width="360" height="560" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" rx="10"/>
  
  <g transform="translate(180, 70)">
    <circle cx="20" cy="20" r="22" fill="rgba(255,255,255,0.08)" />
    <path d="M12 14h16v12H12z" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linejoin="round"/>
    <path d="M12 18h16M12 22h16" stroke="rgba(255,255,255,0.85)" stroke-width="2"/>
  </g>

  ${spans}
  
  <line x1="120" y1="430" x2="280" y2="430" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" />
  <text x="200" y="470" font-family="'Inter', 'Outfit', serif" font-size="18" font-weight="500" fill="rgba(255,255,255,0.85)" text-anchor="middle" dominant-baseline="middle">${escapeHTML(author)}</text>
</svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
