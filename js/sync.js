// Cross-device sync: Google sign-in plus one Firestore document per account (users/{uid}).
// localStorage stays the working copy, so the planner is instant and works offline. This file mirrors it to the cloud.
import { store } from './store.js';
import { $$, uid as newRev, toast, downloadBackup, onAction } from './util.js';
import { reconcile, BLANK_META } from './syncCore.js';
import { FIREBASE_CONFIG, FIREBASE_SDK } from './firebaseConfig.js';

const META_KEY = 'ca-inter-hq-sync';
const PUSH_DELAY_MS = 1500;     // batch typing into one write
const MAX_DOC_CHARS = 1000000;  // Firestore caps a document at 1 MiB (firestore.rules enforces the same limit)

const LABELS = {
  loading: 'Connecting…',
  signedOut: 'Sign in to sync',
  saving: 'Saving…',
  synced: 'Synced',
  offline: 'Offline, will sync later',
  error: 'Sync problem',
};

const readMeta = () => {
  try {
    return { ...BLANK_META, ...JSON.parse(localStorage.getItem(META_KEY)) };
  } catch {
    return { ...BLANK_META };
  }
};
const writeMeta = (patch) => localStorage.setItem(META_KEY, JSON.stringify({ ...readMeta(), ...patch }));

let fb = null;         // { auth, db, authApi, dbApi } once the SDK has loaded
let user = null;
let docRef = null;
let unlisten = null;
let pushTimer = null;
let inflight = false;
let status = 'loading';
let detail = '';

// ---------- status shown in the header pill and the settings card ----------

/** Fill every [data-sync-*] element. Called on status changes and after each page render. */
export function paintSync() {
  $$('[data-sync-label]').forEach((el) => {
    el.textContent = LABELS[status];
    el.dataset.status = status;
  });
  $$('[data-sync-detail]').forEach((el) => { el.textContent = detail; });
  $$('[data-sync-email]').forEach((el) => { el.textContent = user?.email ?? ''; });
  $$('[data-sync-when]').forEach((el) => { el.hidden = (el.dataset.syncWhen === 'in') !== Boolean(user); });
}

function setStatus(next, why = '') {
  status = next;
  detail = why;
  paintSync();
}

const settledStatus = () => (navigator.onLine ? 'synced' : 'offline');

/** Turn Firebase errors into something she can act on. Returns '' for errors that need no message. */
function explain(err) {
  const code = err?.code ?? '';
  if (code === 'permission-denied') return 'The cloud database refused access. The Firestore rules need publishing (see firestore.rules).';
  if (code === 'auth/popup-blocked') return 'The browser blocked the Google sign-in window. Allow pop-ups for this site and try again.';
  if (code === 'auth/unauthorized-domain') return 'This web address is not on the Firebase authorized domains list.';
  if (code === 'auth/network-request-failed' || code === 'unavailable') return 'No internet connection. Try again when you are back online.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '';
  return err?.message || 'Something went wrong while syncing.';
}

// ---------- local edits -> cloud ----------

function markEdited() {
  writeMeta({ dirty: true, editedAt: Date.now() });
  if (!user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, PUSH_DELAY_MS);
}

async function push() {
  clearTimeout(pushTimer);
  pushTimer = null;
  if (!user || inflight) return; // a running push re-checks `dirty` when it finishes
  const json = JSON.stringify(store.cloudData());
  if (json.length >= MAX_DOC_CHARS) {
    setStatus('error', 'The planner has grown too big to sync. Download a backup, then delete old data.');
    return;
  }
  const rev = newRev();
  const editedAt = readMeta().editedAt;
  inflight = true;
  setStatus(navigator.onLine ? 'saving' : 'offline');
  try {
    // Offline, this waits until the connection is back. `dirty` stays saved meanwhile, so a closed tab loses nothing.
    await fb.dbApi.setDoc(docRef, { data: json, rev, updatedAt: Date.now() });
    writeMeta({ uid: user.uid, syncedRev: rev, dirty: readMeta().editedAt !== editedAt });
  } catch (err) {
    inflight = false;
    setStatus('error', explain(err));
    return;
  }
  inflight = false;
  if (readMeta().dirty) push();
  else setStatus(settledStatus());
}

// ---------- cloud -> this device ----------

function adopt(remote, data) {
  store.applyCloud(data);
  writeMeta({ uid: user.uid, syncedRev: remote.rev, dirty: false });
  setStatus(settledStatus());
}

/** First sync on a device that already has its own data, and the account has different data. Never lose either side. */
function askWhichCopy(remote, data) {
  const useAccount = confirm(
    'This device and your account both have planner data.\n\n'
    + 'OK: use your account\'s data here. This device\'s data is downloaded as a backup file first.\n'
    + 'Cancel: keep this device\'s data and replace your account\'s copy. That copy is downloaded as a backup file first.',
  );
  if (useAccount) {
    downloadBackup(store.exportJson(), 'this-device-backup');
    adopt(remote, data);
  } else {
    downloadBackup(store.exportJson(data), 'account-backup');
    push();
  }
}

function onRemote(snap) {
  // Our own write echoing back, or a snapshot racing our write (ours lands last and wins): nothing to do.
  if (snap.metadata.hasPendingWrites || inflight) return;
  const remote = snap.exists() ? snap.data() : null;
  let data = null;
  if (remote) {
    try {
      data = JSON.parse(remote.data);
    } catch {
      setStatus('error', 'The cloud copy could not be read. Your data on this device is safe.');
      return;
    }
  }
  const action = reconcile({
    remote,
    meta: readMeta(),
    uid: user.uid,
    localHasData: store.hasData(),
    remoteHasData: Boolean(data) && store.hasData(data),
    sameContent: Boolean(remote) && remote.data === JSON.stringify(store.cloudData()),
  });
  if (action === 'push') push();
  else if (action === 'adopt') adopt(remote, data);
  else if (action === 'ask') askWhichCopy(remote, data);
  else setStatus(settledStatus());
}

function onAuth(nextUser) {
  unlisten?.();
  unlisten = null;
  user = nextUser;
  if (!user) {
    setStatus('signedOut');
    return;
  }
  setStatus('loading');
  docRef = fb.dbApi.doc(fb.db, 'users', user.uid);
  unlisten = fb.dbApi.onSnapshot(docRef, onRemote, (err) => setStatus('error', explain(err)));
}

// ---------- boot ----------

async function connect() {
  if (fb) return;
  try {
    const load = (name) => import(`${FIREBASE_SDK}/firebase-${name}.js`);
    const [appApi, authApi, dbApi] = await Promise.all([load('app'), load('auth'), load('firestore')]);
    const app = appApi.initializeApp(FIREBASE_CONFIG);
    fb = { auth: authApi.getAuth(app), db: dbApi.getFirestore(app), authApi, dbApi };
  } catch {
    setStatus('offline', 'Could not reach Google. The planner still works here and syncs once you are back online.');
    return;
  }
  fb.authApi.onAuthStateChanged(fb.auth, onAuth);
}

onAction('sync-signin', async () => {
  if (!fb) {
    toast('Still connecting to Google. Try again in a moment.');
    connect();
    return;
  }
  try {
    await fb.authApi.signInWithPopup(fb.auth, new fb.authApi.GoogleAuthProvider());
  } catch (err) {
    const msg = explain(err);
    if (msg) toast(msg);
  }
});

onAction('sync-signout', async () => {
  if (!confirm('Sign out? Your planner stays on this device but stops syncing until you sign in again.')) return;
  await fb.authApi.signOut(fb.auth);
  toast('Signed out');
});

/** Start syncing. Edits are tracked from the first moment, even before Google has loaded or while signed out. */
export function startSync() {
  store.onLocalEdit(markEdited);
  window.addEventListener('online', () => {
    if (!fb) connect();
    else if (user) (readMeta().dirty ? push() : setStatus('synced'));
  });
  window.addEventListener('offline', () => user && setStatus('offline'));
  // Leaving the tab or app: send pending edits now instead of waiting for the delay.
  document.addEventListener('visibilitychange', () => document.hidden && pushTimer && push());
  connect();
}
