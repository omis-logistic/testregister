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
    const files = formData.getAll('files');
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
    // Optional: Log to analytics service
    // logErrorToService(error);
  }
}

function validateTrackingNumber(value) {
  // Add null/empty check
  if (!value || typeof value !== 'string') {
    throw new Error('Tracking number is required');
  }

  // Trim whitespace
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

function validateFileSelection(input) {
  try {
    const files = Array.from(input.files);
    const category = document.getElementById('itemCategory').value;
    
    // Basic validation
    validateFileCount(category, files);
    validateFileSizes(files);
    
    // Show success feedback
    showMessage(`${files.length} valid files selected`, 'success');
    
  } catch (error) {
    showMessage(error.message, 'error');
    input.value = ''; // Clear invalid files
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

// Update processFiles function
async function processFiles(files) {
  return Promise.all(Array.from(files).map(async file => ({
    name: file.name,
    mimeType: file.type,  // Changed from 'type' to 'mimeType'
    data: await toBase64(file),
    size: file.size
  })));
}

// File processing
async function processFiles(files) {
  return Promise.all(files.map(async file => {
    if (!file.type) {
      throw new Error(`File ${file.name} has no type detected`);
    }
    return {
      name: file.name,
      type: file.type,  // Ensure this matches backend check
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

// JSONP submission
function submitViaJsonp(payload) {
  const callbackName = `gas_${Date.now()}`;
  const script = document.createElement('script');
  
  window[callbackName] = (response) => {
    cleanupJsonp(script, callbackName);
    if (response && response.success) {
      handleSuccess(response);
    } else {
      handleFailure(response);
    }
  };

  // Add retry mechanism
  script.onerror = () => {
    showMessage('Connection failed - retrying...', 'error');
    setTimeout(() => submitViaJsonp(payload), 2000);
  };
  
  // Encode parameters properly
  const params = new URLSearchParams({
    ...payload,
    files: JSON.stringify(payload.files),
    callback: callbackName
  }).toString().replace(/%2F/g, '/');

  script.src = `${CONFIG.GAS_URL}?${params}`;
  document.body.appendChild(script);
}

function handleSuccess(response) {
  showMessage(response.message, 'success');
  console.log('Submission successful:', response);
  document.getElementById('declarationForm').reset();
}

function handleFailure(response) {
  const errorMessage = response?.error || 'Unknown server error';
  showMessage(`Submission failed: ${errorMessage}`, 'error');
  console.error('Submission failed:', response);
}

function handleGasResponse(response) {
  console.log('GAS Response:', response);
  if (response.success) {
    showMessage(response.message, 'success');
    document.getElementById('declarationForm').reset();
  } else {
    throw new Error(response.error || 'Server error');
  }
}

function cleanupJsonp(script, callbackName) {
  document.body.removeChild(script);
  delete window[callbackName];
}

// Error handling
function handleSubmissionError(error) {
  console.error('Submission Error:', error);
  showMessage(`Error: ${error.message}`, 'error');
}

// UI functions
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

// Debug utilities
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
