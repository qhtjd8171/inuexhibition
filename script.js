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

// 안전한 이미지 존재 검사
function imageExists(src, { cacheBust = false } = {}) {
  return new Promise(resolve => {
    const im = new Image();
    im.onload = () => resolve(true);
    im.onerror = () => resolve(false);
    im.src = cacheBust ? (src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now()) : src;
  });
}

// 2자리 패딩 · 단일 확장자 자동 탐색
async function discoverSequence(folder, {
  max = 50,
  start = 1,
  pad = 2,
  ext = 'png'
} = {}) {
  const list = [];
  let misses = 0; // 연속 실패 2회면 종료

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

// 제품 카드: product/졸업전시도록_${이름}
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

    // 우선순위: data-images > window.galleries > 자동 탐색
    let list = null;
    if (card.dataset.images) {
      try {
        const arr = JSON.parse(card.dataset.images);
        if (Array.isArray(arr) && arr.length) list = arr;
      } catch {}
    }

    // 폴더 키 결정
    const folderOrKey = card.dataset.gallery || deriveFolderFromCard(card);

    // 전역 매핑 사용(있을 때만)
    if (!list && folderOrKey && window.galleries && window.galleries[folderOrKey]) {
      list = window.galleries[folderOrKey].slice();
    }

    // 자동 탐색
    if (!list && folderOrKey) {
      // 첫 장으로 확장자 판별
      const pngFirst = await imageExists(`${folderOrKey}/01.png`);
      const ext = pngFirst ? 'png' : 'jpg';
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

  function preload(src) {
    const p = new Image();
    p.decoding = 'async';
    p.loading = 'lazy';
    p.src = src;
  }

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
    if (card.dataset.thumb) {
      placeholder.style.backgroundImage = `url("${card.dataset.thumb}")`;
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

function getYouTubeId(url){
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

function renderThumbsWithOptionalVideo(cardEl){
  const media  = document.querySelector('.lightbox-media');
  const thumbs = document.querySelector('.lb-thumbs');
  const images = JSON.parse(cardEl.dataset.images || '[]');

  // 초기 큰 미디어
  media.innerHTML = images[0]
    ? `<img src="${images[0]}" alt="" style="max-width:100%;max-height:100%;object-fit:contain;display:block;">`
    : '';
  thumbs.innerHTML = '';

  // 이미지 썸네일들
  images.forEach(src=>{
    const b = document.createElement('button');
    b.className = 'lb-thumb';
    b.innerHTML = `<img src="${src}" alt="">`;
    b.onclick = ()=> media.innerHTML =
      `<img src="${src}" alt="" style="max-width:100%;max-height:100%;object-fit:contain;display:block;">`;
    thumbs.appendChild(b);
  });

  // 이 카드에만 유튜브 썸네일 추가
  const yt = cardEl.dataset.youtube;
  const id = yt && getYouTubeId(yt);
  if(id){
    const v = document.createElement('button');
    v.className = 'lb-thumb lb-thumb-video';
    v.innerHTML = `
      <img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="영상 썸네일">
      <span class="play-badge">▶</span>
    `;
    v.onclick = ()=> {
      media.innerHTML = `
        <div class="iframe-wrap" style="position:relative;width:100%;padding-bottom:56.25%;height:0;">
          <iframe
            src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0"
            title="YouTube player"
            style="position:absolute;inset:0;width:100%;height:100%;border:0;"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen></iframe>
        </div>`;
    };
    thumbs.appendChild(v);
  }
}

// 카드 클릭 시 실행
document.addEventListener('click',(e)=>{
  const card = e.target.closest('.project-item');
  if(!card) return;
  // 라이트박스 열기(필요 시 기존 코드)
  document.getElementById('lightbox').classList.add('open');
  renderThumbsWithOptionalVideo(card);
});
