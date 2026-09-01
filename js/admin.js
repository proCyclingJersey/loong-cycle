let ghConfig = null;
let categories = [];
let settings = {};
let settingsSha = null;
let categoriesSha = null;
let editingCatId = null;
let editingParentId = null;
let currentAlbumId = null;

const API_BASE = 'https://api.github.com';

// ============ 初始化 ============
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('ghConfig');
  if (saved) {
    try {
      ghConfig = JSON.parse(saved);
      document.getElementById('ghOwner').value = ghConfig.owner || '';
      document.getElementById('ghRepo').value = ghConfig.repo || '';
      document.getElementById('ghToken').value = ghConfig.token || '';
    } catch(e) {}
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
      document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
    });
  });

  document.getElementById('avatarInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) uploadAvatar(file);
  });

  document.getElementById('photoInput').addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) uploadPhotos(files);
  });
});

async function saveConfig() {
  const owner = document.getElementById('ghOwner').value.trim();
  const repo = document.getElementById('ghRepo').value.trim();
  const token = document.getElementById('ghToken').value.trim();
  const errEl = document.getElementById('configError');

  if (!owner || !repo || !token) {
    errEl.textContent = '请填写完整信息';
    return;
  }

  errEl.textContent = '正在验证连接...';
  ghConfig = { owner, repo, token };

  // 测试连接
  try {
    const test = await ghFetch('data/settings.json');
    if (!test.content) throw new Error('返回数据异常');
    localStorage.setItem('ghConfig', JSON.stringify(ghConfig));
    errEl.textContent = '';
    showAdmin();
  } catch (e) {
    let msg = '连接失败：' + e.message;
    if (e.message.includes('401') || e.message.includes('Bad credentials')) {
      msg = 'Token无效，请检查是否复制完整。注意：需要Classic Token，勾选repo权限。';
    } else if (e.message.includes('404')) {
      msg = '找不到仓库或文件，请检查用户名和仓库名是否正确。';
    } else if (e.message.includes('403')) {
      msg = '权限不足，请确认Token有repo权限，且仓库是public或Token有权限访问。';
    }
    errEl.textContent = msg;
  }
}

function logout() {
  localStorage.removeItem('ghConfig');
  location.reload();
}

function showAdmin() {
  document.getElementById('configPage').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  loadData();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 5000);
}

// ============ GitHub API ============
async function ghFetch(path, options = {}) {
  const url = `${API_BASE}/repos/${ghConfig.owner}/${ghConfig.repo}/contents/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${ghConfig.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers
    }
  });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      errMsg = err.message || errMsg;
    } catch(e) {}
    throw new Error(errMsg);
  }
  return res.json();
}

function b64Decode(str) {
  const binary = atob(str.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function b64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function getFile(path) {
  const data = await ghFetch(path);
  if (!data.content) throw new Error('文件内容为空');
  const content = b64Decode(data.content);
  return { content, sha: data.sha };
}

async function putFile(path, content, message, sha = null) {
  const body = { message, content: b64Encode(content) };
  if (sha) body.sha = sha;
  return ghFetch(path, { method: 'PUT', body: JSON.stringify(body) });
}

async function deleteFile(path, sha, message) {
  return ghFetch(path, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha })
  });
}

// ============ 数据加载 ============
async function loadData() {
  try {
    showToast('正在从GitHub加载数据...');
    const [sData, cData] = await Promise.all([
      getFile('data/settings.json'),
      getFile('data/categories.json')
    ]);
    settings = JSON.parse(sData.content);
    categories = JSON.parse(cData.content);
    settingsSha = sData.sha;
    categoriesSha = cData.sha;
    renderCategoryTree();
    fillSettingsForm();
    showToast(`加载完成：${categories.length}个目录，${categories.reduce((s,p)=>s+p.children.length,0)}个相册`);
  } catch (e) {
    showToast('数据加载失败：' + e.message);
    document.getElementById('categoryTree').innerHTML =
      `<div style="padding:20px;color:#e74c3c;">加载失败：${e.message}<br><br>请点击右上角"退出"，重新检查GitHub配置。</div>`;
  }
}

function fillSettingsForm() {
  document.getElementById('setting_site_name').value = settings.site_name || '';
  document.getElementById('setting_whatsapp').value = settings.whatsapp || '';
  document.getElementById('setting_site_description').value = settings.site_description || '';
  if (settings.avatar) document.getElementById('avatarPreview').src = settings.avatar + '?t=' + Date.now();
}

// ============ 目录管理 ============
function renderCategoryTree() {
  const tree = document.getElementById('categoryTree');
  tree.innerHTML = '';
  if (categories.length === 0) {
    tree.innerHTML = '<div style="padding:20px;color:#999;">暂无目录，点击上方按钮添加</div>';
    return;
  }
  categories.forEach(parent => {
    const div = document.createElement('div');
    div.className = 'cat-parent';
    div.innerHTML = `
      <div class="cat-parent-header" onclick="this.nextElementSibling.classList.toggle('open')">
        <span class="cat-parent-name">${escapeHtml(parent.name)} <span style="color:#999;font-weight:400;font-size:12px;">(${parent.children.length})</span></span>
        <span class="cat-parent-actions">
          <button class="btn-secondary" onclick="event.stopPropagation();editCategory(${parent.id}, null)">编辑</button>
          <button class="btn-danger" onclick="event.stopPropagation();deleteCategory(${parent.id})">删除</button>
        </span>
      </div>
      <div class="cat-children">
        <button class="add-child-btn" onclick="showAddCategory(${parent.id})">+ 添加二级目录（相册）</button>
        ${parent.children.map(child => `
          <div class="cat-child">
            <span class="cat-child-name">${escapeHtml(child.name)}</span>
            <span class="cat-child-count">${child.photos.length} photos</span>
            <span class="cat-child-actions">
              <button class="btn-secondary" onclick="openAlbum(${child.id}, '${escapeHtml(child.name).replace(/'/g, "\\'")}')">管理图片</button>
              <button class="btn-secondary" onclick="editCategory(${child.id}, ${parent.id})">编辑</button>
              <button class="btn-danger" onclick="deleteCategory(${child.id})">删除</button>
            </span>
          </div>
        `).join('')}
      </div>
    `;
    tree.appendChild(div);
  });
}

function showAddCategory(parentId) {
  editingCatId = null;
  editingParentId = parentId;
  document.getElementById('catModalTitle').textContent = parentId === null ? '添加一级目录' : '添加二级目录（相册）';
  document.getElementById('catNameInput').value = '';
  document.getElementById('catModal').style.display = 'flex';
}

function editCategory(id, parentId) {
  let cat;
  if (parentId === null) {
    cat = categories.find(c => c.id === id);
  } else {
    const parent = categories.find(c => c.id === parentId);
    cat = parent ? parent.children.find(c => c.id === id) : null;
  }
  if (!cat) return;
  editingCatId = id;
  editingParentId = parentId;
  document.getElementById('catModalTitle').textContent = '编辑目录';
  document.getElementById('catNameInput').value = cat.name;
  document.getElementById('catModal').style.display = 'flex';
}

async function saveCategory() {
  const name = document.getElementById('catNameInput').value.trim();
  if (!name) { showToast('名称不能为空'); return; }

  try {
    if (editingCatId) {
      if (editingParentId === null) {
        const cat = categories.find(c => c.id === editingCatId);
        if (cat) cat.name = name;
      } else {
        const parent = categories.find(c => c.id === editingParentId);
        const cat = parent ? parent.children.find(c => c.id === editingCatId) : null;
        if (cat) cat.name = name;
      }
    } else {
      const newId = Date.now();
      if (editingParentId === null) {
        categories.push({ id: newId, name, children: [] });
      } else {
        const parent = categories.find(c => c.id === editingParentId);
        if (parent) parent.children.push({ id: newId, name, cover: null, photo_count: 0, photos: [] });
      }
    }

    closeCatModal();
    showToast('正在保存到GitHub...');
    await commitCategories(editingCatId ? '编辑目录' : '添加目录');
    renderCategoryTree();
    showToast('保存成功，网站将在1-2分钟内更新');
  } catch (e) {
    showToast('保存失败：' + e.message);
  }
}

async function deleteCategory(id) {
  let cat, parent;
  const parentCat = categories.find(c => c.id === id);
  if (parentCat) {
    cat = parentCat;
    parent = null;
  } else {
    for (const p of categories) {
      const found = p.children.find(c => c.id === id);
      if (found) { cat = found; parent = p; break; }
    }
  }
  if (!cat) return;

  const msg = parent ? `确定删除相册"${cat.name}"？其下所有图片都会被删除！` : `确定删除目录"${cat.name}"？其下所有相册和图片都会被删除！`;
  if (!confirm(msg)) return;

  try {
    showToast('正在删除...');
    const allPhotos = [];
    if (parent) {
      allPhotos.push(...cat.photos);
    } else {
      cat.children.forEach(c => allPhotos.push(...c.photos));
    }
    for (const photo of allPhotos) {
      try {
        const path = photo.filepath.replace(/^\//, '');
        const fileData = await getFile(path);
        if (fileData.sha) await deleteFile(path, fileData.sha, '删除图片');
      } catch (e) { console.log('删除图片文件跳过:', e.message); }
    }

    if (parent) {
      parent.children = parent.children.filter(c => c.id !== id);
    } else {
      categories = categories.filter(c => c.id !== id);
    }

    await commitCategories('删除目录');
    renderCategoryTree();
    showToast('删除成功');
  } catch (e) {
    showToast('删除失败：' + e.message);
  }
}

function closeCatModal() {
  document.getElementById('catModal').style.display = 'none';
}

// ============ 图片管理 ============
function openAlbum(id, name) {
  currentAlbumId = id;
  document.getElementById('modalAlbumTitle').textContent = name + ' - 图片管理';
  document.getElementById('albumModal').style.display = 'flex';
  renderAlbumPhotos(id);
}

function findAlbum(id) {
  for (const p of categories) {
    const found = p.children.find(c => c.id === id);
    if (found) return { album: found, parent: p };
  }
  return null;
}

function renderAlbumPhotos(id) {
  const result = findAlbum(id);
  if (!result) return;
  const { album } = result;
  const grid = document.getElementById('modalPhotoGrid');
  if (album.photos.length === 0) {
    grid.innerHTML = '<p style="color:#999;grid-column:1/-1;text-align:center;padding:20px;">暂无图片，点击上方按钮上传</p>';
    return;
  }
  grid.innerHTML = album.photos.map((p, i) => `
    <div class="modal-photo-item">
      <img src="${p.filepath}" alt="${escapeHtml(p.filename)}" loading="lazy">
      <button class="modal-photo-del" onclick="deletePhoto(${id}, ${i})" title="删除">&times;</button>
    </div>
  `).join('');
}

async function uploadPhotos(files) {
  showToast(`正在上传 ${files.length} 张图片...`);
  const result = findAlbum(currentAlbumId);
  if (!result) return;
  const { album } = result;
  let success = 0;

  for (const file of files) {
    try {
      const compressed = await compressImage(file);
      const fileName = `${currentAlbumId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.jpg`;
      const path = `uploads/${fileName}`;
      const base64 = arrayBufferToBase64(compressed);
      await putFile(path, base64, `上传图片 ${fileName}`, null);

      album.photos.push({ filename: file.name, filepath: path });
      album.cover = album.photos[0].filepath;
      album.photo_count = album.photos.length;
      success++;
    } catch (e) {
      console.error('上传失败:', e);
      showToast(`"${file.name}"上传失败：${e.message}`);
    }
  }

  if (success > 0) {
    try {
      await commitCategories(`上传${success}张图片`);
      renderAlbumPhotos(currentAlbumId);
      renderCategoryTree();
      showToast(`成功上传${success}张，网站将在1-2分钟内更新`);
    } catch (e) {
      showToast('图片已上传但数据保存失败：' + e.message);
    }
  }
  document.getElementById('photoInput').value = '';
}

async function deletePhoto(albumId, index) {
  if (!confirm('确定删除这张图片？')) return;
  const result = findAlbum(albumId);
  if (!result) return;
  const { album } = result;
  const photo = album.photos[index];

  try {
    const path = photo.filepath.replace(/^\//, '');
    try {
      const fileData = await getFile(path);
      if (fileData.sha) await deleteFile(path, fileData.sha, '删除图片');
    } catch(e) { console.log('删除图片文件跳过:', e.message); }

    album.photos.splice(index, 1);
    album.cover = album.photos.length > 0 ? album.photos[0].filepath : null;
    album.photo_count = album.photos.length;

    await commitCategories('删除图片');
    renderAlbumPhotos(albumId);
    renderCategoryTree();
    showToast('删除成功');
  } catch (e) {
    showToast('删除失败：' + e.message);
  }
}

function closeModal() {
  document.getElementById('albumModal').style.display = 'none';
}

// ============ 头像上传 ============
async function uploadAvatar(file) {
  showToast('正在上传头像...');
  try {
    const compressed = await compressImage(file, 300);
    const base64 = arrayBufferToBase64(compressed);
    const path = 'uploads/avatar.png';
    const existing = await getFile(path);
    await putFile(path, base64, '更新头像', existing.sha);
    settings.avatar = 'uploads/avatar.png';
    await commitSettings('更新头像');
    document.getElementById('avatarPreview').src = 'uploads/avatar.png?t=' + Date.now();
    showToast('头像更新成功');
  } catch (e) {
    showToast('上传失败：' + e.message);
  }
}

// ============ 店铺设置 ============
async function saveSettings() {
  try {
    settings.site_name = document.getElementById('setting_site_name').value;
    settings.whatsapp = document.getElementById('setting_whatsapp').value;
    settings.site_description = document.getElementById('setting_site_description').value;
    showToast('正在保存...');
    await commitSettings('更新店铺设置');
    showToast('保存成功，网站将在1-2分钟内更新');
  } catch (e) {
    showToast('保存失败：' + e.message);
  }
}

// ============ 提交到GitHub ============
async function commitCategories(message) {
  const res = await putFile('data/categories.json', JSON.stringify(categories, null, 2), message, categoriesSha);
  categoriesSha = res.content.sha;
}

async function commitSettings(message) {
  const res = await putFile('data/settings.json', JSON.stringify(settings, null, 2), message, settingsSha);
  settingsSha = res.content.sha;
}

// ============ 工具函数 ============
function compressImage(file, maxWidth = 1200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = h * (maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (blob) blob.arrayBuffer().then(resolve).catch(reject);
          else reject(new Error('图片压缩失败'));
        }, 'image/jpeg', 0.82);
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
