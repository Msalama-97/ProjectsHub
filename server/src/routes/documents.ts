import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { one, query } from '../db.js';
import { HttpError, idParam } from '../util.js';

fs.mkdirSync(config.uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
});

export const documentsRouter = Router();

documentsRouter.get('/', async (req, res) => {
  const pid = Number(req.query.project_id);
  if (!pid) throw new HttpError(400, 'project_id is required');
  res.json(
    await query(
      `SELECT d.*, u.name AS uploaded_by_name FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.project_id = $1 ORDER BY d.created_at DESC`,
      [pid],
    ),
  );
});

// Multipart (file) or JSON (link)
documentsRouter.post('/', upload.single('file'), async (req, res) => {
  const body = z
    .object({
      project_id: z.coerce.number().int().positive(),
      title: z.string().trim().max(300).optional(),
      url: z.string().trim().max(2000).optional(),
      category: z.string().trim().max(100).optional(),
    })
    .parse(req.body);
  const project = await one('SELECT id FROM projects WHERE id = $1', [body.project_id]);
  if (!project) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    throw new HttpError(400, 'Project not found');
  }
  let row;
  if (req.file) {
    // multer decodes names as latin1; restore UTF-8 names
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    row = await one(
      `INSERT INTO documents (project_id, title, kind, file_key, file_name, mime_type, size_bytes, category, uploaded_by)
       VALUES ($1,$2,'file',$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.project_id, body.title || originalName, req.file.filename, originalName, req.file.mimetype, req.file.size,
        body.category || 'general', req.user!.id],
    );
  } else {
    if (!body.url) throw new HttpError(400, 'Provide a file or a link');
    const url = /^[a-z]+:\/\//i.test(body.url) ? body.url : `https://${body.url}`;
    row = await one(
      `INSERT INTO documents (project_id, title, kind, url, category, uploaded_by)
       VALUES ($1,$2,'link',$3,$4,$5) RETURNING *`,
      [body.project_id, body.title || url, url, body.category || 'general', req.user!.id],
    );
  }
  res.status(201).json({ ...row, uploaded_by_name: req.user!.name });
});

documentsRouter.patch('/:id', async (req, res) => {
  const d = z
    .object({ title: z.string().trim().min(1).max(300).optional(), category: z.string().trim().max(100).optional() })
    .parse(req.body);
  const row = await one(
    'UPDATE documents SET title = COALESCE($1, title), category = COALESCE($2, category) WHERE id = $3 RETURNING *',
    [d.title ?? null, d.category ?? null, idParam(req)],
  );
  if (!row) throw new HttpError(404, 'Not found');
  res.json(row);
});

documentsRouter.get('/:id/download', async (req, res) => {
  const doc = await one('SELECT * FROM documents WHERE id = $1', [idParam(req)]);
  if (!doc || doc.kind !== 'file') throw new HttpError(404, 'Not found');
  const filePath = path.join(config.uploadDir, path.basename(doc.file_key));
  if (!fs.existsSync(filePath)) throw new HttpError(404, 'File missing on server');
  const inline = req.query.inline === '1';
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
  );
  fs.createReadStream(filePath).pipe(res);
});

documentsRouter.delete('/:id', async (req, res) => {
  const doc = await one('DELETE FROM documents WHERE id = $1 RETURNING *', [idParam(req)]);
  if (doc?.file_key) fs.rmSync(path.join(config.uploadDir, path.basename(doc.file_key)), { force: true });
  res.json({ ok: true });
});
