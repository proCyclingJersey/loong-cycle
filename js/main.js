let allData = null;
let settings = null;
let currentCategory = 'all';
let currentPage = 1;
const limit = 24;
let filteredAlbums = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderCategories();
  renderAlbums();

  document.getElementById('searchBox').addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase().trim();
    currentPage = 1;
    filterAlbums(keyword);
  });
});

async function loadData() {
  try {
    const [sRes, cRes] = await Promise.all([
      fetch('data/settings.json'),
      fetch('data/categories.json')
    ]);
    settings = await sRes.json();
    allData = await cRes.json();

    document.getElementById('siteName').textContent = settings.site_name || 'Loong Cycle';
    document.title = settings.site_name || 'Loong Cycle';
    if (settings.avatar) document.getElementById('siteAvatar').src = settings.avatar;
    if (settings.site_description) {
      const firstLine = settings.site_description.split('\n').filter(l => l.trim())[0] || '';
      document.getElementById('siteDescShort').textContent = firstLine + ' | ' + (settings.whatsapp || '');
    }
  } catch (e) {
    console.error('加载数据失败', e);
    document.getElementById('albumGrid').innerHTML = '<div class="loading">数据加载失败</div>';
  }
}

function getAllAlbums() {
  const albums = [];
  allData.forEach(p => {
    p.children.forEach(c => {
      albums.push({ ...c, parent_name: p.name, parent_id: p.id });
    });
  });
  return albums;
}

function renderCategories() {
  const list = document.getElementById('categoryList');
  list.innerHTML = '<a href="#" class="category-item active" data-id="all">All Categories</a>';
  allData.forEach(p => {
    const a = document.createElement('a');
    a.href = '#';
    a.className = 'category-item';
    a.dataset.id = p.id;
    a.textContent = p.name;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      selectCategory(p.id, p.name);
    });
    list.appendChild(a);
  });
}

function selectCategory(id, name) {
  currentCategory = id;
  currentPage = 1;
  document.querySelectorAll('.category-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id == id);
  });
  document.getElementById('contentTitle').textContent = id === 'all' ? 'All Categories' : name;
  document.getElementById('searchBox').value = '';
  renderAlbums();
}

function getCurrentAlbums() {
  if (currentCategory === 'all') return getAllAlbums();
  const cat = allData.find(p => p.id == currentCategory);
  return cat ? cat.children.map(c => ({ ...c, parent_name: cat.name, parent_id: cat.id })) : [];
}

function filterAlbums(keyword) {
  const all = getCurrentAlbums();
  if (!keyword) {
    filteredAlbums = all;
  } else {
    filteredAlbums = all.filter(a => a.name.toLowerCase().includes(keyword));
  }
  renderAlbumGrid();
}

function renderAlbums() {
  filteredAlbums = getCurrentAlbums();
  renderAlbumGrid();
}

function renderAlbumGrid() {
  const grid = document.getElementById('albumGrid');
  const total = filteredAlbums.length;
  document.getElementById('albumCount').textContent = `${total} albums`;

  const totalPages = Math.ceil(total / limit);
  if (currentPage > totalPages) currentPage = 1;
  const start = (currentPage - 1) * limit;
  const pageAlbums = filteredAlbums.slice(start, start + limit);

  if (pageAlbums.length === 0) {
    grid.innerHTML = '<div class="loading">暂无相册</div>';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  grid.innerHTML = '';
  pageAlbums.forEach(album => {
    const card = document.createElement('a');
    card.href = `album.html?id=${album.id}`;
    card.className = 'album-card';
    const coverHtml = album.cover
      ? `<img src="${album.cover}" alt="${album.name}" class="album-cover" loading="lazy">`
      : '<div class="album-cover-placeholder">No Image</div>';
    card.innerHTML = `
      ${coverHtml}
      <div class="album-info">
        <div class="album-title">${escapeHtml(album.name)}</div>
        <div class="album-meta">${album.photo_count} photos</div>
      </div>
    `;
    grid.appendChild(card);
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pag = document.getElementById('pagination');
  if (totalPages <= 1) { pag.innerHTML = ''; return; }
  let html = `<button class="page-btn" onclick="goPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>‹</button>`;
  html += `<span class="page-info">${currentPage} / ${totalPages}</span>`;
  html += `<button class="page-btn" onclick="goPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>›</button>`;
  pag.innerHTML = html;
}

function goPage(page) {
  if (page < 1) return;
  currentPage = page;
  renderAlbumGrid();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
