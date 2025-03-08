document.getElementById('declarationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const files = formData.getAll('files');
  
  // Client-side validation
  const trackingNumber = formData.get('trackingNumber');
  if (!/^[a-zA-Z0-9-]+$/.test(trackingNumber)) {
    showMessage('Invalid tracking number format', 'error');
    return;
  }

  const phone = formData.get('phone');
  if (isNaN(phone) || phone.length < 6) {
    showMessage('Invalid phone number', 'error');
    return;
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

  // Submit to Google Apps Script
  google.script.run
    .withSuccessHandler(() => {
      showMessage('Form submitted successfully!', 'success');
      e.target.reset();
    })
    .withFailureHandler((err) => showMessage(err.message, 'error'))
    .processForm({
      ...Object.fromEntries(formData),
      files: processedFiles
    });
});

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

function showMessage(text, type) {
  const messageDiv = document.getElementById('message');
  messageDiv.textContent = text;
  messageDiv.className = type;
}
