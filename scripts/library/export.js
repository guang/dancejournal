// Export the PUBLISHED Move Library from Firestore into .cache/library.json (read-only).
//
//   node scripts/library/export.js
//
// Reads programs with shelf == 'topic' and visibility == 'public' (what the app's Discover shows) and the
// library_clips they list. Only clips that are public, ready and not soft-deleted are kept, so a teacher's
// takedown (dj-library's takedown.js) drops their moves on the next export. Needs the Firebase admin key at
// ~/.muh_secrets/dance-notes-firebase-adminsdk-fbsvc-61f182f143.json and firebase-admin (resolved from this
// folder's node_modules, else from ~/dj-move-library/.node, which dj-library already installs).
const fs = require('fs'), os = require('os'), path = require('path');

function req(m) {
  for (const p of [__dirname, path.join(os.homedir(), 'dj-move-library', '.node')]) {
    try { return require(require.resolve(m, { paths: [p] })); } catch (e) { /* next */ }
  }
  throw new Error(`Can't find ${m}. Run \`npm install\` in scripts/library.`);
}
const { initializeApp, cert } = req('firebase-admin/app');
const { getFirestore } = req('firebase-admin/firestore');

const KEY = path.join(os.homedir(), '.muh_secrets', 'dance-notes-firebase-adminsdk-fbsvc-61f182f143.json');
initializeApp({ credential: cert(require(KEY)) });
const db = getFirestore();

const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : null);

(async () => {
  const snap = await db.collection('programs').where('shelf', '==', 'topic').get();
  const topics = [];
  const clipIds = new Set();
  for (const d of snap.docs) {
    const p = d.data();
    if (p.visibility !== 'public') continue;
    topics.push({
      id: d.id,
      title: p.title || '',
      genre: p.genre || '',
      shelfOrder: typeof p.shelfOrder === 'number' ? p.shelfOrder : null,
      clipIds: p.clipIds || [],
      moveFacets: p.moveFacets || {},
      subtopics: p.subtopics || [],
      cover: (p.shelfCover && p.shelfCover.url) || p.thumbnailUrl || null,
      publishedAt: ms(p.publishedAt),
    });
    (p.clipIds || []).forEach((c) => clipIds.add(c));
  }

  const clips = {};
  const ids = [...clipIds];
  for (let i = 0; i < ids.length; i += 300) {
    const refs = ids.slice(i, i + 300).map((id) => db.doc('library_clips/' + id));
    const docs = await db.getAll(...refs);
    for (const doc of docs) {
      if (!doc.exists) continue;
      const c = doc.data();
      if (c.visibility !== 'public' || c.processingStatus !== 'ready' || c.deletedAt) continue;
      if (c.type !== 'cloud' || !c.url) continue;
      clips[doc.id] = {
        id: doc.id,
        name: c.clipName || '',
        url: c.url,
        poster: c.thumbnailUrl || null,
        duration: typeof c.duration === 'number' ? c.duration : null,
        handle: c.creatorHandle || null,
        instagramUrl: c.instagramUrl || null,
        sourceClipId: c.sourceClipId || null,
        moveStartMs: c.moveStartMs != null ? c.moveStartMs : (c.sourceStartMs != null ? c.sourceStartMs : null),
        genre: c.danceType || c.genre || null,
      };
    }
  }

  const out = { exportedAt: new Date().toISOString(), topics, clips };
  fs.mkdirSync(path.join(__dirname, '.cache'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '.cache', 'library.json'), JSON.stringify(out, null, 1));
  console.log(`exported ${topics.length} topics, ${Object.keys(clips).length} clips → scripts/library/.cache/library.json`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
