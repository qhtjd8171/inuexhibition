/**
 * 웹사이트 전반의 인터랙션을 관리하는 스크립트
 * - 카테고리 필터링
 * - 라이트박스 갤러리
 * - 카드 썸네일 동적 로딩
 */
(function () {
  'use strict';

  // ================== 헬퍼 함수 ==================

  /**
   * 이미지 URL이 실제로 유효한지 비동기적으로 확인합니다.
   * @param {string} src - 확인할 이미지 URL
   * @returns {Promise<boolean>} 이미지가 존재하면 true를 반환하는 프로미스
   */
  function imageExists(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  /**
   * YouTube URL에서 동영상 ID를 추출합니다.
   * @param {string} url - YouTube URL
   * @returns {string|null} 추출된 동영상 ID 또는 null
   */
  function getYouTubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|v=|embed\/|watch\?v=)([A-Za-z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  // ================== 메인 기능 셋업 ==================

  /**
   * 카테고리 필터 기능을 설정합니다.
   */
  function setupCategoryFilter() {
    const tabLinks = document.querySelectorAll('.category-nav .tab-link');
    const items = document.querySelectorAll('.project-item');
    if (tabLinks.length === 0) return;

    const applyFilter = (filter) => {
      items.forEach(el => {
        const category = el.dataset.category?.toLowerCase() ?? '';
        const show = (filter === 'all' || category === filter);
        el.style.display = show ? '' : 'none';
      });
    };

    tabLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const currentActive = document.querySelector('.category-nav .tab-link.active');
        if (currentActive) currentActive.classList.remove('active');
        link.classList.add('active');
        applyFilter(link.dataset.filter.toLowerCase());
      });
    });

    // 초기 'All' 필터 적용
    const initialFilter = document.querySelector('.category-nav .tab-link[data-filter="all"]');
    if (initialFilter) initialFilter.click();
  }


  /**
   * 라이트박스(갤러리) 기능을 설정합니다.
   */
  function setupLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

    // 라이트박스 내부 DOM 요소 캐싱
    const elements = {
        media: lightbox.querySelector('.lightbox-media'),
        thumbs: lightbox.querySelector('.lb-thumbs'),
        title: lightbox.querySelector('#lb-title'),
        desc: lightbox.querySelector('#lb-desc'),
        currentIndex: lightbox.querySelector('#lb-idx'),
        total: lightbox.querySelector('#lb-total'),
        prevBtn: lightbox.querySelector('.lb-prev'),
        nextBtn: lightbox.querySelector('.lb-next'),
        closeBtn: lightbox.querySelector('.lb-close')
    };

    let currentItems = [];
    let currentIndex = 0;
    
    // 미디어(이미지/비디오)를 보여주는 함수
    const showMedia = (index) => {
        currentIndex = (index + currentItems.length) % currentItems.length;
        const item = currentItems[currentIndex];

        if (item.type === 'video') {
            elements.media.innerHTML = `
                <div class="iframe-wrap">
                    <iframe src="https://www.youtube.com/embed/${item.id}?autoplay=1&rel=0"
                            title="YouTube video player" frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowfullscreen></iframe>
                </div>`;
        } else {
            elements.media.innerHTML = `<img src="${item.src}" alt="${elements.title.textContent} - ${currentIndex + 1}">`;
        }

        // 썸네일 하이라이트 및 카운터 업데이트
        elements.thumbs.querySelectorAll('button').forEach((btn, i) => {
            btn.firstElementChild.classList.toggle('active', i === currentIndex);
        });
        elements.currentIndex.textContent = currentIndex + 1;
    };
    
    // 라이트박스를 여는 함수
    const openLightbox = (card) => {
        const title = card.dataset.title || card.querySelector('h3')?.textContent || '';
        const desc = card.dataset.desc || card.querySelector('p')?.textContent || '';
        const images = JSON.parse(card.dataset.images || '[]');
        const youtubeId = getYouTubeId(card.dataset.youtube);

        currentItems = images.map(src => ({ type: 'image', src }));
        if (youtubeId) {
            currentItems.push({ type: 'video', id: youtubeId, src: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` });
        }

        if (currentItems.length === 0) return;
        
        elements.title.textContent = title;
        elements.desc.textContent = desc;
        elements.total.textContent = currentItems.length;

        // 썸네일 생성
        elements.thumbs.innerHTML = '';
        currentItems.forEach((item, index) => {
            const btn = document.createElement('button');
            btn.className = item.type === 'video' ? 'lb-thumb lb-thumb-video' : 'lb-thumb';
            btn.innerHTML = `<img src="${item.src}" alt="Thumbnail ${index + 1}">` + 
                          (item.type === 'video' ? '<span class="play-badge">▶</span>' : '');
            btn.addEventListener('click', () => showMedia(index));
            elements.thumbs.appendChild(btn);
        });

        showMedia(0);
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
        lightbox.classList.remove('open');
        document.body.style.overflow = '';
        elements.media.innerHTML = ''; // 비디오 재생 중지
    };

    // 이벤트 리스너 설정 (이벤트 위임 사용)
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.project-item');
        if (card) {
            openLightbox(card);
        }
    });

    elements.closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });
    elements.prevBtn.addEventListener('click', () => showMedia(currentIndex - 1));
    elements.nextBtn.addEventListener('click', () => showMedia(currentIndex + 1));
    
    window.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('open')) return;
        if (e.key === 'ArrowLeft') showMedia(currentIndex - 1);
        if (e.key === 'ArrowRight') showMedia(currentIndex + 1);
        if (e.key === 'Escape') closeLightbox();
    });
  }


  /**
   * 각 카드의 썸네일 이미지를 동적으로 설정합니다.
   */
  async function setupCardThumbnails() {
    const cards = document.querySelectorAll('.project-item');

    const findThumb = async (folder) => {
        if (await imageExists(`${folder}/01.png`)) return `${folder}/01.png`;
        if (await imageExists(`${folder}/01.jpg`)) return `${folder}/01.jpg`;
        return null;
    };

    const deriveFolderFromCard = (card) => {
        if (card.dataset.category?.toLowerCase() === 'product') {
            const name = card.querySelector('p')?.textContent?.trim();
            return name ? `product/졸업전시도록_${name}` : null;
        }
        return null;
    };

    for (const card of cards) {
        const placeholder = card.querySelector('.image-placeholder');
        if (!placeholder) continue;

        let thumbSrc = card.dataset.thumb;
        if (!thumbSrc) {
            const folder = card.dataset.gallery || deriveFolderFromCard(card);
            if (folder) {
                thumbSrc = await findThumb(folder);
            }
        }
        
        if (thumbSrc) {
            placeholder.style.backgroundImage = `url("${thumbSrc}")`;
        }
    }
  }


  // ================== 초기화 실행 ==================
  document.addEventListener('DOMContentLoaded', () => {
    setupCategoryFilter();
    setupLightbox();
    setupCardThumbnails();
  });

})();
