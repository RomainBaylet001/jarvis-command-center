
/*
 * J.A.R.V.I.S. — NETWORK BRIDGE
 * Version 0.2
 *
 * Browser -> secure AI backend
 * The secret API key must stay on the server.
 */

function backendURL(endpoint, route) {
  const raw = String(endpoint || '').trim();

  if (!raw) {
    throw new Error('No AI backend is configured.');
  }

  let url;

  try {
    url = new URL(raw);
  } catch {
    throw new Error('The backend URL is invalid.');
  }

  const local = [
    'localhost',
    '127.0.0.1'
  ].includes(url.hostname);

  if (
    url.protocol !== 'https:' &&
    !(local && url.protocol === 'http:')
  ) {
    throw new Error(
      'The backend must use HTTPS, except for localhost.'
    );
  }

  if (url.username || url.password) {
    throw new Error(
      'Do not put passwords or API keys in a backend URL.'
    );
  }

  url.pathname = route;
  url.search = '';
  url.hash = '';

  return url.toString();
}

async function requestJSON(
  url,
  options = {},
  timeoutMS = 10000
) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeoutMS
  );

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store'
    });

    const data = await response.json()
      .catch(() => null);

    if (!response.ok) {
      const reason =
        data && typeof data.error === 'string'
          ? data.error
          : `Server returned HTTP ${response.status}`;

      throw new Error(reason);
    }

    if (!data || typeof data !== 'object') {
      throw new Error(
        'The server returned an invalid JSON response.'
      );
    }

    return data;

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'The server took too long to respond.'
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        'Cannot reach the AI server. ' +
        'Check its address, connection, ' +
        'and CORS settings.'
      );
    }

    throw error;

  } finally {
    clearTimeout(timer);
  }
}

// SEND A CONVERSATION TO THE AI BACKEND

export async function queryAI(endpoint, history) {
  const url = backendURL(
    endpoint,
    '/api/chat'
  );

  const messages = history
    .filter(item =>
      item &&
      ['user', 'assistant'].includes(item.role) &&
      typeof item.text === 'string'
    )
    .slice(-12)
    .map(item => ({
      role: item.role,
      content: item.text.slice(0, 4000)
    }));

  if (!messages.length) {
    throw new Error(
      'There is no message to send.'
    );
  }

  const data = await requestJSON(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messages })
    },
    30000
  );

  if (
    typeof data.reply !== 'string' ||
    !data.reply.trim()
  ) {
    throw new Error(
      'The AI server returned no response text.'
    );
  }

  return data.reply;
}

// TEST WHETHER THE AI BACKEND IS ONLINE

export async function checkBackend(endpoint) {
  const url = backendURL(
    endpoint,
    '/api/health'
  );

  const data = await requestJSON(
    url,
    { method: 'GET' },
    7000
  );

  if (data.ok !== true) {
    throw new Error(
      'The backend did not report a healthy status.'
    );
  }

  return {
    ok: true,
    aiConfigured: data.aiConfigured === true,
    mode:
      typeof data.mode === 'string'
        ? data.mode
        : 'unknown'
  };
}
