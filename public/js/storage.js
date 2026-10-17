
/*
 * J.A.R.V.I.S. — MEMORY SYSTEM
 * Version 0.2
 *
 * Local persistence, backups and import.
 *
 * This is browser storage, not an encrypted
 * or synchronized cloud memory system.
 */

import { makeStore } from './engine.js';

const STORAGE_KEY = 'jarvis-lab-v1';
const MAX_BACKUP_SIZE = 1024 * 1024;

// VALIDATE AND NORMALIZE DATA

function cleanStore(data) {
  if (!data || typeof data !== 'object' ||
      Array.isArray(data)) {
    throw new Error('Invalid memory data.');
  }

  const cleaned = makeStore();

  if (Array.isArray(data.notes)) {
    cleaned.notes = data.notes
      .filter(item =>
        item &&
        typeof item.text === 'string'
      )
      .slice(0, 1000)
      .map(item => ({
        id: String(
          item.id || crypto.randomUUID()
        ),
        text: item.text.slice(0, 5000),
        createdAt: validDate(item.createdAt)
      }));
  }

  if (Array.isArray(data.tasks)) {
    cleaned.tasks = data.tasks
      .filter(item =>
        item &&
        typeof item.text === 'string'
      )
      .slice(0, 1000)
      .map(item => ({
        id: String(
          item.id || crypto.randomUUID()
        ),
        text: item.text.slice(0, 5000),
        done: item.done === true,
        createdAt: validDate(item.createdAt)
      }));
  }

  if (Array.isArray(data.watchlist)) {
    cleaned.watchlist = [
      ...new Set(
        data.watchlist
          .filter(item =>
            typeof item === 'string'
          )
          .map(item =>
            item.trim().toUpperCase()
          )
          .filter(item =>
            /^[A-Z][A-Z0-9.-]{1,14}$/.test(item)
          )
      )
    ].slice(0, 200);
  }

  return cleaned;
}

function validDate(value) {
  if (
    typeof value === 'string' &&
    !Number.isNaN(Date.parse(value))
  ) {
    return value;
  }

  return new Date().toISOString();
}

// READ MEMORY FROM BROWSER

export function readStore() {
  try {
    const saved = localStorage.getItem(
      STORAGE_KEY
    );

    if (!saved) {
      return makeStore();
    }

    const parsed = JSON.parse(saved);

    return cleanStore(parsed);

  } catch (error) {
    console.warn(
      'JARVIS memory could not be loaded:',
      error
    );

    return makeStore();
  }
}

// SAVE MEMORY TO BROWSER

export function saveStore(store) {
  const clean = cleanStore(store);

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(clean)
    );

    return true;

  } catch (error) {
    console.error(
      'JARVIS memory save failed:',
      error
    );

    throw new Error(
      'Memory could not be saved. ' +
      'Check browser storage availability.'
    );
  }
}

// EXPORT A MEMORY BACKUP

export function exportStore(store) {
  const data = {
    application: 'JARVIS',
    version: '0.2',
    exportedAt: new Date().toISOString(),
    ...cleanStore(store)
  };

  const json = JSON.stringify(
    data,
    null,
    2
  );

  const blob = new Blob(
    [json],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');

  const date = new Date()
    .toISOString()
    .slice(0, 10);

  link.href = url;
  link.download =
    `JARVIS-memory-${date}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10000);
}

// IMPORT A PREVIOUS BACKUP

export async function importStore(file) {
  if (!file) {
    throw new Error('No file selected.');
  }

  if (file.size > MAX_BACKUP_SIZE) {
    throw new Error(
      'Backup file is too large.'
    );
  }

  let data;

  try {
    const text = await file.text();
    data = JSON.parse(text);

  } catch {
    throw new Error(
      'File is not valid JSON.'
    );
  }

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    throw new Error(
      'Invalid backup structure.'
    );
  }

  const validFields = [
    'notes',
    'tasks',
    'watchlist'
  ];

  const hasData = validFields.some(
    field => Array.isArray(data[field])
  );

  if (!hasData) {
    throw new Error(
      'No compatible Jarvis memory found.'
    );
  }

  return cleanStore(data);
}
