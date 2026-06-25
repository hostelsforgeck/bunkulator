// tools/build-mascot.js
// Regenerates the mascot sprite-atlas WebPs from the original high-res frames.
//
// Source : tools/bunku-mascot.frames.js  (the ORIGINAL drop-in mascot — 148
//          base64 WebP frames, 638x360, with alpha)
// Output : bunku-mascot-wave.webp, bunku-mascot-carrot.webp  (alpha-preserving
//          sprite atlases, frames downscaled to TILE_W wide)
//
// Why: the originals were 3.7 MB of base64 inlined into JS (un-cacheable, parsed
// on the main thread, 33% base64 tax) and 638px wide while the mascot renders at
// ~90px CSS. Downscaling + atlasing into binary WebP keeps the alpha and every
// behaviour, loads far faster, and decodes off the main thread on all browsers.
//
// Requires ffmpeg on PATH.  Run:  node tools/build-mascot.js

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(__dirname, 'bunku-mascot.frames.js');
const TMP = path.join(ROOT, '.mascot-tmp');

const TILE_W = 320;          // downscale width; height auto (even). ~3.5x DPR headroom over the ~90px render size.
const COLS = 10;             // atlas columns
const QUALITY = 80;          // libwebp quality

const ANIMS = [
  { label: 'wave', out: 'bunku-mascot-wave.webp' },
  { label: 'carrot', out: 'bunku-mascot-carrot.webp' },
];

function framesOf(js, label) {
  const i = js.indexOf('label: "' + label + '"');
  if (i < 0) throw new Error('animation not found: ' + label);
  const start = js.indexOf('[', js.indexOf('frames:', i));
  const end = js.indexOf(']', start);
  return js.slice(start, end).match(/data:image\/webp;base64,[A-Za-z0-9+/=]+/g) || [];
}

function main() {
  if (!fs.existsSync(SRC)) throw new Error('missing source frames: ' + SRC);
  const js = fs.readFileSync(SRC, 'utf8');
  fs.rmSync(TMP, { recursive: true, force: true });

  const manifest = {};
  let tileH = 0;

  for (const anim of ANIMS) {
    const frames = framesOf(js, anim.label);
    const dir = path.join(TMP, anim.label);
    fs.mkdirSync(dir, { recursive: true });
    frames.forEach((d, i) => {
      fs.writeFileSync(
        path.join(dir, 'f' + String(i).padStart(3, '0') + '.webp'),
        Buffer.from(d.split(',')[1], 'base64')
      );
    });

    const rows = Math.ceil(frames.length / COLS);
    const outPath = path.join(ROOT, anim.out);
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-i', path.join(dir, 'f%03d.webp'),
      '-vf', `scale=${TILE_W}:-2,tile=${COLS}x${rows}:color=#00000000`,
      '-frames:v', '1',
      '-c:v', 'libwebp', '-pix_fmt', 'yuva420p', '-q:v', String(QUALITY),
      outPath, '-y',
    ]);

    // Read back the real tile height (scale=-2 rounds to even)
    const probe = execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'stream=width,height',
      '-of', 'csv=p=0', outPath,
    ]).toString().trim().split(',').map(Number);
    tileH = Math.round(probe[1] / rows);

    const bytes = fs.statSync(outPath).size;
    manifest[anim.label] = { frameCount: frames.length, cols: COLS, rows };
    console.log(
      `${anim.label}: ${frames.length} frames -> ${anim.out} ` +
      `(${probe[0]}x${probe[1]}, ${(bytes / 1024).toFixed(0)} KB)`
    );
  }

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nTILE: ${TILE_W}x${tileH}, COLS: ${COLS}`);
  console.log('manifest:', JSON.stringify(manifest));
  console.log('\nDone. Atlases written to project root.');
}

main();
