let placesService = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'INIT_PLACES_SERVICE') {
        // Initialize service with API key
        sendResponse({ success: true });
    } 
    else if (request.action === 'GET_PLACE_PREDICTIONS') {
        fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(request.input)}&key=${request.apiKey}&types=address`)
            .then(response => response.json())
            .then(data => {
                sendResponse({ success: true, predictions: data.predictions });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    else if (request.action === 'GET_PLACE_DETAILS') {
        fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${request.placeId}&key=${request.apiKey}&fields=address_component,formatted_address`)
            .then(response => response.json())
            .then(data => {
                sendResponse({ success: true, details: data.result });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});