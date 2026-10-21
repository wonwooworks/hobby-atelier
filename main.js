const header = document.querySelector('.site-header');
const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const OPEN_MIN = 11 * 60;
const CLOSE_MIN = 20 * 60;
const SOON_MIN = 30;
const sign = document.querySelector('[data-shop-sign]');
const msg = document.querySelector('[data-sign-msg]');

const getSeoulMinutes = () => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === 'hour').value) % 24;
    const minute = Number(parts.find((p) => p.type === 'minute').value);
    return hour * 60 + minute;
};

const getSignState = (now) => {
    if (now >= OPEN_MIN && now < CLOSE_MIN - SOON_MIN) {
        return { open: true, word: 'OPEN', note: '문 열었어요', msg: '지금 문 열려 있어요 · 놀러 오세요' };
    }
    if (now >= CLOSE_MIN - SOON_MIN && now < CLOSE_MIN) {
        return { open: true, word: 'OPEN', note: '곧 문 닫아요', msg: '곧 문 닫아요 · 서둘러 오세요' };
    }
    if (now < OPEN_MIN) {
        return { open: false, word: 'CLOSE', note: '11시에 열어요', msg: '아직 문 열기 전이에요 · 조금만 기다려 주세요' };
    }
    return { open: false, word: 'CLOSE', note: '내일 만나요', msg: '오늘은 문 닫았어요 · 내일 만나요' };
};

const updateShopSign = () => {
    const state = getSignState(getSeoulMinutes());
    if (sign) {
        sign.querySelector('[data-sign-word]').textContent = state.word;
        sign.querySelector('[data-sign-note]').textContent = state.note;
        sign.classList.toggle('is-closed', !state.open);
        sign.hidden = false;
    }
    if (msg) {
        msg.replaceChildren(...state.msg.split(' · ').flatMap((part, i, arr) => {
            const span = document.createElement('span');
            span.className = 'nowrap';
            span.textContent = i < arr.length - 1 ? `${part} ·` : part;
            return i < arr.length - 1 ? [span, ' '] : [span];
        }));
        msg.hidden = false;
    }
};

if (sign || msg) {
    updateShopSign();
    setInterval(updateShopSign, 60000);
}