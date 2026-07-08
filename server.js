const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001; // Port 3001 to avoid conflicts
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Multer Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Preserve original filename, but avoid conflicts by adding a timestamp if file exists
    let name = file.originalname;
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    let filePath = path.join(UPLOADS_DIR, name);
    let counter = 1;

    while (fs.existsSync(filePath)) {
      name = `${base}_${counter}${ext}`;
      filePath = path.join(UPLOADS_DIR, name);
      counter++;
    }
    cb(null, name);
  }
});

const upload = multer({ storage });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Also serve uploads folder for visual file previews (images, videos)
app.use('/files', express.static(UPLOADS_DIR));

// Helper: Format file sizes
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// API: List all uploaded files & cloud stats
app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    let totalSize = 0;

    const fileList = files.map(file => {
      const filePath = path.join(UPLOADS_DIR, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;

      // Detect file type
      const ext = path.extname(file).toLowerCase();
      let type = 'file';
      if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(ext)) {
        type = 'image';
      } else if (['.mp4', '.webm', '.ogg', '.mov'].includes(ext)) {
        type = 'video';
      } else if (['.mp3', '.wav', '.flac'].includes(ext)) {
        type = 'audio';
      } else if (['.pdf'].includes(ext)) {
        type = 'pdf';
      } else if (['.txt', '.md', '.json', '.html'].includes(ext)) {
        type = 'document';
      }

      return {
        name: file,
        size: formatBytes(stats.size),
        rawSize: stats.size,
        type: type,
        uploadedAt: stats.birthtime,
        url: `/files/${encodeURIComponent(file)}`
      };
    }).sort((a, b) => b.uploadedAt - a.uploadedAt);

    res.json({
      files: fileList,
      stats: {
        totalFiles: fileList.length,
        totalSize: formatBytes(totalSize),
        rawTotalSize: totalSize
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar arquivos: ' + error.message });
  }
});

// API: Upload files (handles single file uploads)
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    res.json({
      message: 'Arquivo enviado com sucesso!',
      file: {
        name: req.file.filename,
        size: formatBytes(req.file.size)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro no upload: ' + error.message });
  }
});

// API: Delete a file
app.delete('/api/files/:name', (req, res) => {
  try {
    const filename = req.params.name;
    const filePath = path.join(UPLOADS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo nao encontrado.' });
    }

    fs.unlinkSync(filePath);
    res.json({ message: `Arquivo ${filename} excluido com sucesso!` });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir arquivo: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Cloud] Servidor rodando em http://localhost:${PORT}`);
});
