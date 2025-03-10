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
    
    // Get core form values
    const trackingNumber = formData.get('trackingNumber') || '';
    const phone = formData.get('phone') || '';
    const quantity = formData.get('quantity') || '';
    const price = formData.get('price') || '';
    const itemCategory = formData.get('itemCategory') || '';
    const itemDescription = (formData.get('itemDescription') || '').trim();

    // Validate core fields
    validateTrackingNumber(trackingNumber);
    validatePhoneNumber(phone);
    validateQuantity(quantity);
    validatePrice(price);

    // Process files
    const rawFiles = Array.from(formData.getAll('files') || []);
    const validFiles = rawFiles.filter(file => file.size > 0);
    
    // File validation
    validateFiles(itemCategory, validFiles);

    // Prepare payload
    const processedFiles = await processFiles(validFiles);
    
    const payload = {
      trackingNumber: trackingNumber.trim(),
      phone: phone.trim(),
      itemDescription,
      quantity,
      price,
      collectionPoint: formData.get('collectionPoint'),
      itemCategory,
      files: processedFiles
    };

    // Submit data
    await submitForm(payload);

    // Success handled in verification check
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    console.error('Submission Error:', error);
  }
}

function validateFiles(category, files) {
  const starredCategories = [
    '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
    '*Gadgets', '*Oil Ointment', '*Supplement'
  ];

  // 1. Validate file requirements for starred categories
  if (starredCategories.includes(category)) {
    if (files.length < 1) {
      throw new Error('At least 1 file required for this category');
    }
    if (files.length > 3) {
      throw new Error('Maximum 3 files allowed for this category');
    }
  }

  // 2. Validate individual files (only if files exist)
  files.forEach(file => {
    if (file.size === 0) {
      throw new Error(`File "${file.name}" is empty`);
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error(`File "${file.name}" exceeds 5MB limit`);
    }
  });
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

// File Processor
async function processFiles(files) {
  return Promise.all(files.map(async file => ({
    name: file.name,
    mimeType: file.type,
    data: await toBase64(file),
    size: file.size
 })));
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

async function submitForm(payload) {
  const PROXY_URL = 'https://script.google.com/macros/s/AKfycbw0d5OTcj4Z_ZZXGjlVyzBKXOYCUMRx-hl4P2KaiVCjOdLNz7i7yDFen4kK-HZ7DlR7pg/exec';
  
  try {
    const formData = new URLSearchParams();
    formData.append('payload', JSON.stringify(payload));

    await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
      mode: 'no-cors'
    });

    // Start verification with retries
    setTimeout(() => verifySubmission(payload.trackingNumber), 3000);
    showMessage('Submission processing...', 'pending');

  } catch (error) {
    showMessage('Submission received - confirmation pending', 'pending');
  }
}

// Add verification function
async function verifySubmission(trackingNumber) {
  try {
    // Add retry mechanism
    let retries = 3;
    let result;
    
    while (retries > 0) {
      const response = await fetch(
        `${PROXY_URL}?tracking=${encodeURIComponent(trackingNumber)}&_=${Date.now()}`
      );
      
      if (response.ok) {
        result = await response.json();
        if (result.exists) break;
      }
      
      retries--;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (result?.exists) {
      showMessage('Submission verified successfully!', 'success');
    } else {
      showMessage('Submission received - verification pending', 'pending');
    }
    
  } catch (error) {
    showMessage('Submission received - final verification pending', 'pending');
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
