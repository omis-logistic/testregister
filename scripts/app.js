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
    
    // Validate inputs
    validateTrackingNumber(formData.get('trackingNumber'));
    validatePhoneNumber(formData.get('phone'));
    validateQuantity(formData.get('quantity'));
    validatePrice(formData.get('price'));
    validateFiles(
      formData.get('itemCategory'),
      formData.getAll('files')
    );

    const payload = {
      trackingNumber: formData.get('trackingNumber'),
      phone: formData.get('phone'),
      itemDescription: formData.get('itemDescription'),
      quantity: formData.get('quantity'),
      price: formData.get('price'),
      collectionPoint: formData.get('collectionPoint'),
      itemCategory: formData.get('itemCategory'),
      files: await processFiles(formData.getAll('files'))
    };

    console.log('Validated Payload:', payload);
    submitViaJsonp(payload);
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    console.error('Submission Error:', error);
  }
}

function validateTrackingNumber(value) {
  if (!/^[A-Za-z0-9\-]+$/.test(value)) {
    throw new Error('Tracking number contains invalid characters');
  }
  
  if (value.startsWith('-') || value.endsWith('-')) {
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

function validateFiles(category, files) {
  const starredCategories = [
    '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
    '*Gadgets', '*Oil Ointment', '*Supplement'
  ];
  
  if (starredCategories.includes(category)) {
    if (files.length < 1) throw new Error('At least 1 file required');
    if (files.length > 3) throw new Error('Maximum 3 files allowed');
  }
  
  files.forEach(file => {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error(`File ${file.name} exceeds 5MB limit`);
    }
  });
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
    document.body.removeChild(script);
    delete window[callbackName];
    
    if (response.success) {
      showMessage(response.message, 'success');
      document.getElementById('declarationForm').reset();
    } else {
      showMessage(response.error || 'Submission failed', 'error');
    }
  };

  const params = new URLSearchParams({
    ...payload,
    files: JSON.stringify(payload.files),
    callback: callbackName
  });

  script.src = `${CONFIG.GAS_URL}?${params}`;
  script.onerror = () => {
    showMessage('Connection failed', 'error');
    document.body.removeChild(script);
  };
  
  document.body.appendChild(script);
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
