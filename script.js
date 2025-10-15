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

// (1) 선택: 수동 매핑(예: Our Run 유지)
const galleries = {
  photo1: [
    'photo1/2.jpg',
    'photo1/2-1.jpg',
    'photo1/2-2.jpg'
  ]
};

// (2) 이미지 존재 여부 검사: load / error 이벤트 활용
function imageExists(src) {
  return new Promise(resolve => {
    const im = new Image();
    im.addEventListener('load', () => resolve(true), { once: true });
    im.addEventListener('error', () => resolve(false), { once: true });
    im.src = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now(); // 캐시 회피
  });
}

// (3) 폴더 내 연속 이미지 자동 탐색
// 폴더/01.png, 02.png … 우선 시도, 없으면 jpg/jpeg/webp도 탐색
async function discoverSequence(folder, {
  max = 200,
  start = 1,
  pads = [2, 1, 3],              // 01, 1, 001 순서
  exts = ['png', 'jpg', 'jpeg', 'webp']
} = {}) {
  const list = [];
  let misses = 0;                // 연속 실패 카운트(3회면 종료)

  for (let n = start; n <= max && misses < 3; n++) {
    let hit = false;

    for (const pad of pads) {
      const num = String(n).padStart(pad, '0');
      for (const ext of exts) {
        const src = `${folder}/${num}.${ext}`;
        if (await imageExists(src)) { list.push(src); hit = true; break; }
      }
      if (hit) break;
    }

    misses = hit ? 0 : (misses + 1);
  }

  return list;
}

// (4) data-gallery가 없을 때 자동 유추(제품: product/졸업전시도록_이름)
function deriveFolderFromCard(card) {
  const cat = card.dataset.category?.toLowerCase();
  const name = card.querySelector('p')?.textContent?.trim();
  if (cat === 'product' && name) return `product/졸업전시도록_${name}`;
  return null;
}

(function(){
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lb-image');
  const titleEl = document.getElementById('lb-title');
  const descEl  = document.getElementById('lb-desc');
  const idxEl   = document.getElementById('lb-idx');
  const totalEl = document.getElementById('lb-total');
  const thumbs  = document.getElementById('lb-thumbs');
  const btnPrev = lb.querySelector('.lb-prev');
  const btnNext = lb.querySelector('.lb-next');
  const btnClose= lb.querySelector('.lb-close');

  let cur = { key:null, list:[], i:0 };

  // 카드 클릭 → 갤러리 오픈
  document.addEventListener('click', async (e)=>{
    const card = e.target.closest('.project-item');
    if(!card) return;

    // 우선순위: 명시적 data-gallery → 자동 유추
    const folderOrKey = card.dataset.gallery || deriveFolderFromCard(card);
    if(!folderOrKey) return;

    // 1) 수동 매핑에 있으면 사용
    let list = galleries[folderOrKey]?.slice();

    // 2) 없으면 폴더에서 자동 탐색(01.png…)
    if(!list) list = await discoverSequence(folderOrKey);

    if(!list.length) return;

    openLB({
      list,
      title: card.dataset.title || card.querySelector('h3')?.textContent || '',
      desc:  card.dataset.desc  || card.querySelector('p')?.textContent  || ''
    });
  });

  function openLB({list, title, desc, start=0}){
    cur.key  = title;
    cur.list = list;
    cur.i    = Math.max(0, Math.min(start, cur.list.length-1));
    titleEl.textContent = title;
    descEl.textContent  = desc;
    totalEl.textContent = String(cur.list.length);
    buildThumbs();
    show(cur.i);
    lb.classList.add('open');
    lb.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  }

  function closeLB(){
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }

  function show(i){
    cur.i = (i + cur.list.length) % cur.list.length;
    const src = cur.list[cur.i];
    img.src = src;
    img.alt = `${cur.key} - ${cur.i+1}`;
    idxEl.textContent = String(cur.i + 1);
    highlight(cur.i);
    preload(cur.list[(cur.i+1)%cur.list.length]);
    preload(cur.list[(cur.i-1+cur.list.length)%cur.list.length]);
  }

  function preload(src){ const p = new Image(); p.src = src; }

  function buildThumbs(){
    thumbs.innerHTML = '';
    cur.list.forEach((src, i)=>{
      const b = document.createElement('button');
      const t = document.createElement('img');
      t.src = src; t.alt = `thumb ${i+1}`;
      b.appendChild(t);
      b.addEventListener('click', ()=> show(i));
      thumbs.appendChild(b);
    });
  }

  function highlight(i){
    thumbs.querySelectorAll('img').forEach((el, k)=> el.classList.toggle('active', k===i));
  }

  // 내비게이션/닫기/키보드 제어
  btnPrev.addEventListener('click', ()=> show(cur.i-1));
  btnNext.addEventListener('click', ()=> show(cur.i+1));
  btnClose.addEventListener('click', closeLB);
  lb.addEventListener('click', (e)=>{ if(e.target === lb) closeLB(); });

  window.addEventListener('keydown', (e)=>{
    if(!lb.classList.contains('open')) return;
    if(e.key === 'ArrowLeft')  { e.preventDefault(); show(cur.i-1); }
    if(e.key === 'ArrowRight') { e.preventDefault(); show(cur.i+1); }
    if(e.key === 'Escape')     { e.preventDefault(); closeLB(); }
  });
})();

// ================== 카드 썸네일(01.png 자동 주입) ==================
(async function setCardThumbnails(){
  const cards = document.querySelectorAll('.project-item');

  async function imageExists(src){
    return new Promise(res=>{
      const im = new Image();
      im.addEventListener('load', ()=>res(true), {once:true});
      im.addEventListener('error',()=>res(false), {once:true});
      im.src = src + (src.includes('?')?'&':'?') + 'v=' + Date.now(); // 캐시 회피
    });
  }

  // 제품 카드 등에서 data-gallery가 없으면 폴더 자동 유추
  function deriveFolderFromCard(card){
    const cat  = card.dataset.category?.toLowerCase();
    const name = card.querySelector('p')?.textContent?.trim();
    if(cat === 'product' && name) return `product/졸업전시도록_${name}`;
    return null;
  }

  // 01.png → 1.png → 001.png, 없으면 jpg/jpeg/webp 순으로 시도
  async function findThumb(folder){
    const tries = [
      `${folder}/01.png`, `${folder}/1.png`, `${folder}/001.png`,
      `${folder}/01.jpg`, `${folder}/01.jpeg`, `${folder}/01.webp`
    ];
    for(const src of tries){
      if(await imageExists(src)) return src;
    }
    return null;
  }

  for(const card of cards){
    const placeholder = card.querySelector('.image-placeholder');
    if(!placeholder) continue;

    const folder = card.dataset.gallery || deriveFolderFromCard(card);
    if(!folder) continue;

    const src = await findThumb(folder);
    if(src){
      placeholder.style.backgroundImage = `url("${src}")`;
    }
  }
})();