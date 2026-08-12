const CATEGORY_CODES = {
  orders: 'ORD',
  restock: 'RSK',
  posts: 'PST',
  general: 'GEN',
};

const STATUSES = ['todo', 'in_progress', 'done'];

let activeCategory = '';
let allTasks = [];

const form = document.getElementById('task-form');
const emptyState = document.getElementById('empty-state');

async function fetchTasks() {
  const url = activeCategory ? `/api/tasks?category=${activeCategory}` : '/api/tasks';
  const res = await fetch(url);
  allTasks = await res.json();
  render();
}

function formatDue(dateStr) {
  if (!dateStr) return null;
  const due = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = due < today;
  const label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { label, overdue };
}

function cardHTML(task) {
  const due = formatDue(task.due_date);
  return `
    <article class="tag-card" data-id="${task.id}">
      <div class="tag-card__top">
        <span class="tag-card__code">${CATEGORY_CODES[task.category] || 'GEN'}-${String(task.id).padStart(3, '0')}</span>
        <span class="tag-card__priority tag-card__priority--${task.priority}">${task.priority}</span>
      </div>
      <p class="tag-card__title">${escapeHTML(task.title)}</p>
      ${task.notes ? `<p class="tag-card__notes">${escapeHTML(task.notes)}</p>` : ''}
      ${due ? `<p class="tag-card__due ${due.overdue && task.status !== 'done' ? 'is-overdue' : ''}">Due ${due.label}</p>` : ''}
      <div class="tag-card__actions">
        ${nextStatusButtons(task)}
        <button class="is-danger" data-action="delete" data-id="${task.id}">Remove</button>
      </div>
    </article>
  `;
}

function nextStatusButtons(task) {
  const buttons = [];
  if (task.status === 'todo') {
    buttons.push(`<button data-action="status" data-status="in_progress" data-id="${task.id}">Start</button>`);
  }
  if (task.status === 'in_progress') {
    buttons.push(`<button data-action="status" data-status="todo" data-id="${task.id}">Back</button>`);
    buttons.push(`<button data-action="status" data-status="done" data-id="${task.id}">Complete</button>`);
  }
  if (task.status === 'done') {
    buttons.push(`<button data-action="status" data-status="in_progress" data-id="${task.id}">Reopen</button>`);
  }
  return buttons.join('');
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  STATUSES.forEach((status) => {
    const tasks = allTasks.filter((t) => t.status === status);
    document.getElementById(`cards-${status}`).innerHTML = tasks.map(cardHTML).join('');
    document.getElementById(`count-${status}`).textContent = tasks.length;
  });
  emptyState.hidden = allTasks.length !== 0;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('title').value,
    category: document.getElementById('category').value,
    priority: document.getElementById('priority').value,
    due_date: document.getElementById('due_date').value || null,
    notes: document.getElementById('notes').value || null,
  };

  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    form.reset();
    fetchTasks();
  } else {
    const body = await res.json();
    alert((body.errors || ['Could not add task']).join('\n'));
  }
});

document.querySelectorAll('.filter-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    activeCategory = btn.dataset.filterCategory;
    fetchTasks();
  });
});

document.querySelector('.board__lanes').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const { action, id, status } = btn.dataset;

  if (action === 'delete') {
    if (!confirm('Remove this task?')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  } else if (action === 'status') {
    await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }
  fetchTasks();
});

fetchTasks();
