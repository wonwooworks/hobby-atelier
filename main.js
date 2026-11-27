document.documentElement.classList.add('js');

const KAKAO = 'http://pf.kakao.com/_vxehwj/chat';
const KINDS = { gift: '답례품', goods: '굿즈', piece: '작품' };
const KIND_ORDER = { piece: 0, goods: 1, gift: 2 };
const ASK_MESSAGES = { gift: '이렇게 주문하고 싶어요!', goods: '이런 굿즈를 만들고 싶어요!', piece: '이런 걸 만들고 싶어요!' };
const LEGACY = { visit: 'location', works: 'gallery' };

const LOCAL_WORKS = window.HOBBY_DEFAULT_WORKS || [];

const CONFIG = window.HOBBY_CONFIG || {};
const photoBase = (CONFIG.photoBaseUrl || '').replace(/\/$/, '');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pages = [...document.querySelectorAll('.page')];
const navLinks = [...document.querySelectorAll('[data-nav]')];
const drawer = document.getElementById('drawer');
const menuBtn = document.querySelector('[data-menu]');
const worksList = document.querySelector('[data-works]');
const zoomBox = document.querySelector('[data-zoom-box]');
const zoomImg = document.querySelector('[data-zoom-img]');
const zoomCap = document.querySelector('[data-zoom-cap]');
const zoomDesc = document.querySelector('[data-zoom-desc]');
const toast = document.querySelector('[data-toast]');
const askBox = document.querySelector('[data-ask-box]');
const askTitle = document.querySelector('[data-ask-title]');
const askDesc = document.querySelector('[data-ask-desc]');
const askText = document.querySelector('[data-ask-text]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let allWorks = LOCAL_WORKS;
let pendingCase = '';
let toastTimer;

const setMenu = (open) => {
  if (!drawer || !menuBtn) return;
  drawer.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
};

const showToast = (message) => {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2800);
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  }
};

const zoomDots = document.querySelector('[data-zoom-dots]');
let zoomPhotos = [];

const showZoomPhoto = (i) => {
  zoomImg.src = zoomPhotos[i];
  if (!zoomDots) return;
  [...zoomDots.children].forEach((d, k) => {
    d.classList.toggle('is-on', k === i);
    d.setAttribute('aria-current', k === i ? 'true' : 'false');
  });
};

const openZoom = (src, caption, desc, list) => {
  if (!zoomBox || typeof zoomBox.showModal !== 'function') return;
  zoomPhotos = list && list.length ? list : [src];
  zoomImg.alt = caption;
  zoomCap.textContent = caption;
  if (zoomDesc) zoomDesc.textContent = desc || '';
  if (zoomDots) {
    zoomDots.hidden = zoomPhotos.length < 2;
    zoomDots.innerHTML = zoomPhotos.length < 2 ? '' : zoomPhotos.map((_, i) => `<button class="hero__dot" type="button" data-zoom-to="${i}" aria-label="사진 ${i + 1} / ${zoomPhotos.length}"></button>`).join('');
  }
  showZoomPhoto(0);
  if (!zoomBox.open) zoomBox.showModal();
};

const openWork = (id) => {
  const work = allWorks.find((w) => w.id === id);
  if (!work) return false;
  openZoom(work.photo, work.title, work.desc, work.photos);
  return true;
};

const workCard = (w, n) => `
          <li class="work photo-frame" data-page="${Math.floor(n / 8)}" style="--c:${(n % 4) + 1};--r:${Math.floor((n % 8) / 4) + 1}">
            <span class="tape tape--sage work__tape" aria-hidden="true"></span>
            <button class="work__img" type="button" data-zoom data-work="${escapeHtml(w.id)}" data-src="${escapeHtml(w.photo)}" data-cap="${escapeHtml(w.title)}" data-desc="${escapeHtml(w.desc || '')}" aria-label="${escapeHtml(w.title)} 크게 보기">
              <img src="${escapeHtml(w.thumb || w.photo)}" alt="${escapeHtml(w.title)}" loading="lazy">
              <span class="work__kind">${KINDS[w.kind]}</span>
            </button>
            <h3 class="work__title">${escapeHtml(w.title)}</h3>
            <a class="work__ask" href="${KAKAO}" target="_blank" rel="noopener" data-ask="${escapeHtml(w.id)}">이런 걸 만들고 싶어요 →</a>
          </li>`;

const renderWorks = () => {
  if (worksList) {
    worksList.innerHTML = allWorks.length ? allWorks.map(workCard).join('') : '<li class="works__empty">새로운 작업물이 곧 올라와요</li>';
  }
  updateSlide();
};

const readField = (field) => {
  if (!field) return '';
  if ('stringValue' in field) return field.stringValue;
  if ('timestampValue' in field) return field.timestampValue;
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(readField);
  if ('mapValue' in field) return Object.fromEntries(Object.entries(field.mapValue.fields || {}).map(([k, v]) => [k, readField(v)]));
  return '';
};

const loadRemoteWorks = async () => {
  const { projectId, apiKey } = CONFIG.firebase || {};
  if (!projectId || !photoBase) return;
  try {
    const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    const key = apiKey ? `key=${apiKey}` : '';
    const [res, metaRes] = await Promise.all([
      fetch(`${base}/works?pageSize=300${key ? `&${key}` : ''}`),
      fetch(`${base}/meta/counter${key ? `?${key}` : ''}`).catch(() => null)
    ]);
    if (!res.ok) {
      console.warn(`[취미공작소] 작업물을 불러오지 못했어요 (${res.status}).`);
      return;
    }
    let seeded = false;
    if (metaRes && metaRes.ok) {
      const meta = await metaRes.json();
      seeded = Boolean(meta.fields && meta.fields.seeded && meta.fields.seeded.booleanValue);
    }
    const data = await res.json();
    const remote = (data.documents || []).map((d) => {
      const f = Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, readField(v)]));
      const photos = f.photos || [];
      return {
        id: d.name.split('/').pop(),
        kind: f.kind,
        title: f.title,
        desc: f.desc,
        createdAt: f.createdAt || '',
        photo: photos[0] ? `${photoBase}/${photos[0].full}` : '',
        thumb: photos[0] ? `${photoBase}/${photos[0].thumb}` : '',
        photos: photos.map((p) => `${photoBase}/${p.full}`)
      };
    }).filter((w) => w.photo && KINDS[w.kind]);
    if (!remote.length && !seeded) return;
    remote.sort((a, b) => (KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) || (a.createdAt < b.createdAt ? 1 : -1));
    allWorks = remote;
    renderWorks();
    if (pendingCase && openWork(pendingCase)) pendingCase = '';
  } catch (error) {
    console.warn(error);
  }
};

const stage = document.getElementById('stage');
let currentId = '';
let jumping = false;
let jumpTimer;

const resolve = (hash) => {
  const [section, sub] = hash.replace(/^#/, '').split('/');
  if (section === 'case' && sub) return { id: 'gallery', work: sub };
  if (section === 'class') return { id: 'class' };
  return { id: LEGACY[section] || section };
};

const markActive = (id) => {
  const target = pages.find((p) => p.id === id) || pages[0];
  if (target.id === currentId) return;
  currentId = target.id;
  pages.forEach((p) => p.classList.toggle('is-on', p === target));
  navLinks.forEach((a) => {
    const on = a.dataset.nav === target.id;
    a.classList.toggle('is-on', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = target === pages[0] ? '취미공작소 | hobby atelier' : `${target.dataset.label} | 취미공작소`;
  const hash = target === pages[0] ? location.pathname : `#${target.id}`;
  if (`${location.pathname}${location.hash}` !== (target === pages[0] ? location.pathname : `${location.pathname}#${target.id}`)) history.replaceState(null, '', hash);
};

const goTo = (hash, smooth) => {
  const { id, work } = resolve(hash);
  const target = pages.find((p) => p.id === id) || pages[0];
  setMenu(false);
  jumping = true;
  clearTimeout(jumpTimer);
  jumpTimer = setTimeout(() => { jumping = false; }, smooth ? 900 : 50);
  stage.scrollTo({ top: target.offsetTop, behavior: smooth && !reduceMotion.matches ? 'smooth' : 'auto' });
  markActive(target.id);
  if (work && !openWork(work)) pendingCase = work;
};

const showPage = (hash, smooth) => goTo(hash, smooth);

let wheelLock = false;
stage.addEventListener('wheel', (event) => {
  if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  if ((zoomBox && zoomBox.open) || (askBox && askBox.open)) return;
  const dir = Math.sign(event.deltaY);
  const top = stage.scrollTop;
  const view = stage.clientHeight;
  const cur = pages.find((p) => p.offsetTop <= top + 2 && top + 2 < p.offsetTop + p.offsetHeight) || pages[0];
  if (dir > 0 && top + view < cur.offsetTop + cur.offsetHeight - 2) return;
  if (dir < 0 && top > cur.offsetTop + 2) return;
  event.preventDefault();
  if (wheelLock) return;
  const next = pages[pages.indexOf(cur) + dir];
  if (!next) return;
  wheelLock = true;
  setTimeout(() => { wheelLock = false; }, 950);
  jumping = true;
  clearTimeout(jumpTimer);
  jumpTimer = setTimeout(() => { jumping = false; }, 900);
  const dest = dir < 0 ? Math.max(next.offsetTop, next.offsetTop + next.offsetHeight - view) : next.offsetTop;
  stage.scrollTo({ top: dest, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  markActive(next.id);
}, { passive: false });

if ('IntersectionObserver' in window) {
  const pageObserver = new IntersectionObserver((entries) => {
    if (jumping) return;
    entries.forEach((entry) => { if (entry.isIntersecting) markActive(entry.target.id); });
  }, { root: stage, rootMargin: '-45% 0px -45% 0px' });
  pages.forEach((p) => pageObserver.observe(p));
}

document.addEventListener('click', async (event) => {
  const pageLink = event.target.closest('a[href^="#"]');
  if (pageLink) {
    const hash = pageLink.getAttribute('href');
    if (pages.some((p) => p.id === resolve(hash).id)) {
      event.preventDefault();
      showPage(hash, true);
      return;
    }
  }

  if (event.target.closest('[data-menu]')) {
    setMenu(drawer.hidden);
    return;
  }

  const ask = event.target.closest('[data-ask]');
  if (ask) {
    event.preventDefault();
    const work = allWorks.find((w) => w.id === ask.dataset.ask);
    if (!work) return;
    const url = `${location.origin}${location.pathname}#case/${work.id}`;
    const message = `[${work.title}] ${ASK_MESSAGES[work.kind] || '이런 걸 만들고 싶어요!'}\n${url}`;
    const ok = await copyText(message);
    if (askTitle) askTitle.textContent = ok ? '작업물 이름과 링크를 복사했어요' : '아래 내용을 복사해 주세요';
    if (askDesc) askDesc.textContent = ok ? '카톡 채팅창에 붙여넣어 보내 주세요' : '길게 눌러 복사한 뒤 카톡에 붙여넣어 주세요';
    if (askText) askText.textContent = message;
    if (askBox && typeof askBox.showModal === 'function') askBox.showModal();
    else window.open(KAKAO, '_blank', 'noopener');
    return;
  }

  if (askBox && askBox.open && (event.target.closest('[data-ask-close]') || event.target.closest('[data-ask-go]') || event.target === askBox)) {
    if (!event.target.closest('[data-ask-go]')) event.preventDefault();
    askBox.close();
    return;
  }

  const zoom = event.target.closest('[data-zoom]');
  if (zoom) {
    if (zoom.dataset.work && openWork(zoom.dataset.work)) return;
    const img = zoom.querySelector('img.is-on') || zoom.querySelector('img');
    openZoom(zoom.dataset.src || img.src, zoom.dataset.cap || img.alt, zoom.dataset.desc);
    return;
  }

  const zoomTo = event.target.closest('[data-zoom-to]');
  if (zoomTo) {
    showZoomPhoto(Number(zoomTo.dataset.zoomTo));
    return;
  }

  if (zoomBox && zoomBox.open && (event.target.closest('[data-zoom-close]') || event.target === zoomBox)) {
    zoomBox.close();
    return;
  }

  const copyBtn = event.target.closest('[data-copy]');
  if (copyBtn) {
    const ok = await copyText(copyBtn.dataset.copy);
    showToast(ok ? '공방 주소를 복사했어요' : '주소를 길게 눌러 복사해 주세요');
  }
});

const workDots = document.querySelector('[data-work-dots]');
let workPageIndex = 0;
const showWorkPage = (index, animate) => {
  if (!worksList) return;
  const cards = [...worksList.children];
  const count = Math.max(1, Math.ceil(cards.length / 8));
  workPageIndex = Math.min(Math.max(index, 0), count - 1);
  cards.forEach((li, i) => {
    const on = Math.floor(i / 8) === workPageIndex;
    li.classList.toggle('is-off', !on);
    li.classList.toggle('is-in', on && animate && !reduceMotion.matches);
  });
  if (!workDots) return;
  workDots.hidden = count < 2;
  if (workDots.children.length !== count) {
    workDots.innerHTML = Array.from({ length: count }, (_, i) => `<button class="hero__dot" type="button" data-work-page="${i}" aria-label="작업물 ${i + 1} / ${count}"></button>`).join('');
  }
  [...workDots.children].forEach((d, i) => {
    d.classList.toggle('is-on', i === workPageIndex);
    d.setAttribute('aria-current', i === workPageIndex ? 'true' : 'false');
  });
};
function updateSlide() { showWorkPage(0, false); }
if (workDots) workDots.addEventListener('click', (event) => {
  const dot = event.target.closest('[data-work-page]');
  if (dot) showWorkPage(Number(dot.dataset.workPage), true);
});
updateSlide();

const sliders = [...document.querySelectorAll('.page--hero')].map((page) => {
  const slides = [...page.querySelectorAll('.hero__slide')];
  const dotBtns = [...page.querySelectorAll('[data-slide-to]')];
  if (slides.length < 2) return null;
  const state = { page, slides, dotBtns, index: 0, timer: 0, hover: false };
  state.go = (i) => {
    state.index = (i + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle('is-on', k === state.index));
    dotBtns.forEach((d, k) => {
      d.classList.toggle('is-on', k === state.index);
      d.setAttribute('aria-current', k === state.index ? 'true' : 'false');
    });
  };
  dotBtns.forEach((d) => d.addEventListener('click', () => { state.go(Number(d.dataset.slideTo)); restart(state); }));
  const photo = page.querySelector('.hero__photo');
  photo.addEventListener('pointerenter', () => { state.hover = true; });
  photo.addEventListener('pointerleave', () => { state.hover = false; });
  return state;
}).filter(Boolean);

function restart(state) {
  clearInterval(state.timer);
  if (reduceMotion.matches) return;
  state.timer = setInterval(() => {
    if (state.hover || !state.page.classList.contains('is-on') || (zoomBox && zoomBox.open)) return;
    state.go(state.index + 1);
  }, 4000);
}
sliders.forEach(restart);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && drawer && !drawer.hidden) setMenu(false);
});

window.addEventListener('hashchange', () => showPage(location.hash, true));

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
showPage(location.hash, false);
loadRemoteWorks();