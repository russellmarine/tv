// Keyboard Channel Switcher for RussellTV
(function() {
    'use strict';
    
    // Define channel mapping - EDIT THESE to match your buttons!
    const channelMap = {
        '1': 'cbs',
        '2': 'nbc',
        '3': 'fox',
        '4': 'bloomberg',
        '5': 'skynews',
        '6': 'trt'
    };

    document.addEventListener('keydown', function(event) {
        const key = event.key;
        
        // Don't trigger if typing in a text field
        if (event.target.tagName === 'INPUT' || 
            event.target.tagName === 'TEXTAREA') {
            return;
        }

        if (channelMap.hasOwnProperty(key)) {
            const channelId = channelMap[key];
            
            // Find the button multiple ways
            let channelButton = document.getElementById(channelId);
            
            if (!channelButton) {
                channelButton = document.querySelector(`[data-channel="${channelId}"]`);
            }
            
            if (!channelButton) {
                channelButton = document.querySelector(`button[onclick*="${channelId}"]`);
            }
            
            if (channelButton) {
                event.preventDefault();
                channelButton.click();
                flashButton(channelButton);
            }
        }
    });

    function flashButton(button) {
        const originalBg = button.style.backgroundColor;
        const originalTransform = button.style.transform;
        
        button.style.backgroundColor = '#ff6b35';
        button.style.transform = 'scale(1.1)';
        
        setTimeout(() => {
            button.style.backgroundColor = originalBg;
            button.style.transform = originalTransform;
        }, 200);
    }

})();
