import express from 'express';
import multer from 'multer';
import { execFile } from 'child_process';
import { readFile, writeFile, rename, unlink, readdir } from 'fs/promises';
import { createReadStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ dest: tmpdir() });
const PORT = process.env.PORT || 3001;

// Slicer profiles directory
const PROFILES_DIR = join(__dirname, 'slicer-profiles', 'prusa-slicer');

// TEMPORARY: tuning UI override allowlist — remove when no longer needed
const ALLOWED_SPEED_KEYS = new Set([
  'perimeter_speed', 'external_perimeter_speed', 'infill_speed',
  'solid_infill_speed', 'top_solid_infill_speed', 'first_layer_speed',
  'travel_speed', 'max_print_speed', 'support_material_speed'
]);
const ALLOWED_FILL_PATTERNS = new Set(['gyroid', 'rectilinear', 'grid']);

async function writeOverridesIni(overrides) {
  const lines = [];
  for (const [key, value] of Object.entries(overrides || {})) {
    if (ALLOWED_SPEED_KEYS.has(key)) {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 10 && n <= 500) lines.push(`${key} = ${n}`);
    } else if (key === 'fill_pattern' && ALLOWED_FILL_PATTERNS.has(value)) {
      lines.push(`fill_pattern = ${value}`);
    }
    // silently ignore anything else — security: prevent ini injection
  }
  if (lines.length === 0) return null;
  const path = join(tmpdir(), `slicer-overrides-${Date.now()}-${Math.random().toString(36).slice(2)}.ini`);
  await writeFile(path, lines.join('\n') + '\n');
  return path;
}
// END TEMPORARY

// ── Google Drive upload (OAuth2 preferred, uploads as real user with quota) ──
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
let driveClient = null;

// OAuth2 first (uploads as real user — has storage quota)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
  try {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    driveClient = google.drive({ version: 'v3', auth: oauth2 });
    console.log('Google Drive upload enabled (OAuth2)');
  } catch (e) {
    console.warn('Google Drive setup failed:', e.message);
  }
}

async function uploadToDrive(filePath, filename) {
  if (!driveClient || !DRIVE_FOLDER_ID) return { success: false, reason: 'Drive not configured' };
  try {
    await driveClient.files.create({
      requestBody: { name: filename, parents: [DRIVE_FOLDER_ID] },
      media: { mimeType: 'application/octet-stream', body: createReadStream(filePath) }
    });
    console.log(`Uploaded to Drive: ${filename}`);
    return { success: true };
  } catch (e) {
    console.error('Drive upload failed:', e.message);
    return { success: false, reason: e.message };
  }
}

// ── Run PrusaSlicer to produce G-code ──
async function runSlicer(profileName, stlPath, gcodePath, overridesPath = null) {
  const profilePath = join(PROFILES_DIR, `${profileName}.ini`);
  const supportPath = join(PROFILES_DIR, 'support-override.ini');

  const args = [
    '--export-gcode',
    '--load', profilePath,
    '--load', supportPath,
    ...(overridesPath ? ['--load', overridesPath] : []),
    '--center', '112.5,112.5',
    '--output', gcodePath,
    stlPath
  ];

  return new Promise((resolve, reject) => {
    execFile('prusa-slicer', args, { timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('PrusaSlicer stderr:', stderr);
        console.error('PrusaSlicer error:', err.message);
        reject(new Error(stderr || err.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

// ── Check if PrusaSlicer is available ──
async function checkSlicerAvailable() {
  return new Promise((resolve) => {
    execFile('prusa-slicer', ['--help'], { timeout: 10_000 }, (err) => {
      resolve(!err);
    });
  });
}

// ── Non-uniform scale binary STL to exact target dimensions (mm) ──
async function scaleSTL(filePath, targetX, targetY, targetZ) {
  const buf = Buffer.from(await readFile(filePath));
  const triCount = buf.readUInt32LE(80);
  // First pass: find bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < triCount; i++) {
    const off = 84 + i * 50;
    for (let v = 0; v < 3; v++) {
      const vOff = off + 12 + v * 12;
      const x = buf.readFloatLE(vOff);
      const y = buf.readFloatLE(vOff + 4);
      const z = buf.readFloatLE(vOff + 8);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
  }
  const sx = targetX / (maxX - minX);
  const sy = targetY / (maxY - minY);
  const sz = targetZ / (maxZ - minZ);
  // Second pass: scale vertices (center at origin first)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  for (let i = 0; i < triCount; i++) {
    const off = 84 + i * 50;
    // Scale normal
    const nx = buf.readFloatLE(off) * sx;
    const ny = buf.readFloatLE(off + 4) * sy;
    const nz = buf.readFloatLE(off + 8) * sz;
    const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    buf.writeFloatLE(nx / nLen, off);
    buf.writeFloatLE(ny / nLen, off + 4);
    buf.writeFloatLE(nz / nLen, off + 8);
    // Scale vertices
    for (let v = 0; v < 3; v++) {
      const vOff = off + 12 + v * 12;
      buf.writeFloatLE((buf.readFloatLE(vOff) - cx) * sx, vOff);
      buf.writeFloatLE((buf.readFloatLE(vOff + 4) - cy) * sy, vOff + 4);
      buf.writeFloatLE((buf.readFloatLE(vOff + 8) - cz) * sz, vOff + 8);
    }
  }
  await writeFile(filePath, buf);
}

// Serve built static files
app.use(express.static(join(__dirname, 'dist')));

// ── Slicer status check ──
app.get('/api/slicer-status', async (_req, res) => {
  const slicerOk = await checkSlicerAvailable();
  const driveOk = !!(driveClient && DRIVE_FOLDER_ID);
  res.json({ slicer: slicerOk, drive: driveOk });
});

// ── List available profiles ──
app.get('/api/profiles', async (_req, res) => {
  try {
    const files = await readdir(PROFILES_DIR);
    const profiles = files
      .filter(f => f.endsWith('.ini') && !f.startsWith('support') && !f.startsWith('printer'))
      .map(f => ({
        id: f.replace('.ini', ''),
        name: f.replace('.ini', '').replace(/_/g, ' ')
      }));
    res.json(profiles);
  } catch {
    res.json([]);
  }
});

// ── Slice STL → G-code ──
app.post('/api/slice', upload.single('stl'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No STL file uploaded' });

  const profile = req.body.profile || 'optimized';
  const rawPath = req.file.path;
  const stlPath = rawPath + '.stl';
  const gcodeFilename = req.body.filename
    ? req.body.filename.replace(/\.stl$/i, '.gcode')
    : 'output.gcode';
  const gcodePath = rawPath + '.gcode';
  let overridesPath = null;

  try {
    await rename(rawPath, stlPath);

    // TEMPORARY: tuning UI overrides — remove once speeds are finalized
    if (req.body.overrides) {
      try {
        overridesPath = await writeOverridesIni(JSON.parse(req.body.overrides));
      } catch { /* invalid JSON — ignore */ }
    }
    const autoScale = req.body.autoScale !== '0';
    if (autoScale) {
      const targetX = 192, targetZ = 37;
      const targetY = req.body.hasInscription ? 48 : 42;
      await scaleSTL(stlPath, targetX, targetY, targetZ);
    } else {
      // Custom dimensions: apply only if all 3 are present and within range
      const clamp = n => Math.max(1, Math.min(300, n));
      const cx = parseFloat(req.body.customScaleX);
      const cy = parseFloat(req.body.customScaleY);
      const cz = parseFloat(req.body.customScaleZ);
      if ([cx, cy, cz].every(n => Number.isFinite(n) && n > 0)) {
        await scaleSTL(stlPath, clamp(cx), clamp(cy), clamp(cz));
      }
      // else: skip scaling entirely (use STL as-is)
    }
    // END TEMPORARY

    await runSlicer(profile, stlPath, gcodePath, overridesPath);

    // Upload to Google Drive (must finish before cleanup deletes the file)
    await uploadToDrive(gcodePath, gcodeFilename);

    const gcode = await readFile(gcodePath);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${gcodeFilename}"`
    });
    res.send(gcode);
  } catch (err) {
    console.error('Slice failed:', err.message);
    const slicerOk = await checkSlicerAvailable();
    const hint = !slicerOk ? ' (PrusaSlicer not found on server)' : '';
    res.status(500).json({ error: 'Slicing failed' + hint, details: err.message });
  } finally {
    unlink(rawPath).catch(() => {});
    unlink(stlPath).catch(() => {});
    unlink(gcodePath).catch(() => {});
    if (overridesPath) unlink(overridesPath).catch(() => {});
  }
});

// ── Slice + Upload (for batch processing, returns JSON status) ──
app.post('/api/slice-and-upload', upload.single('stl'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No STL file uploaded' });

  const profile = req.body.profile || 'optimized';
  const rawPath = req.file.path;
  const stlPath = rawPath + '.stl';
  const gcodeFilename = req.body.filename
    ? req.body.filename.replace(/\.stl$/i, '.gcode')
    : 'output.gcode';
  const gcodePath = rawPath + '.gcode';

  const result = { gcode: false, drive: false, driveError: '' };
  let overridesPath = null;

  try {
    await rename(rawPath, stlPath);

    // TEMPORARY: tuning UI overrides — remove once speeds are finalized
    if (req.body.overrides) {
      try {
        overridesPath = await writeOverridesIni(JSON.parse(req.body.overrides));
      } catch { /* invalid JSON — ignore */ }
    }
    const autoScale = req.body.autoScale !== '0';
    if (autoScale) {
      const targetX = 192, targetZ = 37;
      const targetY = req.body.hasInscription ? 48 : 42;
      await scaleSTL(stlPath, targetX, targetY, targetZ);
    } else {
      // Custom dimensions: apply only if all 3 are present and within range
      const clamp = n => Math.max(1, Math.min(300, n));
      const cx = parseFloat(req.body.customScaleX);
      const cy = parseFloat(req.body.customScaleY);
      const cz = parseFloat(req.body.customScaleZ);
      if ([cx, cy, cz].every(n => Number.isFinite(n) && n > 0)) {
        await scaleSTL(stlPath, clamp(cx), clamp(cy), clamp(cz));
      }
      // else: skip scaling entirely (use STL as-is)
    }
    // END TEMPORARY

    await runSlicer(profile, stlPath, gcodePath, overridesPath);

    result.gcode = true;

    // Read gcode and include in response (base64) so client can add to ZIP
    const gcodeBuf = await readFile(gcodePath);
    result.gcodeBase64 = gcodeBuf.toString('base64');
    result.gcodeFilename = gcodeFilename;

    // Upload to Google Drive
    const driveResult = await uploadToDrive(gcodePath, gcodeFilename);
    result.drive = driveResult.success;
    if (!driveResult.success) result.driveError = driveResult.reason || '';

    res.json(result);
  } catch (err) {
    console.error('Slice failed:', err.message);
    res.json(result); // gcode stays false
  } finally {
    unlink(rawPath).catch(() => {});
    unlink(stlPath).catch(() => {});
    unlink(gcodePath).catch(() => {});
    if (overridesPath) unlink(overridesPath).catch(() => {});
  }
});

// SPA fallback (Express 5 syntax)
app.get('/{*path}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
