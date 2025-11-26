// /js/gunny-chat.js
// GunnyGPT Comm Planner chat – modular, no coupling to other features
(function() {
  'use strict';

  const API_ME = '/api/me';
  const API_HISTORY = '/api/chat/history?limit=40';
  const API_SEND = '/api/chat/send';

  const state = {
    isAuthenticated: false,
    visible: false,
    pollTimer: null
  };

  let containerEl, panelEl, messagesEl, inputEl, sendBtn, loginOverlayEl, headerUserEl;

  function init() {
    containerEl = document.getElementById('gunny-chat-container');
    if (!containerEl) {
      console.warn('[GunnyChat] #gunny-chat-container not found, skipping init.');
      return;
    }

    buildLayout();
    wireEvents();
    checkAuth();
  }

  function buildLayout() {
    // Slightly reuse your headline look but with a fiery twist
    containerEl.innerHTML = `
      <div id="gunny-chat-panel" class="gunny-chat-collapsed">
        <div id="gunny-chat-header">
          <span class="gunny-title">🔥 GunnyGPT – Comm Planner</span>
          <span id="gunny-user-label" class="gunny-user-label"></span>
        </div>
        <div id="gunny-chat-body">
          <div id="gunny-chat-messages"></div>
        </div>
        <div id="gunny-chat-footer">
          <textarea id="gunny-input" rows="2"
            placeholder="Ask the Gunny about links, SATCOM plans, TTPs…"></textarea>
          <button id="gunny-send-btn">Send</button>
        </div>
        <div id="gunny-login-overlay" class="gunny-hidden">
          <p>Sign in with Webex to talk with GunnyGPT.</p>
          <a id="gunny-login-btn" href="/api/webex/login">Login with Webex</a>
        </div>
      </div>
    `;

    panelEl = document.getElementById('gunny-chat-panel');
    messagesEl = document.getElementById('gunny-chat-messages');
    inputEl = document.getElementById('gunny-input');
    sendBtn = document.getElementById('gunny-send-btn');
    loginOverlayEl = document.getElementById('gunny-login-overlay');
    headerUserEl = document.getElementById('gunny-user-label');

    applyStyles();
  }

  function applyStyles() {
    // Inline styles so you don't have to touch CSS files yet; you can migrate later.
    const css = `
      .gunny-hidden { display: none; }

      #gunny-chat-panel {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 260px;
        background: radial-gradient(circle at top left, #3b0b0b 0, #130303 40%, #050000 100%);
        border-radius: 6px;
        border: 1px solid rgba(255, 80, 0, 0.55);
        box-shadow: 0 0 16px rgba(255, 80, 0, 0.35);
        overflow: hidden;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      #gunny-chat-panel.gunny-chat-collapsed {
        display: none;
      }

      #gunny-chat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.35rem 0.6rem;
        border-bottom: 1px solid rgba(255, 120, 0, 0.4);
        background: linear-gradient(90deg, rgba(255,120,0,0.2), rgba(255,0,0,0.05));
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #ffd9c2;
      }

      #gunny-chat-header .gunny-title::before {
        content: "● ";
        color: #ff5a00;
      }

      .gunny-user-label {
        font-size: 0.7rem;
        opacity: 0.75;
      }

      #gunny-chat-body {
        flex: 1;
        overflow-y: auto;
        padding: 0.5rem;
      }

      #gunny-chat-messages {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }

      .gunny-msg {
        max-width: 90%;
        padding: 0.3rem 0.55rem;
        border-radius: 0.4rem;
        font-size: 0.78rem;
        line-height: 1.3;
        position: relative;
      }

      .gunny-msg.me {
        margin-left: auto;
        background: linear-gradient(135deg, #ff7b21, #ff4b10);
        color: #120500;
        box-shadow: 0 0 8px rgba(255, 130, 40, 0.65);
      }

      .gunny-msg.gunny {
        margin-right: auto;
        background: radial-gradient(circle at top left, #2b0903, #140202);
        color: #ffd7bd;
        border: 1px solid rgba(255, 120, 0, 0.4);
      }

      .gunny-msg .meta {
        font-size: 0.65rem;
        opacity: 0.65;
        margin-top: 0.12rem;
      }

      #gunny-chat-footer {
        border-top: 1px solid rgba(255, 80, 0, 0.4);
        padding: 0.4rem;
        display: flex;
        gap: 0.35rem;
        background: rgba(0, 0, 0, 0.92);
      }

      #gunny-input {
        flex: 1;
        resize: none;
        background: rgba(15, 5, 2, 0.9);
        border: 1px solid rgba(255, 90, 0, 0.6);
        color: #ffe2cd;
        padding: 0.3rem 0.4rem;
        font-size: 0.78rem;
        border-radius: 0.3rem;
      }

      #gunny-input:focus {
        outline: none;
        box-shadow: 0 0 8px rgba(255, 120, 0, 0.7);
      }

      #gunny-send-btn {
        align-self: flex-end;
        padding: 0.3rem 0.7rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 160, 80, 0.9);
        background: radial-gradient(circle at top, #ffb347, #ff5a1f);
        color: #201004;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        cursor: pointer;
        white-space: nowrap;
      }

      #gunny-send-btn:hover {
        box-shadow: 0 0 10px rgba(255, 120, 0, 0.9);
      }

      #gunny-login-overlay {
        position: absolute;
        inset: 0;
        background: rgba(5, 0, 0, 0.95);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 0.7rem;
        color: #ffe0c7;
        font-size: 0.82rem;
        text-align: center;
        padding: 0 1.5rem;
      }

      #gunny-login-overlay.gunny-hidden {
        display: none;
      }

      #gunny-login-btn {
        padding: 0.35rem 0.9rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 120, 0, 0.85);
        text-decoration: none;
        color: #1a0500;
        background: linear-gradient(135deg, #ffaa3a, #ff5f1c);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.78rem;
      }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  function wireEvents() {
    if (!sendBtn || !inputEl) return;

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  async function checkAuth() {
    try {
      const res = await fetch(API_ME, { credentials: 'include' });
      const data = await res.json();
      if (!data.authenticated) {
        state.isAuthenticated = false;
        loginOverlayEl && loginOverlayEl.classList.remove('gunny-hidden');
        stopPolling();
        return;
      }
      state.isAuthenticated = true;
      if (headerUserEl) headerUserEl.textContent = data.displayName || '';
      loginOverlayEl && loginOverlayEl.classList.add('gunny-hidden');
      startPolling();
    } catch (err) {
      console.error('[GunnyChat] auth check failed', err);
    }
  }

  async function loadHistory() {
    if (!state.isAuthenticated || !messagesEl) return;
    try {
      const res = await fetch(API_HISTORY, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      renderMessages(data.messages || []);
    } catch (err) {
      console.error('[GunnyChat] history error', err);
    }
  }

  function renderMessages(msgs) {
    messagesEl.innerHTML = '';
    msgs.forEach((m) => {
      const div = document.createElement('div');
      div.classList.add('gunny-msg');
      if (m.fromMe) div.classList.add('me');
      else if (m.fromGunny) div.classList.add('gunny');

      const textSpan = document.createElement('div');
      textSpan.textContent = m.text || '';

      const meta = document.createElement('div');
      meta.classList.add('meta');
      const ts = new Date(m.created);
      meta.textContent =
        (m.fromGunny ? 'GunnyGPT' : 'You') +
        ' · ' +
        ts.toLocaleTimeString();

      div.appendChild(textSpan);
      div.appendChild(meta);
      messagesEl.appendChild(div);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage() {
    if (!state.isAuthenticated) {
      loginOverlayEl && loginOverlayEl.classList.remove('gunny-hidden');
      return;
    }
    const text = (inputEl.value || '').trim();
    if (!text) return;
    inputEl.value = '';

    try {
      const res = await fetch(API_SEND, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok) {
        console.error('[GunnyChat] send failed', await res.text());
        return;
      }
      // Small delay so the bot has time to answer
      setTimeout(loadHistory, 600);
    } catch (err) {
      console.error('[GunnyChat] send error', err);
    }
  }

  function startPolling() {
    loadHistory();
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = window.setInterval(loadHistory, 3500);
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  // Public API for info-bar toggle
  function show() {
    if (!panelEl) return;
    state.visible = true;
    panelEl.classList.remove('gunny-chat-collapsed');
  }

  function hide() {
    if (!panelEl) return;
    state.visible = false;
    panelEl.classList.add('gunny-chat-collapsed');
  }

  function toggle() {
    if (!panelEl) return;
    if (state.visible) hide();
    else {
      show();
      // lazy-auth check each open in case cookie expired
      checkAuth();
    }
  }

  // Expose global handle for info-bar.js
  window.GunnyChat = {
    init,
    toggle,
    show,
    hide
  };

  // Auto-init after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
