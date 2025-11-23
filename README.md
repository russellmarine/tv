# Russell TV - Modular Architecture

## Overview
Russell TV has been refactored into a modular, component-based architecture. Each module handles a specific responsibility and can be modified independently without affecting other parts of the system.

## File Structure

```
/
├── index.html                      # Minimal HTML structure
├── css/
│   ├── russelltv-styles.css       # All visual styling
│   └── grid-pro.css               # Grid enhancement styles
├── js/
│   ├── app.js                     # Application bootstrap
│   ├── storage.js                 # LocalStorage management
│   ├── player-single.js           # Single-view player
│   ├── player-grid.js             # Grid-view player
│   ├── ui-controls.js             # Buttons and UI elements
│   ├── view-manager.js            # View switching logic
│   ├── mobile-ui.js               # Mobile-specific features
│   ├── news.js                    # News headlines
│   ├── grid-state.js              # Grid cell state persistence
│   ├── keyboard-controls.js       # Keyboard shortcuts
│   └── grid-pro.js                # Advanced grid features
└── config/
    ├── channels.js                # Channel definitions
    ├── news-config.js             # News feed configuration
    ├── time-config.js             # Time display config
    ├── weather-config.js          # Weather config
    └── info-bar.js                # Info bar setup
```

## Core Modules

### 1. storage.js
**Purpose:** LocalStorage operations
**API:**
- `RussellTV.Storage.saveLastChannel(key)`
- `RussellTV.Storage.loadLastChannel()`
- `RussellTV.Storage.saveLastView(view)`
- `RussellTV.Storage.loadLastView()`

**Dependencies:** None
**Used by:** view-manager.js, player-single.js

### 2. player-single.js
**Purpose:** Single-channel video playback
**API:**
- `RussellTV.SinglePlayer.play(channelKey)`
- `RussellTV.SinglePlayer.stop()`
- `RussellTV.SinglePlayer.getCurrentChannel()`

**Dependencies:** storage.js, HLS.js, channels.js
**Used by:** view-manager.js

### 3. player-grid.js
**Purpose:** Multi-cell grid video playback
**API:**
- `RussellTV.GridPlayer.playCell(cell, channelKey)`
- `RussellTV.GridPlayer.stopAll()`
- `RussellTV.GridPlayer.stopCell(cell)`
- `RussellTV.GridPlayer.loadDefaults()`

**Dependencies:** HLS.js, channels.js
**Used by:** view-manager.js, ui-controls.js, grid-state.js

### 4. ui-controls.js
**Purpose:** UI component creation and management
**API:**
- `RussellTV.UIControls.buildChannelButtons()`
- `RussellTV.UIControls.buildGrid()`
- `RussellTV.UIControls.highlightButton(key)`
- `RussellTV.UIControls.clearButtonHighlights()`

**Dependencies:** channels.js, view-manager.js
**Used by:** app.js

### 5. view-manager.js
**Purpose:** View state and switching logic
**API:**
- `RussellTV.ViewManager.showSingle(channelKey)`
- `RussellTV.ViewManager.showGrid()`
- `RussellTV.ViewManager.getCurrentView()`
- `RussellTV.ViewManager.initButtons()`

**Dependencies:** storage.js, player-single.js, player-grid.js, ui-controls.js
**Used by:** app.js, ui-controls.js, mobile-ui.js

### 6. mobile-ui.js
**Purpose:** Mobile-specific UI features
**API:**
- `RussellTV.MobileUI.initChannelDropdown()`
- `RussellTV.MobileUI.initTicker()`

**Dependencies:** view-manager.js, channels.js
**Used by:** app.js

### 7. app.js
**Purpose:** Application initialization and bootstrap
**No public API** - self-executing initialization

**Dependencies:** All core modules
**Used by:** None (entry point)

## Module Loading Order

The modules must be loaded in this order (already configured in index.html):

1. **External Dependencies**
   - HLS.js

2. **Configuration**
   - channels.js
   - time-config.js
   - weather-config.js
   - news-config.js

3. **Core Modules** (order matters)
   - storage.js
   - player-single.js
   - player-grid.js
   - ui-controls.js
   - view-manager.js
   - mobile-ui.js

4. **Features** (order doesn't matter)
   - news.js
   - grid-state.js
   - keyboard-controls.js
   - grid-pro.js
   - info-bar.js

5. **Bootstrap**
   - app.js

## Adding New Features

To add a new feature:

1. Create a new JS file in `/js/`
2. Use the module pattern:
```javascript
window.RussellTV = window.RussellTV || {};

window.RussellTV.MyFeature = (function() {
  'use strict';
  
  // Private variables and functions
  
  // Public API
  return {
    publicMethod1: function() {},
    publicMethod2: function() {}
  };
})();
```

3. Add the script tag to index.html in the "Features" section
4. Access other modules via `window.RussellTV.ModuleName.method()`

## Benefits of This Architecture

### ✅ **Separation of Concerns**
Each module has a single, clear responsibility

### ✅ **Independent Development**
Modify one module without touching others

### ✅ **Easy Testing**
Test each module in isolation

### ✅ **Maintainability**
Find and fix bugs quickly in the relevant module

### ✅ **Scalability**
Add new features without bloating existing code

### ✅ **Reusability**
Modules can be reused in other projects

### ✅ **Clean HTML**
index.html is now just 85 lines (vs 750+ before)

## Migration from Old Version

If you're using the old monolithic `index.html`:

1. Replace index.html with `index-refactored.html`
2. Move `/css/russelltv-styles.css` to your css directory
3. Move all the new JS modules to your `/js/` directory
4. Keep your existing config files - they still work

Your existing external files (news.js, grid-state.js, keyboard-controls.js, etc.) remain unchanged and will work with the new architecture.

## Debugging

To debug a specific module, add this to your browser console:
```javascript
// Check if module loaded
console.log(window.RussellTV.Storage);
console.log(window.RussellTV.SinglePlayer);

// Check current state
console.log(window.RussellTV.ViewManager.getCurrentView());
console.log(window.RussellTV.SinglePlayer.getCurrentChannel());
```

## Performance Notes

- Each module is wrapped in an IIFE (Immediately Invoked Function Expression) to prevent global scope pollution
- Modules only expose public methods, keeping internals private
- No circular dependencies - clean dependency tree
- Lazy initialization where appropriate
