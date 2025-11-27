(function() {
  'use strict';

  console.log('✅ [GunnyChat] module loaded');

  const API_BASE = '/api';

  let panelEl = null;
  let messagesEl = null;
  let inputEl = null;
  let formEl = null;
  let statusEl = null;
  let typingEl = null;
  let isOpen = false;

  // Drag state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panelStartLeft = 0;
  let panelStartTop = 0;

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
        height: 420px;
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
        resize: both;
        min-width: 320px;
        min-height: 260px;
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
        cursor: move; /* makes it obvious you can drag */
        user-select: none;
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
        overscroll-behavior: contain; /* keep wheel inside panel */
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
        background: rgba(255,140,0,0.85); /* 🔥 Marine-orange */
        color: #000;
        border: 1px solid rgba(255,180,60,0.9);
      }
      .gunny-chat-msg.from-gunny {
        align-self: flex-start;
        background: rgba(50,50,50,0.95); /* dark radio-chatter */
        color: #ff9d42; /* tactical amber text */
        border: 1px solid rgba(255,120,0,0.6);
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
      .gunny-chat-typing {
        min-height: 1.1em;
        font-size: 0.7rem;
        color: rgba(220,220,220,0.85);
        opacity: 0.9;
        display: none;
      }
      .gunny-chat-typing .dot {
        display: inline-block;
        animation: gunny-dots 1.2s infinite ease-in-out;
      }
      .gunny-chat-typing .dot:nth-child(2) {
        animation-delay: 0.2s;
      }
      .gunny-chat-typing .dot:nth-child(3) {
        animation-delay: 0.4s;
      }
      @keyframes gunny-dots {
        0%, 20%   { opacity: 0.2; transform: translateY(0); }
        50%       { opacity: 1;   transform: translateY(-1px); }
        100%      { opacity: 0.2; transform: translateY(0); }
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

  // ---------- Webex login ----------
  async function ensureLoggedIn() {
    try {
      const login = await apiJson('/webex/login');

      // Already logged in for this browser/user
      if (login && login.logged_in) {
        return true;
      }

      // If a login URL is provided, redirect to FedRAMP Webex OAuth
      if (login && login.url) {
        setStatus('Redirecting to Webex login…', false);
        window.location.href = login.url;
        return false;
      }

      setStatus('Unable to start Webex login flow.', true);
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

  function setTyping(active) {
    if (!typingEl) return;
    typingEl.style.display = active ? 'block' : 'none';
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

      setTyping(true);

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
    } finally {
      setTyping(false);
    }
  }

  // ---------- Drag helpers ----------
  function ensurePanelPositionForDrag() {
    // Convert bottom/right anchored position to explicit top/left for dragging
    const rect = panelEl.getBoundingClientRect();
    panelEl.style.left = rect.left + 'px';
    panelEl.style.top = rect.top + 'px';
    panelEl.style.right = 'auto';
    panelEl.style.bottom = 'auto';
  }

  function onHeaderMouseDown(e) {
    if (e.button !== 0) return; // left button only
    if (!panelEl) return;

    e.preventDefault();
    ensurePanelPositionForDrag();

    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = panelEl.getBoundingClientRect();
    panelStartLeft = rect.left;
    panelStartTop = rect.top;

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e) {
    if (!isDragging || !panelEl) return;

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    let newLeft = panelStartLeft + dx;
    let newTop = panelStartTop + dy;

    const maxLeft = window.innerWidth - panelEl.offsetWidth;
    const maxTop = window.innerHeight - panelEl.offsetHeight;

    if (!isNaN(maxLeft)) {
      newLeft = Math.min(Math.max(0, newLeft), Math.max(0, maxLeft));
    }
    if (!isNaN(maxTop)) {
      newTop = Math.min(Math.max(0, newTop), Math.max(0, maxTop));
    }

    panelEl.style.left = newLeft + 'px';
    panelEl.style.top = newTop + 'px';
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
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
          <div class="gunny-chat-typing">
            GunnyGPT is thinking<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
          </div>
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
    typingEl   = panelEl.querySelector('.gunny-chat-typing');

    const closeBtn  = panelEl.querySelector('.gunny-chat-close');
    const headerEl  = panelEl.querySelector('.gunny-chat-header');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        closePanel();
      });
    }

    if (headerEl) {
      headerEl.addEventListener('mousedown', onHeaderMouseDown);
    }

    if (formEl) {
      formEl.addEventListener('submit', onSend);
    }

    // Make mouse wheel over the panel always scroll the messages,
    // instead of bleeding through to the page first.
    panelEl.addEventListener('wheel', function(e) {
      if (!messagesEl) return;
      if (!panelEl.contains(e.target)) return;

      // Apply wheel delta to the messages container
      messagesEl.scrollTop += e.deltaY;
      e.preventDefault();
      e.stopPropagation();
    }, { passive: false });

    console.log('✅ [GunnyChat] panel initialized');
  }

  async function openPanel() {
    ensurePanel();
    panelEl.classList.add('open');
    isOpen = true;
    setTyping(false);
    clearStatus();

    try {
      const logged = await ensureLoggedIn();
      if (!logged) return;
      await loadHistory();
      if (inputEl) inputEl.focus();
    } catch (err) {
      console.error('[GunnyChat] open error', err);
      setStatus('Auth or API error talking to Gunny.', true);
    }
  }

  function closePanel() {
    if (!panelEl) return;
    panelEl.classList.remove('open');
    isOpen = false;
    setTyping(false);
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
