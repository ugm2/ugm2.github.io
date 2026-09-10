/* Regenerate the web-sized WebP derivatives of the site's raster assets.
 *
 *   npm install --no-save sharp
 *   node tools/optimize-images.mjs
 *
 * The originals in assets/css/images/ and images/ are the masters; everything
 * the page actually loads is a .webp generated here. Without this step the
 * page weight goes back to ~24 MB, which is how it got there the first time.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMG = path.join(ROOT, "assets/css/images");
const OWN = path.join(ROOT, "images");

const log = [];
async function make(
  src,
  out,
  { w, h, fit = "inside", q = 80, flatten = false } = {},
) {
  const inPath = path.isAbsolute(src) ? src : path.join(IMG, src);
  const outPath = path.isAbsolute(out) ? out : path.join(IMG, out);
  let p = sharp(inPath).resize({
    width: w,
    height: h,
    fit,
    withoutEnlargement: true,
  });
  if (flatten) p = p.flatten({ background: "#0b0d0f" });
  const buf = await p.webp({ quality: q, effort: 6 }).toBuffer();
  fs.writeFileSync(outPath, buf);
  const before = fs.statSync(inPath).size,
    after = buf.length;
  log.push({
    out: path.relative(ROOT, outPath),
    kb: Math.round(after / 1024),
    was: Math.round(before / 1024),
  });
}

// --- modal carousel slides (rendered <= ~470px wide, 2x = ~940) -------------
const slides = [
  ["guexit.png", "guexit.webp"],
  ["guexit-screenshot.png", "guexit-screenshot.webp"],
  ["guexit2.png", "guexit2.webp"],
  ["guexit3.png", "guexit3.webp"],
  ["guexit4.png", "guexit4.webp"],
  ["guexit-diagram.png", "guexit-diagram.webp"],
  ["neural_search.png", "neural_search.webp"],
  ["neural_search_2.png", "neural_search_2.webp"],
  ["neural_search_3.png", "neural_search_3.webp"],
  ["grocery_classifier.png", "grocery_classifier.webp"],
  ["grocery_classifier_2.png", "grocery_classifier_2.webp"],
  ["grocery_classifier_3.png", "grocery_classifier_3.webp"],
  ["grocery_classifier_4.png", "grocery_classifier_4.webp"],
  ["grocery_classifier_5.png", "grocery_classifier_5.webp"],
  ["marca-tu-ritmo.PNG", "marca-tu-ritmo.webp"],
  ["marca-tu-ritmo-2.PNG", "marca-tu-ritmo-2.webp"],
  ["marca-tu-ritmo-3.PNG", "marca-tu-ritmo-3.webp"],
  ["marca-tu-ritmo-4.PNG", "marca-tu-ritmo-4.webp"],
];
for (const [s, o] of slides) await make(s, o, { w: 1000, h: 1300, q: 80 });

// --- project tile art (tile renders <= ~430px, 2x = 860) --------------------
await make("guexit.png", "tile-guexit.webp", {
  w: 800,
  h: 800,
  fit: "cover",
  q: 76,
  flatten: true,
});
await make("neural_search.png", "tile-neural.webp", {
  w: 800,
  h: 800,
  fit: "cover",
  q: 76,
  flatten: true,
});
await make("grocery_classifier.png", "tile-grocery.webp", {
  w: 800,
  h: 800,
  fit: "cover",
  q: 76,
  flatten: true,
});
await make("marca-tu-ritmo-main.jpg", "tile-fitness.webp", {
  w: 800,
  h: 800,
  fit: "cover",
  q: 76,
  flatten: true,
});

// --- app-icon marks used in tiles + modal headers (render at 60px) ----------
await make("neural_search_app.png", "icon-neural.webp", {
  w: 160,
  h: 160,
  fit: "cover",
  q: 86,
});
await make("grocery_classifier_app.png", "icon-grocery.webp", {
  w: 160,
  h: 160,
  fit: "cover",
  q: 86,
});
await make("marca-tu-ritmo-app.PNG", "icon-fitness.webp", {
  w: 160,
  h: 160,
  fit: "cover",
  q: 86,
});

// --- portrait (renders ~520px wide) ----------------------------------------
for (const w of [480, 900]) {
  await make(
    path.join(OWN, "unai_circle.png"),
    path.join(OWN, `unai-${w}.webp`),
    { w, q: 80 },
  );
}

// --- animated waving hand in the hero (renders at ~44px) -------------------
{
  const src = path.join(IMG, "wave-3.gif");
  if (fs.existsSync(src)) {
    const buf = await sharp(src, { animated: true })
      .resize({ width: 96, withoutEnlargement: true })
      .webp({ quality: 72, effort: 6 })
      .toBuffer();
    fs.writeFileSync(path.join(IMG, "wave.webp"), buf);
    log.push({
      out: "assets/css/images/wave.webp",
      kb: Math.round(buf.length / 1024),
      was: Math.round(fs.statSync(src).size / 1024),
    });
  }
}

console.log(
  log
    .map(
      (r) =>
        `${String(r.kb).padStart(5)}KB  (was ${String(r.was).padStart(5)}KB)  ${r.out}`,
    )
    .join("\n"),
);
console.log(
  "\nTOTAL new =",
  log.reduce((a, b) => a + b.kb, 0),
  "KB   was",
  log.reduce((a, b) => a + b.was, 0),
  "KB",
);
