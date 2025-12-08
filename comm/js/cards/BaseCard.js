/**
 * BaseCard.js
 * Base class for all Comm Dashboard cards
 * Provides common lifecycle, rendering, and event handling
 */

(function () {
  'use strict';

  const { Events, Layout, escapeHtml, $ } = window.CommDashboard;

  /**
   * BaseCard - Abstract base class for dashboard cards
   * 
   * Lifecycle:
   *   constructor() -> init() -> render() -> update() -> destroy()
   * 
   * Subclasses must implement:
   *   - renderBody() - Returns HTML string for card body content
   * 
   * Subclasses may override:
   *   - init() - Setup logic (call super.init())
   *   - update(data) - Handle data updates
   *   - destroy() - Cleanup (call super.destroy())
   *   - getStatusText() - Returns text for card header status/meta area
   */
  class BaseCard {
    /**
     * @param {Object} config
     * @param {string} config.id - DOM element ID (e.g., 'comm-card-location')
     * @param {string} config.title - Card title
     * @param {string} [config.statusId] - ID for status element in header
     * @param {string} [config.metaId] - ID for meta element in header
     * @param {string} [config.bodyId] - ID for body element (defaults to {id}-body)
     */
    constructor(config) {
      this.id = config.id;
      this.title = config.title;
      this.statusId = config.statusId || null;
      this.metaId = config.metaId || null;
      this.bodyId = config.bodyId || `${config.id.replace('comm-card-', 'comm-')}-body`;

      this.element = null;
      this.bodyElement = null;
      this.statusElement = null;
      this.metaElement = null;

      this._eventUnsubs = [];
      this._intervals = [];
      this._timeouts = [];

      this.state = {};
    }

    /**
     * Initialize the card - bind DOM elements, setup event listeners
     * Call super.init() if overriding
     */
    init() {
      this.element = document.getElementById(this.id);
      if (!this.element) {
        console.warn(`[${this.constructor.name}] Element #${this.id} not found`);
        return;
      }

      this.bodyElement = document.getElementById(this.bodyId) || 
                         this.element.querySelector('.comm-card-body');
      
      if (this.statusId) {
        this.statusElement = document.getElementById(this.statusId);
      }
      if (this.metaId) {
        this.metaElement = document.getElementById(this.metaId);
      }

      this.render();
      Layout.observeCard(this.element);

      console.log(`[${this.constructor.name}] Initialized`);
    }

    /**
     * Render the card body
     * Calls renderBody() which subclasses must implement
     */
    render() {
      if (!this.bodyElement) return;

      const html = this.renderBody();
      if (html !== null && html !== undefined) {
        this.bodyElement.innerHTML = html;
      }

      this.afterRender();
      this.updateStatus();
      Layout.queue();
    }

    /**
     * Called after render() completes - use to bind event listeners to rendered elements
     * Override in subclass, no need to call super
     */
    afterRender() {
      // Override in subclass
    }

    /**
     * Return HTML string for card body
     * MUST be implemented by subclass
     * @returns {string} HTML content
     */
    renderBody() {
      throw new Error(`${this.constructor.name} must implement renderBody()`);
    }

    /**
     * Update card with new data
     * @param {*} data - Update payload
     */
    update(data) {
      // Override in subclass
    }

    /**
     * Update the status/meta display in card header
     */
    updateStatus() {
      const statusText = this.getStatusText();
      if (this.statusElement && statusText !== null) {
        this.statusElement.textContent = statusText;
      }

      const metaText = this.getMetaText();
      if (this.metaElement && metaText !== null) {
        if (typeof metaText === 'string') {
          this.metaElement.innerHTML = metaText;
        }
      }
    }

    /**
     * Get status text for header
     * Override in subclass
     * @returns {string|null}
     */
    getStatusText() {
      return null;
    }

    /**
     * Get meta text/HTML for header
     * Override in subclass
     * @returns {string|null}
     */
    getMetaText() {
      return null;
    }

    /**
     * Subscribe to a CommDashboard event (auto-cleanup on destroy)
     * @param {string} event 
     * @param {Function} callback 
     */
    on(event, callback) {
      const unsub = Events.on(event, callback);
      this._eventUnsubs.push(unsub);
      return unsub;
    }

    /**
     * Emit a CommDashboard event
     * @param {string} event 
     * @param {*} data 
     * @param {boolean} sticky 
     */
    emit(event, data, sticky = false) {
      Events.emit(event, data, sticky);
    }

    /**
     * Set an interval (auto-cleanup on destroy)
     * @param {Function} fn 
     * @param {number} ms 
     * @returns {number} Interval ID
     */
    setInterval(fn, ms) {
      const id = window.setInterval(fn, ms);
      this._intervals.push(id);
      return id;
    }

    /**
     * Set a timeout (auto-cleanup on destroy)
     * @param {Function} fn 
     * @param {number} ms 
     * @returns {number} Timeout ID
     */
    setTimeout(fn, ms) {
      const id = window.setTimeout(fn, ms);
      this._timeouts.push(id);
      return id;
    }

    /**
     * Query within this card's element
     * @param {string} selector 
     * @returns {Element|null}
     */
    $(selector) {
      return this.element?.querySelector(selector) || null;
    }

    /**
     * Query all within this card's element
     * @param {string} selector 
     * @returns {Element[]}
     */
    $$(selector) {
      return this.element ? Array.from(this.element.querySelectorAll(selector)) : [];
    }

    /**
     * Show the card
     */
    show() {
      this.element?.classList.remove('comm-hidden');
      Layout.queue();
    }

    /**
     * Hide the card
     */
    hide() {
      this.element?.classList.add('comm-hidden');
      Layout.queue();
    }

    /**
     * Check if card is visible
     * @returns {boolean}
     */
    isVisible() {
      return this.element ? !this.element.classList.contains('comm-hidden') : false;
    }

    /**
     * Cleanup - remove event listeners, clear intervals
     * Call super.destroy() if overriding
     */
    destroy() {
      this._eventUnsubs.forEach(unsub => unsub());
      this._eventUnsubs = [];

      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];

      this._timeouts.forEach(id => clearTimeout(id));
      this._timeouts = [];

      console.log(`[${this.constructor.name}] Destroyed`);
    }

    // ============================================================
    // Static Helper Methods (available to all cards)
    // ============================================================

    /**
     * Create a metric row HTML
     */
    static metricHtml(label, value, hint, icon) {
      return `
        <div class="comm-weather-metric"${hint ? ` data-hint="${escapeHtml(hint)}"` : ''}>
          <span class="icon">${icon || ''}</span>
          <div class="metric-text">
            <span class="label">${escapeHtml(label)}</span>
            <span class="value">${escapeHtml(value)}</span>
          </div>
        </div>
      `;
    }

    /**
     * Create a status pill HTML
     */
    static statusPillHtml(text, className = '') {
      return `<span class="status-pill ${escapeHtml(className)}">${escapeHtml(text)}</span>`;
    }

    /**
     * Create card footer HTML with source attribution
     */
    static footerHtml(sourceText, links = []) {
      const linkHtml = links.map(l => 
        `<a class="inline-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`
      ).join(' · ');

      return `
        <div class="comm-card-micro comm-card-footer">
          ${linkHtml ? `Source: ${linkHtml} • ` : ''}${escapeHtml(sourceText)}
        </div>
      `;
    }

    /**
     * Create a placeholder HTML
     */
    static placeholderHtml(text) {
      return `<p class="comm-placeholder">${escapeHtml(text)}</p>`;
    }
  }

  // Export
  window.CommDashboard.BaseCard = BaseCard;

})();
