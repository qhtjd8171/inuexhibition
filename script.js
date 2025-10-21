/**
 * 웹사이트 전반의 인터랙션을 관리하는 스크립트
 * - 카테고리 필터링 (work.html)
 * - 라이트박스 갤러리 (work.html)
 * - 카드 썸네일 동적 로딩 (work.html)
 * - 탭 기능 (about.html)
 */
(function () {
  'use strict';

  // ================== 헬퍼 함수 ==================

  function imageExists(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  function getYouTubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|v=|embed\/|watch\?v=)([A-Za-z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  // ================== 기능 셋업 함수 ==================

  function setupCategoryFilter() {
    if (!document.body.classList.contains('work-page')) return;
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

    const initialFilter = document.querySelector('.category-nav .tab-link[data-filter="all"]');
    if (initialFilter) initialFilter.click();
  }

  function setupLightbox() {
    if (!document.body.classList.contains('work-page')) return;
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

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

    if (!elements.closeBtn) return;

    let currentItems = [];
    let currentIndex = 0;

    const showMedia = (index) => {
      currentIndex = (index + currentItems.length) % currentItems.length;
      const item = currentItems[currentIndex];
      if (!item) return;

      if (item.type === 'video') {
        elements.media.innerHTML = `<div class="iframe-wrap"><iframe src="https://www.youtube.com/embed/${item.id}?autoplay=1&rel=0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
      } else {
        elements.media.innerHTML = `<img src="${item.src}" alt="${elements.title.textContent} - ${currentIndex + 1}">`;
      }

      if (elements.thumbs) {
        elements.thumbs.querySelectorAll('button').forEach((btn, i) => {
          btn.firstElementChild.classList.toggle('active', i === currentIndex);
        });
      }
      if (elements.currentIndex) elements.currentIndex.textContent = currentIndex + 1;
    };

    const openLightbox = (card) => {
      const title = card.dataset.title || card.querySelector('h3')?.textContent || '';
      const desc = card.dataset.desc || card.querySelector('p')?.textContent || '';
      const images = JSON.parse(card.dataset.images || '[]');
      const youtubeId = getYouTubeId(card.dataset.youtube);

      currentItems = images.map(src => ({ type: 'image', src }));
      if (youtubeId) currentItems.push({ type: 'video', id: youtubeId, src: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` });
      if (currentItems.length === 0) return;

      if (elements.title) elements.title.textContent = title;
      if (elements.desc) elements.desc.textContent = desc;
      if (elements.total) elements.total.textContent = currentItems.length;

      if (elements.thumbs) {
        elements.thumbs.innerHTML = '';
        currentItems.forEach((item, index) => {
          const btn = document.createElement('button');
          btn.className = item.type === 'video' ? 'lb-thumb lb-thumb-video' : 'lb-thumb';
          btn.innerHTML = `<img src="${item.src}" alt="Thumbnail ${index + 1}">` + (item.type === 'video' ? '<span class="play-badge">▶</span>' : '');
          btn.addEventListener('click', () => showMedia(index));
          elements.thumbs.appendChild(btn);
        });
      }

      showMedia(0);
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
      elements.media.innerHTML = '';
    };

    document.addEventListener('click', (e) => {
      if (e.target.closest('.project-item')) openLightbox(e.target.closest('.project-item'));
    });

    elements.closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    if (elements.prevBtn) elements.prevBtn.addEventListener('click', () => showMedia(currentIndex - 1));
    if (elements.nextBtn) elements.nextBtn.addEventListener('click', () => showMedia(currentIndex + 1));

    window.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'ArrowLeft') showMedia(currentIndex - 1);
      if (e.key === 'ArrowRight') showMedia(currentIndex + 1);
      if (e.key === 'Escape') closeLightbox();
    });
  }

  async function setupCardThumbnails() {
    if (!document.body.classList.contains('work-page')) return;
    const cards = document.querySelectorAll('.project-item');
    if (cards.length === 0) return;

    const findThumb = async (folder) => {
      if (await imageExists(`${folder}/01.png`)) return `${folder}/01.png`;
      if (await imageExists(`${folder}/01.jpg`)) return `${folder}/01.jpg`;
      return null;
    };

    for (const card of cards) {
      const placeholder = card.querySelector('.image-placeholder');
      if (!placeholder) continue;
      let thumbSrc = card.dataset.thumb;
      if (!thumbSrc) {
        const folder = card.dataset.gallery;
        if (folder) thumbSrc = await findThumb(folder);
      }
      if (thumbSrc) placeholder.style.backgroundImage = `url("${thumbSrc}")`;
    }
  }

  // about.html: 탭 기능
  function setupAboutTabs() {
    if (!document.body.classList.contains('about-page')) return;
    const tabButtons = document.querySelectorAll('.about-tab-menu .tab-button');
    const tabContents = document.querySelectorAll('.about-tab-content');
    if (tabButtons.length === 0 || tabContents.length === 0) return;

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.dataset.tab;

        // 모든 버튼과 콘텐츠에서 'active' 클래스 제거
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // 클릭된 요소에만 'active' 클래스 추가
        button.classList.add('active');
        const activeContent = document.getElementById(tabId);
        if (activeContent) {
          activeContent.classList.add('active');
        }
      });
    });
  }

  // ================== 초기화 실행 ==================
  document.addEventListener('DOMContentLoaded', () => {
    // 각 페이지에 맞는 기능 실행
    setupCategoryFilter();
    setupLightbox();
    setupCardThumbnails();
    setupAboutTabs();
  });





})();

