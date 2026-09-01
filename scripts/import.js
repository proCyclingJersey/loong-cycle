const fs = require('fs');
const path = require('path');

// 根目录（loong‑cycle的上级，相册_优化后）
const SOURCE_ROOT = path.resolve(__dirname, '../../');
// data文件夹在项目根目录
const OUTPUT_DATA = path.resolve(__dirname, '../data/categories.json');
const UPLOAD_DEST = path.resolve(__dirname, '../uploads');

// 自动确保data文件夹存在
const dataDir = path.dirname(OUTPUT_DATA);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(UPLOAD_DEST)) {
    fs.mkdirSync(UPLOAD_DEST, { recursive: true });
}

console.log("源目录：", SOURCE_ROOT);

function copyFile(src, dest) {
    if (!fs.existsSync(path.dirname(dest))) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
    }
    fs.copyFileSync(src, dest);
}

function readFirstLevel() {
    const list = fs.readdirSync(SOURCE_ROOT, { withFileTypes: true });
    const result = [];
    for (const item of list) {
        if (item.isDirectory() && item.name !== "loong-cycle") {
            result.push({
                id: item.name,
                name: item.name,
                children: readSecond(path.join(SOURCE_ROOT, item.name))
            })
        }
    }
    return result;
}

function readSecond(parentPath) {
    const dirs = fs.readdirSync(parentPath, { withFileTypes: true });
    const albums = [];
    for (const d of dirs) {
        if (d.isDirectory()) {
            const fullPath = path.join(parentPath, d.name);
            const imgs = getImageFiles(fullPath);
            if (imgs.length === 0) continue;

            const coverFile = imgs[0];
            const srcImg = path.join(fullPath, coverFile);
            const destImg = path.join(UPLOAD_DEST, coverFile);
            copyFile(srcImg, destImg);

            for(const f of imgs){
                copyFile(path.join(fullPath,f), path.join(UPLOAD_DEST,f));
            }

            const imageList = imgs.map(f => `uploads/${f}`);
            albums.push({
                albumId: d.name,
                albumName: d.name,
                cover: `uploads/${coverFile}`,
                images: imageList
            })
        }
    }
    return albums;
}

function getImageFiles(dir) {
    const all = fs.readdirSync(dir, { withFileTypes: true });
    const exts = ['.jpg', '.jpeg', '.png', '.webp'];
    return all
        .filter(f => f.isFile())
        .filter(f => exts.includes(path.extname(f.name).toLowerCase()))
        .map(f => f.name);
}

async function run() {
    console.log("开始扫描文件夹...");
    const categories = readFirstLevel();
    fs.writeFileSync(OUTPUT_DATA, JSON.stringify(categories, null, 2), 'utf8');
    console.log("✅已生成 categories.json");
    let albumCount = 0;
    categories.forEach(c => albumCount += c.children.length);
    console.log(`一级目录${categories.length}个，相册${albumCount}个`);
    console.log("运行完成！");
}

run().catch(err => {
    console.error(err);
    process.exit(1);
})
