const header = document.querySelector('.site-header');
const intro = document.querySelector('.intro');

const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 4);
    const introBottom = intro ? intro.offsetTop + intro.offsetHeight - header.offsetHeight : 0;
    header.classList.toggle('is-paper', window.scrollY > introBottom);
};
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

const character = document.querySelector('.intro__character');
const bubbles = document.querySelector('.chat__bubbles');

if (character && bubbles) {
    const syncCharacter = () => { character.style.height = `${bubbles.offsetHeight}px`; };
    syncCharacter();
    window.addEventListener('resize', syncCharacter);
    if (document.fonts) document.fonts.ready.then(syncCharacter);
    if ('ResizeObserver' in window) new ResizeObserver(syncCharacter).observe(bubbles);
}

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const modals = new Map([...document.querySelectorAll('dialog.modal')].map((el) => [el.id, el]));
const root = document.documentElement;
const lightbox = document.querySelector('.lightbox');
const classModal = document.getElementById('classes');
let navOpened = null;
let detailPushed = false;
let lightboxPushed = false;
let clearAfterPop = false;

const clearHash = () => history.replaceState(null, '', location.pathname + location.search);
const anyModalOpen = () => [...modals.values()].some((el) => el.open);

const showClassMain = () => {
    if (!classModal) return;
    classModal.querySelectorAll('[data-detail-panel]').forEach((panel) => { panel.hidden = true; });
    classModal.querySelector('[data-detail-main]').hidden = false;
    classModal.querySelector('.modal__inner').scrollTop = 0;
};

const isDetailOpen = () => Boolean(classModal && classModal.open
    && classModal.querySelector('[data-detail-main]').hidden);

const openModal = (id, fromNav) => {
    const dialog = modals.get(id);
    if (!dialog || dialog.open) return;
    modals.forEach((el) => { if (el.open) el.close(); });
    dialog.showModal();
    root.classList.add('modal-open');
    navOpened = fromNav ? dialog : null;
    dialog.querySelector('.modal__inner').scrollTop = 0;
};

modals.forEach((dialog) => {
    dialog.addEventListener('close', () => {
        if (!anyModalOpen()) root.classList.remove('modal-open');
        if (dialog === classModal) showClassMain();
        if (location.hash === `#${dialog.id}`) {
            const steps = (navOpened === dialog ? 1 : 0) + (dialog === classModal && detailPushed ? 1 : 0);
            if (navOpened !== dialog) clearAfterPop = steps > 0;
            if (steps > 0) history.go(-steps);
            else clearHash();
        }
        if (dialog === classModal) detailPushed = false;
        if (navOpened === dialog) navOpened = null;
    });
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
    });
    dialog.querySelectorAll('[data-modal-close]').forEach((btn) => {
        btn.addEventListener('click', () => dialog.close());
    });
});

if (classModal) {
    const main = classModal.querySelector('[data-detail-main]');
    const panels = classModal.querySelectorAll('[data-detail-panel]');
    classModal.querySelectorAll('[data-detail]').forEach((btn) => {
        btn.addEventListener('click', () => {
            main.hidden = true;
            panels.forEach((panel) => { panel.hidden = panel.dataset.detailPanel !== btn.dataset.detail; });
            classModal.querySelector('.modal__inner').scrollTop = 0;
            history.pushState({ layer: 'detail' }, '', location.hash || '#classes');
            detailPushed = true;
            const back = classModal.querySelector(`[data-detail-panel="${btn.dataset.detail}"] [data-detail-back]`);
            if (back) back.focus({ preventScroll: true });
        });
    });
    classModal.querySelectorAll('[data-detail-back]').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (detailPushed) history.back();
            else showClassMain();
        });
    });
}

if (lightbox) {
    const img = lightbox.querySelector('.lightbox__img');
    const caption = lightbox.querySelector('.lightbox__caption');
    document.querySelectorAll('[data-zoom]').forEach((photo) => {
        photo.addEventListener('click', () => {
            img.src = photo.currentSrc || photo.src;
            img.alt = photo.alt;
            const label = photo.closest('.modal__item');
            caption.textContent = label ? label.textContent.trim() : '';
            lightbox.showModal();
            history.pushState({ layer: 'lightbox' }, '', location.hash);
            lightboxPushed = true;
        });
    });
    const closeLightbox = () => {
        if (lightboxPushed) history.back();
        else lightbox.close();
    };
    lightbox.querySelector('[data-lightbox-close]').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox || event.target.classList.contains('lightbox__figure')) closeLightbox();
    });
    lightbox.addEventListener('cancel', (event) => {
        event.preventDefault();
        closeLightbox();
    });
}

window.addEventListener('popstate', () => {
    if (lightbox && lightbox.open) {
        lightboxPushed = false;
        lightbox.close();
        return;
    }
    if (isDetailOpen()) {
        detailPushed = false;
        showClassMain();
        return;
    }
    if (clearAfterPop) {
        clearAfterPop = false;
        clearHash();
    }
});

document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    if (!modals.has(id)) return;
    event.preventDefault();
    history.pushState(null, '', `#${id}`);
    openModal(id, true);
});

window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (modals.has(id)) {
        openModal(id, true);
    } else {
        if (lightbox && lightbox.open) lightbox.close();
        modals.forEach((el) => {
            if (el.open) {
                navOpened = null;
                detailPushed = false;
                el.close();
            }
        });
    }
});

if (modals.has(location.hash.slice(1))) openModal(location.hash.slice(1), false);

const paintLayer = document.querySelector('.paint-layer');
const canPaint = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (paintLayer && intro && canPaint) {
    const paints = ['#E5533D', '#3A6FD8', '#3E9B5B', '#F0B429', '#E46A8C', '#3A2F5E'];
    let lastDab = 0;
    intro.addEventListener('pointermove', (event) => {
        const now = performance.now();
        if (now - lastDab < 55) return;
        lastDab = now;
        const rect = intro.getBoundingClientRect();
        const size = 5 + Math.random() * 7;
        const dab = document.createElement('span');
        dab.className = 'paint-dab';
        dab.style.width = `${size}px`;
        dab.style.height = `${size * (0.8 + Math.random() * 0.3)}px`;
        dab.style.left = `${event.clientX - rect.left + (Math.random() * 10 - 5)}px`;
        dab.style.top = `${event.clientY - rect.top + (Math.random() * 10 - 5)}px`;
        dab.style.background = paints[Math.floor(Math.random() * paints.length)];
        dab.addEventListener('animationend', () => dab.remove());
        paintLayer.appendChild(dab);
    });
}

const toTop = document.querySelector('[data-to-top]');

if (toTop) {
    const toggleTop = () => toTop.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.6);
    window.addEventListener('scroll', toggleTop, { passive: true });
    toggleTop();
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}