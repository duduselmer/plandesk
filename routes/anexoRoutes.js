const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AnexoService = require('../services/anexoService');
const { autenticar } = require('../middleware/auth');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const tipos = /jpeg|jpg|png|pdf|xlsx|xls|csv|docx|doc/;
    const ext = tipos.test(path.extname(file.originalname).toLowerCase());
    if (ext) return cb(null, true);
    cb(new Error('Formato não permitido. Use: PDF, Excel, Word, Imagens'));
  }
});

router.use(autenticar);

// Upload de anexo
router.post('/:ticketId/upload', upload.single('arquivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const resultado = await AnexoService.salvarAnexo(
      req.params.ticketId,
      req.file.originalname,
      req.file.filename,
      req.file.size,
      req.file.mimetype,
      req.usuario.id
    );

    res.status(201).json(resultado);
  } catch (error) {
    // Remover arquivo se houve erro
    if (req.file) {
      const filePath = path.join(uploadsDir, req.file.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.status(400).json({ error: error.message });
  }
});

// Listar anexos de um ticket
router.get('/:ticketId/listar', async (req, res) => {
  try {
    const anexos = await AnexoService.listarAnexos(req.params.ticketId);
    res.json(anexos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excluir anexo
router.delete('/:anexoId', async (req, res) => {
  try {
    const resultado = await AnexoService.excluirAnexo(req.params.anexoId);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Middleware de erro do multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Arquivo excede o limite de 25MB' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;
