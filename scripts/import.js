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
 * Output: data/categories.json
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
 * Convert absolute path to web-relative path with forward slashes
 */
function toWebPath(absPath) {
  return path.relative(PROJECT_ROOT, absPath).replace(/\\/g, '/');
}

/**
 * Scan the uploads directory tree and build category data
 */
function scanUploads() {
  const categories = [];
  let totalAlbums = 0;
  let totalImages = 0;
  const emptyAlbums = [];
  const allReferencedFiles = new Set();

  const categoryDirs = getSubdirs(UPLOADS_DIR);

  for (const categoryName of categoryDirs) {
    const categoryPath = path.join(UPLOADS_DIR, categoryName);
    const albumDirs = getSubdirs(categoryPath);
    const children = [];

    for (const albumName of albumDirs) {
      const albumPath = path.join(categoryPath, albumName);
      const images = getImages(albumPath);

      if (images.length === 0) {
        emptyAlbums.push(categoryName + '/' + albumName);
        continue;
      }

      // Build web-relative paths: uploads/Category/Album/image.png
      const imagePaths = images.map(function(img) {
        return 'uploads/' + categoryName + '/' + albumName + '/' + img;
      });

      // Track referenced files for orphan cleanup
      imagePaths.forEach(function(p) { allReferencedFiles.add(p); });

      children.push({
        albumId: albumName,
        albumName: albumName,
        cover: imagePaths[0],
        images: imagePaths
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
    totalImages: totalImages,
    emptyAlbums: emptyAlbums,
    allReferencedFiles: allReferencedFiles
  };
}

/**
 * Remove orphan files (images in uploads not referenced by any album)
 * and remove empty directories.
 */
function cleanupOrphans(allReferencedFiles) {
  let removedFiles = 0;
  let removedDirs = 0;

  function walkDir(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    var entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath);
        // Remove directory if now empty
        if (fs.existsSync(fullPath) && fs.readdirSync(fullPath).length === 0) {
          fs.rmdirSync(fullPath);
          removedDirs++;
        }
      } else if (entry.isFile() && isImageFile(entry.name)) {
        var relPath = toWebPath(fullPath);
        if (!allReferencedFiles.has(relPath)) {
          fs.unlinkSync(fullPath);
          removedFiles++;
        }
      }
    }
  }

  walkDir(UPLOADS_DIR);
  return { removedFiles: removedFiles, removedDirs: removedDirs };
}

/**
 * Validate that every image referenced in categories actually exists on disk
 */
function validateCategories(categories) {
  var missing = [];
  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i];
    for (var j = 0; j < cat.children.length; j++) {
      var album = cat.children[j];
      for (var k = 0; k < album.images.length; k++) {
        var img = album.images[k];
        var fullPath = path.join(PROJECT_ROOT, img);
        if (!fs.existsSync(fullPath)) {
          missing.push(img);
        }
      }
    }
  }
  return missing;
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
    console.error('');
    console.error('Please run sync.bat first to copy images into uploads/.');
    process.exit(1);
  }

  // Step 1: Scan
  console.log('[1/4] Scanning uploads directory...');
  console.log('      Path: ' + UPLOADS_DIR);
  var result = scanUploads();

  console.log('      Categories : ' + result.categories.length);
  console.log('      Albums     : ' + result.totalAlbums);
  console.log('      Images     : ' + result.totalImages);

  if (result.emptyAlbums.length > 0) {
    console.log('      Empty albums skipped: ' + result.emptyAlbums.length);
    result.emptyAlbums.forEach(function(a) {
      console.log('        - ' + a);
    });
  }
  console.log('');

  // Step 2: Validate
  console.log('[2/4] Validating image references...');
  var missing = validateCategories(result.categories);
  if (missing.length > 0) {
    console.warn('      [WARN] Missing images: ' + missing.length);
    missing.forEach(function(m) {
      console.warn('        - ' + m);
    });
  } else {
    console.log('      All ' + result.totalImages + ' images verified.');
  }
  console.log('');

  // Step 3: Cleanup orphans
  console.log('[3/4] Cleaning up orphan files...');
  var cleanup = cleanupOrphans(result.allReferencedFiles);
  console.log('      Removed orphan files: ' + cleanup.removedFiles);
  console.log('      Removed empty dirs  : ' + cleanup.removedDirs);
  console.log('');

  // Step 4: Write JSON
  console.log('[4/4] Writing categories.json...');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result.categories, null, 2), 'utf8');
  console.log('      Output: ' + OUTPUT_FILE);
  console.log('');

  // Summary
  console.log('============================================================');
  console.log('  Import Complete!');
  console.log('============================================================');
  console.log('  Categories : ' + result.categories.length);
  console.log('  Albums     : ' + result.totalAlbums);
  console.log('  Images     : ' + result.totalImages);
  console.log('  Missing    : ' + missing.length);
  console.log('  Orphans    : ' + cleanup.removedFiles + ' files, ' + cleanup.removedDirs + ' dirs');
  console.log('============================================================');
}

main();
