# RussellTV Event-Driven Architecture

## Overview

This is a complete rewrite using an event-driven architecture. No more polling, no more race conditions, no more random delays.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        russelltv-core.js                            │
│                    (Event Bus + Storage + Utils)                    │
│                                                                     │
│   Events.emit() ◄────────────────────────────► Events.on()          │
│   Events.whenReady()  (for sticky events)                           │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ 'core:ready' (sticky)
                                 ▼
         ┌───────────────────────┴───────────────────────┐
         │                                               │
         ▼                                               ▼
┌─────────────────────┐                    ┌─────────────────────────┐
│    info-bar.js      │                    │   space-weather.js      │
│  (Time & Weather)   │                    │   (NOAA Data Fetch)     │
│                     │                    │                         │
│ Emits:              │                    │ Emits:                  │
│ • 'infobar:ready'   │                    │ • 'spaceweather:        │
│ • 'infobar:rendered'│                    │    data-updated'        │
└─────────────────────┘                    └─────────────────────────┘
         │                                               │
         │ 'infobar:ready' (sticky)                      │
         ▼                                               │
┌─────────────────────────────┐                          │
│ space-weather-infobar.js    │◄─────────────────────────┘
│ (HF/GPS/SAT Indicators)     │   listens for data updates
│                             │
│ Emits:                      │
│ • 'spaceweather:ready'      │
└─────────────────────────────┘
         │
         │ 'spaceweather:ready' (sticky)
         ▼
┌─────────────────────┐       ┌─────────────────────────┐
│ feature-toggles.js  │       │  propagation-panel.js   │
│ (Settings Panel)    │       │  (Detailed Forecasts)   │
│                     │       │                         │
│ Emits:              │       │ Emits:                  │
│ • 'feature:toggle'  │       │ • 'propagation:ready'   │
│ • 'features:ready'  │       │                         │
└─────────────────────┘       └─────────────────────────┘
```

## Event Flow

1. **Page Load**
   - `russelltv-core.js` loads → emits `core:ready`

2. **Info Bar Creation**
   - `info-bar.js` receives `core:ready` → creates bar → emits `infobar:ready`

3. **Space Weather Data**
   - `space-weather.js` receives `core:ready` → fetches NOAA data → emits `spaceweather:data-updated`

4. **Indicators Creation**
   - `space-weather-infobar.js` receives `infobar:ready` → creates indicators → emits `spaceweather:ready`

5. **Features & Panel**
   - `feature-toggles.js` receives `spaceweather:ready` → applies saved states
   - `propagation-panel.js` receives `spaceweather:ready` → creates panel

## Key Concepts

### Sticky Events
Events marked as `sticky` are remembered. If a listener subscribes after the event fired, they receive it immediately:

```javascript
// This works even if 'infobar:ready' already fired
Events.whenReady('infobar:ready', () => {
  // Called immediately if already fired, or when it fires
});
```

### No More Polling
Instead of:
```javascript
// OLD - BAD
setInterval(() => {
  const el = document.getElementById('something');
  if (el) doSomething();
}, 500);
```

We now use:
```javascript
// NEW - GOOD
Events.whenReady('something:ready', () => {
  doSomething();
});
```

### Feature Toggle Events
When a feature is toggled, an event is emitted that any module can listen to:

```javascript
Events.on('feature:toggle', ({ feature, enabled }) => {
  if (feature === 'my-feature') {
    myElement.style.display = enabled ? 'block' : 'none';
  }
});
```

## Script Load Order

**CRITICAL**: Load scripts in this order in your HTML:

```html
<!-- 1. Core (MUST be first) -->
<script src="/js/russelltv-core.js"></script>

<!-- 2. Config files (needed by other modules) -->
<script src="/config/time-zones.js"></script>
<script src="/config/weather-config.js"></script>
<script src="/config/space-weather-config.js"></script>

<!-- 3. Modules (order doesn't matter thanks to events) -->
<script src="/js/info-bar.js"></script>
<script src="/js/space-weather.js"></script>
<script src="/js/space-weather-infobar.js"></script>
<script src="/js/propagation-panel.js"></script>
<script src="/js/feature-toggles.js"></script>
```

## File Summary

| File | Purpose | Size |
|------|---------|------|
| `russelltv-core.js` | Event bus, storage, utilities | ~4KB |
| `info-bar.js` | Bottom bar with time/weather | ~8KB |
| `space-weather.js` | NOAA data fetching | ~4KB |
| `space-weather-infobar.js` | HF/GPS/SAT indicators | ~7KB |
| `propagation-panel.js` | Detailed forecast panel | ~8KB |
| `feature-toggles.js` | Settings panel & state | ~9KB |

## Debug Mode

Enable debug logging to see all events in console:

```javascript
RussellTV.Events.setDebug(true);
```

You'll see:
```
📢 [RTV] Emit "core:ready"
📡 [RTV] Subscribed to "infobar:ready"
📢 [RTV] Emit "infobar:ready" {bar: div#info-bar}
📡 [RTV] "infobar:ready" already fired, calling immediately
...
```

## Migration from Old Code

### Files to Remove
- `storage.js` (merged into core)

### Files to Replace
- `info-bar.js` → new version
- `space-weather.js` → new version
- `space-weather-infobar.js` → new version
- `propagation-panel.js` → new version
- `feature-toggles.js` → new version

### New File to Add
- `russelltv-core.js` (load FIRST)

## Adding New Features

To add a new feature that depends on the info bar:

```javascript
(function() {
  const Events = window.RussellTV.Events;

  function init(data) {
    const bar = data.bar;
    // Create your elements
    // Emit your ready event
    Events.emit('myfeature:ready', null, { sticky: true });
  }

  // Wait for info bar
  Events.whenReady('infobar:ready', init);
})();
```

## Benefits

1. **Deterministic** - Events guarantee order
2. **No race conditions** - Sticky events handle timing
3. **Modular** - Each file is independent
4. **Debuggable** - Debug mode shows event flow
5. **Extensible** - Easy to add new features
6. **Fast** - No polling, instant response
