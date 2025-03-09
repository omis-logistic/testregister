// scripts/app.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed');
  initializeForm();
  checkConfig();
});

function initializeForm() {
  const form = document.getElementById('declarationForm');
  if (!form) {
    console.error('Form element not found');
    return;
  }

  form.addEventListener('submit', handleSubmit);
  console.log('Form event listener attached');
}

function checkConfig() {
  if (typeof CONFIG === 'undefined' || !CONFIG.GAS_URL) {
    showMessage('Configuration error: GAS URL not defined', 'error');
    console.error('CONFIG object:', CONFIG);
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  console.log('Submit event triggered');
  
  const form = e.target;
  const formData = new FormData(form);
  const payload = {};
  
  try {
    // Convert FormData to object and validate
    for (const [key, value] of formData.entries()) {
      payload[key] = value;
      console.log(`Form field [${key}]:`, value);
    }

    // Validate required fields
    validateTrackingNumber(payload.trackingNumber);
    validatePhoneNumber(payload.phone);
    validateQuantity(payload.quantity);
    validatePrice(payload.price);
    validateCategoryFiles(payload.itemCategory, formData.getAll('files'));

    // Process files
    payload.files = await processFiles(formData.getAll('files'));
    
    // Show loading state
    showMessage('Submitting...', 'pending');
    
    // Send to GAS
    const response = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(payload),
      credentials: 'omit'
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('GAS response:', result);

    if (result.success) {
      showMessage(result.message, 'success');
      form.reset();
    } else {
      throw new Error(result.error || 'Unknown server error');
    }
  } catch (error) {
    console.error('Submission error:', error);
    showMessage(`Error: ${error.message}`, 'error');
  }
}

// Validation functions
function validateTrackingNumber(value) {
  if (!/^[A-Za-z0-9-]+$/.test(value)) {
    throw new Error('Invalid tracking number format. Only letters, numbers, and hyphens allowed.');
  }
}

function validatePhoneNumber(value) {
  if (!/^\d{6,}$/.test(value)) {
    throw new Error('Phone number must contain at least 6 digits');
  }
}

function validateQuantity(value) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) {
    throw new Error('Quantity must be a whole number greater than 0');
  }
}

function validatePrice(value) {
  const num = Number(value);
  if (isNaN(num) || num < 0) {
    throw new Error('Price must be a valid positive number');
  }
}

function validateCategoryFiles(category, files) {
  const starredCategories = [
    '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
    '*Gadgets', '*Oil Ointment', '*Supplement'
  ];

  if (starredCategories.includes(category)) {
    if (files.length < 1) throw new Error('At least 1 file upload required for this category');
    if (files.length > 3) throw new Error('Maximum 3 files allowed');
  }
}

// File processing
async function processFiles(files) {
  const processed = [];
  for (const file of files) {
    try {
      const data = await toBase64(file);
      processed.push({
        name: file.name,
        mimeType: file.type,
        data: data
      });
    } catch (error) {
      console.error('File processing error:', error);
      throw new Error(`Failed to process file: ${file.name}`);
    }
  }
  return processed;
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

// UI functions
function showMessage(text, type) {
  const messageDiv = document.getElementById('message');
  if (!messageDiv) {
    console.error('Message div not found');
    return;
  }

  messageDiv.textContent = text;
  messageDiv.className = `message-${type}`;
  
  // Clear message after timeout
  const timeoutMap = {
    'success': 5000,
    'error': 8000,
    'pending': null
  };

  if (timeoutMap[type]) {
    setTimeout(() => {
      messageDiv.textContent = '';
      messageDiv.className = '';
    }, timeoutMap[type]);
  }
}

// Debugging utilities
window.debugForm = {
  testConnection: async () => {
    try {
      const response = await fetch(CONFIG.GAS_URL, { method: 'POST' });
      console.log('Connection test response:', response);
    } catch (error) {
      console.error('Connection test failed:', error);
    }
  },
  showConfig: () => console.log('Current CONFIG:', CONFIG)
};
