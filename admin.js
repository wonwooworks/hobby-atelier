import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const CONFIG = window.HOBBY_CONFIG;
const app = initializeApp(CONFIG.firebase);
const auth = getAuth(app);
const db = getFirestore(app);
const worksRef = collection(db, 'works');

const KINDS = { gift: '답례품', goods: '굿즈', piece: '작품' };
const FULL_SIZE = 1400;
const THUMB_SIZE = 480;

const $ = (selector) => document.querySelector(selector);
const loginView = $('[data-login]');
const appView = $('[data-app]');
const loginForm = $('[data-login-form]');
const loginMessage = $('[data-login-message]');
const list = $('[data-list]');
const listMessage = $('[data-list-message]');
const editor = $('[data-editor]');
const editorForm = $('[data-editor-form]');
const editorTitle = $('[data-editor-title]');
const editorMessage = $('[data-editor-message]');
const photosEl = $('[data-photos]');
const fileInput = $('[data-file]');
const saveBtn = $('[data-save]');
const deleteBtn = $('[data-delete]');

const photoUrl = (key) => `${CONFIG.photoBaseUrl.replace(/\/$/, '')}/${key}`;

let works = [];
let editing = null;
let photos = [];
let removedKeys = [];

const setMessage = (el, text, isError = false) => {
  el.textContent = text;
  el.classList.toggle('is-error', isError);
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const loadWorks = async () => {
  setMessage(listMessage, '불러오는 중이에요.');
  try {
    const snap = await getDocs(query(worksRef, orderBy('createdAt', 'desc')));
    works = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderList();
    setMessage(listMessage, works.length ? '' : '아직 올린 작업이 없어요.');
  } catch (error) {
    setMessage(listMessage, '목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', true);
  }
};

const renderList = () => {
  list.innerHTML = works.map((w) => `
    <li class="item">
      <img class="item__thumb" src="${photoUrl(w.photos[0].thumb)}" alt="">
      <div>
        <p class="item__title">${escapeHtml(w.title)}</p>
        <p class="item__meta">${KINDS[w.kind] || ''} · 사진 ${w.photos.length}장</p>
      </div>
      <button class="btn item__edit" type="button" data-edit="${w.id}">수정</button>
    </li>`).join('');
};

const renderPhotos = () => {
  photosEl.innerHTML = photos.map((p, i) => `
    <li class="photo">
      <img class="photo__img" src="${p.file ? p.preview : photoUrl(p.thumb)}" alt="">
      ${i === 0 ? '<span class="photo__badge">대표</span>' : ''}
      <div class="photo__tools">
        ${i > 0 ? `<button class="photo__tool" type="button" data-first="${i}">대표로</button>` : ''}
        <button class="photo__tool" type="button" data-remove="${i}">빼기</button>
      </div>
    </li>`).join('');
};

const openEditor = (work) => {
  editing = work || null;
  removedKeys = [];
  photos = work ? work.photos.map((p) => ({ ...p })) : [];
  editorForm.reset();
  editorTitle.textContent = work ? '작업 수정' : '새 작업 올리기';
  deleteBtn.hidden = !work;
  if (work) {
    editorForm.kind.value = work.kind;
    editorForm.title.value = work.title;
    editorForm.desc.value = work.desc || '';
  }
  setMessage(editorMessage, '');
  renderPhotos();
  editor.showModal();
};

const closeEditor = () => {
  photos.forEach((p) => { if (p.preview) URL.revokeObjectURL(p.preview); });
  editor.close();
};

const resize = async (file, maxSize) => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const toBlob = (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await toBlob('image/webp', 0.8);
  if (webp && webp.type === 'image/webp') return webp;
  return toBlob('image/jpeg', 0.8);
};

const callWorker = async (path, options) => {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${CONFIG.workerUrl.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`worker ${res.status}`);
  return res.json();
};

const upload = async (blob, base) => {
  const isWebp = blob.type === 'image/webp';
  const key = `${base}.${isWebp ? 'webp' : 'jpg'}`;
  await callWorker(`/upload?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': isWebp ? 'image/webp' : 'image/jpeg' },
    body: blob
  });
  return key;
};

const removeFromBucket = async (keys) => {
  if (!keys.length) return;
  try {
    await callWorker('/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys })
    });
  } catch (error) {
    console.warn(error);
  }
};

const newKey = (suffix) => `works/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${suffix}`;

const LOGIN_ERRORS = {
  'auth/invalid-credential': '이메일이나 비밀번호를 다시 확인해 주세요.',
  'auth/wrong-password': '이메일이나 비밀번호를 다시 확인해 주세요.',
  'auth/user-not-found': '이메일이나 비밀번호를 다시 확인해 주세요.',
  'auth/invalid-email': '이메일 형식을 다시 확인해 주세요.',
  'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요.',
  'auth/invalid-api-key': '설정 파일의 apiKey를 확인해 주세요.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': '설정 파일의 apiKey를 확인해 주세요.',
  'auth/operation-not-allowed': 'Firebase에서 이메일/비밀번호 로그인을 켜주세요.',
  'auth/configuration-not-found': 'Firebase Authentication을 먼저 시작해 주세요.'
};

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('[type="submit"]');
  button.disabled = true;
  setMessage(loginMessage, '로그인하는 중이에요.');
  try {
    await signInWithEmailAndPassword(auth, loginForm.email.value.trim(), loginForm.password.value);
    setMessage(loginMessage, '');
  } catch (error) {
    console.error(error);
    setMessage(loginMessage, `${LOGIN_ERRORS[error.code] || '로그인하지 못했어요.'} (${error.code || error.message})`, true);
  } finally {
    button.disabled = false;
  }
});

$('[data-logout]').addEventListener('click', () => signOut(auth));
$('[data-new]').addEventListener('click', () => openEditor());
$('[data-editor-close]').addEventListener('click', closeEditor);

list.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-edit]');
  if (btn) openEditor(works.find((w) => w.id === btn.dataset.edit));
});

photosEl.addEventListener('click', (event) => {
  const first = event.target.closest('[data-first]');
  const remove = event.target.closest('[data-remove]');
  if (first) {
    const [picked] = photos.splice(Number(first.dataset.first), 1);
    photos.unshift(picked);
  }
  if (remove) {
    const [gone] = photos.splice(Number(remove.dataset.remove), 1);
    if (gone.file) URL.revokeObjectURL(gone.preview);
    else removedKeys.push(gone.full, gone.thumb);
  }
  renderPhotos();
});

fileInput.addEventListener('change', () => {
  [...fileInput.files].forEach((file) => {
    if (photos.length >= 20) return;
    photos.push({ file, preview: URL.createObjectURL(file) });
  });
  fileInput.value = '';
  renderPhotos();
});

editorForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!photos.length) {
    setMessage(editorMessage, '사진을 한 장 이상 올려주세요.', true);
    return;
  }
  saveBtn.disabled = true;
  const pending = photos.filter((p) => p.file);
  try {
    let done = 0;
    const saved = [];
    for (const p of photos) {
      if (p.file) {
        setMessage(editorMessage, `사진 올리는 중이에요 (${done + 1}/${pending.length})`);
        const [full, thumb] = await Promise.all([resize(p.file, FULL_SIZE), resize(p.file, THUMB_SIZE)]);
        const fullKey = await upload(full, newKey('full'));
        const thumbKey = await upload(thumb, newKey('thumb'));
        saved.push({ full: fullKey, thumb: thumbKey });
        done += 1;
      } else {
        saved.push({ full: p.full, thumb: p.thumb });
      }
    }
    setMessage(editorMessage, '저장하는 중이에요.');
    const data = {
      kind: editorForm.kind.value,
      title: editorForm.title.value.trim(),
      desc: editorForm.desc.value.trim(),
      photos: saved
    };
    if (editing) {
      await updateDoc(doc(db, 'works', editing.id), { ...data, updatedAt: serverTimestamp() });
    } else {
      await addDoc(worksRef, { ...data, createdAt: serverTimestamp() });
    }
    await removeFromBucket(removedKeys);
    closeEditor();
    await loadWorks();
  } catch (error) {
    setMessage(editorMessage, '저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.', true);
  } finally {
    saveBtn.disabled = false;
  }
});

deleteBtn.addEventListener('click', async () => {
  if (!editing || !window.confirm('이 작업을 삭제할까요? 사진도 함께 지워져요.')) return;
  deleteBtn.disabled = true;
  try {
    await deleteDoc(doc(db, 'works', editing.id));
    await removeFromBucket(editing.photos.flatMap((p) => [p.full, p.thumb]));
    closeEditor();
    await loadWorks();
  } catch (error) {
    setMessage(editorMessage, '삭제하지 못했어요. 다시 시도해 주세요.', true);
  } finally {
    deleteBtn.disabled = false;
  }
});

onAuthStateChanged(auth, (user) => {
  localStorage.removeItem('hobbyAdmin');
  loginView.hidden = Boolean(user);
  appView.hidden = !user;
  if (user) loadWorks();
});