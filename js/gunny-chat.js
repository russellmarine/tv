(function() {
  'use strict';

  console.log('✅ [GunnyChat] module loaded');

  const API_BASE = '/api';

  let panelEl = null;
  let messagesEl = null;
  let inputEl = null;
  let formEl = null;
  let statusEl = null;
  let isOpen = false;

  // ---------- Styles ----------
  function injectStyles() {
    if (document.getElementById('gunny-chat-styles')) return;
    const style = document.createElement('style');
    style.id = 'gunny-chat-styles';
    style.textContent = `
      .gunny-chat-panel {
        position: fixed;
        bottom: 3.2rem;
        right: 1rem;
        width: 420px;
        max-height: 70vh;
        min-height: 260px;
        background: rgba(0,0,0,0.95);
        color: #f5f5f5;
        border-radius: 12px;
        border: 1px solid rgba(255,120,0,0.6);
        box-shadow: 0 8px 24px rgba(0,0,0,0.8);
        display: none;
        flex-direction: column;
        overflow: hidden;
        z-index: 9999;
        font-size: 0.85rem;
      }
      .gunny-chat-panel.open {
        display: flex;
      }
      .gunny-chat-header {
        padding: 0.4rem 0.6rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: radial-gradient(circle at top left,
          rgba(255,120,0,0.4),
          rgba(0,0,0,0.95));
        border-bottom: 1px solid rgba(255,120,0,0.4);
      }
      .gunny-chat-title {
        font-weight: 600;
        font-size: 0.8rem;
      }
      .gunny-chat-close {
        background: transparent;
        border: none;
        color: #fff;
        cursor: pointer;
        font-size: 0.9rem;
      }
      .gunny-chat-messages {
        padding: 0.5rem 0.6rem;
        flex: 1 1 auto;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .gunny-chat-msg {
        padding: 0.35rem 0.5rem;
        border-radius: 8px;
        max-width: 85%;
        line-height: 1.3;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .gunny-chat-msg.from-me {
        align-self: flex-end;
        background: rgba(100,150,255,0.9);
        color: #000;
      }
      .gunny-chat-msg.from-gunny {
        align-self: flex-start;
        background: rgba(255,120,0,0.85);
        color: #fff;
      }
      .gunny-chat-msg.from-other {
        align-self: flex-start;
        background: rgba(80,80,80,0.9);
      }
      .gunny-chat-footer {
        border-top: 1px solid rgba(255,255,255,0.1);
        padding: 0.35rem 0.4rem 0.45rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .gunny-chat-status {
        min-height: 1.1em;
        font-size: 0.7rem;
        color: rgba(220,220,220,0.8);
      }
      .gunny-chat-status.error {
        color: #ff8080;
      }
      .gunny-chat-form {
        display: flex;
        gap: 0.35rem;
      }
      .gunny-chat-input {
        flex: 1 1 auto;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.25);
        background: rgba(0,0,0,0.7);
        color: #fff;
        padding: 0.25rem 0.6rem;
        font-size: 0.8rem;
      }
      .gunny-chat-input:focus {
        outline: none;
        border-color: rgba(255,120,0,0.85);
        box-shadow: 0 0 4px rgba(255,120,0,0.8);
      }
      .gunny-chat-send {
        border-radius: 999px;
        border: none;
        padding: 0.3rem 0.8rem;
        font-size: 0.8rem;
        cursor: pointer;
        background: linear-gradient(135deg, #ff8800, #ff4500);
        color: #000;
        font-weight: 600;
      }
      .gunny-chat-send:hover {
        filter: brightness(1.1);
      }
    `;
    document.head.appendChild(style);
  }

  // ---------- API helper ----------
  async function apiJson(path, options) {
    const res = await fetch(API_BASE + path, {
      credentials: 'include',
      ...options,
    });
    if (!res.ok) {
      let body;
      try { body = await res.text(); } catch { body = '<no body>'; }
      throw new Error('API ' + path + ' failed: ' + res.status + ' ' + body);
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return {};
    return await res.json();
  }

  // Check Webex login status; if not logged in, redirect to FedRAMP Webex login
  async function ensureLoggedIn() {
    try {
      const status = await apiJson('/webex/status');
      if (status && status.logged_in) {
        return true;
      }

      const login = await apiJson('/webex/login');
      if (login && login.url) {
        setStatus('Redirecting to Webex login…', false);
        window.location.href = login.url;
      } else {
        setStatus('Unable to start Webex login flow.', true);
      }
      return false;
    } catch (err) {
      console.error('[GunnyChat] ensureLoggedIn error', err);
      setStatus('Webex auth check failed. Try again.', true);
      return false;
    }
  }

  // ---------- UI helpers ----------
  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('error', !!isError);
  }

  function clearStatus() {
    setStatus('');
  }

  function scrollToBottom() {
    if (!messagesEl) return;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderMessage(msg) {
    if (!messagesEl) return;
    const div = document.createElement('div');
    const cls = msg.fromMe ? 'from-me'
              : msg.fromGunny ? 'from-gunny'
              : 'from-other';

    div.className = 'gunny-chat-msg ' + cls;
    div.textContent = msg.text || '';
    messagesEl.appendChild(div);
  }

  // ---------- History ----------
  async function loadHistory() {
    try {
      setStatus('Loading history…');
      const data = await apiJson('/chat/history');
      messagesEl.innerHTML = '';
      const list = (data && data.messages) || [];
      for (const m of list) {
        renderMessage(m);
      }
      scrollToBottom();
      clearStatus();
    } catch (err) {
      console.error('[GunnyChat] history error', err);
      setStatus('Unable to load history. Try again, Devil Dog.', true);
    }
  }

  // ---------- Sending ----------
  async function onSend(e) {
    e.preventDefault();
    const text = (inputEl.value || '').trim();
    if (!text) return;

    // Show user bubble immediately
    renderMessage({ text, fromMe: true });
    scrollToBottom();
    inputEl.value = '';

    try {
      const logged = await ensureLoggedIn();
      if (!logged) return;

      const resp = await apiJson('/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      // Render Gunny's reply if present
      if (resp && resp.markdown) {
        renderMessage({ text: resp.markdown, fromGunny: true });
        scrollToBottom();
      }

      clearStatus();
    } catch (err) {
      console.error('[GunnyChat] send error', err);
      setStatus('Send failed. Check Webex auth or try again.', true);
    }
  }

  // ---------- Panel ----------
  function ensurePanel() {
    if (panelEl) return;

    injectStyles();

    panelEl = document.getElementById('gunny-chat-container');
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.id = 'gunny-chat-container';
      panelEl.className = 'gunny-chat-panel';
      panelEl.innerHTML = `
        <div class="gunny-chat-header">
          <div class="gunny-chat-title">🔥 GunnyGPT · Comm Planner</div>
          <button class="gunny-chat-close" type="button" aria-label="Close Gunny chat">✕</button>
        </div>
        <div class="gunny-chat-messages"></div>
        <div class="gunny-chat-footer">
          <div class="gunny-chat-status"></div>
          <form class="gunny-chat-form">
            <input class="gunny-chat-input" type="text"
                   placeholder="Ask Gunny about your comm plan…"
                   autocomplete="off" />
            <button class="gunny-chat-send" type="submit">Send</button>
          </form>
        </div>
      `;
      document.body.appendChild(panelEl);
    }

    messagesEl = panelEl.querySelector('.gunny-chat-messages');
    inputEl    = panelEl.querySelector('.gunny-chat-input');
    formEl     = panelEl.querySelector('.gunny-chat-form');
    statusEl   = panelEl.querySelector('.gunny-chat-status');

    const closeBtn = panelEl.querySelector('.gunny-chat-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        closePanel();
      });
    }

    if (formEl) {
      formEl.addEventListener('submit', onSend);
    }

    console.log('✅ [GunnyChat] panel initialized');
  }

  async function openPanel() {
    ensurePanel();
    panelEl.classList.add('open');
    isOpen = true;

    try {
      const logged = await ensureLoggedIn();
      if (!logged) return;
      await loadHistory();
    } catch (err) {
      console.error('[GunnyChat] open error', err);
      setStatus('Auth or API error talking to Gunny.', true);
    }
  }

  function closePanel() {
    if (!panelEl) return;
    panelEl.classList.remove('open');
    isOpen = false;
  }

  function togglePanel() {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  // ---------- Export globals ----------
  window.RussellTV = window.RussellTV || {};
  window.RussellTV.GunnyChat = {
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    isOpen: function() { return !!isOpen; },
  };

  window.GunnyChat = {
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    isOpen: function() { return !!isOpen; },
  };

  console.log('✅ [GunnyChat] globals ready (window.GunnyChat + RussellTV.GunnyChat)');
})();
