// Debug logging functionality
function debugLog(message, data = null) {
    // No-op in production
    return;
}

// Global variables
const MERCHANTOS_FIELDS = {
    // Screen 1 selectors
    street_address: 'input[placeholder="Mailing Address"], input[placeholder="Address"]',  // Handle both forms
    street_address2: 'input[placeholder="Mailing Address cont."], input[placeholder="Address 2"]',
    city: 'input[placeholder="City"]',
    state: 'input[placeholder="State"]',
    country: 'select:has(option[value="Country"])',  // Handles country dropdown
    postal_code: 'input[placeholder="Zip"], input[placeholder="ZIP"]'  // Handle both Zip/ZIP
};

let activeInput = null;
let autocompleteDropdown = null;
let debounceTimer = null;
let errorNotification = null;

// Initialization functions
function initializeExtension() {
    debugLog('Starting extension initialization...');
    
    try {
        initializeAutocomplete();
        setupMutationObserver();
        debugLog('✅ Extension initialization complete');
    } catch (error) {
        console.error('Error initializing extension:', error);
    }
}

function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                const addressInput = document.querySelector(MERCHANTOS_FIELDS.street_address);
                if (addressInput && !addressInput.hasAttribute('data-autocomplete-initialized')) {
                    debugLog('Found new address field, initializing...');
                    initializeAutocomplete();
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function initializeAutocomplete() {
    // Try both possible address input fields
    const addressInput = document.querySelector('input[placeholder="Mailing Address"]') || 
                        document.querySelector('input[placeholder="Address"]');
                        
    if (!addressInput) {
        debugLog('Address input not found');
        return;
    }

    // Clean up any existing listeners
    cleanupExistingListeners();

    // Mark the input as initialized
    addressInput.setAttribute('data-autocomplete-initialized', 'true');
    
    // Add event listeners
    addressInput.addEventListener('input', handleInput);
    addressInput.addEventListener('focus', handleInput);
    
    // Add document-level click listener for dropdown
    document.addEventListener('click', (e) => {
        if (autocompleteDropdown && 
            !autocompleteDropdown.contains(e.target) && 
            e.target !== activeInput) {
            hideDropdown();
        }
    });

    // Add window resize listener
    window.addEventListener('resize', () => {
        if (autocompleteDropdown && autocompleteDropdown.style.display !== 'none') {
            positionDropdown(activeInput);
        }
    });
    
    debugLog('✅ Address field initialized');
}
function cleanupExistingListeners() {
    const addressInput = document.querySelector(MERCHANTOS_FIELDS.street_address);
    if (addressInput) {
        addressInput.removeEventListener('input', handleInput);
        addressInput.removeEventListener('focus', handleInput);
    }
}

// UI Helper functions
function hideDropdown() {
    if (autocompleteDropdown) {
        autocompleteDropdown.style.display = 'none';
        autocompleteDropdown.innerHTML = ''; // Clear contents
        document.body.removeChild(autocompleteDropdown); // Remove from DOM
        autocompleteDropdown = null; // Reset the reference
    }
    activeInput = null;
}

function createAutocompleteDropdown() {
    const dropdown = document.createElement('div');
    dropdown.className = 'maps-autocomplete-dropdown';
    dropdown.style.cssText = `
        position: absolute;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 10000;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        display: none;
    `;
    document.body.appendChild(dropdown);
    return dropdown;
}

function positionDropdown(input) {
    if (!autocompleteDropdown || !input) return;
    
    const rect = input.getBoundingClientRect();
    autocompleteDropdown.style.top = `${rect.bottom + window.scrollY}px`;
    autocompleteDropdown.style.left = `${rect.left + window.scrollX}px`;
    autocompleteDropdown.style.width = `${rect.width}px`;
}

// Event Handlers
async function handleInput(e) {
    const input = e.target;
    activeInput = input;

    if (!autocompleteDropdown) {
        autocompleteDropdown = createAutocompleteDropdown();
    }

    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    const value = input.value.trim();
    if (value.length < 3) {
        hideDropdown();
        return;
    }

    // Check if input matches a prediction
    const predictions = autocompleteDropdown.querySelectorAll('.autocomplete-item');
    for (const pred of predictions) {
        if (pred.textContent === value) {
            hideDropdown();
            return;
        }
    }

    debounceTimer = setTimeout(async () => {
        try {
            const apiKey = await new Promise(resolve => 
                chrome.storage.sync.get(['apiKey'], result => resolve(result.apiKey))
            );

            if (!apiKey) {
                showError('Google Address Autocomplete is not configured. Please contact support.');
                return;
            }

            const response = await new Promise(resolve => 
                chrome.runtime.sendMessage({
                    action: 'GET_PLACE_PREDICTIONS',
                    input: value,
                    apiKey: apiKey
                }, resolve)
            );

            if (!response.success) {
                showError('Unable to get address suggestions. Please try typing the address manually.');
                return;
            }

            displayPredictions(response.predictions);
        } catch (error) {
            showError('Unable to get address suggestions. Please try typing the address manually.');
        }
    }, 300);
}

function displayPredictions(predictions) {
    if (!activeInput || !autocompleteDropdown) return;

    autocompleteDropdown.innerHTML = '';
    
    if (predictions.length === 0) {
        hideDropdown();
        return;
    }

    predictions.forEach(prediction => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
        `;
        div.textContent = prediction.description;
        
        div.addEventListener('mouseenter', () => {
            div.style.backgroundColor = '#f5f5f5';
        });
        
        div.addEventListener('mouseleave', () => {
            div.style.backgroundColor = 'white';
        });
        
        div.addEventListener('click', () => handlePredictionSelect(prediction));
        
        autocompleteDropdown.appendChild(div);
    });

    positionDropdown(activeInput);
    autocompleteDropdown.style.display = 'block';
}

async function handlePredictionSelect(prediction) {
    // Hide dropdown immediately and stop any pending timers
    hideDropdown();
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    
    try {
        const apiKey = await new Promise(resolve => 
            chrome.storage.sync.get(['apiKey'], result => resolve(result.apiKey))
        );

        if (!apiKey) {
            showError('Google Address Autocomplete is not configured. Please contact support.');
            return;
        }

        const response = await new Promise(resolve => 
            chrome.runtime.sendMessage({
                action: 'GET_PLACE_DETAILS',
                placeId: prediction.place_id,
                apiKey: apiKey
            }, resolve)
        );

        if (!response.success) {
            showError('Unable to fill address details. Please try entering the address manually.');
            return;
        }

        // Hide dropdown again before filling fields (in case it somehow got shown)
        hideDropdown();
        fillFormFields(response.details.address_components);
        // And one final time after filling fields
        hideDropdown();
    } catch (error) {
        showError('Unable to fill address details. Please try entering the address manually.');
    }
}

// Form Field Management
function fillFormFields(components) {
    let addressComponents = {
        street_number: '',
        route: '',
        subpremise: '',
        locality: '',
        administrative_area_level_1: '',
        country: '',
        postal_code: ''
    };

    components.forEach(component => {
        component.types.forEach(type => {
            if (addressComponents.hasOwnProperty(type)) {
                addressComponents[type] = component.long_name;
            }
        });
    });

    const streetAddress = `${addressComponents.street_number} ${addressComponents.route}`.trim();
    setFieldValue(MERCHANTOS_FIELDS.street_address, streetAddress);

    if (addressComponents.subpremise) {
        setFieldValue(MERCHANTOS_FIELDS.street_address2, `Suite ${addressComponents.subpremise}`);
    }

    setFieldValue(MERCHANTOS_FIELDS.city, addressComponents.locality);
    setFieldValue(MERCHANTOS_FIELDS.state, addressComponents.administrative_area_level_1);
    setFieldValue(MERCHANTOS_FIELDS.postal_code, addressComponents.postal_code);

    const countrySelect = document.querySelector(MERCHANTOS_FIELDS.country);
    if (countrySelect) {
        const countryOption = Array.from(countrySelect.options)
            .find(option => option.text === addressComponents.country);
        if (countryOption) {
            countrySelect.value = countryOption.value;
            countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}

function setFieldValue(selector, value) {
    // Try to find the element using multiple possible selectors
    const selectors = selector.split(', ');
    let element = null;
    
    for (const sel of selectors) {
        element = document.querySelector(sel);
        if (element) break;
    }

    if (element && value) {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// Error Notification Management
function createErrorNotification() {
    const notification = document.createElement('div');
    notification.className = 'maps-autocomplete-error';
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #fff;
        border-left: 4px solid #dc3545;
        border-radius: 4px;
        padding: 12px 20px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 10000;
        max-width: 300px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        display: none;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    return notification;
}

function showError(message, duration = 5000) {
    if (!errorNotification) {
        errorNotification = createErrorNotification();
    }
    
    errorNotification.innerHTML = `
        <div>${message}</div>
        <button onclick="this.parentElement.style.display='none'" style="
            position: absolute;
            right: 8px;
            top: 8px;
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #666;
            padding: 0 5px;
        ">×</button>
    `;
    
    errorNotification.style.display = 'block';
    
    if (duration) {
        setTimeout(() => {
            if (errorNotification) {
                errorNotification.style.display = 'none';
            }
        }, duration);
    }
}

// Add styles
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .maps-autocomplete-error {
        animation: slideIn 0.3s ease-out;
    }
`;
document.head.appendChild(styleSheet);

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}

// Backup initialization
window.addEventListener('load', () => {
    setTimeout(initializeExtension, 1000);
});