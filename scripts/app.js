// scripts/app.js
document.getElementById('declarationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const messageDiv = document.getElementById('message');
  
  try {
    // Client-side validations
    const trackingNumber = formData.get('trackingNumber');
    if (!/^[a-zA-Z0-9-]+$/.test(trackingNumber)) {
      throw new Error('Invalid tracking number format. Only letters, numbers, and hyphens allowed.');
    }

    const phone = formData.get('phone');
    if (!/^\d{6,}$/.test(phone)) {
      throw new Error('Phone number must contain at least 6 digits');
    }

    const quantity = formData.get('quantity');
    if (!Number.isInteger(Number(quantity)) || quantity < 1) {
      throw new Error('Quantity must be a whole number greater than 0');
    }

    const itemCategory = formData.get('itemCategory');
    const starredCategories = [
      '*Books', '*Cosmetics/Skincare/Bodycare', '*Food Beverage/Drinks',
      '*Gadgets', '*Oil Ointment', '*Supplement'
    ];
    
    // File validation
    const files = formData.getAll('files');
    if (starredCategories.includes(itemCategory)) {
      if (files.length < 1) {
        throw new Error('At least 1 file upload required for this category');
      }
      if (files.length > 3) {
        throw new Error('Maximum 3 files allowed for this category');
      }
    }

    // Process files
    const processedFiles = [];
    for (const file of files) {
      processedFiles.push({
        name: file.name,
        mimeType: file.type,
        data: await toBase64(file)
      });
    }

    // Create payload
    const payload = {
      trackingNumber: trackingNumber,
      phone: phone,
      itemDescription: formData.get('itemDescription'),
      quantity: Number(quantity),
      price: Number(formData.get('price')),
      collectionPoint: formData.get('collectionPoint'),
      itemCategory: itemCategory,
      files: processedFiles
    };

    // Submit to GAS
    const response = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Network response was not ok');

    const result = await response.json();
    
    if (result.success) {
      showMessage(result.message, 'success');
      form.reset();
    } else {
      throw new Error(result.error || 'Submission failed');
    }

  } catch (error) {
    showMessage(error.message, 'error');
    console.error('Submission error:', error);
  }
});

// File to Base64 converter
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

// Message display handler
function showMessage(text, type) {
  const messageDiv = document.getElementById('message');
  messageDiv.textContent = text;
  messageDiv.className = type;
  
  // Clear message after 5 seconds
  setTimeout(() => {
    messageDiv.textContent = '';
    messageDiv.className = '';
  }, 5000);
}

// Initial loading check
document.addEventListener('DOMContentLoaded', () => {
  if (typeof CONFIG === 'undefined') {
    showMessage('Configuration error: GAS_URL not defined', 'error');
  }
});
