import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { Firestore } from "@google-cloud/firestore";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "db.json");

const FIRESTORE_ENABLED = process.env.USE_FIRESTORE !== "false";
const FIRESTORE_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
const FIRESTORE_USERS_COLLECTION = process.env.FIRESTORE_USERS_COLLECTION || "users";
const FIRESTORE_BRIEFINGS_COLLECTION = process.env.FIRESTORE_BRIEFINGS_COLLECTION || "briefings";
const FIRESTORE_META_COLLECTION = process.env.FIRESTORE_META_COLLECTION || "meta";

const defaultUsage = () => ({
  totals: {
    generateBriefing: 0,
    generateSuccess: 0,
    generateFail: 0,
    geminiCalls: 0,
    geminiSuccess: 0,
    geminiFail: 0,
    ttsCalls: 0,
    ttsSuccess: 0,
    ttsFail: 0,
  },
  daily: {},
  byUser: {},
});

const defaultActivity = () => ({
  byUser: {},
});

const defaultState = () => ({
  users: [],
  sessions: [],
  briefings: [],
  usage: defaultUsage(),
  activity: defaultActivity(),
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeState = (parsed) => ({
  users: Array.isArray(parsed?.users) ? parsed.users : [],
  sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
  briefings: Array.isArray(parsed?.briefings) ? parsed.briefings : [],
  usage: parsed?.usage && typeof parsed.usage === "object" ? parsed.usage : defaultUsage(),
  activity: parsed?.activity && typeof parsed.activity === "object" ? parsed.activity : defaultActivity(),
});

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const loadLocalState = async () => {
  if (!fs.existsSync(dbPath)) return defaultState();
  try {
    const raw = await fsp.readFile(dbPath, "utf-8");
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
};

const writeLocalState = async (state) => {
  await fsp.writeFile(dbPath, JSON.stringify(state, null, 2), "utf-8");
};

const briefingDocId = (briefing) => `${briefing.userId || "unknown"}::${briefing.id || "unknown"}`;

const chunk = (arr, size = 400) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

let firestore = null;
if (FIRESTORE_ENABLED) {
  try {
    firestore = new Firestore(FIRESTORE_PROJECT_ID ? { projectId: FIRESTORE_PROJECT_ID } : {});
  } catch (error) {
    console.warn("Firestore unavailable, fallback to local db.json:", error?.message || error);
    firestore = null;
  }
}

const usersCollection = firestore?.collection(FIRESTORE_USERS_COLLECTION) || null;
const briefingsCollection = firestore?.collection(FIRESTORE_BRIEFINGS_COLLECTION) || null;
const usageDoc = firestore?.collection(FIRESTORE_META_COLLECTION).doc("usage") || null;
const activityDoc = firestore?.collection(FIRESTORE_META_COLLECTION).doc("activity") || null;

let state = defaultState();
let knownUserIds = new Set();
let knownBriefingDocIds = new Set();
let saveQueue = Promise.resolve();

const syncUsersToFirestore = async () => {
  if (!usersCollection) return;
  const currentUsers = Array.isArray(state.users) ? state.users : [];
  const currentUserIds = new Set(currentUsers.map((u) => u.id).filter(Boolean));

  for (const group of chunk(currentUsers)) {
    const batch = firestore.batch();
    for (const user of group) {
      batch.set(usersCollection.doc(user.id), user, { merge: true });
    }
    await batch.commit();
  }

  const removedUserIds = [...knownUserIds].filter((id) => !currentUserIds.has(id));
  for (const group of chunk(removedUserIds)) {
    const batch = firestore.batch();
    for (const id of group) {
      batch.delete(usersCollection.doc(id));
    }
    await batch.commit();
  }

  knownUserIds = currentUserIds;
};

const syncBriefingsToFirestore = async () => {
  if (!briefingsCollection) return;
  const currentBriefings = Array.isArray(state.briefings) ? state.briefings : [];
  const currentDocIds = new Set(currentBriefings.map(briefingDocId));

  for (const group of chunk(currentBriefings)) {
    const batch = firestore.batch();
    for (const briefing of group) {
      batch.set(briefingsCollection.doc(briefingDocId(briefing)), briefing, { merge: true });
    }
    await batch.commit();
  }

  const removedDocIds = [...knownBriefingDocIds].filter((id) => !currentDocIds.has(id));
  for (const group of chunk(removedDocIds)) {
    const batch = firestore.batch();
    for (const id of group) {
      batch.delete(briefingsCollection.doc(id));
    }
    await batch.commit();
  }

  knownBriefingDocIds = currentDocIds;
};

const syncUsageToFirestore = async () => {
  if (!usageDoc) return;
  await usageDoc.set({ ...state.usage, updatedAt: Date.now() }, { merge: true });
};

const syncActivityToFirestore = async () => {
  if (!activityDoc) return;
  await activityDoc.set({ ...state.activity, updatedAt: Date.now() }, { merge: true });
};

const saveState = async ({
  users = true,
  briefings = true,
  usage = true,
  activity = true,
} = {}) => {
  const run = async () => {
    await writeLocalState(state);

    if (!firestore) return;

    const tasks = [];
    if (users) tasks.push(syncUsersToFirestore());
    if (briefings) tasks.push(syncBriefingsToFirestore());
    if (usage) tasks.push(syncUsageToFirestore());
    if (activity) tasks.push(syncActivityToFirestore());
    await Promise.all(tasks);
  };

  saveQueue = saveQueue
    .then(run, run)
    .catch((error) => {
      console.error("Failed to persist state:", error);
      throw error;
    });

  return saveQueue;
};

const loadFirestoreState = async () => {
  if (!firestore) return null;

  const [usersSnap, briefingsSnap, usageSnap, activitySnap] = await Promise.all([
    usersCollection.get(),
    briefingsCollection.get(),
    usageDoc.get(),
    activityDoc.get(),
  ]);

  const hasRemoteData = usersSnap.size > 0 || briefingsSnap.size > 0 || usageSnap.exists || activitySnap.exists;
  if (!hasRemoteData) return null;

  const remote = defaultState();
  remote.users = usersSnap.docs.map((doc) => doc.data()).filter(Boolean);
  remote.briefings = briefingsSnap.docs.map((doc) => doc.data()).filter(Boolean);
  if (usageSnap.exists) {
    const data = usageSnap.data();
    remote.usage = {
      totals: data?.totals && typeof data.totals === "object" ? data.totals : defaultUsage().totals,
      daily: data?.daily && typeof data.daily === "object" ? data.daily : {},
      byUser: data?.byUser && typeof data.byUser === "object" ? data.byUser : {},
    };
  }
  if (activitySnap.exists) {
    const data = activitySnap.data();
    remote.activity = {
      byUser: data?.byUser && typeof data.byUser === "object" ? data.byUser : {},
    };
  }

  knownUserIds = new Set(remote.users.map((u) => u.id).filter(Boolean));
  knownBriefingDocIds = new Set(remote.briefings.map(briefingDocId));

  return normalizeState(remote);
};

const applyState = (nextState) => {
  state = normalizeState(nextState);
  knownUserIds = new Set(state.users.map((u) => u.id).filter(Boolean));
  knownBriefingDocIds = new Set(state.briefings.map(briefingDocId));
};

const init = async () => {
  const localState = await loadLocalState();

  if (!firestore) {
    applyState(localState);
    return;
  }

  try {
    const remoteState = await loadFirestoreState();
    if (remoteState) {
      applyState(remoteState);
      await writeLocalState(state);
      return;
    }

    applyState(localState);
    await saveState({ users: true, briefings: true, usage: true, activity: true });
  } catch (error) {
    console.error("Failed to load from Firestore, fallback to local db.json:", error?.message || error);
    applyState(localState);
  }
};

export const db = {
  get users() {
    return state.users;
  },
  set users(value) {
    state.users = Array.isArray(value) ? value : [];
  },
  get sessions() {
    return state.sessions;
  },
  set sessions(value) {
    state.sessions = Array.isArray(value) ? value : [];
  },
  get briefings() {
    return state.briefings;
  },
  set briefings(value) {
    state.briefings = Array.isArray(value) ? value : [];
  },
  get usage() {
    return state.usage;
  },
  set usage(value) {
    state.usage = value && typeof value === "object" ? value : defaultUsage();
  },
  get activity() {
    return state.activity;
  },
  set activity(value) {
    state.activity = value && typeof value === "object" ? value : defaultActivity();
  },
  init,
  save: saveState,
  isFirestoreEnabled() {
    return Boolean(firestore);
  },
  snapshot() {
    return clone(state);
  },
};
