/**
 * RREADS — Catalog and search module
 */

let allBooks = []; // In-memory cache of decrypted book metadata

/**
 * Loads the book index and range-fetches metadata headers.
 * @param {Uint8Array} keyBytes - The password bytes for XOR decryption
 */
async function loadCatalog(keyBytes) {
  window.RReadsUI.showLoading();
  allBooks = [];
  
  const isGuest = window.RReadsApp.isGuest();
  const indexUrl = isGuest ? 'preview/index.enc' : 'index.enc';
  const bookDir = isGuest ? 'preview' : 'enc';
  
  try {
    // 1. Fetch index.enc
    const indexRes = await fetch(indexUrl);
    if (!indexRes.ok) {
      throw new Error('No se pudo descargar index.enc. Asegúrate de que el catálogo ha sido generado.');
    }
    
    const indexEncBuffer = await indexRes.arrayBuffer();
    const indexEncBytes = new Uint8Array(indexEncBuffer);
    const indexDecBytes = window.RReadsCrypto.xorCrypt(indexEncBytes, keyBytes);
    const indexStr = new TextDecoder().decode(indexDecBytes);
    
    let uuids = [];
    try {
      uuids = JSON.parse(indexStr);
    } catch (e) {
      throw new Error('Contraseña incorrecta o índice corrupto.');
    }
    
    if (!Array.isArray(uuids)) {
      throw new Error('Formato de índice inválido.');
    }
    
    // 2. Fetch metadata of each book using range requests
    const metadataPromises = uuids.map(async (uuid, idx) => {
      try {
        // Fetch first 2048 bytes
        const res = await fetch(`${bookDir}/${uuid}.enc`, {
          headers: {
            'Range': 'bytes=0-2047'
          }
        });
        
        if (!res.ok && res.status !== 206) {
          console.error(`Error al cargar el libro ${uuid}: ${res.statusText}`);
          return null;
        }
        
        const buffer = await res.arrayBuffer();
        if (buffer.byteLength < 11) {
          console.error(`El archivo del libro ${uuid} es demasiado pequeño.`);
          return null;
        }
        
        // Parse header
        const magicArr = new Uint8Array(buffer, 0, 6);
        const magicStr = new TextDecoder('ascii').decode(magicArr);
        if (magicStr !== 'RREADS') {
          console.error(`Cabecera mágica inválida para ${uuid}`);
          return null;
        }
        
        const version = new Uint8Array(buffer, 6, 1)[0];
        const view = new DataView(buffer, 7, 4);
        const metaLen = view.getUint32(0, false); // big-endian
        
        if (buffer.byteLength < 11 + metaLen) {
          console.error(`Petición de rango insuficiente para metadatos de ${uuid}. Longitud: ${metaLen}`);
          // If the range fetch was too small, let's fallback to fetching the whole file
          const fullRes = await fetch(`${bookDir}/${uuid}.enc`);
          const fullBuffer = await fullRes.arrayBuffer();
          const fullMetaXor = new Uint8Array(fullBuffer, 11, metaLen);
          const fullMetaBytes = window.RReadsCrypto.xorCrypt(fullMetaXor, keyBytes);
          const fullMetaStr = new TextDecoder().decode(fullMetaBytes);
          const meta = JSON.parse(fullMetaStr);
          meta.addedOrder = idx; // Preserve order
          return meta;
        }
        
        const metaXor = new Uint8Array(buffer, 11, metaLen);
        const metaBytes = window.RReadsCrypto.xorCrypt(metaXor, keyBytes);
        const metaStr = new TextDecoder().decode(metaBytes);
        const meta = JSON.parse(metaStr);
        meta.addedOrder = idx; // Preserve order
        return meta;
      } catch (e) {
        console.error(`Fallo al cargar metadatos de ${uuid}:`, e);
        return null;
      }
    });
    
    const results = await Promise.all(metadataPromises);
    allBooks = results.filter(book => book !== null);
    
    // 3. Render catalog
    filterAndSortCatalog();
    
  } catch (error) {
    console.error(error);
    alert(`Error de Carga: ${error.message}`);
    // Go back to login
    window.location.hash = '#login';
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
      return a.addedOrder - b.addedOrder; // Original compilation order
    }
    return 0;
  });
  
  // 3. Render
  renderGrid(filtered);
}

/**
 * Renders the filtered books to the DOM.
 * @param {Array} books 
 */
function renderGrid(books) {
  const grid = document.getElementById('catalog-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  if (books.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
      <h3>No se encontraron libros</h3>
      <p style="margin-top: 8px;">Intenta cambiar el término de búsqueda.</p>
    </div>`;
    return;
  }
  
  books.forEach(book => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.onclick = () => {
      window.location.hash = `#reader/${book.uuid}`;
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
 * Escapes characters for HTML output.
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
  // Simple hash to derive a stable hue
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  
  // Wrap title text into lines
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
  
  // Centering Y axis
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

// Export functions to global scope
window.RReadsCatalog = {
  loadCatalog,
  filterAndSortCatalog
};
