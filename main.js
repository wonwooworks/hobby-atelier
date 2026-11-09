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
let navOpened = null;

const clearHash = () => history.replaceState(null, '', location.pathname + location.search);

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
        if (![...modals.values()].some((el) => el.open)) root.classList.remove('modal-open');
        if (location.hash === `#${dialog.id}`) {
            if (navOpened === dialog) history.back();
            else clearHash();
        }
        if (navOpened === dialog) navOpened = null;
    });
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
    });
    dialog.querySelectorAll('[data-modal-close]').forEach((btn) => {
        btn.addEventListener('click', () => dialog.close());
    });
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
        modals.forEach((el) => {
            if (el.open) {
                navOpened = null;
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