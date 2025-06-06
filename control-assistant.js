// Control Assistant Script

// Initialize as soon as the script loads
console.log('Control Assistant: Script loaded');

// Use a more reliable way to wait for the page to be ready
function waitForPageToLoad() {
  console.log('Control Assistant: Waiting for page to load...');
  
  // Check if the body is ready
  if (document.body) {
    console.log('Control Assistant: Body is ready, initializing...');
    setTimeout(initControlAssistant, 2000); // Still give a little time for dynamic content
  } else {
    console.log('Control Assistant: Body not ready yet, waiting...');
    setTimeout(waitForPageToLoad, 500);
  }
}

// Start waiting for the page to load
waitForPageToLoad();

function initControlAssistant() {
  console.log('Control Assistant: Initializing...');
  
  // Create the UI elements
  createControlAssistantUI();
  
  // Initial fetch of goods list
  fetchGoodsList();
  
  // Set up scroll event listener to refresh goods list
  window.addEventListener('scroll', debounce(fetchGoodsList, 300));
  
  console.log('Control Assistant: Initialized');
}

// Store the currently pinned product (only one product can be auto-explained at a time)
let pinnedProduct = null; // Format: { productId, title, price, imageUrl, originalButton }

function createControlAssistantUI() {
  // Create toggle button
  const toggleButton = document.createElement('div');
  toggleButton.className = 'control-assistant-toggle';
  toggleButton.innerHTML = '中控助手';
  toggleButton.title = '打开/关闭中控助手';
  document.body.appendChild(toggleButton);
  
  toggleButton.addEventListener('click', toggleControlAssistantPanel);
  
  // Create panel
  const panel = document.createElement('div');
  panel.id = 'controlAssistantPanel';
  panel.className = 'control-assistant-panel';
  panel.innerHTML = `
    <div class="control-assistant-header">
      <h2>中控助手</h2>
      <div class="control-assistant-close">×</div>
    </div>
    <div class="control-assistant-settings">
      <div class="control-assistant-setting">
        <label for="explainInterval">讲解间隔 (秒):</label>
        <input type="number" id="explainInterval" min="1" max="60" value="${explainInterval}">
        <button id="saveSettings" class="control-assistant-btn">保存</button>
      </div>
      <div id="controlAssistantStatus" class="control-assistant-status">状态: 就绪</div>
    </div>
    <div class="control-assistant-pinned-products">
      <h3>正在讲解的商品</h3>
      <ul id="pinnedProductsList" class="control-assistant-pinned-list">
        <li style="text-align: center; padding: 10px; color: #999;">没有正在讲解的商品</li>
      </ul>
    </div>
    <div class="control-assistant-goods">
      <h3>商品列表</h3>
      <ul id="controlAssistantGoodsList" class="control-assistant-goods-list"></ul>
    </div>
  `;
  document.body.appendChild(panel);
  
  // Set up event listeners
  document.querySelector('.control-assistant-close').addEventListener('click', toggleControlAssistantPanel);
  
  // Save settings button
  const saveSettingsBtn = document.getElementById('saveSettings');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveSettings);
  }

  pinnedProduct = null;
}

function toggleControlAssistantPanel() {
  const panel = document.getElementById('controlAssistantPanel');
  if (panel.classList.contains('hidden')) {
    panel.classList.remove('hidden');
    panel.classList.add('visible');
  } else {
    panel.classList.remove('visible');
    panel.classList.add('hidden');
  }
}

// Store the current explain interval
let currentExplainInterval = null; // Format: { productId, interval, button, originalButton }
let explainButtons = [];
let explainInterval = 5; // Default interval in seconds

// Product ID map to track products by their IDs
let productIdMap = {}; // Format: { productId: { index, button } }

// Function to save settings
function saveSettings() {
  const intervalInput = document.getElementById('explainInterval');
  if (intervalInput) {
    const newInterval = parseInt(intervalInput.value);
    if (!isNaN(newInterval) && newInterval >= 1 && newInterval <= 60) {
      explainInterval = newInterval;
      
      // Update active interval if exists
      if (currentExplainInterval) {
        const { productId, button, originalButton } = currentExplainInterval;
        clearInterval(currentExplainInterval.interval);
        
        // Find the index of the button in explainButtons array
        let buttonIndex = -1;
        for (let i = 0; i < explainButtons.length; i++) {
          if (explainButtons[i] === originalButton) {
            buttonIndex = i;
            break;
          }
        }
        
        if (buttonIndex !== -1) {
          startExplainInterval(productId, buttonIndex, button);
        }
      }
      
      const statusEl = document.getElementById('controlAssistantStatus');
      if (statusEl) {
        statusEl.textContent = `状态: 已保存设置 (间隔: ${explainInterval}秒)`;
        setTimeout(() => {
          statusEl.textContent = '状态: 就绪';
        }, 2000);
      }
    }
  }
}

// Function to stop auto-explain for a product
function stopAutoExplain(productId) {
  console.log(`Stopping auto-explain for product ${productId}`);
  
  if (currentExplainInterval && currentExplainInterval.productId === productId) {
    // Stop the interval
    clearInterval(currentExplainInterval.interval);
    currentExplainInterval = null;
    
    // Clear the pinned product
    clearPinnedProduct();
    
    // Update the button in the main list if it exists
    const mainListButton = document.querySelector(`#controlAssistantGoodsList [data-product-id="${productId}"] .control-assistant-explain-btn`);
    if (mainListButton) {
      mainListButton.textContent = '自动讲解';
      mainListButton.classList.remove('active');
    }
  }
}

// Function to toggle auto-explain for a specific product
function toggleProductAutoExplain(productId, index, button) {
  console.log(`Toggling auto-explain for product ${productId}`);
  
  // Check if this product already has an interval running
  if (currentExplainInterval && currentExplainInterval.productId === productId) {
    // Stop auto-explain
    stopAutoExplain(productId);
  } else {
    // Stop any existing auto-explain first
    if (currentExplainInterval) {
      stopAutoExplain(currentExplainInterval.productId);
    }
    
    // Get product data
    const goodsItem = button.closest('.control-assistant-goods-item');
    if (!goodsItem) return;
    
    const title = goodsItem.querySelector('.control-assistant-goods-title').textContent;
    const price = goodsItem.querySelector('.control-assistant-goods-price').textContent;
    const imageEl = goodsItem.querySelector('.control-assistant-goods-image');
    const imageUrl = imageEl ? imageEl.src : '';
    
    // Start the interval
    startExplainInterval(productId, index, button);
    button.textContent = '讲解中...';
    button.classList.add('active');
    
    // Set as the pinned product
    setPinnedProduct(productId, title, price, imageUrl, explainButtons[index]);
  }
}

// Function to set the pinned product (only one at a time)
function setPinnedProduct(productId, title, price, imageUrl, originalButton) {
  console.log(`Setting pinned product to ${productId}`);
  
  // If there's already a pinned product, stop its auto-explain first
  if (pinnedProduct) {
    stopAutoExplain(pinnedProduct.productId);
  }
  
  // Store the product data
  pinnedProduct = {
    productId,
    title,
    price,
    imageUrl,
    originalButton
  };
  
  // Update the pinned product display
  updatePinnedProductDisplay();
}

// Function to clear the pinned product
function clearPinnedProduct() {
  console.log('Clearing pinned product');
  
  // Clear the product data
  pinnedProduct = null;
  
  // Update the pinned product display
  updatePinnedProductDisplay();
}

// Function to update the pinned product display
function updatePinnedProductDisplay() {
  const pinnedList = document.getElementById('pinnedProductsList');
  
  if (!pinnedList) return;
  
  // Clear the list
  pinnedList.innerHTML = '';
  
  // If no pinned product, show a message
  if (!pinnedProduct) {
    pinnedList.innerHTML = '<li style="text-align: center; padding: 10px; color: #999;">没有正在讲解的商品</li>';
    return;
  }
  
  // Add the pinned product to the list
  const listItem = document.createElement('li');
  listItem.className = 'control-assistant-goods-item';
  listItem.setAttribute('data-product-id', pinnedProduct.productId);
  
  listItem.innerHTML = `
    <img class="control-assistant-goods-image" src="${pinnedProduct.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iMjUiIHk9IjI1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}" loading="lazy" alt="${pinnedProduct.title}">
    <div class="control-assistant-goods-info">
      <h3 class="control-assistant-goods-title">${pinnedProduct.title}</h3>
      <div class="control-assistant-goods-action-row">
        <div class="control-assistant-goods-price">${pinnedProduct.price}</div>
        <button class="control-assistant-btn control-assistant-btn-primary control-assistant-explain-btn active" data-product-id="${pinnedProduct.productId}">
          取消讲解
        </button>
      </div>
    </div>
  `;
  
  pinnedList.appendChild(listItem);
  
  // Add event listener to the pinned product's button
  const button = listItem.querySelector('.control-assistant-explain-btn');
  if (button) {
    button.addEventListener('click', function() {
      const productId = this.getAttribute('data-product-id');
      stopAutoExplain(productId);
    });
  }
}

// Function to move a product to the top of our list
function moveProductToTop(productId) {
  const goodsList = document.getElementById('controlAssistantGoodsList');
  if (!goodsList) return;
  
  // Find the item with this product ID
  const item = goodsList.querySelector(`[data-product-id="${productId}"]`);
  if (item && goodsList.firstChild) {
    // Move it to the top of the list
    goodsList.insertBefore(item, goodsList.firstChild);
    
    // Add a highlight effect
    item.classList.add('highlight');
    setTimeout(() => {
      item.classList.remove('highlight');
    }, 1000);
  }
}

// Function to start an explain interval for a specific product
function startExplainInterval(productId, index, button) {
  if (!explainButtons[index]) {
    console.error(`No explain button found at index ${index}`);
    return;
  }
  
  // Cache the original button DOM object
  const originalButton = explainButtons[index];
  
  // Create a new interval
  const intervalId = setInterval(() => {
    // Try to click the cached original button first
    let buttonClicked = false;
    
    // Try to use the button from pinnedProducts if available
    const cachedButton = pinnedProduct ? pinnedProduct.originalButton : originalButton;
    
    try {
      console.log(`Auto-clicking explain button for product ${productId}`);
      cachedButton.click();
      buttonClicked = true;
    } catch (e) {
      console.error('Error clicking cached button:', e);
      
      // If the cached button is no longer valid, try to find it again by index
      if (explainButtons[index]) {
        try {
          explainButtons[index].click();
          buttonClicked = true;
        } catch (e2) {
          console.error('Error clicking current button:', e2);
        }
      }
    }
    
    // If both attempts failed, try the event dispatch method
    if (!buttonClicked) {
      try {
        // Try alternative method
        const evt = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        
        if (cachedButton && cachedButton.isConnected) {
          cachedButton.dispatchEvent(evt);
          buttonClicked = true;
        } else if (explainButtons[index]) {
          explainButtons[index].dispatchEvent(evt);
          buttonClicked = true;
        }
      } catch (e3) {
        console.error('Error dispatching event:', e3);
      }
    }
    
    // If all attempts failed, check if we need to stop the interval
    if (!buttonClicked) {
      // We don't stop the interval just because the button isn't found
      // The pinned product section will continue to show and try to click the button
      console.log(`Could not click button for product ${productId}, will try again next interval`);
    }
  }, explainInterval * 1000);
  
  // Store the current interval information
  currentExplainInterval = {
    productId,
    interval: intervalId,
    button: button,
    originalButton: originalButton
  };
}

function fetchGoodsList() {
  //console.log('Fetching goods list...');
  
  // Make sure our panel exists before trying to update it
  if (!document.getElementById('controlAssistantPanel')) {
    console.log('Control Assistant panel not found, recreating UI...');
    createControlAssistantUI();
    return; // Return and wait for the next call after UI is created
  }
  
  // Find the goods list container
  const goodsListContainer = document.getElementById('live-control-goods-list-container');
  
  if (!goodsListContainer) {
    console.log('Goods list container not found, trying alternative selectors...');
    // Try to find the container using alternative selectors
    const possibleContainers = document.querySelectorAll('[class*="goods-list"]');
    if (possibleContainers.length > 0) {
      console.log(`Found ${possibleContainers.length} possible containers`);
    } else {
      console.log('No goods list containers found');
      updateControlAssistantGoodsList([]); // Update with empty list
      return;
    }
  }
  
  // Find all goods items
  let goodsItems = document.querySelectorAll('.rpa_lc__live-goods__goods-item');
  
  if (!goodsItems || goodsItems.length === 0) {
    console.log('No goods items found with primary selector, trying alternative selectors...');
    // Try to find goods items using alternative selectors
    goodsItems = document.querySelectorAll('[class*="goods-item"]');
    if (goodsItems.length === 0) {
      console.log('No goods items found with any selector');
      updateControlAssistantGoodsList([]); // Update with empty list
      return;
    } else {
      console.log(`Found ${goodsItems.length} possible items with alternative selector`);
    }
  }
  
  // Find all explain buttons - more specific selector
  explainButtons = [];
  
  // Find all divs with class containing 'goodsAction-JcGBoH'
  const actionDivs = document.querySelectorAll('[class*="goodsAction-JcGBoH"]');
  
  // Find buttons inside these divs with text content exactly equal to '讲解'
  actionDivs.forEach(div => {
    div.querySelectorAll('button').forEach(button => {
      if (button.textContent.includes('讲解')) {
        //console.log('Found explain button:', button);
        explainButtons.push(button);
      }
    });
  });
  
  //console.log(`Found ${explainButtons.length} explain buttons`);
  
  // Update our UI with the goods list
  updateControlAssistantGoodsList(goodsItems);
}

function updateControlAssistantGoodsList(goodsItems) {
  const goodsList = document.getElementById('controlAssistantGoodsList');
  
  // Check if goodsList exists
  if (!goodsList) {
    console.error('Control Assistant: Goods list element not found');
    return;
  }
  
  if (!goodsItems || goodsItems.length === 0) {
    goodsList.innerHTML = '<li style="text-align: center; padding: 20px;">未找到商品</li>';
    return;
  }
  
  // Clear the list
  goodsList.innerHTML = '';
  
  // Reset the product ID map
  productIdMap = {};
  
  // Add each goods item to our list
  Array.from(goodsItems).forEach((item, index) => {
    // Optimize image loading
    const imageEl = item.querySelector('img');
    let imageUrl = '';
    if (imageEl) {
      // Use a smaller size image if possible by modifying the URL
      imageUrl = imageEl.src;
      // Remove any existing size parameters and add our own
      imageUrl = imageUrl.replace(/~\d+x\d+\.image/, '~100x100.image');
    }
    
    if (imageUrl.startsWith('data:image')) {
      // skip this item if no image loading
      return;
    }

    // Extract the product ID from the data-rbd-draggable-id attribute
    let productId = item.getAttribute('data-rbd-draggable-id');
    if (!productId) {
      // Try to find it in a child element
      const draggableChild = item.querySelector('[data-rbd-draggable-id]');
      if (draggableChild) {
        productId = draggableChild.getAttribute('data-rbd-draggable-id');
      } else {
        // Generate a fallback ID if we can't find the attribute
        productId = `product-${index}-${Date.now()}`;
      }
    }
    
    // Store the mapping between product ID and index
    productIdMap[productId] = index;
    
    // Extract information from the goods item
    const title = extractText(item, '[class*="title"]') || `商品 ${index + 1}`;
    
    // Look for price in the goodsData class - first div child contains price
    let price = '价格未知';
    const goodsDataDiv = item.querySelector('[class*="goodsData"]');
    if (goodsDataDiv && goodsDataDiv.children && goodsDataDiv.children.length > 0) {
      // First child div contains price
      price = goodsDataDiv.children[0].textContent.trim();
    } else {
      // Fallback to generic price selector
      price = extractText(item, '[class*="price"]') || '价格未知';
    }
    
    // Get inventory, sales and conversion rate if available
    let inventory = '';
    
    if (goodsDataDiv && goodsDataDiv.children) {
      if (goodsDataDiv.children.length > 1) inventory = goodsDataDiv.children[1].textContent.trim();
    }
    
    // Create a new list item
    const listItem = document.createElement('li');
    listItem.className = 'control-assistant-goods-item';
    listItem.setAttribute('data-product-id', productId);
    
    // Check if this product is already being auto-explained
    const isAutoExplaining = currentExplainInterval && currentExplainInterval.productId === productId;
    const buttonClass = isAutoExplaining ? 'control-assistant-btn control-assistant-btn-primary control-assistant-explain-btn active' : 'control-assistant-btn control-assistant-btn-primary control-assistant-explain-btn';
    const buttonText = isAutoExplaining ? '讲解中...' : '自动讲解';
    
    listItem.innerHTML = `
      <img class="control-assistant-goods-image" src="${imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iMjUiIHk9IjI1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}" loading="lazy" alt="${title}">
      <div class="control-assistant-goods-info">
        <h3 class="control-assistant-goods-title">${title}</h3>
        <div class="control-assistant-goods-action-row">
          <div class="control-assistant-goods-price">${price}</div>
          <button class="${buttonClass}" data-index="${index}" data-product-id="${productId}">
            ${buttonText}
          </button>
        </div>
      </div>
    `;
    
    goodsList.appendChild(listItem);
  });
  
  // Add event listeners to the explain buttons - only target buttons in the main goods list
  document.querySelectorAll('#controlAssistantGoodsList .control-assistant-explain-btn').forEach(button => {
    button.addEventListener('click', function() {
      const index = parseInt(this.getAttribute('data-index'));
      const productId = this.getAttribute('data-product-id');
      
      console.log(`Toggle auto-explain for product ${productId} at index ${index}`, explainButtons[index]);
      
      if (explainButtons[index]) {
        // Toggle auto-explain for this product
        toggleProductAutoExplain(productId, index, this);
      } else {
        console.error(`No explain button found for product ${productId} at index ${index}`);
        // Refresh the goods list to try to find the buttons again
        fetchGoodsList();
      }
    });
  });
}

// Helper function to extract text from an element
function extractText(parentElement, selector) {
  const element = parentElement.querySelector(selector);
  return element ? element.textContent.trim() : null;
}

// Debounce function to limit how often a function can be called
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

// Mutation observer to detect DOM changes and refresh goods list
const observer = new MutationObserver(debounce(() => {
  //console.log('DOM changed, refreshing goods list...');
  fetchGoodsList();
}, 500));

// Start observing the document with the configured parameters
function startObserver() {
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('Control Assistant: Observer started');
  } else {
    console.log('Control Assistant: Body not available for observer, will retry');
    setTimeout(startObserver, 1000);
  }
}

// Start the observer when appropriate
startObserver();
