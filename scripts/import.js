/**
 * import.js - Scan uploads directory and generate categories.json
 *
 * Expected directory structure:
 *   uploads/
 *     <CategoryName>/
 *       <AlbumName>/
 *         001.png
 *         002.jpg
 *
 * Output format (matches frontend main.js / album.html expectations):
 *   [{
 *     id: "CategoryName",
 *     name: "CategoryName",
 *     children: [{
 *       id: 0,
 *       name: "AlbumName",
 *       cover: "uploads/Category/Album/001.png",
 *       photo_count: 5,
 *       photos: [
 *         { filepath: "uploads/Category/Album/001.png", filename: "001.png" }
 *       ]
 *     }]
 *   }]
 */

const fs = require('fs');
const path = require('path');

// ---- Paths ----
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'uploads');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'categories.json');

// ---- Supported image extensions ----
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

/**
 * Natural sort: 001, 002, ..., 010, 011 (not 001, 010, 011, 002)
 */
function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Check if a filename is an image
 */
function isImageFile(name) {
  return IMAGE_EXTS.has(path.extname(name).toLowerCase());
}

/**
 * Get sorted image files in a directory
 */
function getImages(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isFile() && isImageFile(entry.name))
    .map(entry => entry.name)
    .sort(naturalCompare);
}

/**
 * Get sorted subdirectories in a directory
 */
function getSubdirs(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort(naturalCompare);
}

/**
 * Scan the uploads directory tree and build category data
 */
function scanUploads() {
  const categories = [];
  let totalAlbums = 0;
  let totalImages = 0;
  let albumIdCounter = 0;

  const categoryDirs = getSubdirs(UPLOADS_DIR);

  for (const categoryName of categoryDirs) {
    const categoryPath = path.join(UPLOADS_DIR, categoryName);
    const albumDirs = getSubdirs(categoryPath);
    const children = [];

    for (const albumName of albumDirs) {
      const albumPath = path.join(categoryPath, albumName);
      const images = getImages(albumPath);

      if (images.length === 0) {
        console.log('      [SKIP] Empty album: ' + categoryName + '/' + albumName);
        continue;
      }

      // Build photo objects with filepath and filename
      const photos = images.map(function(img) {
        return {
          filepath: 'uploads/' + categoryName + '/' + albumName + '/' + img,
          filename: img
        };
      });

      children.push({
        id: albumIdCounter++,
        name: albumName,
        cover: photos[0].filepath,
        photo_count: images.length,
        photos: photos
      });

      totalAlbums++;
      totalImages += images.length;
    }

    if (children.length > 0) {
      categories.push({
        id: categoryName,
        name: categoryName,
        children: children
      });
    }
  }

  return {
    categories: categories,
    totalAlbums: totalAlbums,
    totalImages: totalImages
  };
}

// ============================================================
// Main
// ============================================================
function main() {
  console.log('============================================================');
  console.log('  Loong Cycle - Import Script');
  console.log('============================================================');
  console.log('');

  // Check uploads directory exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error('[ERROR] uploads directory not found:');
    console.error('        ' + UPLOADS_DIR);
    process.exit(1);
  }

  // Step 1: Scan
  console.log('[1/2] Scanning uploads directory...');
  console.log('      Path: ' + UPLOADS_DIR);
  const result = scanUploads();

  console.log('      Categories : ' + result.categories.length);
  console.log('      Albums     : ' + result.totalAlbums);
  console.log('      Images     : ' + result.totalImages);
  console.log('');

  // Step 2: Write JSON
  console.log('[2/2] Writing categories.json...');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result.categories, null, 2), 'utf8');

  // Verify JSON is valid and parseable
  try {
    const verify = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    console.log('      JSON valid: ' + verify.length + ' categories, ' +
      verify.reduce(function(s, c) { return s + c.children.length; }, 0) + ' albums');
  } catch (e) {
    console.error('      [ERROR] JSON validation failed: ' + e.message);
    process.exit(1);
  }

  console.log('      Output: ' + OUTPUT_FILE);
  console.log('');

  // Summary
  console.log('============================================================');
  console.log('  Import Complete!');
  console.log('============================================================');
  console.log('  Categories : ' + result.categories.length);
  console.log('  Albums     : ' + result.totalAlbums);
  console.log('  Images     : ' + result.totalImages);
  console.log('============================================================');
}

main();
