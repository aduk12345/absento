import { formatJakartaWatermarkDateTime } from "./date";

const MAP_ZOOM = 16;
const TILE_SIZE = 256;
const TILE_FETCH_TIMEOUT_MS = 6000;

// Watermark ala "GPS Map Camera" di-bake langsung ke canvas foto absen (checkin/checkout)
// SEBELUM di-convert ke blob & upload — jadi permanen di file foto, bukan overlay UI.
// Dipanggil dari AbsenPanel.tsx (handleCapture), sesudah drawImage(video) & sebelum toBlob().
// Async karena butuh fetch thumbnail peta (best-effort — kalau gagal/timeout, watermark
// tetap tampil tanpa thumbnail, cuma pin polos).
export async function drawAbsenceWatermark(
  canvas: HTMLCanvasElement,
  opts: {
    lat: number;
    lng: number;
    shortLabel?: string | null;
    displayName?: string | null;
    date: Date;
  }
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  // Referensi lebar 900px (bukan 1280) — canvas sekarang selalu potret (hasil
  // cropToPortrait di AbsenPanel.tsx, lebar native kamera ~720-1080px), jadi kalau
  // masih pakai referensi 1280 watermark jadi mengecil otomatis di foto potret.
  const scale = w / 900;

  const { dateLine, timeLine } = formatJakartaWatermarkDateTime(opts.date);
  const coordLine = formatCoordinates(opts.lat, opts.lng);
  const title = opts.shortLabel || coordLine;
  const subtitle = opts.displayName || null;

  const padX = 20 * scale;
  const mapSize = 190 * scale;
  const gapAfterMap = 16 * scale;
  const lineGap = 9 * scale;
  const titleSize = 42 * scale;
  const bodySize = 27 * scale;

  const textMaxWidth = w - padX * 2 - mapSize - gapAfterMap;

  // Susun baris teks dulu supaya tinggi box bisa dihitung pas.
  const textLines: { text: string; size: number; color: string; bold: boolean }[] = [
    { text: title, size: titleSize, color: "#ffffff", bold: true },
  ];
  if (subtitle) {
    const wrapped = wrapText(ctx, subtitle, textMaxWidth, bodySize, 2);
    for (const line of wrapped) {
      textLines.push({ text: line, size: bodySize, color: "#e2e8f0", bold: false });
    }
  }
  if (opts.shortLabel) {
    textLines.push({ text: coordLine, size: bodySize, color: "#e2e8f0", bold: false });
  }
  textLines.push({ text: `${dateLine}  •  ${timeLine}`, size: bodySize, color: "#e2e8f0", bold: false });

  const textBlockHeight = textLines.reduce((sum, l) => sum + l.size + lineGap, 0);
  const boxHeight = Math.max(textBlockHeight + padX * 2, mapSize + padX * 2);

  // Gradient gelap dari transparan (atas) ke hitam pekat (bawah) — supaya teks putih
  // tetap terbaca di atas foto apa pun tanpa menutupi seluruh frame.
  const gradient = ctx.createLinearGradient(0, h - boxHeight, 0, h);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.35, "rgba(0,0,0,0.55)");
  gradient.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, h - boxHeight, w, boxHeight);

  // Thumbnail peta (screenshot titik lokasi) di kiri, fallback ke pin polos kalau gagal.
  const mapX = padX;
  const mapY = h - boxHeight / 2 - mapSize / 2;
  const mapThumb = await loadMapThumbnail(opts.lat, opts.lng, mapSize).catch(() => null);

  ctx.save();
  roundedRectPath(ctx, mapX, mapY, mapSize, mapSize, 10 * scale);
  ctx.clip();
  if (mapThumb) {
    ctx.drawImage(mapThumb.canvas, mapThumb.sx, mapThumb.sy, mapThumb.s, mapThumb.s, mapX, mapY, mapSize, mapSize);
  } else {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
  }
  ctx.restore();
  ctx.save();
  roundedRectPath(ctx, mapX, mapY, mapSize, mapSize, 10 * scale);
  ctx.lineWidth = 2 * scale;
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.stroke();
  ctx.restore();
  drawPin(ctx, mapX + mapSize / 2, mapY + mapSize / 2, 28 * scale);

  // Render baris teks, top-aligned di dalam box, mulai setelah thumbnail peta.
  const textX = mapX + mapSize + gapAfterMap;
  let cursorY = h - boxHeight / 2 - textBlockHeight / 2;
  for (const line of textLines) {
    ctx.font = `${line.bold ? "700" : "500"} ${line.size}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = line.color;
    ctx.textBaseline = "top";
    ctx.fillText(line.text, textX, cursorY);
    cursorY += line.size + lineGap;
  }
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const r = size / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = size * 0.3;
  ctx.fillStyle = "#f43f5e";
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.15, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy + r * 0.35);
  ctx.lineTo(cx + r * 0.55, cy + r * 0.35);
  ctx.lineTo(cx, cy + r * 1.15);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.15, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}°${latDir} ${Math.abs(lng).toFixed(5)}°${lngDir}`;
}

// Faktor "zoom-out" — crop area lebih LEBAR dari ukuran tampil thumbnail lalu di-scale
// turun (drawImage otomatis scale src rect ke dest rect di pemanggil). Tanpa ini, di lokasi
// yang jalannya tidak persis melintasi window crop sempit (mis. di tengah halaman/plaza),
// thumbnail cuma nampak warna dasar tanah/gedung polos tanpa jalan/landmark apa pun —
// area yang lebih lebar jauh lebih mungkin menangkap konteks (jalan, gedung lain, dst).
const ZOOM_OUT_FACTOR = 2.2;

// Ambil HANYA tile CARTO yang benar-benar overlap area crop di sekitar titik lokasi
// (biasanya beberapa tile, bukan grid tetap yang lebih besar dari perlu) supaya jumlah
// request minimal & tidak gampang gagal/timeout di koneksi lambat, gabung ke canvas
// offscreen, lalu hitung crop persegi (sudah di-zoom-out) tepat berpusat di titik itu
// buat di-drawImage sebagai thumbnail (scale-down ke ukuran tampil ditangani pemanggil).
async function loadMapThumbnail(
  lat: number,
  lng: number,
  destSize: number
): Promise<{ canvas: HTMLCanvasElement; sx: number; sy: number; s: number }> {
  const n = 2 ** MAP_ZOOM;
  const worldX = ((lng + 180) / 360) * n * TILE_SIZE;
  const latRad = (lat * Math.PI) / 180;
  const worldY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * TILE_SIZE;

  const cropSize = destSize * ZOOM_OUT_FACTOR;
  const half = cropSize / 2;
  const tileXMin = Math.floor((worldX - half) / TILE_SIZE);
  const tileXMax = Math.floor((worldX + half) / TILE_SIZE);
  const tileYMin = Math.floor((worldY - half) / TILE_SIZE);
  const tileYMax = Math.floor((worldY + half) / TILE_SIZE);

  const cols = tileXMax - tileXMin + 1;
  const rows = tileYMax - tileYMin + 1;

  const offCanvas = document.createElement("canvas");
  offCanvas.width = TILE_SIZE * cols;
  offCanvas.height = TILE_SIZE * rows;
  const offCtx = offCanvas.getContext("2d");
  if (!offCtx) throw new Error("no ctx");

  const tasks: Promise<{ col: number; row: number; img: HTMLImageElement }>[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tx = tileXMin + col;
      const ty = tileYMin + row;
      tasks.push(
        loadImage(`/api/maps/tile?z=${MAP_ZOOM}&x=${tx}&y=${ty}`).then((img) => ({ col, row, img }))
      );
    }
  }
  const tiles = await Promise.all(tasks);
  for (const { col, row, img } of tiles) {
    offCtx.drawImage(img, col * TILE_SIZE, row * TILE_SIZE);
  }

  // Posisi titik lokasi persis di dalam offCanvas (relatif terhadap tileXMin/tileYMin).
  const pointX = worldX - tileXMin * TILE_SIZE;
  const pointY = worldY - tileYMin * TILE_SIZE;

  return {
    canvas: offCanvas,
    sx: pointX - half,
    sy: pointY - half,
    s: cropSize,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error("tile timeout")), TILE_FETCH_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("tile load error"));
    };
    img.src = src;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number
): string[] {
  ctx.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);

  // Kalau masih ada sisa kata yang belum masuk baris terakhir, tambahkan ellipsis.
  const consumed = lines.join(" ").length;
  if (consumed < text.length && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 0) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }

  return lines;
}
