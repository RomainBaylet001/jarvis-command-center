
import { runLocalCommand, normalize } from './engine.js';
import {
  readStore,
  saveStore,
  exportStore,
  importStore
} from './storage.js';
import { queryAI, checkBackend } from './network.js';

const $ = id => document.getElementById(id);

let store = readStore();
let view = 'command';
let busy = false;
let messages = [];

let backend =
  localStorage.getItem('jarvis-backend') ||
  (['localhost', '127.0.0.1'].includes(location.hostname)
    ? location.origin
    : '');

const headers = {
  command: ['SYS / 001', 'COMMAND CENTER'],
  investments: ['SYS / 002', 'INVESTMENT INTELLIGENCE'],
  memory: ['SYS / 003', 'PERSONAL MEMORY'],
  tasks: ['SYS / 004', 'ACTION QUEUE'],
  system: ['SYS / 005', 'SYSTEM CONFIGURATION']
};

function txt(element, value) {
  element.textContent = value;
}

function setState(state) {
  document.querySelector('.workspace').dataset.state = state;

  const labels = {
    idle: 'SYSTEM READY · AWAITING INPUT',
    thinking: 'PROCESSING REQUEST...'
  };

  txt(
    $('orbStateText'),
    labels[state] || labels.idle
  );

  txt(
    $('footerStatus'),
    state === 'idle' ? 'SYSTEM READY' : state.toUpperCase()
  );
}

function setView(name) {
  if (!headers[name]) return;

  view = name;

  document.querySelectorAll('.view').forEach(element => {
    element.classList.toggle(
      'active',
      element.id === `view-${name}`
    );
  });

  document.querySelectorAll('.nav-item').forEach(element => {
    element.classList.toggle(
      'active',
      element.dataset.view === name
    );
  });

  txt($('pageCode'), headers[name][0]);
  txt($('pageTitle'), headers[name][1]);

  if (name === 'memory') renderNotes();
  if (name === 'tasks') renderTasks();
  if (name === 'investments') renderWatchlist();

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

function newMessage(role, text, isError = false) {
  messages.push({ role, text });
  messages = messages.slice(-30);

  const div = document.createElement('div');
  div.className = `message ${role}${isError ? ' error' : ''}`;

  const strong = document.createElement('strong');
  strong.textContent = role === 'user' ? 'YOU' : 'JARVIS';

  div.append(
    strong,
    document.createTextNode(text)
  );

  $('messages').append(div);
  $('messages').scrollTop = $('messages').scrollHeight;
}

function save() {
  saveStore(store);
  renderSummary();

  if (view === 'memory') renderNotes();
  if (view === 'tasks') renderTasks();
  if (view === 'investments') renderWatchlist();
}

function renderSummary() {
  txt(
    $('memorySummary'),
    `${store.notes.length} stored note${store.notes.length === 1 ? '' : 's'}`
  );

  const pending = store.tasks.filter(task => !task.done).length;

  txt(
    $('taskSummary'),
    `${pending} pending task${pending === 1 ? '' : 's'}`
  );

  txt($('tasksPending'), `${pending} pending`);

  txt(
    $('watchCount'),
    String(store.watchlist.length).padStart(2, '0')
  );
}

function appendEmpty(container, message) {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.textContent = message;
  container.append(div);
}

// PERSONAL MEMORY

function renderNotes() {
  const element = $('notesList');
  element.replaceChildren();

  if (!store.notes.length) {
    return appendEmpty(
      element,
      'No memories yet. Save a note above or say "remember that..."'
    );
  }

  for (const note of store.notes) {
    const row = document.createElement('div');
    row.className = 'list-item';

    const main = document.createElement('div');
    main.className = 'item-text';

    const line = document.createElement('div');
    line.textContent = note.text;

    const time = document.createElement('small');
    time.className = 'item-meta';
    time.textContent = new Date(note.createdAt).toLocaleString();

    main.append(line, time);

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'DELETE';
    button.setAttribute('aria-label', 'Delete note');

    button.onclick = () => {
      store.notes = store.notes.filter(
        item => item.id !== note.id
      );
      save();
    };

    row.append(main, button);
    element.append(row);
  }
}

// TASK MANAGEMENT

function renderTasks() {
  const element = $('tasksList');
  element.replaceChildren();

  if (!store.tasks.length) {
    return appendEmpty(
      element,
      'No tasks yet. Add your first task above.'
    );
  }

  for (const task of store.tasks) {
    const row = document.createElement('div');
    row.className = `list-item${task.done ? ' done' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!task.done;

    checkbox.setAttribute(
      'aria-label',
      `Complete task ${task.text}`
    );

    checkbox.onchange = () => {
      task.done = checkbox.checked;
      save();
    };

    const main = document.createElement('div');
    main.className = 'item-text';
    main.textContent = task.text;

    const button = document.createElement('button');
    button.textContent = 'DELETE';

    button.onclick = () => {
      store.tasks = store.tasks.filter(
        item => item.id !== task.id
      );
      save();
    };

    row.append(checkbox, main, button);
    element.append(row);
  }
}

// INVESTMENT WATCHLIST

function renderWatchlist() {
  const element = $('watchlist');
  element.replaceChildren();

  for (const symbol of store.watchlist) {
    const tag = document.createElement('span');
    tag.className = 'watch-pill';

    tag.append(document.createTextNode(symbol));

    const button = document.createElement('button');
    button.title = `Remove ${symbol}`;
    button.textContent = '×';

    button.setAttribute(
      'aria-label',
      `Remove ${symbol} from watchlist`
    );

    button.onclick = () => {
      store.watchlist = store.watchlist.filter(
        item => item !== symbol
      );
      save();
    };

    tag.append(button);
    element.append(tag);
  }

  if (!store.watchlist.length) {
    appendEmpty(
      element,
      'No assets on your research watchlist.'
    );
  }
}

// COMMAND PROCESSING

async function processCommand(input) {
  const command = normalize(input);

  if (!command || busy) return;

  newMessage('user', command);
  $('commandInput').value = '';

  setState('thinking');
  busy = true;
  $('sendBtn').disabled = true;

  try {
    const result = runLocalCommand(command, store);

    if (result.handled) {
      if (result.changed) save();
      if (result.view) setView(result.view);

      newMessage('assistant', result.reply);

    } else if (backend) {
      const history = messages.filter(
        message =>
          message.role === 'user' ||
          message.role === 'assistant'
      );

      const reply = await queryAI(backend, history);
      newMessage('assistant', reply);

    } else {
      newMessage(
        'assistant',
        'This command needs a connected AI backend. ' +
        'Offline I can manage notes, tasks and your ' +
        'research watchlist. Open System Settings ' +
        'to connect an AI service securely.'
      );
    }

  } catch (error) {
    newMessage(
      'assistant',
      `Request failed: ${error.message}`,
      true
    );

  } finally {
    busy = false;
    $('sendBtn').disabled = false;
    setState('idle');
  }
}

// AI CONNECTION STATUS

function updateConnection() {
  const active = !!backend;

  txt(
    $('connectionLabel'),
    active ? 'BACKEND URL SET' : 'LOCAL MODE'
  );

  txt(
    $('modeValue'),
    active ? 'BACKEND CONFIGURED' : 'OFFLINE / LOCAL'
  );

  txt(
    $('sidebarMode'),
    active ? 'AI BACKEND URL SET' : 'LOCAL COMMAND ENGINE'
  );

  txt(
    $('systemFootnote'),
    active
      ? 'AI AVAILABLE IF SERVER IS RUNNING'
      : 'LOCAL COMMANDS · NO AI CONNECTED'
  );

  $('backendInput').value = backend;
}

// INITIALIZE APPLICATION

function setup() {

  // Navigation
  document.querySelectorAll('[data-view]').forEach(button => {
    button.addEventListener('click', () => {
      setView(button.dataset.view);
    });
  });

  // Quick-access modules
  document.querySelectorAll('[data-open]').forEach(button => {
    const action = () => setView(button.dataset.open);

    button.addEventListener('click', action);

    button.addEventListener('keydown', event => {
      if (event.key === 'Enter') action();
    });
  });

  // Command shortcuts
  document.querySelectorAll('[data-command]').forEach(button => {
    button.addEventListener('click', () => {
      processCommand(button.dataset.command);
    });
  });

  // Main terminal
  $('commandForm').addEventListener('submit', event => {
    event.preventDefault();
    processCommand($('commandInput').value);
  });

  // Save a memory
  $('noteForm').addEventListener('submit', event => {
    event.preventDefault();

    const input = normalize($('noteInput').value);

    if (input) {
      store.notes.unshift({
        id: crypto.randomUUID(),
        text: input,
        createdAt: new Date().toISOString()
      });

      $('noteInput').value = '';
      save();
    }
  });

  // Add a task
  $('taskForm').addEventListener('submit', event => {
    event.preventDefault();

    const input = normalize($('taskInput').value);

    if (input) {
      store.tasks.unshift({
        id: crypto.randomUUID(),
        text: input,
        done: false,
        createdAt: new Date().toISOString()
      });

      $('taskInput').value = '';
      save();
    }
  });

  // Add investment asset
  $('addTickerForm').addEventListener('submit', event => {
    event.preventDefault();

    const ticker = $('newTicker').value.toUpperCase().trim();

    if (!/^[A-Z][A-Z0-9.\-]{1,14}$/.test(ticker)) {
      alert('Use a ticker such as ETH or VWCE.DE');
      return;
    }

    if (!store.watchlist.includes(ticker)) {
      store.watchlist.push(ticker);
    }

    $('newTicker').value = '';
    save();
  });

  // Export data
  $('exportBtn').addEventListener('click', () => {
    exportStore(store);
  });

  // Import data
  $('importBtn').addEventListener('click', () => {
    $('importFile').click();
  });

  $('importFile').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imported = await importStore(file);

      if (confirm('Replace local notes, tasks and watchlist?')) {
        store = imported;
        save();
        newMessage('assistant', 'Local backup imported.');
      }

    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }

    event.target.value = '';
  });

  // Delete local data
  $('clearBtn').addEventListener('click', () => {
    const confirmed = confirm(
      'Delete all locally saved notes, tasks and watchlist? ' +
      'This cannot be undone unless you have a backup.'
    );

    if (!confirmed) return;

    localStorage.removeItem('jarvis-lab-v1');
    store = readStore();
    save();

    newMessage('assistant', 'Local data cleared.');
  });

  // Save backend URL
  $('saveBackendBtn').addEventListener('click', () => {
    const value = $('backendInput').value.trim().replace(/\/$/, '');

    const valid =
      !value ||
      /^https:\/\//i.test(value) ||
      /^http:\/\/localhost(:\d+)?$/i.test(value) ||
      /^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(value);

    if (!valid) {
      txt(
        $('backendMessage'),
        'For security, use HTTPS or localhost during development.'
      );
      return;
    }

    backend = value;

    if (backend) {
      localStorage.setItem('jarvis-backend', backend);
    } else {
      localStorage.removeItem('jarvis-backend');
    }

    updateConnection();

    txt(
      $('backendMessage'),
      backend
        ? 'Backend URL saved. Test the connection next.'
        : 'Backend disconnected. Offline mode available.'
    );
  });

  // Test AI backend
  $('testBackendBtn').addEventListener('click', async () => {
    if (!backend) {
      txt(
        $('backendMessage'),
        'Enter and save a backend URL first.'
      );
      return;
    }

    txt($('backendMessage'), 'Checking server...');

    try {
      const info = await checkBackend(backend);

      txt(
        $('backendMessage'),
        info.aiConfigured
          ? 'Backend reachable and AI configured.'
          : 'Backend reachable, but no AI API key is configured.'
      );

    } catch (error) {
      txt(
        $('backendMessage'),
        `Backend unreachable: ${error.message}`
      );
    }
  });

  // Clear displayed conversation
  $('clearConversation').addEventListener('click', () => {
    messages = [];
    $('messages').replaceChildren();

    newMessage(
      'assistant',
      'Conversation display cleared. Stored notes and tasks remain.'
    );
  });

  // Clock
  const updateClock = () => {
    txt(
      $('liveClock'),
      new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date())
    );
  };

  updateClock();
  setInterval(updateClock, 30000);

  // Startup
  updateConnection();
  renderSummary();
  renderWatchlist();

  newMessage(
    'assistant',
    'JARVIS local systems initialized. ' +
    'Type "help" to see available commands. ' +
    'Advanced AI requires a secure backend connection.'
  );

  $('commandInput').focus({ preventScroll: true });
}

// Service worker — optional
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

setup();
