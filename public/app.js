// Global State
let files = [];
let uploadQueue = [];

// Initialize Lucide Icons helper
function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initIcons();

  // Load files list
  loadFiles();

  // Refresh Button
  document.getElementById('refresh-btn').addEventListener('click', loadFiles);

  // Setup Drag & Drop Zone
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const selectedFiles = fileInput.files;
    if (selectedFiles.length > 0) {
      handleFilesUpload(selectedFiles);
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  ['dragleave', 'dragend'].forEach(type => {
    dropZone.addEventListener(type, () => {
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFilesUpload(droppedFiles);
    }
  });

  // Setup Modal Close
  document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('preview-modal').style.display = 'none';
  });
  document.getElementById('preview-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('preview-modal')) {
      document.getElementById('preview-modal').style.display = 'none';
    }
  });
});

// Fetch files and statistics from API
async function loadFiles() {
  try {
    const res = await fetch('/api/files');
    if (!res.ok) throw new Error('Falha ao obter lista de arquivos.');
    
    const data = await res.json();
    files = data.files;

    // Update Stats header
    document.getElementById('stat-files-count').innerText = `${data.stats.totalFiles} arquivos`;
    document.getElementById('stat-storage-size').innerText = data.stats.totalSize;

    renderFilesList();
  } catch (error) {
    console.error(error);
  }
}

// Render files inside the Explorer Grid
function renderFilesList() {
  const grid = document.getElementById('files-grid');
  grid.innerHTML = '';

  if (files.length === 0) {
    grid.innerHTML = `
      <div class="empty-explorer">
        <i data-lucide="ghost"></i>
        <p>Nenhum arquivo na sua nuvem pessoal.</p>
        <span>Arraste um arquivo acima para começar!</span>
      </div>
    `;
    initIcons();
    return;
  }

  // Type to Icon mappings
  const typeIcons = {
    image: 'file-image',
    video: 'file-video',
    audio: 'file-audio',
    pdf: 'file-text',
    document: 'file-text',
    file: 'file'
  };

  files.forEach(file => {
    const card = document.createElement('div');
    card.className = 'file-card';
    const iconName = typeIcons[file.type] || 'file';

    card.innerHTML = `
      <div class="file-actions">
        <a href="${file.url}" download="${file.name}" class="action-btn-sm" title="Baixar">
          <i data-lucide="download"></i>
        </a>
        <button class="action-btn-sm delete-btn-sm" data-name="${file.name}" title="Excluir">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
      <div class="file-icon-wrapper">
        <i data-lucide="${iconName}"></i>
      </div>
      <div class="file-name" title="${file.name}">${escapeHtml(file.name)}</div>
      <div class="file-size">${file.size}</div>
    `;

    // Click handler for image cards to open modal preview
    if (file.type === 'image') {
      const iconWrapper = card.querySelector('.file-icon-wrapper');
      iconWrapper.style.cursor = 'pointer';
      iconWrapper.addEventListener('click', () => {
        openImagePreview(file.url, file.name);
      });
    }

    // Add Delete listener
    const deleteBtn = card.querySelector('.delete-btn-sm');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFile(file.name);
    });

    grid.appendChild(card);
  });

  initIcons();
}

// Open modal image preview
function openImagePreview(url, name) {
  const modal = document.getElementById('preview-modal');
  const img = document.getElementById('modal-img');
  const caption = document.getElementById('modal-caption');

  img.src = url;
  caption.innerText = name;
  modal.style.display = 'flex';
}

// Delete file from API
async function deleteFile(name) {
  if (!confirm(`Deseja mesmo excluir o arquivo "${name}"?`)) return;

  try {
    const res = await fetch(`/api/files/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Erro ao excluir arquivo.');
    loadFiles();
  } catch (error) {
    console.error(error);
    alert('Erro ao excluir arquivo.');
  }
}

// Handle multi-files queue upload
function handleFilesUpload(selectedFiles) {
  Array.from(selectedFiles).forEach(file => {
    uploadSingleFile(file);
  });
}

// Upload a single file using XMLHttpRequest to capture upload progress events
function uploadSingleFile(file) {
  const progressList = document.getElementById('upload-progress-list');
  const fileId = 'upload-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

  // Append progress row in list
  const progressItem = document.createElement('div');
  progressItem.className = 'progress-item';
  progressItem.id = fileId;
  progressItem.innerHTML = `
    <div class="progress-info">
      <span class="progress-name">${escapeHtml(file.name)}</span>
      <span class="progress-percent" id="${fileId}-percent">0%</span>
    </div>
    <div class="progress-bar-bg">
      <div class="progress-bar-fill" id="${fileId}-fill"></div>
    </div>
  `;
  progressList.appendChild(progressItem);

  // Setup AJAX Upload
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append('file', file);

  // Track progress
  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      document.getElementById(`${fileId}-percent`).innerText = `${percent}%`;
      document.getElementById(`${fileId}-fill`).style.width = `${percent}%`;
    }
  });

  // Finish upload handler
  xhr.onreadystatechange = () => {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        // Complete visual
        document.getElementById(`${fileId}-percent`).innerText = 'Completo!';
        document.getElementById(`${fileId}-percent`).style.color = 'var(--color-success)';
        document.getElementById(`${fileId}-fill`).style.background = 'var(--color-success)';
        
        // Remove item after delay
        setTimeout(() => {
          progressItem.remove();
        }, 1500);

        loadFiles();
      } else {
        // Error visual
        document.getElementById(`${fileId}-percent`).innerText = 'Falhou!';
        document.getElementById(`${fileId}-percent`).style.color = 'var(--color-danger)';
        document.getElementById(`${fileId}-fill`).style.background = 'var(--color-danger)';
        document.getElementById(`${fileId}-fill`).style.width = '100%';

        setTimeout(() => {
          progressItem.remove();
        }, 3000);
      }
    }
  };

  xhr.open('POST', '/api/upload', true);
  xhr.send(formData);
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
