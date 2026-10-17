
/*
 * J.A.R.V.I.S. — COMMAND ENGINE
 * Version 0.2
 *
 * Local command processing.
 * No artificial intelligence or market data
 * is simulated by this module.
 */

export function normalize(text) {
  return String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

// CREATE DEFAULT DATA STORE

export function makeStore(seed = {}) {
  return {
    notes: Array.isArray(seed.notes)
      ? seed.notes
      : [],

    tasks: Array.isArray(seed.tasks)
      ? seed.tasks
      : [],

    watchlist: Array.isArray(seed.watchlist)
      ? seed.watchlist
      : [
          'VWCE',
          'VFEA',
          'FLXI',
          'BTC',
          'SOL',
          'LINK',
          'AVAX',
          'RENDER',
          'AKT'
        ]
  };
}

// MAIN COMMAND PROCESSOR

export function runLocalCommand(
  text,
  store,
  now = new Date()
) {

  const raw = normalize(text);
  const q = raw.toLowerCase();

  if (!raw) {
    return {
      handled: true,
      reply: 'I did not receive a command.'
    };
  }

  // GREETINGS

  if (
    /^(hi|hello|hey|good morning|good evening|jarvis|hello jarvis)[.!]?$/i
      .test(raw)
  ) {
    return {
      handled: true,
      reply:
        'Online and ready. ' +
        'I can manage local notes and tasks, ' +
        'search your watchlist, and open the ' +
        'investment module. To answer general ' +
        'questions, connect an AI backend in System.'
    };
  }

  // HELP

  if (
    /^(help|what can you do|commands)[?!]?$/i
      .test(raw)
  ) {
    return {
      handled: true,
      reply:
        'Try: "remember that I want to shoot a ' +
        'perfume campaign", "show my notes", ' +
        '"add task review ETF allocations", ' +
        '"show tasks", "add ETH to watchlist", ' +
        '"show watchlist", or "what time is it?".'
    };
  }

  // CURRENT TIME

  if (
    /what time|current time|time is it|what's the time/
      .test(q)
  ) {
    return {
      handled: true,
      reply:
        'Your device reports ' +
        new Intl.DateTimeFormat(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        }).format(now) +
        '.'
    };
  }

  // SAVE A MEMORY

  let m = raw.match(
    /^(?:remember(?: that)?|save note|take a note)\s+(.+)/i
  );

  if (m) {

    const note = {
      id: crypto.randomUUID(),
      text: m[1],
      createdAt: now.toISOString()
    };

    store.notes.unshift(note);

    return {
      handled: true,
      changed: true,
      reply:
        `Saved locally: "${note.text}". ` +
        'You can view or delete it in Memory.'
    };
  }

  // SHOW MEMORIES

  if (
    /^(?:show|list|read)(?: my)? notes$/i.test(raw)
  ) {
    return {
      handled: true,
      view: 'memory',
      reply: store.notes.length
        ? `You have ${store.notes.length} saved ` +
          `note${store.notes.length === 1 ? '' : 's'}. ` +
          "I've opened Memory."
        : 'You have no saved notes yet. ' +
          'Say "remember that..." to create one.'
    };
  }

  // SEARCH MEMORIES

  m = raw.match(
    /^(?:find|search)(?: my)? notes? (?:for |about )?(.+)/i
  );

  if (m) {

    const hits = store.notes.filter(note =>
      note.text.toLowerCase().includes(
        m[1].toLowerCase()
      )
    );

    return {
      handled: true,
      view: 'memory',
      reply: hits.length
        ? `Found ${hits.length} matching notes: ` +
          hits.slice(0, 3)
            .map(note => note.text)
            .join(' · ')
        : `No notes match "${m[1]}".`
    };
  }

  // CREATE TASK

  m = raw.match(
    /^(?:add task|remind me to|todo)\s+(.+)/i
  );

  if (m) {

    const task = {
      id: crypto.randomUUID(),
      text: m[1],
      done: false,
      createdAt: now.toISOString()
    };

    store.tasks.unshift(task);

    return {
      handled: true,
      changed: true,
      reply:
        `Added task locally: "${task.text}". ` +
        'Important: this is a checklist, ' +
        'not a scheduled notification.'
    };
  }

  // SHOW TASKS

  if (
    /^(?:show|list)(?: my)? tasks$/i.test(raw)
  ) {
    const pending = store.tasks.filter(
      task => !task.done
    ).length;

    return {
      handled: true,
      view: 'tasks',
      reply:
        `You have ${pending} open tasks. ` +
        'Opening Tasks.'
    };
  }

  // OPEN INVESTMENT LAB

  if (
    /^(?:show|open)(?: my)? (?:investments?|portfolio|finance|research lab)$/i
      .test(raw)
  ) {
    return {
      handled: true,
      view: 'investments',
      reply:
        'Opening Investments. Figures displayed ' +
        'there are research examples, not ' +
        'verified live prices.'
    };
  }

  // SHOW WATCHLIST

  if (
    /^(?:show|list)(?: my)? watchlist$/i.test(raw)
  ) {
    return {
      handled: true,
      view: 'investments',
      reply:
        'Your research watchlist contains: ' +
        store.watchlist.join(', ') +
        '. No prices are fetched in offline mode.'
    };
  }

  // ADD ASSET TO WATCHLIST

  m = raw.match(
    /^add ([a-z][a-z0-9.\-]{1,14}) to (?:my )?watchlist$/i
  );

  if (m) {

    const ticker = m[1].toUpperCase();

    if (!store.watchlist.includes(ticker)) {
      store.watchlist.push(ticker);
    }

    return {
      handled: true,
      changed: true,
      view: 'investments',
      reply:
        `${ticker} is now on your local research ` +
        'watchlist. It has not been bought or traded.'
    };
  }

  // REMOVE ASSET FROM WATCHLIST

  m = raw.match(
    /^remove ([a-z][a-z0-9.\-]{1,14}) from (?:my )?watchlist$/i
  );

  if (m) {

    const ticker = m[1].toUpperCase();

    store.watchlist = store.watchlist.filter(
      item => item !== ticker
    );

    return {
      handled: true,
      changed: true,
      view: 'investments',
      reply:
        `Removed ${ticker} from your local ` +
        'research watchlist. No brokerage ' +
        'action was taken.'
    };
  }

  // SYSTEM STATUS

  if (
    /^(?:status|system status|diagnostics)$/i
      .test(raw)
  ) {
    return {
      handled: true,
      view: 'system',
      reply:
        'Core interface is active. Notes and tasks ' +
        'use this browser local storage. ' +
        'Check System for AI connection details.'
    };
  }

  // PREVENT ACCIDENTAL DELETION

  if (
    /^(?:clear|delete|wipe) (?:all )?(?:memory|notes|tasks|everything)$/i
      .test(raw)
  ) {
    return {
      handled: true,
      reply:
        'For safety, I will not delete your ' +
        'data from a text command. Open the ' +
        'relevant panel and use its delete controls.'
    };
  }

  // BLOCK FINANCIAL EXECUTION

  if (/\b(buy|sell|trade|transfer|pay)\b/i.test(q)) {
    return {
      handled: true,
      reply:
        'I can research and plan, but cannot ' +
        'execute financial transactions. ' +
        'No brokerage connection is installed.'
    };
  }

  // PASS UNKNOWN REQUEST TO FUTURE AI BACKEND

  return {
    handled: false
  };
}
