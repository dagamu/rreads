/**
 * RREADS — Read Levels processing module
 */

/**
 * Gets the effective read level of a node by climbing the DOM tree.
 * @param {Node} node 
 * @returns {number}
 */
function getEffectiveLevel(node) {
  if (!node) return 0;
  let current = node;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    if (current.hasAttribute('data-read-level')) {
      return parseInt(current.getAttribute('data-read-level') || 0);
    }
    current = current.parentNode;
  }
  return 0;
}

/**
 * Checks if a tag name is structural and should be preserved as a wrapper.
 * @param {string} tagName 
 * @returns {boolean}
 */
function isStructuralTag(tagName) {
  if (!tagName) return false;
  const tag = tagName.toLowerCase();
  const structuralTags = [
    'section', 'article', 'ul', 'ol', 'li', 'table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th',
    'blockquote', 'details', 'summary', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'
  ];
  return structuralTags.includes(tag);
}

/**
 * Extracts all unique read levels from the document, sorted ascending.
 * Always includes level 0.
 * @param {Document} doc 
 * @returns {Array<number>}
 */
function extractReadLevels(doc) {
  const levelsSet = new Set([0]);
  const elements = doc.querySelectorAll('[data-read-level]');
  elements.forEach(el => {
    const lvl = parseInt(el.getAttribute('data-read-level') || 0);
    if (!isNaN(lvl)) {
      levelsSet.add(lvl);
    }
  });
  return Array.from(levelsSet).sort((a, b) => a - b);
}

/**
 * Recursively filters a DOM node based on the selected read level.
 * @param {Node} node - The source node
 * @param {number} selectedLevel - The selected read level
 * @returns {Node|null} Cloned and filtered node, or null if it should be removed
 */
function filterDOM(node, selectedLevel) {
  // Case 1: Text Node
  if (node.nodeType === Node.TEXT_NODE) {
    // Keep empty whitespace nodes as is to preserve layout
    if (node.textContent.trim() === '') {
      return node.cloneNode(true);
    }
    const effectiveLvl = getEffectiveLevel(node.parentNode);
    return effectiveLvl >= selectedLevel ? node.cloneNode(true) : null;
  }
  
  // Case 2: Element Node
  if (node.nodeType === Node.ELEMENT_NODE) {
    const selfLvl = getEffectiveLevel(node);
    
    // Check if this node has any descendant with explicit level >= selectedLevel
    const descendants = node.querySelectorAll('[data-read-level]');
    let hasValidDescendant = false;
    for (let desc of descendants) {
      const descLvl = parseInt(desc.getAttribute('data-read-level') || 0);
      if (descLvl >= selectedLevel) {
        hasValidDescendant = true;
        break;
      }
    }
    
    const isSelfValid = selfLvl >= selectedLevel;
    
    if (isSelfValid || hasValidDescendant) {
      // Shallow clone (do not copy children automatically)
      const cloned = node.cloneNode(false);
      
      // Filter children recursively
      for (let child of node.childNodes) {
        const filteredChild = filterDOM(child, selectedLevel);
        if (filteredChild) {
          cloned.appendChild(filteredChild);
        }
      }
      
      // Post-filtering validation:
      // If the node itself is not valid (kept only as a wrapper)
      // and it contains no actual visible content (no elements and only whitespace text)
      // then we discard it to prevent empty wrappers.
      const hasContent = Array.from(cloned.childNodes).some(n => {
        if (n.nodeType === Node.ELEMENT_NODE) return true;
        if (n.nodeType === Node.TEXT_NODE) return n.textContent.trim().length > 0;
        return false;
      });
      
      if (!isSelfValid && !hasContent) {
        return null;
      }
      
      return cloned;
    }
  }
  
  // Case 3: Other Node Types (like Comments, CDATA, etc.) - discard
  return null;
}

/**
 * Filters the document contents and returns the HTML string for the given read level.
 * @param {Document} doc - The full parsed document
 * @param {number} level - The selected level
 * @returns {string} The filtered inner HTML of the document body
 */
function renderReadLevel(doc, level) {
  // If level is 0, return the full original body HTML (bypass filtering)
  if (level === 0) {
    return doc.body.innerHTML;
  }
  
  const tempContainer = doc.createElement('div');
  
  // Filter all root child nodes of body
  for (let child of doc.body.childNodes) {
    const filtered = filterDOM(child, level);
    if (filtered) {
      tempContainer.appendChild(filtered);
    }
  }
  
  // If the result is completely empty, we can provide a small helpful feedback message
  if (tempContainer.textContent.trim() === '' && tempContainer.children.length === 0) {
    return `<div style="text-align: center; padding: 40px; color: var(--text-secondary);">
      <h3>Nivel vacío</h3>
      <p style="margin-top: 8px;">No hay contenido marcado para el Nivel ${level} en este libro.</p>
    </div>`;
  }
  
  return tempContainer.innerHTML;
}

// Export to global scope
window.RReadsLevels = {
  extractReadLevels,
  filterDOM,
  renderReadLevel
};
