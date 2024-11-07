const DEFAULT_HOSTS = [
    "https://maps.googleapis.com/*",
    "*://*.merchantos.com/*",
];

// Load hosts
function loadHostPermissions() {
    chrome.storage.sync.get(['hostPermissions'], function(result) {
        const textarea = document.getElementById('hostPermissions');
        const customHosts = result.hostPermissions || [];
        
        // Combine default and custom hosts
        const allHosts = [...DEFAULT_HOSTS, ...customHosts];
        
        // Set textarea value
        textarea.value = allHosts.join('\n');
    });
}

// Save hosts
function saveHostPermissions() {
    const textarea = document.getElementById('hostPermissions');
    const hostsText = textarea.value;
    
    // Split by newlines and filter empty lines
    const hosts = hostsText.split('\n')
        .map(host => host.trim())
        .filter(host => host !== '');
    
    // Remove default hosts from the list to be saved
    const customHosts = hosts.filter(host => !DEFAULT_HOSTS.includes(host));
    
    chrome.storage.sync.set({ hostPermissions: customHosts }, function() {
        showStatus('Settings saved successfully!', 'success');
    });
}

function showStatus(message, type = 'success', duration = 3000) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    setTimeout(() => {
        status.style.display = 'none';
    }, duration);
}

document.addEventListener('DOMContentLoaded', function() {
    // Load saved settings
    chrome.storage.sync.get(['apiKey', 'debugMode'], function(result) {
        if (result.apiKey) {
            document.getElementById('apiKey').value = result.apiKey;
        }
        if (result.debugMode) {
            document.getElementById('debugMode').checked = result.debugMode;
        }
    });

    // Load host permissions
    loadHostPermissions();

    // Save settings
    document.getElementById('save').addEventListener('click', function() {
        const apiKey = document.getElementById('apiKey').value;
        const debugMode = (document.getElementById('debugMode')?.checked) || false;
        const status = document.getElementById('status');

        if (!apiKey) {
            showStatus('Error: API key cannot be empty', 'error');
            return;
        }

        // Save API key and debug mode
        chrome.storage.sync.set({ 
            apiKey,
            debugMode 
        }, function() {
            showStatus('Settings saved successfully!', 'success');
        });

        // Save host permissions
        saveHostPermissions();
    });

    // Add Ctrl+S support for saving
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            document.getElementById('save').click();
        }
    });
});