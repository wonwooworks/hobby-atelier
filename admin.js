import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, query, orderBy, getDocs, setDoc, updateDoc, deleteDoc, doc, serverTimestamp, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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
const progressEl = $('[data-progress]');
const progressBar = $('[data-progress-bar]');
const progressText = $('[data-progress-text]');

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
      <div class="item__actions">
        <button class="btn item__btn" type="button" data-edit="${w.id}">수정</button>
        <button class="btn btn--danger item__btn" type="button" data-remove-work="${w.id}">삭제</button>
      </div>
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
  if (editorForm.classList.contains('is-busy')) return;
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

const upload = async (blob, base, onProgress) => {
  const isWebp = blob.type === 'image/webp';
  const key = `${base}.${isWebp ? 'webp' : 'jpg'}`;
  const token = await auth.currentUser.getIdToken();
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${CONFIG.workerUrl.replace(/\/$/, '')}/upload?key=${encodeURIComponent(key)}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', isWebp ? 'image/webp' : 'image/jpeg');
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded);
    });
    xhr.addEventListener('load', () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`worker ${xhr.status}`))));
    xhr.addEventListener('error', () => reject(new Error('network')));
    xhr.send(blob);
  });
  if (onProgress) onProgress(blob.size);
  return key;
};

const explainError = (error) => {
  const code = error.code || error.message || '';
  if (code === 'network') return `사진 업로드가 막혔어요. Worker의 ALLOWED_ORIGIN에 지금 주소(${location.origin})가 있는지 확인해 주세요. (network)`;
  if (code === 'worker 401') return '업로드 로그인 확인에 실패했어요. Worker의 FIREBASE_PROJECT_ID를 확인해 주세요. (worker 401)';
  if (code === 'worker 403') return '이 계정은 업로드 권한이 없어요. Worker의 ADMIN_EMAILS를 확인해 주세요. (worker 403)';
  if (code.startsWith('worker')) return `사진을 올리지 못했어요. (${code})`;
  if (code === 'permission-denied') return '저장 권한이 없어요. Firestore 규칙에 관리자 이메일이 맞게 들어갔는지, 새 규칙을 게시했는지 확인해 주세요. (permission-denied)';
  return `저장하지 못했어요. 다시 시도해 주세요. (${code})`;
};

const deleteWork = async (work) => {
  await deleteDoc(doc(db, 'works', work.id));
  await removeFromBucket(work.photos.flatMap((p) => [p.full, p.thumb]));
};

const setProgress = (percent, text) => {
  progressEl.hidden = false;
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `${text} ${Math.round(percent)}%`;
};

const hideProgress = () => {
  progressEl.hidden = true;
  progressBar.style.width = '0%';
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

$('[data-reset]').addEventListener('click', async () => {
  const email = loginForm.email.value.trim();
  if (!email) {
    setMessage(loginMessage, '이메일을 먼저 입력해 주세요.', true);
    loginForm.email.focus();
    return;
  }
  try {
    auth.languageCode = 'ko';
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error(error);
  }
  setMessage(loginMessage, '등록된 이메일이라면 비밀번호 설정 메일을 보냈어요. 메일함을 확인해 주세요.');
});
$('[data-new]').addEventListener('click', () => openEditor());
$('[data-editor-close]').addEventListener('click', closeEditor);
editor.addEventListener('cancel', (event) => {
  if (editorForm.classList.contains('is-busy')) event.preventDefault();
});

list.addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit]');
  const remove = event.target.closest('[data-remove-work]');
  if (edit) openEditor(works.find((w) => w.id === edit.dataset.edit));
  if (remove) {
    const work = works.find((w) => w.id === remove.dataset.removeWork);
    if (!work || !window.confirm(`'${work.title}' 작업을 삭제할까요? 사진도 함께 지워져요.`)) return;
    remove.disabled = true;
    try {
      await deleteWork(work);
      await loadWorks();
    } catch (error) {
      remove.disabled = false;
      setMessage(listMessage, '삭제하지 못했어요. 다시 시도해 주세요.', true);
    }
  }
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
  saveBtn.classList.add('is-loading');
  editorForm.classList.add('is-busy');
  setMessage(editorMessage, '');
  try {
    const pending = photos.filter((p) => p.file);
    if (pending.length) setProgress(0, '사진 준비 중');
    let prepared = 0;
    for (const p of pending) {
      [p.fullBlob, p.thumbBlob] = await Promise.all([resize(p.file, FULL_SIZE), resize(p.file, THUMB_SIZE)]);
      prepared += 1;
      setProgress((prepared / pending.length) * 100, '사진 준비 중');
    }
    const total = pending.reduce((sum, p) => sum + p.fullBlob.size + p.thumbBlob.size, 0);
    let sent = 0;
    const track = (loaded) => setProgress(Math.min(99, ((sent + loaded) / total) * 100), '사진 올리는 중');
    const saved = [];
    for (const p of photos) {
      if (p.file) {
        const fullKey = await upload(p.fullBlob, newKey('full'), track);
        sent += p.fullBlob.size;
        const thumbKey = await upload(p.thumbBlob, newKey('thumb'), track);
        sent += p.thumbBlob.size;
        saved.push({ full: fullKey, thumb: thumbKey });
      } else {
        saved.push({ full: p.full, thumb: p.thumb });
      }
    }
    setProgress(100, '저장하는 중');
    const data = {
      kind: editorForm.kind.value,
      title: editorForm.title.value.trim(),
      desc: editorForm.desc.value.trim(),
      photos: saved
    };
    if (editing) {
      await updateDoc(doc(db, 'works', editing.id), { ...data, updatedAt: serverTimestamp() });
    } else {
      const counterRef = doc(db, 'meta', 'counter');
      const no = await runTransaction(db, async (tx) => {
        const snap = await tx.get(counterRef);
        const next = (snap.exists() ? snap.data().works || 0 : 0) + 1;
        tx.set(counterRef, { works: next }, { merge: true });
        return next;
      });
      await setDoc(doc(db, 'works', String(no)), { ...data, no, createdAt: serverTimestamp() });
    }
    await removeFromBucket(removedKeys);
    editorForm.classList.remove('is-busy');
    hideProgress();
    closeEditor();
    await loadWorks();
  } catch (error) {
    console.error(error);
    setMessage(editorMessage, explainError(error), true);
  } finally {
    hideProgress();
    saveBtn.disabled = false;
    saveBtn.classList.remove('is-loading');
    editorForm.classList.remove('is-busy');
  }
});

deleteBtn.addEventListener('click', async () => {
  if (!editing || !window.confirm('이 작업을 삭제할까요? 사진도 함께 지워져요.')) return;
  deleteBtn.disabled = true;
  try {
    await deleteWork(editing);
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