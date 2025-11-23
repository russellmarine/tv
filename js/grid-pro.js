// Professional Grid System for RussellTV
// Includes: Smart layouts, focus mode, solo audio, professional UI

(function() {
    'use strict';

    // Grid configuration
    const GRID_LAYOUTS = {
        '1x2': { rows: 1, cols: 2, cells: 2, label: '2 Wide' },
        '2x2': { rows: 2, cols: 2, cells: 4, label: '4 Square' },
        '1x3': { rows: 1, cols: 3, cells: 3, label: '3 Wide' },
        '2x3': { rows: 2, cols: 3, cells: 6, label: '6 Grid' },
        '1x4': { rows: 1, cols: 4, cells: 4, label: '4 Wide' }
    };

    let currentLayout = '2x2';
    let focusedCell = null;
    let audioCell = 1; // Which cell has audio active

    // Replace the grid button with a dropdown version
    function replaceGridButton() {
        const gridBtn = document.getElementById('btn-grid');
        if (!gridBtn) return;

        // Create container for button + dropdown
        const container = document.createElement('div');
        container.className = 'grid-btn-container';
        container.style.position = 'relative';
        container.style.display = 'inline-block';

        // Create the main button
        const mainBtn = document.createElement('button');
        mainBtn.id = 'btn-grid-main';
        mainBtn.className = 'btn';
        const config = GRID_LAYOUTS[currentLayout];
        mainBtn.textContent = `Grid: ${config.label}`;
        
        // Create dropdown arrow button
        const dropdownBtn = document.createElement('button');
        dropdownBtn.className = 'btn grid-dropdown-toggle';
        dropdownBtn.innerHTML = '▼';
        dropdownBtn.style.padding = '0.35rem 0.5rem';
        dropdownBtn.style.marginLeft = '-1px';

        // Create dropdown menu
        const dropdown = document.createElement('div');
        dropdown.className = 'grid-layout-dropdown';

        Object.entries(GRID_LAYOUTS).forEach(([key, config]) => {
            const option = document.createElement('div');
            option.className = 'grid-layout-option';
            option.textContent = config.label;
            option.dataset.layout = key;
            
            if (key === currentLayout) {
                option.classList.add('active');
            }
            
            option.onclick = () => {
                // First, switch to grid view if not already there
                const gridView = document.getElementById('grid-view');
                if (gridView && gridView.style.display === 'none') {
                    if (window.enterGridMode) {
                        window.enterGridMode();
                    }
                }
                
                // Then change the layout
                changeLayout(key);
                dropdown.classList.remove('show');
                mainBtn.textContent = `Grid: ${config.label}`;
                
                // Update active state
                dropdown.querySelectorAll('.grid-layout-option').forEach(o => {
                    o.classList.remove('active');
                });
                option.classList.add('active');
            };
            
            dropdown.appendChild(option);
        });

        // Toggle dropdown
        dropdownBtn.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        };

        // Main button enters grid mode
        mainBtn.onclick = () => {
            if (window.enterGridMode) {
                window.enterGridMode();
            }
        };

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
        });

        container.appendChild(mainBtn);
        container.appendChild(dropdownBtn);
        container.appendChild(dropdown);

        // Replace the old button
        gridBtn.parentNode.replaceChild(container, gridBtn);
    }

    // Change grid layout
    function changeLayout(layoutKey) {
        if (!GRID_LAYOUTS[layoutKey]) return;
        
        currentLayout = layoutKey;
        const config = GRID_LAYOUTS[layoutKey];
        
        focusedCell = null; // Reset focus when changing layouts
        
        rebuildGrid(config);
        
        // Save layout preference
        try {
            localStorage.setItem('russelltv.gridLayout', layoutKey);
        } catch (e) {}
    }

    // Rebuild grid with new layout
    function rebuildGrid(config) {
        const wrapper = document.querySelector('#grid-view .grid-wrapper');
        if (!wrapper) return;

        // Stop all current streams
        stopAllGridCells();

        // Set data attribute for CSS sizing
        wrapper.setAttribute('data-layout', currentLayout);

        // Remove old grid styles
        wrapper.style.gridTemplateColumns = '';
        wrapper.style.gridTemplateRows = '';
        
        // Clear and rebuild cells
        wrapper.innerHTML = '';

        for (let cell = 1; cell <= config.cells; cell++) {
            const cellDiv = createGridCell(cell);
            wrapper.appendChild(cellDiv);
        }

        // Load channels immediately after DOM update
        setTimeout(() => loadDefaultChannelsForLayout(config.cells), 100);
    }

    // Create a professional grid cell
    function createGridCell(cellNum) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell-pro';
        cell.dataset.cell = cellNum;
        
        if (cellNum === audioCell) {
            cell.classList.add('audio-active');
        }

        // Header with custom channel selector
        const header = document.createElement('div');
        header.className = 'grid-cell-header';

        // Audio indicator
        const audioBtn = document.createElement('button');
        audioBtn.className = 'grid-audio-btn';
        audioBtn.innerHTML = cellNum === audioCell ? '🔊' : '🔇';
        audioBtn.title = 'Click to make this cell the audio source';
        audioBtn.onclick = () => setAudioCell(cellNum);
        header.appendChild(audioBtn);

        // Custom channel selector
        const selector = createChannelSelector(cellNum);
        header.appendChild(selector);

        // Focus button
        const focusBtn = document.createElement('button');
        focusBtn.className = 'grid-focus-btn';
        focusBtn.innerHTML = '⛶';
        focusBtn.title = 'Focus this cell';
        focusBtn.onclick = () => toggleFocus(cellNum);
        header.appendChild(focusBtn);

        cell.appendChild(header);

        // Video container
        const body = document.createElement('div');
        body.className = 'grid-cell-body';

        const frame = document.createElement('div');
        frame.className = 'grid-cell-frame';

        // HLS video element
        const video = document.createElement('video');
        video.id = `grid-video-${cellNum}`;
        video.autoplay = true;
        video.muted = (cellNum !== audioCell);
        video.controls = false;
        video.playsInline = true;
        video.setAttribute('playsinline', '');

        // YouTube container
        const ytDiv = document.createElement('div');
        ytDiv.id = `grid-yt-${cellNum}`;
        ytDiv.className = 'yt-container';
        ytDiv.style.display = 'none';
        ytDiv.style.background = 'transparent';

        frame.appendChild(video);
        frame.appendChild(ytDiv);
        body.appendChild(frame);
        cell.appendChild(body);

        return cell;
    }

    // Create professional channel selector
    function createChannelSelector(cellNum) {
        const container = document.createElement('div');
        container.className = 'channel-selector-pro';

        const button = document.createElement('button');
        button.className = 'channel-selector-btn';
        button.textContent = 'Select Channel';
        button.dataset.cell = cellNum;

        const dropdown = document.createElement('div');
        dropdown.className = 'channel-dropdown';

        if (window.CHANNELS) {
            Object.entries(window.CHANNELS).forEach(([key, channel]) => {
                const option = document.createElement('div');
                option.className = 'channel-option';
                option.textContent = channel.label;
                option.dataset.channel = key;
                
                option.onclick = (e) => {
                    e.stopPropagation();
                    selectChannel(cellNum, key, channel.label);
                    dropdown.classList.remove('show');
                };
                
                dropdown.appendChild(option);
            });
        }

        button.onclick = (e) => {
            e.stopPropagation();
            
            // Close all other dropdowns
            document.querySelectorAll('.channel-dropdown.show').forEach(d => {
                if (d !== dropdown) d.classList.remove('show');
            });
            
            dropdown.classList.toggle('show');
        };

        container.appendChild(button);
        container.appendChild(dropdown);

        return container;
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.channel-dropdown.show').forEach(d => {
            d.classList.remove('show');
        });
    });

    // Select a channel for a cell
    function selectChannel(cellNum, channelKey, channelLabel) {
        console.log(`selectChannel: cell=${cellNum}, channel=${channelKey}`);
        
        const cell = document.querySelector(`[data-cell="${cellNum}"]`);
        if (!cell) {
            console.error(`Cell ${cellNum} not found`);
            return;
        }

        const btn = cell.querySelector('.channel-selector-btn');
        if (btn) {
            btn.textContent = channelLabel;
        }

        // Save selection
        saveGridChannelSelection(cellNum, channelKey);

        // Use the original index.html playGridCell function
        if (typeof window.playGridCell === 'function') {
            console.log(`Using window.playGridCell for cell ${cellNum}`);
            window.playGridCell(cellNum, channelKey);
        } else {
            console.error('window.playGridCell not found!');
        }

        // Update audio after playback starts
        setTimeout(() => updateAudioStates(), 200);
    }

    // Save grid channel selections
    function saveGridChannelSelection(cellNum, channelKey) {
        try {
            const key = `russelltv.gridCell${cellNum}`;
            localStorage.setItem(key, channelKey);
        } catch (e) {}
    }

    // Load saved grid channel selections
    function loadSavedGridSelections(numCells) {
        const savedSelections = {};
        for (let i = 1; i <= numCells; i++) {
            try {
                const key = `russelltv.gridCell${i}`;
                const saved = localStorage.getItem(key);
                if (saved) {
                    savedSelections[i] = saved;
                }
            } catch (e) {}
        }
        return savedSelections;
    }

    // Set which cell has audio
    function setAudioCell(cellNum) {
        console.log(`Setting audio cell to ${cellNum}`);
        audioCell = cellNum;
        
        // Save audio cell preference
        try {
            localStorage.setItem('russelltv.audioCell', cellNum);
        } catch (e) {}
        
        // Update all audio buttons and mute states
        document.querySelectorAll('.grid-cell-pro').forEach(cell => {
            const num = parseInt(cell.dataset.cell);
            const audioBtn = cell.querySelector('.grid-audio-btn');
            
            if (num === audioCell) {
                cell.classList.add('audio-active');
                if (audioBtn) audioBtn.innerHTML = '🔊';
            } else {
                cell.classList.remove('audio-active');
                if (audioBtn) audioBtn.innerHTML = '🔇';
            }
        });

        // Force update audio states
        updateAudioStates();
    }

    // Update mute state on all video elements
    function updateAudioStates() {
        console.log(`Updating audio, active cell: ${audioCell}`);
        
        for (let i = 1; i <= 9; i++) {
            const video = document.getElementById(`grid-video-${i}`);
            if (video) {
                video.muted = (i !== audioCell);
            }

            // Update YouTube players
            if (window.YT_PLAYERS && window.YT_PLAYERS[`grid-${i}`]) {
                try {
                    if (i === audioCell) {
                        window.YT_PLAYERS[`grid-${i}`].unMute();
                        window.YT_PLAYERS[`grid-${i}`].setVolume(100);
                    } else {
                        window.YT_PLAYERS[`grid-${i}`].mute();
                    }
                } catch (e) {}
            }
        }
    }

    // Toggle focus mode
    function toggleFocus(cellNum) {
        const wrapper = document.querySelector('#grid-view .grid-wrapper');
        if (!wrapper) return;

        if (focusedCell === cellNum) {
            // Exit focus mode
            focusedCell = null;
            wrapper.classList.remove('focus-mode');
            document.querySelectorAll('.grid-cell-pro').forEach(cell => {
                cell.classList.remove('focused', 'unfocused');
            });
        } else {
            // Enter focus mode
            focusedCell = cellNum;
            wrapper.classList.add('focus-mode');
            
            document.querySelectorAll('.grid-cell-pro').forEach(cell => {
                const num = parseInt(cell.dataset.cell);
                if (num === cellNum) {
                    cell.classList.add('focused');
                    cell.classList.remove('unfocused');
                } else {
                    cell.classList.add('unfocused');
                    cell.classList.remove('focused');
                }
            });
        }
    }

    // Load default channels for layout
    function loadDefaultChannelsForLayout(numCells) {
        const defaults = window.GRID_DEFAULTS || {};
        const savedSelections = loadSavedGridSelections(numCells);
        
        console.log('Loading channels for', numCells, 'cells');
        
        // Shorter delays for faster loading
        for (let i = 1; i <= numCells; i++) {
            const channelKey = savedSelections[i] || defaults[i];
            
            if (channelKey && window.CHANNELS && window.CHANNELS[channelKey]) {
                // Much faster - just stagger by 150ms each
                setTimeout(() => {
                    const cell = document.querySelector(`[data-cell="${i}"]`);
                    if (cell && window.CHANNELS[channelKey]) {
                        selectChannel(i, channelKey, window.CHANNELS[channelKey].label);
                    }
                }, i * 150);
            }
        }
    }

    // Stop all grid cells
    function stopAllGridCells() {
        // Stop HLS instances
        if (window.hlsGrid) {
            Object.values(window.hlsGrid).forEach(hls => {
                if (hls) hls.destroy();
            });
        }

        // Stop YouTube players
        if (window.YT_PLAYERS) {
            Object.keys(window.YT_PLAYERS).forEach(key => {
                if (key.startsWith('grid-')) {
                    try {
                        window.YT_PLAYERS[key].destroy();
                    } catch (e) {}
                }
            });
        }
    }

    // Keyboard shortcuts for layouts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        const gridView = document.getElementById('grid-view');
        if (!gridView || gridView.style.display === 'none') return;

        // Layout shortcuts (when in grid mode)
        const layoutMap = {
            '2': '1x2',
            '4': '2x2',
            '3': '1x3',
            '6': '2x3',
            'u': '1x4',
            'U': '1x4'
        };

        if (layoutMap[e.key]) {
            e.preventDefault();
            changeLayout(layoutMap[e.key]);
            
            // Update selector
            const mainBtn = document.getElementById('btn-grid-main');
            if (mainBtn) {
                const config = GRID_LAYOUTS[layoutMap[e.key]];
                mainBtn.textContent = `Grid: ${config.label}`;
            }
        }

        // F key for focus mode
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            toggleFocus(focusedCell || 1);
        }

        // A key to cycle audio between cells
        if (e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            const config = GRID_LAYOUTS[currentLayout];
            const nextCell = (audioCell % config.cells) + 1;
            setAudioCell(nextCell);
        }
    });

    // Initialize when grid button is clicked
    const originalEnterGridMode = window.enterGridMode;
    window.enterGridMode = function() {
        if (originalEnterGridMode) originalEnterGridMode();
        
        // Initialize professional grid on first load
        if (!document.querySelector('.grid-cell-pro')) {
            const config = GRID_LAYOUTS[currentLayout];
            rebuildGrid(config);
        } else {
            // Grid already exists, just make sure defaults are loaded
            const config = GRID_LAYOUTS[currentLayout];
            loadDefaultChannelsForLayout(config.cells);
        }
    };

    // Initialize
    window.addEventListener('load', () => {
        replaceGridButton();
        
        // Load saved preferences
        try {
            const savedLayout = localStorage.getItem('russelltv.gridLayout');
            if (savedLayout && GRID_LAYOUTS[savedLayout]) {
                currentLayout = savedLayout;
            }
            
            const savedAudioCell = localStorage.getItem('russelltv.audioCell');
            if (savedAudioCell) {
                audioCell = parseInt(savedAudioCell);
            }
        } catch (e) {}
        
        // Check if grid visible on startup
        setTimeout(() => {
            const gridView = document.getElementById('grid-view');
            if (gridView && gridView.style.display !== 'none') {
                const config = GRID_LAYOUTS[currentLayout];
                if (!document.querySelector('.grid-cell-pro')) {
                    rebuildGrid(config);
                }
            }
        }, 300);
    });

})();
