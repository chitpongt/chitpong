// ── State ──────────────────────────────────────────────────────────────────
let board = null;
let draggedCard = null;
let dragSourceColumnId = null;
let placeholder = null;

// ── API helpers ─────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  board.columns.forEach((col) => {
    boardEl.appendChild(createColumnEl(col));
  });
}

function createColumnEl(col) {
  const colEl = document.createElement('div');
  colEl.className = 'column';
  colEl.dataset.columnId = col.id;

  // Header
  const header = document.createElement('div');
  header.className = 'column-header';
  const titleEl = document.createElement('span');
  titleEl.className = 'column-title';
  titleEl.textContent = col.title;
  const countEl = document.createElement('span');
  countEl.className = 'column-count';
  countEl.textContent = col.cards.length;
  header.appendChild(titleEl);
  header.appendChild(countEl);
  colEl.appendChild(header);

  // Cards container
  const container = document.createElement('div');
  container.className = 'cards-container';
  container.dataset.columnId = col.id;
  col.cards.forEach((card) => container.appendChild(createCardEl(card, col.id)));
  setupDropZone(container, col.id);
  colEl.appendChild(container);

  // Add-card area
  colEl.appendChild(createAddCardArea(col.id));

  return colEl;
}

function createCardEl(card, columnId) {
  const cardEl = document.createElement('div');
  cardEl.className = 'card';
  cardEl.draggable = true;
  cardEl.dataset.cardId = card.id;
  cardEl.dataset.columnId = columnId;

  const titleEl = document.createElement('span');
  titleEl.className = 'card-title';
  titleEl.textContent = card.title;

  const delBtn = document.createElement('button');
  delBtn.className = 'card-delete';
  delBtn.title = 'Delete card';
  delBtn.textContent = '✕';
  delBtn.addEventListener('click', () => deleteCard(card.id));

  cardEl.appendChild(titleEl);
  cardEl.appendChild(delBtn);

  cardEl.addEventListener('dragstart', (e) => {
    draggedCard = card.id;
    dragSourceColumnId = columnId;
    cardEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    placeholder = document.createElement('div');
    placeholder.className = 'card-placeholder';
  });

  cardEl.addEventListener('dragend', () => {
    cardEl.classList.remove('dragging');
    placeholder && placeholder.remove();
    placeholder = null;
    draggedCard = null;
    dragSourceColumnId = null;
    document.querySelectorAll('.cards-container').forEach((c) =>
      c.classList.remove('drag-over')
    );
  });

  return cardEl;
}

function createAddCardArea(columnId) {
  const area = document.createElement('div');
  area.className = 'add-card-area';

  const form = document.createElement('div');
  form.className = 'add-card-form';

  const textarea = document.createElement('textarea');
  textarea.className = 'add-card-input';
  textarea.placeholder = 'Enter card title…';
  textarea.rows = 2;

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-card';
  addBtn.textContent = 'Add card';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-cancel';
  cancelBtn.title = 'Cancel';
  cancelBtn.textContent = '✕';

  actions.appendChild(addBtn);
  actions.appendChild(cancelBtn);
  form.appendChild(textarea);
  form.appendChild(actions);

  const openBtn = document.createElement('button');
  openBtn.className = 'btn-open-form';
  openBtn.textContent = '+ Add a card';

  area.appendChild(form);
  area.appendChild(openBtn);

  // Events
  openBtn.addEventListener('click', () => {
    form.classList.add('visible');
    openBtn.style.display = 'none';
    textarea.focus();
  });

  cancelBtn.addEventListener('click', () => {
    form.classList.remove('visible');
    openBtn.style.display = '';
    textarea.value = '';
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBtn.click();
    }
    if (e.key === 'Escape') cancelBtn.click();
  });

  addBtn.addEventListener('click', async () => {
    const title = textarea.value.trim();
    if (!title) return;
    try {
      const card = await api('POST', '/api/cards', { columnId, title });
      const col = board.columns.find((c) => c.id === columnId);
      col.cards.push(card);
      const container = document.querySelector(
        `.cards-container[data-column-id="${columnId}"]`
      );
      container.appendChild(createCardEl(card, columnId));
      updateCount(columnId);
      textarea.value = '';
      textarea.focus();
    } catch (err) {
      alert('Failed to add card: ' + err.message);
    }
  });

  return area;
}

// ── Drag-and-drop ─────────────────────────────────────────────────────────────
function setupDropZone(container, columnId) {
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    container.classList.add('drag-over');
    if (placeholder) {
      const afterEl = getDragAfterElement(container, e.clientY);
      if (afterEl) {
        container.insertBefore(placeholder, afterEl);
      } else {
        container.appendChild(placeholder);
      }
    }
  });

  container.addEventListener('dragleave', (e) => {
    if (!container.contains(e.relatedTarget)) {
      container.classList.remove('drag-over');
    }
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    container.classList.remove('drag-over');
    if (!draggedCard) return;

    const cardEl = document.querySelector(`.card[data-card-id="${draggedCard}"]`);

    if (columnId === dragSourceColumnId) {
      // Reorder within the same column (client-side only)
      if (placeholder && placeholder.parentNode === container) {
        container.insertBefore(cardEl, placeholder);
        placeholder.remove();
        placeholder = null;
      }
      return;
    }

    try {
      await api('PUT', `/api/cards/${draggedCard}/move`, {
        targetColumnId: columnId,
      });
      // Update local state
      let card = null;
      for (const col of board.columns) {
        const idx = col.cards.findIndex((c) => c.id === draggedCard);
        if (idx !== -1) {
          [card] = col.cards.splice(idx, 1);
          updateCount(col.id);
          break;
        }
      }
      const targetCol = board.columns.find((c) => c.id === columnId);
      targetCol.cards.push(card);
      updateCount(columnId);

      // Move card DOM element
      cardEl.dataset.columnId = columnId;
      if (placeholder && placeholder.parentNode === container) {
        container.insertBefore(cardEl, placeholder);
        placeholder.remove();
        placeholder = null;
      } else {
        container.appendChild(cardEl);
      }
    } catch (err) {
      alert('Failed to move card: ' + err.message);
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableEls = [
    ...container.querySelectorAll('.card:not(.dragging)'),
  ];
  return draggableEls.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

// ── Delete card ───────────────────────────────────────────────────────────────
async function deleteCard(cardId) {
  if (!confirm('Delete this card?')) return;
  try {
    await api('DELETE', `/api/cards/${cardId}`);
    for (const col of board.columns) {
      const idx = col.cards.findIndex((c) => c.id === cardId);
      if (idx !== -1) {
        col.cards.splice(idx, 1);
        updateCount(col.id);
        break;
      }
    }
    document.querySelector(`.card[data-card-id="${cardId}"]`).remove();
  } catch (err) {
    alert('Failed to delete card: ' + err.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function updateCount(columnId) {
  const col = board.columns.find((c) => c.id === columnId);
  const header = document.querySelector(
    `.column[data-column-id="${columnId}"] .column-count`
  );
  if (header) header.textContent = col.cards.length;
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    board = await api('GET', '/api/board');
    renderBoard();
  } catch (err) {
    document.getElementById('board').textContent =
      'Failed to load board: ' + err.message;
  }
}

init();
