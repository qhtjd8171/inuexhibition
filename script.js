// ================== 드롭다운 탭 선택/필터 ==================
document.addEventListener('DOMContentLoaded', () => {
  const tabLinks = document.querySelectorAll('.dropdown-menu .tab-link');
  const items = document.querySelectorAll('.project-item');

  function applyFilter(filter) {
    const hasCategory = Array.from(items).some(el => el.dataset.category);
    if (!hasCategory) return;
    items.forEach(el => {
      const cat = (el.dataset.category || '').toLowerCase();
      const show = filter === 'all' ? true : (cat === filter);
      el.style.display = show ? '' : 'none';
    });
  }

  tabLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      tabLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const filter = (link.dataset.filter || 'all').toLowerCase();
      applyFilter(filter);
    });
  });

  const initial = document.querySelector('.dropdown-menu .tab-link[data-filter="all"]');
  if (initial) initial.click();
});

// ================== 라이트박스 갤러리 ==================

// (1) 안전한 이미지 존재 검사
function imageExists(src, { cacheBust = false } = {}) {
  return new Promise(resolve => {
    const im = new Image();
    im.onload = () => resolve(true);
    im.onerror = () => resolve(false);
    im.src = cacheBust ? (src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now()) : src;
  });
}

// (2) 파일 구조에 맞춘 자동 탐색
// 기본 가정: 2자리 패딩(01..), 단일 확장자만 사용(.png 또는 .jpg)
async function discoverSequence(folder, {
  max = 50,
  start = 1,
  pad = 2,
  ext = 'png' // 필요 시 'jpg'로 변경
} = {}) {
  const list = [];
  let misses = 0; // 연속 실패 2회면 종료(존재 구간이 끝난 것으로 간주)

  for (let n = start; n <= max && misses < 2; n++) {
    const num = String(n).padStart(pad, '0');
    const src = `${folder}/${num}.${ext}`;
    if (await imageExists(src)) {
      list.push(src);
      misses = 0;
    } else {
      misses++;
    }
  }
  return list;
}

// (3) data-gallery가 없을 때 자동 유추(제품: product/졸업전시하도록_이름)
function deriveFolderFromCard(card) {
  const cat = card.dataset.category?.toLowerCase();
  const name = card.querySelector('p')?.textContent?.trim();
  if (cat === 'product' && name) return `product/졸업전시도록_${name}`;
  return null;
}

(function () {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lb-image');
  const titleEl = document.getElementById('lb-title');
  const descEl = document.getElementById('lb-desc');
  const idxEl = document.getElementById('lb-idx');
  const totalEl = document.getElementById('lb-total');
  const thumbs = document.getElementById('lb-thumbs');
  const btnPrev = lb.querySelector('.lb-prev');
  const btnNext = lb.querySelector('.lb-next');
  const btnClose = lb.querySelector('.lb-close');

  let cur = { key: null, list: [], i: 0 };

  // 카드 클릭 → 갤러리 오픈
  document.addEventListener('click', async (e) => {
    const card = e.target.closest('.project-item');
    if (!card) return;

    const folderOrKey = card.dataset.gallery || deriveFolderFromCard(card);
    if (!folderOrKey) return;

    // 우선순위: data-images > window.galleries > 자동 탐색
    let list = null;
    if (card.dataset.images) {
      try {
        const arr = JSON.parse(card.dataset.images);
        if (Array.isArray(arr) && arr.length) list = arr;
      } catch {}
    }
    if (!list && window.galleries && window.galleries[folderOrKey]) {
      list = window.galleries[folderOrKey].slice();
    }
    if (!list) {
      // 폴더별 실제 확장자 선택: png 우선, 없으면 jpg
      const firstPng = await imageExists(`${folderOrKey}/01.png`);
      const ext = firstPng ? 'png' : 'jpg';
      list = await discoverSequence(folderOrKey, { ext, pad: 2, max: 50 });
    }

    if (!list || !list.length) return;

    openLB({
      list,
      title: card.dataset.title || card.querySelector('h3')?.textContent || '',
      desc: card.dataset.desc || card.querySelector('p')?.textContent || ''
    });
  });

  function openLB({ list, title, desc, start = 0 }) {
    cur.key = title;
    cur.list = list;
    cur.i = Math.max(0, Math.min(start, cur.list.length - 1));
    titleEl.textContent = title;
    descEl.textContent = desc;
    totalEl.textContent = String(cur.list.length);
    buildThumbs();
    show(cur.i);
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLB() {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function show(i) {
    cur.i = (i + cur.list.length) % cur.list.length;
    const src = cur.list[cur.i];
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = src;
    img.alt = `${cur.key} - ${cur.i + 1}`;
    idxEl.textContent = String(cur.i + 1);
    highlight(cur.i);
    preload(cur.list[(cur.i + 1) % cur.list.length]);
  }

  function preload(src) { const p = new Image(); p.decoding = 'async'; p.loading = 'lazy'; p.src = src; }

  function buildThumbs() {
    thumbs.innerHTML = '';
    cur.list.forEach((src, i) => {
      const b = document.createElement('button');
      const t = document.createElement('img');
      t.decoding = 'async';
      t.loading = 'lazy';
      t.src = src; t.alt = `thumb ${i + 1}`;
      b.appendChild(t);
      b.addEventListener('click', () => show(i));
      thumbs.appendChild(b);
    });
  }

  function highlight(i) {
    thumbs.querySelectorAll('img').forEach((el, k) => el.classList.toggle('active', k === i));
  }

  // 내비게이션/닫기/키보드 제어
  btnPrev.addEventListener('click', () => show(cur.i - 1));
  btnNext.addEventListener('click', () => show(cur.i + 1));
  btnClose.addEventListener('click', closeLB);
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLB(); });

  window.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur.i - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(cur.i + 1); }
    if (e.key === 'Escape') { e.preventDefault(); closeLB(); }
  });
})();

// ================== 카드 썸네일(01만 검사) ==================
(async function setCardThumbnails() {
  const cards = document.querySelectorAll('.project-item');

  async function findThumb(folder) {
    const png = `${folder}/01.png`;
    if (await imageExists(png)) return png;
    const jpg = `${folder}/01.jpg`;
    if (await imageExists(jpg)) return jpg;
    return null;
  }

  for (const card of cards) {
    const placeholder = card.querySelector('.image-placeholder');
    if (!placeholder) continue;
    // 우선순위: data-thumb > data-gallery/자동
    const direct = card.dataset.thumb;
    if (direct) {
      placeholder.style.backgroundImage = `url("${direct}")`;
      continue;
    }
    const folder = card.dataset.gallery || deriveFolderFromCard(card);
    if (!folder) continue;
    const src = await findThumb(folder);
    if (src) {
      placeholder.style.backgroundImage = `url("${src}")`;
    }
  }
})();
