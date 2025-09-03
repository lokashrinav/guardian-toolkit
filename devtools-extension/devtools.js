// DevTools extension entry point
// Creates the "Baseline Check" panel in Chrome DevTools

chrome.devtools.panels.create(
  'Baseline Check',
  'icons/icon16.png',
  'panel.html',
  (panel) => {
    console.log('Baseline Check panel created');
    
    // Panel event handlers
    panel.onShown.addListener((window) => {
      console.log('Baseline panel shown');
      // Initialize panel when shown
      if (window.BaselinePanel) {
        window.BaselinePanel.initialize();
      }
    });
    
    panel.onHidden.addListener(() => {
      console.log('Baseline panel hidden');
    });
  }
);