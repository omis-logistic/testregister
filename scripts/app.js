// scripts/app.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('Document ready - initializing form');
  initializeForm();
  checkConfig();
});

function initializeForm() {
  const form = document.getElementById('declarationForm');
  if (!form) {
    console.error('Error: Form element not found');
    return;
  }

  form.addEventListener('submit', handleFormSubmit);
  console.log('Form event listener attached');
}

function checkConfig() {
  if (typeof CONFIG === 'undefined' || !CONFIG.GAS_URL) {
    showMessage('Configuration error: GAS endpoint not defined', 'error');
    console.error('Missing CONFIG:', CONFIG);
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  showMessage('Submitting...', 'pending');

  try {
    const formData = new FormData(form);
    
    // Get and validate tracking number first
    const trackingNumber = formData.get('trackingNumber') || '';
    validateTrackingNumber(trackingNumber);

    // Get and validate phone number
    const phone = formData.get('phone') || '';
    validatePhoneNumber(phone);

    // Validate quantity
    const quantity = formData.get('quantity') || '';
    validateQuantity(quantity);

    // Validate price
    const price = formData.get('price') || '';
    validatePrice(price);

    // Validate files
    const itemCategory = formData.get('itemCategory') || '';
    const files = Array.from(formData.getAll('files') || []);
    validateFiles(itemCategory, files);

    // Process files and build payload
    const processedFiles = await processFiles(files);
    
    const payload = {
      trackingNumber: trackingNumber.trim(),
      phone: phone.trim(),
      itemDescription: (formData.get('itemDescription') || '').trim(),
      quantity: quantity,
      price: price,
      collectionPoint: formData.get('collectionPoint'),
      itemCategory: itemCategory,
      files: processedFiles
    };

    console.log('Validated Payload:', payload);
    submitViaJsonp(payload);

  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    console.error('Submission Error:', error);
  }
}

function validateTrackingNumber(value) {
  if (!value || typeof value !== 'string') {
    throw new Error('Tracking number is required');
  }

  const trimmedValue = value.trim();
  
  if (trimmedValue.length === 0) {
    throw new Error('Tracking number cannot be empty');
  }

  if (!/^[A-Za-z0-9\-]+$/.test(trimmedValue)) {
    throw new Error('Tracking number contains invalid characters');
  }
  
  if (trimmedValue.startsWith('-') || trimmedValue.endsWith('-')) {
    throw new Error('Tracking number cannot start/end with hyphen');
  }
}

function validatePhoneNumber(phone) {
  if (!/^\d{6,15}$/.test(phone)) {
    throw new Error('Phone number must contain 6-15 digits');
  }
}

function validateQuantity(quantity) {
  const num = Number(quantity);
  if (!Number.isInteger(num) || num < 1) {
    throw new Error('Quantity must be a whole number ≥ 1');
  }
}

function validatePrice(price) {
  const num = Number(price);
  if (isNaN(num) || num < 0) {
    throw new Error('Price must be a positive number');
  }
}

function handleFileSelection(input) {
  try {
    const files = Array.from(input.files || []);
    const category = document.getElementById('itemCategory').value;
    
    validateFileCount(category, files);
    validateFileSizes(files);
    
    showMessage(`${files.length} valid files selected`, 'success');
    
  } catch (error) {
    showMessage(error.message, 'error');
    input.value = '';
  }
}

function validateFileCount(category, files) {
  const starredCategories = [
    '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
    '*Gadgets', '*Oil Ointment', '*Supplement'
  ];
  
  if (starredCategories.includes(category)) {
    if (files.length < 1) throw new Error('At least 1 file required');
    if (files.length > 3) throw new Error('Maximum 3 files allowed');
  }
}

function validateFileSizes(files) {
  files.forEach(file => {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error(`File ${file.name} exceeds 5MB limit`);
    }
  });
}

function validateFiles(category, files) {
  const fileList = Array.isArray(files) ? files : [];
  const starredCategories = [
    '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
    '*Gadgets', '*Oil Ointment', '*Supplement'
  ];

  if (starredCategories.includes(category)) {
    if (fileList.length < 1) throw new Error('At least 1 file required');
    if (fileList.length > 3) throw new Error('Maximum 3 files allowed');
  }

  fileList.forEach(file => {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error(`File ${file.name} exceeds 5MB limit`);
    }
  });
}

async function processFiles(files) {
  return Promise.all(Array.from(files).map(async file => {
    return {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      data: await toBase64(file),
      size: file.size
    };
  }));
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

function submitViaJsonp(payload) {
  const callbackName = `gas_${Date.now()}`;
  const script = document.createElement('script');
  let isScriptActive = true;
  const MAX_URL_LENGTH = 2000; // Conservative browser limit
  const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB per file

  // 1. Payload validation and cleanup system
  const safeCleanup = () => {
    try {
      if (isScriptActive && script.parentNode === document.body) {
        document.body.removeChild(script);
      }
      isScriptActive = false;
      delete window[callbackName];
    } catch (cleanupError) {
      console.warn('Cleanup error:', cleanupError);
    }
  };

  // 2. Response handler with error shielding
  window[callbackName] = (response) => {
    try {
      safeCleanup();
      
      if (!response) {
        throw new Error('Server response empty');
      }

      if (response.success) {
        showMessage(response.message, 'success');
        document.getElementById('declarationForm').reset();
      } else {
        const cleanError = (response.error || 'Unknown error')
          .replace(/[^a-zA-Z0-9 .,:-]/g, '')
          .substring(0, 100);
        showMessage(`Failed: ${cleanError}`, 'error');
      }
    } catch (handlerError) {
      console.error('Response handling failed:', handlerError);
      showMessage('Submission processing error', 'error');
    }
  };

  // 3. Core submission logic
  try {
    // Validate payload structure
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid submission data');
    }

    // Pre-process files
    const optimizedFiles = [];
    let totalSize = 0;

    payload.files.forEach((file, index) => {
      // Validate individual files
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File ${index + 1} exceeds 3MB limit`);
      }
      if (file.data.length > MAX_FILE_SIZE * 1.37) { // Base64 overhead
        throw new Error(`File ${index + 1} encoded data too large`);
      }

      optimizedFiles.push({
        n: file.name.substring(0, 50), // Trim long filenames
        t: file.mimeType,
        d: file.data,
        s: file.size
      });
      totalSize += file.data.length;
    });

    // Size validation
    if (totalSize > 5 * 1024 * 1024) { // 5MB total limit
      throw new Error('Total files exceed 5MB combined limit');
    }

    // Build compressed payload
    const params = new URLSearchParams({
      // Core data
      tn: payload.trackingNumber.substring(0, 50),
      ph: payload.phone,
      qt: payload.quantity,
      pc: payload.price,
      cp: payload.collectionPoint,
      ct: payload.itemCategory,
      
      // Compressed files
      fl: encodeURIComponent(JSON.stringify(optimizedFiles)),
      
      // System
      cb: callbackName,
      v: '1.2' // API version
    });

    // URL length check
    const finalURL = `${CONFIG.GAS_URL}?${params}`;
    if (finalURL.length > MAX_URL_LENGTH) {
      throw new Error(`Submission too large (${finalURL.length} chars)`);
    }

    // Script handling
    script.src = finalURL;
    script.onload = () => safeCleanup();
    script.onerror = () => {
      showMessage('Network error - please try again', 'error');
      safeCleanup();
    };

    // Safe execution
    document.body.appendChild(script);

  } catch (error) {
    safeCleanup();
    showMessage(`Submission blocked: ${error.message}`, 'error');
    console.error('Submission validation failed:', {
      error,
      payload: payload ? {
        ...payload,
        files: payload.files?.map(f => f.name)
      } : null
    });
  }

  // Add timeout cleanup
  setTimeout(() => {
    if (isScriptActive) {
      showMessage('Submission timeout - check connection', 'error');
      safeCleanup();
    }
  }, 15000); // 15-second timeout
}
  
function handleGasResponse(response) {
  if (response?.success) {
    showMessage(response.message, 'success');
    document.getElementById('declarationForm').reset();
  } else {
    const errorMessage = response?.error || 'Unknown server error';
    showMessage(`Submission failed: ${errorMessage}`, 'error');
  }
}

function cleanupJsonp(script, callbackName) {
  document.body.removeChild(script);
  delete window[callbackName];
}

function showMessage(text, type) {
  const messageDiv = document.getElementById('message');
  if (!messageDiv) {
    console.error('Message container not found');
    return;
  }

  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;

  clearTimeout(messageDiv.timeout);
  messageDiv.timeout = setTimeout(() => {
    messageDiv.textContent = '';
    messageDiv.className = 'message';
  }, type === 'error' ? 8000 : 5000);
}

window.debugForm = {
  testSubmission: () => {
    const testPayload = {
      trackingNumber: 'TEST-123',
      phone: '1234567890',
      itemDescription: 'Test Item',
      quantity: '2',
      price: '19.99',
      collectionPoint: 'Rimba',
      itemCategory: 'Clothing',
      files: []
    };
    submitViaJsonp(testPayload);
  }
};
