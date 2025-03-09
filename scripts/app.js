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
    
    // 1. Validate Tracking Number
    const trackingNumber = formData.get('trackingNumber') || '';
    validateTrackingNumber(trackingNumber);

    // 2. Validate Phone Number
    const phone = formData.get('phone') || '';
    validatePhoneNumber(phone);

    // 3. Validate Quantity
    const quantity = formData.get('quantity') || '';
    validateQuantity(quantity);

    // 4. Validate Price
    const price = formData.get('price') || '';
    validatePrice(price);

    // 5. Validate Files
    const itemCategory = formData.get('itemCategory') || '';
    const files = Array.from(formData.getAll('files') || []);
    validateFiles(itemCategory, files);

    // 6. Process Files
    const processedFiles = await processFiles(files);

    // 7. Build Payload
    const payload = {
      trackingNumber: trackingNumber.trim(),
      phone: phone.trim(),
      itemDescription: (formData.get('itemDescription') || '').trim(),
      quantity: Number(quantity),
      price: Number(price),
      collectionPoint: formData.get('collectionPoint'),
      itemCategory: itemCategory,
      files: processedFiles
    };

    console.log('Submission Payload:', payload);
    
    // 8. Submit via POST
    await submitForm(payload);

  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    console.error('Submission Error:', error);
    
    // Optional: Log to error tracking service
    // logError(error);
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

// File Processor
async function processFiles(files) {
  return Promise.all(
    Array.from(files).map(async file => ({
      name: file.name,
      type: file.type,
      data: await toBase64(file),
      size: file.size
    }))
  );
}

// Base64 Converter
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

function validatePhoneNumber(phone) {
  if (!/^\d{6,15}$/.test(phone)) {
    throw new Error('Phone must be 6-15 digits');
  }
}

const PROXY_URL = 'https://script.google.com/macros/s/AKfycbzCsjxgx24aoNJyUaZF30yGWTUOy6Q1P-agvMDrUWJLVtTHc5CCGajLJt2sV5B-9pEiAA/exec';

async function submitForm(payload) {
  showMessage('Submitting...', 'pending');
  
  try {
    // 1. Submit main data
    const submitResponse = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!submitResponse.ok) throw new Error('Submission failed');
    
    // 2. Verify with retries
    let attempts = 0;
    const checkExists = async () => {
      attempts++;
      const response = await fetch(`${PROXY_URL}?tracking=${encodeURIComponent(payload.trackingNumber)}`);
      const result = await response.json();
      
      if (result.exists) {
        showMessage('Submission successful! ✔️', 'success');
        document.getElementById('declarationForm').reset();
      } else if (attempts < 5) {
        setTimeout(checkExists, 2000); // Retry every 2 seconds
        showMessage(`Verifying... (${attempts}/5)`, 'pending');
      } else {
        throw new Error('Verification timeout');
      }
    };
    
    await checkExists();
    
  } catch (error) {
    showMessage('Final verification failed - check spreadsheet manually', 'error');
    console.error('Submission Error:', error);
  }
}

async function verifySubmission(trackingNumber) {
  try {
    const response = await fetch(`${PROXY_URL}?tracking=${encodeURIComponent(trackingNumber)}`);
    const result = await response.json();
    return { found: result.exists };
  } catch (error) {
    return { found: false };
  }
}

// Add this verification function
async function checkSubmissionStatus(trackingNumber) {
  const ss = SpreadsheetApp.openById("1XGlYw_0Zn7MZAMVTBA-DHCvXVsdeSKYAh6KvzM3aEco");
  const sheet = ss.getSheetByName("V2");
  const data = sheet.getDataRange().getValues();
  
  const exists = data.some(row => row[2] === trackingNumber);
  exists ? showMessage('Submission verified!', 'success') 
         : showMessage('Verification failed', 'error');
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
    submitForm(testPayload);
  }
};
