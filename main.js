const NAVER = 'https://m.booking.naver.com/booking/6/bizes/215117';
const KAKAO = 'http://pf.kakao.com/_vxehwj/chat';

const CLASSES = [
  {
    id: 'plaster',
    name: '석고방향제',
    cover: 'plaster.jpg',
    desc: '캐릭터 모양 석고에 직접 색을 칠하고, 좋아하는 향을 입혀 나만의 방향제를 완성해요.',
    points: ['수백 가지 몰드 중에서 마음에 드는 모양을 골라요', '물감으로 자유롭게 색을 입혀요', '완성한 방향제는 옷장, 차, 책상 어디에 두어도 좋아요'],
    photos: ['plaster.jpg', 'hero.jpg', 'made1.jpg']
  },
  {
    id: 'suncatcher',
    name: '썬캐쳐',
    cover: 'moru.jpg',
    desc: '모루로 꽃을 만들고 반짝이는 구슬을 꿰어, 창가에 거는 썬캐쳐를 완성해요.',
    points: ['알록달록 다양한 색으로 준비되어 있는 모루로 나만의 꽃 모양을 잡아요', '반짝이는 크리스탈로 장식해요', '햇빛을 받으면 방 안에 무지개가 반짝여요'],
    photos: ['moru-full.jpg', 'sun1.jpg', 'sun2.jpg']
  },
  {
    id: 'beads',
    name: '비즈 공예',
    cover: 'beads.jpg',
    desc: '좋아하는 색의 구슬을 골라, 휴대폰이나 가방에 다는 스트랩을 만들어요.',
    points: ['원하는 구슬과 꾸밈재료를 골라서 나만의 스트랩을 만들어요', '길이와 배열을 자유롭게 정해요', '폰스트랩이나 키링 등 다양한 쓰임으로 만들어요'],
    photos: ['beads.jpg', 'beads1.jpg', 'beads2.jpg']
  }
];

const KINDS = { gift: '답례품', goods: '굿즈', piece: '작품' };
const CTA_LABELS = { gift: '이렇게 주문하고 싶어요', goods: '나만의 굿즈 문의하기', piece: '이런 걸 만들고 싶어요' };

const WORKS = [
  { id: 'bear-gift', kind: 'gift', title: '엄마곰 아기곰 답례품', desc: '투명 상자에 리본을 묶어 하나하나 포장한 곰돌이 석고 답례품이에요.', photos: ['gift.jpg'] },
  { id: 'wedding-birthday', kind: 'gift', title: '웨딩·생일 기념 석고', desc: '두 사람의 모습과 생일 케이크를 석고로 만들어 특별한 날을 기념했어요.', photos: ['made1.jpg'] },
  { id: 'suwon-goods', kind: 'goods', title: '수원화성 석고 굿즈', desc: '행궁동과 수원화성 풍경을 담아 색칠한 사각 석고 굿즈예요.', photos: ['goods.jpg'] },
  { id: 'dressed-bears', kind: 'goods', title: '옷 입은 곰돌이', desc: '멜빵바지와 잠옷을 입은 곰돌이 석고예요.', photos: ['made3.jpg'] },
  { id: 'summer-puppies', kind: 'piece', title: '여름 강아지들', desc: '튜브와 선글라스로 여름을 꾸민 강아지 석고방향제예요.', photos: ['hero.jpg'] },
  { id: 'flower-candle', kind: 'piece', title: '플라워 캔들', desc: '알록달록한 꽃 장식을 올린 유리 용기 캔들이에요.', photos: ['made2.jpg'] },
  { id: 'character-plaster', kind: 'piece', title: '캐릭터 석고방향제', desc: '원데이클래스에서 만나는 다양한 동물 캐릭터 석고예요.', photos: ['plaster.jpg'] },
  { id: 'cold-bears', kind: 'goods', title: '앗추워 곰돌이', desc: '쌀쌀해진 날씨에 따뜻한 패딩을 꺼내 입은 꼬마 곰돌이들이에요.', photos: ['cold-bear.jpg'] },
  { id: 'baby-1st', kind: 'gift', title: '첫돌 기념 답례품', desc: '소중한 아가의 첫 생일을 축하하고 기념하기 위한 답례품이에요.', photos: ['baby-1st1.jpg', 'baby-1st2.jpg'] }
];

const CONFIG = window.HOBBY_CONFIG || {};
const photoBase = (CONFIG.photoBaseUrl || '').replace(/\/$/, '');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pic = (src, alt, cls = '') => `<img${cls ? ` class="${cls}"` : ''} src="${src}" alt="${escapeHtml(alt)}" loading="lazy">`;
const img = (file, alt, cls = '') => pic(`images/${file}`, alt, cls);

const localWorks = WORKS.map((w) => ({ ...w, photos: w.photos.map((f) => ({ full: `images/${f}`, thumb: `images/${f}` })) }));
let allWorks = localWorks;

const readField = (field) => {
  if (!field) return '';
  if ('stringValue' in field) return field.stringValue;
  if ('timestampValue' in field) return field.timestampValue;
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(readField);
  if ('mapValue' in field) {
    return Object.fromEntries(Object.entries(field.mapValue.fields || {}).map(([k, v]) => [k, readField(v)]));
  }
  return '';
};

const loadRemoteWorks = async () => {
  const { projectId, apiKey } = CONFIG.firebase || {};
  if (!window.HOBBY_CONFIG) {
    console.warn('[취미공작소] config.js를 불러오지 못했어요. index.html에 config.js가 연결되어 있는지 확인해 주세요.');
    return;
  }
  if (!projectId || !photoBase) {
    console.warn('[취미공작소] config.js의 projectId 또는 photoBaseUrl이 비어 있어요.');
    return;
  }
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/works?pageSize=300${apiKey ? `&key=${apiKey}` : ''}`);
    if (!res.ok) {
      console.warn(`[취미공작소] 작업물을 불러오지 못했어요 (${res.status}). Firestore 보안 규칙의 읽기 권한을 확인해 주세요.`);
      return;
    }
    const data = await res.json();
    const remote = (data.documents || []).map((d) => {
      const f = Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, readField(v)]));
      return {
        id: d.name.split('/').pop(),
        kind: f.kind,
        title: f.title,
        desc: f.desc,
        createdAt: f.createdAt || '',
        photos: (f.photos || []).map((p) => ({ full: `${photoBase}/${p.full}`, thumb: `${photoBase}/${p.thumb}` }))
      };
    }).filter((w) => w.photos.length && KINDS[w.kind]);
    remote.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    allWorks = [...remote, ...localWorks];
    const section = location.hash.replace(/^#/, '').split('/')[0];
    if (section === 'works' || section === 'case') route();
  } catch (error) {
    console.warn(error);
  }
};

const classList = document.querySelector('[data-class-list]');
if (classList) {
  classList.innerHTML = CLASSES.map((c) => `
    <li><a class="tile" href="#class/${c.id}">${img(c.cover, c.name, 'tile__img')}<span class="tile__name">${c.name}</span></a></li>`).join('');
}

const worksList = document.querySelector('[data-works-list]');
const renderWorks = (filter) => {
  const list = filter && filter !== 'all' ? allWorks.filter((w) => w.kind === filter) : allWorks;
  worksList.innerHTML = list.map((w) => `
    <li><a class="tile" href="#case/${w.id}">${pic(w.photos[0].thumb, w.title, 'tile__img')}<span class="tile__name">${escapeHtml(w.title)}</span><span class="tile__meta">${KINDS[w.kind]}</span></a></li>`).join('');
  document.querySelectorAll('[data-filter]').forEach((el) => {
    el.classList.toggle('is-on', el.dataset.filter === (filter || 'all'));
  });
};

const classDetail = document.querySelector('[data-class-detail]');
const renderClass = (id) => {
  const c = CLASSES.find((item) => item.id === id);
  if (!c) return false;
  classDetail.innerHTML = `
    <div class="detail__photos">${c.photos.map((p) => img(p, c.name)).join('')}</div>
    <div class="detail__text">
      <a class="back" href="#class">클래스</a>
      <h2 class="detail__title">${c.name}</h2>
      <p class="detail__desc">${c.desc}</p>
      <ul class="detail__points">${c.points.map((p) => `<li>${p}</li>`).join('')}</ul>
      <a class="cta" href="${NAVER}" target="_blank" rel="noopener"><span class="naver-mark" aria-hidden="true">N</span>진행 중인 클래스 보기</a>
    </div>`;
  return true;
};

const caseDetail = document.querySelector('[data-case-detail]');
const renderCase = (id) => {
  const w = allWorks.find((item) => item.id === id);
  if (!w) return false;
  caseDetail.innerHTML = `
    <div class="detail__photos">${w.photos.map((p) => pic(p.full, w.title)).join('')}</div>
    <div class="detail__text">
      <a class="back" href="#works/${w.kind}">${KINDS[w.kind]}</a>
      <h2 class="detail__title">${escapeHtml(w.title)}</h2>
      <p class="detail__desc">${escapeHtml(w.desc || '')}</p>
      <a class="cta" href="${KAKAO}" target="_blank" rel="noopener">${CTA_LABELS[w.kind] || '이런 걸 만들고 싶어요'}</a>
    </div>`;
  return true;
};

const views = document.querySelectorAll('[data-view]');
const navLinks = document.querySelectorAll('.top__nav a');

const show = (name) => {
  views.forEach((v) => { v.hidden = v.dataset.view !== name; });
  document.body.classList.toggle('is-home', name === 'home');
};

const route = () => {
  const [section, sub] = location.hash.replace(/^#/, '').split('/');
  let active = '';
  if (section === 'class' && sub && renderClass(sub)) {
    show('class-detail');
    active = 'class';
  } else if (section === 'class') {
    show('class');
    active = 'class';
  } else if (section === 'works') {
    renderWorks(sub);
    show('works');
    active = KINDS[sub] ? `works/${sub}` : '';
  } else if (section === 'case' && sub && renderCase(sub)) {
    show('case');
    const work = allWorks.find((item) => item.id === sub);
    active = work ? `works/${work.kind}` : '';
  } else if (section === 'visit') {
    show('visit');
    active = 'visit';
  } else {
    show('home');
  }
  navLinks.forEach((a) => a.classList.toggle('is-on', a.getAttribute('href') === `#${active}`));
  window.scrollTo(0, 0);
};

window.addEventListener('hashchange', route);
route();
loadRemoteWorks();

const lightbox = document.querySelector('.lightbox');
if (lightbox) {
  const big = lightbox.querySelector('.lightbox__img');
  let pushed = false;
  document.addEventListener('click', (event) => {
    const photo = event.target.closest('.detail__photos img');
    if (!photo) return;
    big.src = photo.src;
    big.alt = photo.alt;
    lightbox.showModal();
    history.pushState({ layer: 'lightbox' }, '', location.hash || '#');
    pushed = true;
  });
  const close = () => { if (pushed) history.back(); else lightbox.close(); };
  lightbox.querySelector('[data-lightbox-close]').addEventListener('click', close);
  lightbox.addEventListener('click', (event) => { if (event.target === lightbox) close(); });
  lightbox.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  window.addEventListener('popstate', () => {
    if (lightbox.open) {
      pushed = false;
      lightbox.close();
    }
  });
}

const home = document.querySelector('.view--home');
const paintLayer = document.querySelector('.paint-layer');
const canPaint = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (home && paintLayer && canPaint) {
  const paints = ['#E5533D', '#3A6FD8', '#3E9B5B', '#F0B429', '#E46A8C', '#3A2F5E'];
  let last = 0;
  home.addEventListener('pointermove', (event) => {
    const now = performance.now();
    if (now - last < 55) return;
    last = now;
    const rect = home.getBoundingClientRect();
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

if (localStorage.getItem('hobbyAdmin') === '1') {
  const side = document.querySelector('.top__side');
  const inHeader = document.createElement('a');
  inHeader.className = 'admin-return';
  inHeader.href = 'admin.html';
  inHeader.textContent = '관리자';
  if (side) side.prepend(inHeader);
  const onHome = document.createElement('a');
  onHome.className = 'admin-return admin-return--home';
  onHome.href = 'admin.html';
  onHome.textContent = '관리자';
  document.querySelector('.view--home').appendChild(onHome);
}