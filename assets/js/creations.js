// /assets/js/creations.js
// ─────────────────────────────────────────────────────────────────────────
// Shared cross-tool storage for Westcrest Media tools.
//
// Two layers, one API:
//   1. LOCAL (IndexedDB)  — instant tool-to-tool handoff. Works for EVERYONE,
//      no login required. This is what lets "Background Remover -> Photo
//      Editor -> Compressor" feel like one continuous flow.
//   2. CLOUD (Supabase)   — if the user happens to be logged in, the same
//      save also persists permanently (shows up on /dashboard, works across
//      devices). Anonymous users simply skip this part — local-only is fine.
//
// Usage in any tool page:
//   import { saveResult, getResultForTool, getLatestResult, recordToFile }
//     from '/assets/js/creations.js'
//
//   // After a tool finishes processing:
//   await saveResult({
//     toolSlug:  'background-remover',
//     toolName:  'Background Remover',
//     blob:      resultBlob,
//     fileName:  'my-photo.png'
//   })
//
//   // On a tool page, to offer "Continue with your last result":
//   const last = await getLatestResult()
//   if (last) showContinueBanner(last)
//
//   // On a tool page, to restore the user's OWN previous work in that tool:
//   const mine = await getResultForTool('background-remover')
// ─────────────────────────────────────────────────────────────────────────

import { supabase } from '/assets/js/auth.js'

const DB_NAME     = 'wm_tools_db'
const DB_VERSION  = 1
const STORE_NAME  = 'handoff'
const SESSION_KEY = 'wm_session_id'
const BUCKET      = 'user-creations'

// ─── Session ID — stable per browser, works with or without login ───────
export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

// ─── IndexedDB plumbing ───────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('by_session', 'sessionId')
        store.createIndex('by_tool', 'toolSlug')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

async function idbPut(record) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

async function idbGetAll() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror   = () => reject(req.error)
  })
}

// ─── Save a tool's output ─────────────────────────────────────────────────
// Call right after a tool finishes processing and has a result blob ready.
export async function saveResult({ toolSlug, toolName, blob, fileName, mimeType }) {
  const sessionId = getSessionId()
  const record = {
    id: `${sessionId}_${toolSlug}`,   // one slot per tool per session -> always latest
    sessionId,
    toolSlug,
    toolName,
    blob,
    fileName,
    mimeType: mimeType || blob.type,
    createdAt: Date.now()
  }

  // 1. Local save — always happens, instant, no login needed.
  await idbPut(record)

  // 2. Cloud save — only if logged in. Fire-and-forget, never blocks the UI
  //    and never breaks the local flow if it fails (offline, RLS, etc).
  saveToCloud(record).catch(err => console.warn('Cloud save skipped:', err.message))

  return record
}

async function saveToCloud({ sessionId, toolSlug, toolName, blob, fileName, mimeType }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return // anonymous user — local-only is fine, nothing more to do

  const user = session.user
  const path = `${user.id}/${toolSlug}/${Date.now()}-${fileName}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: mimeType, upsert: false })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { error: insertError } = await supabase.from('creations').insert({
    user_id:    user.id,
    tool_slug:  toolSlug,
    tool_name:  toolName,
    file_url:   urlData.publicUrl,
    session_id: sessionId
  })
  if (insertError) throw insertError
}

// ─── Get this session's latest saved result for ONE specific tool ────────
// Use this to restore a user's own previous work if they come back to a tool.
export async function getResultForTool(toolSlug) {
  const sessionId = getSessionId()
  const all = await idbGetAll()
  return all.find(r => r.sessionId === sessionId && r.toolSlug === toolSlug) || null
}

// ─── Get the most recent result across ALL tools in this session ─────────
// Use this on tool load to offer "Continue with your last result".
export async function getLatestResult() {
  const sessionId = getSessionId()
  const all = await idbGetAll()
  const mine = all.filter(r => r.sessionId === sessionId)
  if (mine.length === 0) return null
  return mine.sort((a, b) => b.createdAt - a.createdAt)[0]
}

// ─── Convert a saved record back into a File for <input type="file"> flows ──
export function recordToFile(record) {
  return new File([record.blob], record.fileName, { type: record.mimeType })
}
