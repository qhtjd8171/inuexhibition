// ================== 공통 유틸 ==================

// 문자열-JSON 안전 파싱
function parseJSONSafe(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// 이미지 존재 판별(캐시 활용: 쿼리스트링 미부착)
function probeImage(src) {
  return new Promise(resolve => {
    const im = new Image();
    im.decoding = 'async';
    im.loading = 'eager';
    im.addEventListener('load', () => resolve({ ok: true, src }), { once: true });
    im.addEventListener('error', () => resolve({ ok: false, src }), { once: true });
    im.src = src;
  });
}

// 후보군 중 먼저 성공하는 소스 1개 선택
async function chooseFirstExisting(candidates) {
  for (const src of candidates) {
    const r = await probeImage(src);
    if (r.ok) return src;
  }
  return null;
}

// 여러 이미지를 병렬 프리로드(성공한 것만 반환)
async function preloadList(list) {
  const tasks = list.map(src => probeImage(src));
  const res = await Promise.allSettled(tasks);
  return res
    .map(r => r.value)
    .filter(v => v && v.ok)
    .map(v => v.src);
}

// 규칙 기반 시퀀스 생성: [[01.avif,01.webp,01.jpg], [02.avif,...], ...]
function buildSequenceCandidates(pat) {
  const {
    base = '',
    prefix = '',
    pad = 2,
    start = 1,
    count = 1,
    exts = ['avif', 'png', 'jpg']
  } = pat || {};
  const sets = [];
  for (let i = 0; i < count; i++) {
    const num = String(start + i).padStart(pad, '0');
    sets.push(exts.map(ext => `${base}${prefix}${num}.${ext}`));
  }
  return sets;
}

// 카드로부터 폴더 경로 자동 유추(제품 전용 규칙)
function deriveFolderFromCard(card) {
  const cat = card.dataset.category?.toLowerCase();
  const name = card.querySelector('p')?.textContent?.trim();
  if (cat === 'product' && name) return `product/졸업전시도록_${name}`;
  return null;
}

// 페이지 진입 시 썸네일 경로 프리페치 힌트 삽입
function insertPrefetch(href) {
  if (!href) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'image';
  link.href = href;
  document.head.appendChild(link);
}

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

// ================== 수동 매핑 갤러리(필요 시 유지) ==================


// ================== 이미지 리스트 해석(메타 우선) ==================
async function resolveImageListFromCard(card) {
  // 1) 명시적 목록(data-images='["a.jpg","b.jpg"]')
  if (card.dataset.images) {
    const list = parseJSONSafe(card.dataset.images, null);
    if (Array.isArray(list) && list.length > 0) return list;
  }

  // 2) 규칙 기반(data-pattern='{"base":"x/","pad":2,"start":1,"count":12,"exts":["avif","webp","jpg"]}')
  if (card.dataset.pattern) {
    const pat = parseJSONSafe(card.dataset.pattern, null);
    if (pat) {
      const sets = buildSequenceCandidates(pat); // [[01.avif,01.webp...], [02...], ...]
      // 첫 장은 즉시 검증, 나머지는 병렬 검증
      const first = await chooseFirstExisting(sets[0]);
      const restPromises = sets.slice(1).map(set => chooseFirstExisting(set));
      const rest = await Promise.all(restPromises);
      return [first, ...rest].filter(Boolean);
    }
  }

  // 3) 수동 매핑 키(data-gallery)가 galleries에 있으면 사용
  const keyOrFolder = card.dataset.gallery || deriveFolderFromCard(card);
  if (!keyOrFolder) return [];

  if (galleries[keyOrFolder]) {
    return galleries[keyOrFolder].slice();
  }

  // 4) 폴더 자동 탐색을 최소화: 01만 확인하고 존재하면 count 없이 점진 로딩
  // 요구사항상 "필요한 만큼만" 요청: 먼저 01만, 이후 라이트박스 내에서 인접만 프리로드
  const firstCandidates = ['avif', 'png', 'jpg'].map(ext => `${keyOrFolder}/01.${ext}`);
  const first = await chooseFirstExisting(firstCandidates);
  return first ? [first] : [];
}

// ================== 라이트박스 ==================
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

  let cur = {
    key: null,
    // 확정된 실제 이미지 URL 리스트
    list: [],
    // 규칙 기반일 경우, 다음 후보들을 생성하기 위한 패턴 정보(옵션)
    pattern: null,
    i: 0
  };

  // 카드 클릭 → 갤러리 오픈(점진적/병렬)
  document.addEventListener('click', async (e) => {
    const card = e.target.closest('.project-item');
    if (!card) return;

    // 메타데이터 해석
    const title = card.dataset.title || card.querySelector('h3')?.textContent || '';
    const desc = card.dataset.desc || card.querySelector('p')?.textContent || '';

    // 패턴 정보를 보존(라이트박스 내 확장용)
    cur.pattern = card.dataset.pattern ? parseJSONSafe(card.dataset.pattern, null) : null;
    if (!cur.pattern && (card.dataset.gallery || deriveFolderFromCard(card))) {
      // data-pattern이 없다면, 라이트박스에서 "필요 시" 다음 번호만 생성할 수 있도록 기본 규칙을 유추
      const folder = card.dataset.gallery || deriveFolderFromCard(card);
      if (folder) {
        cur.pattern = {
          base: folder + '/',
          prefix: '',
          pad: 2,
          start: 1,
          count: 200,
          exts: ['avif', 'png', 'jpg']
        };
      }
    }

    // 리스트 해석(메타 우선)
    let list = await resolveImageListFromCard(card);
    if (!list.length) return;

    openLB({ list, title, desc, start: 0 });

    // 라이트박스가 열리자마자 첫 2~3장 프리로드(우선순위 부여)
    preloadTop(list, 3);
  });

  function openLB({ list, title, desc, start = 0 }) {
    cur.key = title;
    cur.list = list.slice(); // 실제로 표시 가능한 확정 리스트
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
    img.src = src;
    img.alt = `${cur.key} - ${cur.i + 1}`;
    idxEl.textContent = String(cur.i + 1);
    highlight(cur.i);

    // 인접 이미지 프리로드(병렬), 필요 시 다음 이미지를 탐색-확장
    ensureNeighbor(cur.i + 1);
    ensureNeighbor(cur.i - 1);
  }

  function buildThumbs() {
    thumbs.innerHTML = '';
    cur.list.forEach((src, i) => {
      const b = document.createElement('button');
      const t = document.createElement('img');
      t.src = src;
      t.alt = `thumb ${i + 1}`;
      b.appendChild(t);
      b.addEventListener('click', () => show(i));
      thumbs.appendChild(b);
    });
  }

  function highlight(i) {
    thumbs.querySelectorAll('img').forEach((el, k) => el.classList.toggle('active', k === i));
  }

  // 인접 인덱스를 보장: 리스트가 부족하면 규칙을 통해 "다음 번호"만 점진적으로 확장
  async function ensureNeighbor(targetIndex) {
    // 이미 존재하면 프리로드만
    if (targetIndex >= 0 && targetIndex < cur.list.length) {
      const src = cur.list[targetIndex];
      const im = new Image();
      try { im.fetchPriority = targetIndex === cur.i + 1 ? 'high' : 'low'; } catch { }
      im.decoding = 'async';
      im.loading = 'eager';
      im.src = src;
      return;
    }

    // 오른쪽으로 넘어가는 경우에만 확장 시도
    if (targetIndex === cur.list.length && cur.pattern) {
      const nextNumber = (cur.pattern.start || 1) + cur.list.length; // 현재 길이 기준 다음 번호
      const num = String(nextNumber).padStart(cur.pattern.pad || 2, '0');
      const candidates = (cur.pattern.exts || ['avif', 'png', 'jpg'])
        .map(ext => `${cur.pattern.base}${cur.pattern.prefix || ''}${num}.${ext}`);

      const hit = await chooseFirstExisting(candidates);
      if (hit) {
        cur.list.push(hit);
        totalEl.textContent = String(cur.list.length);

        // 썸네일 1개만 증분 추가
        const b = document.createElement('button');
        const t = document.createElement('img');
        t.src = hit;
        t.alt = `thumb ${cur.list.length}`;
        b.appendChild(t);
        const indexForClick = cur.list.length - 1;
        b.addEventListener('click', () => show(indexForClick));
        thumbs.appendChild(b);
      }
    }
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

  // 우선 프리로드(라이트박스 오픈 직후 첫 2~3장)
  function createImg(src, priority = 'auto') {
    const im = new Image();
    try { im.fetchPriority = priority; } catch { }
    im.decoding = 'async';
    im.loading = 'eager';
    im.src = src;
    return im;
  }
  function preloadTop(list, n = 3) {
    list.slice(0, n).forEach((src, i) => createImg(src, i === 0 ? 'high' : 'low'));
  }
})();

// ================== 카드 썸네일(메타 우선, 단일 검사, 병렬 세팅) ==================
(async function setCardThumbnails() {
  const cards = document.querySelectorAll('.project-item');

  // data-thumb가 있으면 그대로 사용, 없으면 pattern/폴더 기준으로 01만 시도
  async function resolveThumb(card) {
    if (card.dataset.thumb) return card.dataset.thumb;

    // 패턴이 있으면 첫 번호만 생성
    if (card.dataset.pattern) {
      const pat = parseJSONSafe(card.dataset.pattern, null);
      if (pat) {
        const n = String(pat.start ?? 1).padStart(pat.pad ?? 2, '0');
        const candidates = (pat.exts ?? ['avif', 'png', 'jpg'])
          .map(ext => `${pat.base}${pat.prefix ?? ''}${n}.${ext}`);
        insertPrefetch(candidates[0]); // 가벼운 프리페치 힌트
        return await chooseFirstExisting(candidates);
      }
    }

    // 패턴이 없으면 data-gallery 또는 자동 유추 폴더에서 01만 시도
    const folder = card.dataset.gallery || deriveFolderFromCard(card);
    if (folder) {
      const candidates = ['avif', 'png', 'jpg'].map(ext => `${folder}/01.${ext}`);
      insertPrefetch(candidates[0]);
      return await chooseFirstExisting(candidates);
    }
    return null;
  }

  await Promise.allSettled(Array.from(cards).map(async card => {
    const placeholder = card.querySelector('.image-placeholder');
    if (!placeholder) return;
    const src = await resolveThumb(card);
    if (src) {
      placeholder.style.backgroundImage = `url("${src}")`;
    }
  }));
})();

