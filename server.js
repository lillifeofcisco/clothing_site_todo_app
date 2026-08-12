const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const VALID_CATEGORIES = ['orders', 'restock', 'posts', 'general'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_STATUSES = ['todo', 'in_progress', 'done'];

function validateTaskInput(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.title !== undefined) {
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      errors.push('title is required');
    }
  }
  if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
    errors.push(`category must be one of ${VALID_CATEGORIES.join(', ')}`);
  }
  if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
    errors.push(`priority must be one of ${VALID_PRIORITIES.join(', ')}`);
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    errors.push(`status must be one of ${VALID_STATUSES.join(', ')}`);
  }
  return errors;
}

// GET /api/tasks?category=&status=
app.get('/api/tasks', (req, res) => {
  const { category, status } = req.query;
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += " ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC";

  const tasks = db.prepare(query).all(...params);
  res.json(tasks);
});

// GET /api/tasks/:id
app.get('/api/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// POST /api/tasks
app.post('/api/tasks', (req, res) => {
  const errors = validateTaskInput(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const { title, category = 'general', priority = 'medium', status = 'todo', due_date = null, notes = null } = req.body;

  const result = db.prepare(`
    INSERT INTO tasks (title, category, priority, status, due_date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title.trim(), category, priority, status, due_date, notes);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(task);
});

// PUT /api/tasks/:id
app.put('/api/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const errors = validateTaskInput(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });

  const updated = {
    title: req.body.title !== undefined ? req.body.title.trim() : existing.title,
    category: req.body.category !== undefined ? req.body.category : existing.category,
    priority: req.body.priority !== undefined ? req.body.priority : existing.priority,
    status: req.body.status !== undefined ? req.body.status : existing.status,
    due_date: req.body.due_date !== undefined ? req.body.due_date : existing.due_date,
    notes: req.body.notes !== undefined ? req.body.notes : existing.notes,
  };

  db.prepare(`
    UPDATE tasks SET title = ?, category = ?, priority = ?, status = ?, due_date = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(updated.title, updated.category, updated.priority, updated.status, updated.due_date, updated.notes, req.params.id);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(task);
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Drop Culture Ops running at http://localhost:${PORT}`);
});
