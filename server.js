const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store
let board = {
  columns: [
    { id: 'todo', title: 'To Do', cards: [] },
    { id: 'inprogress', title: 'In Progress', cards: [] },
    { id: 'done', title: 'Done', cards: [] },
  ],
};
let nextCardId = 1;

// GET all board data
app.get('/api/board', (req, res) => {
  res.json(board);
});

// POST create a new card
app.post('/api/cards', (req, res) => {
  const { columnId, title } = req.body;
  if (!columnId || !title || !title.trim()) {
    return res.status(400).json({ error: 'columnId and title are required' });
  }
  const column = board.columns.find((c) => c.id === columnId);
  if (!column) {
    return res.status(404).json({ error: 'Column not found' });
  }
  const card = { id: String(nextCardId++), title: title.trim() };
  column.cards.push(card);
  res.status(201).json(card);
});

// PUT move a card to another column
app.put('/api/cards/:cardId/move', (req, res) => {
  const { cardId } = req.params;
  const { targetColumnId } = req.body;
  if (!targetColumnId) {
    return res.status(400).json({ error: 'targetColumnId is required' });
  }
  const targetColumn = board.columns.find((c) => c.id === targetColumnId);
  if (!targetColumn) {
    return res.status(404).json({ error: 'Target column not found' });
  }

  let card = null;
  for (const col of board.columns) {
    const idx = col.cards.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      [card] = col.cards.splice(idx, 1);
      break;
    }
  }
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }
  targetColumn.cards.push(card);
  res.json(card);
});

// DELETE a card
app.delete('/api/cards/:cardId', (req, res) => {
  const { cardId } = req.params;
  for (const col of board.columns) {
    const idx = col.cards.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      col.cards.splice(idx, 1);
      return res.status(204).send();
    }
  }
  res.status(404).json({ error: 'Card not found' });
});

app.listen(PORT, () => {
  console.log(`Kanban board running at http://localhost:${PORT}`);
});

module.exports = app;
