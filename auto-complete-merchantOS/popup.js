document.addEventListener('DOMContentLoaded', function() {
    // Check API key status
    chrome.storage.sync.get(['apiKey'], function(result) {
      const status = document.getElementById('apiStatus');
      if (!result.apiKey) {
        status.textContent = 'Please configure your API key to use the extension.';
        status.className = 'status warning';
      } else {
        status.textContent = 'Extension is ready to use.';
        status.className = 'status success';
      }
    });
  
    // Options page link
    document.getElementById('optionsLink').addEventListener('click', function() {
      chrome.runtime.openOptionsPage();
    });
  });