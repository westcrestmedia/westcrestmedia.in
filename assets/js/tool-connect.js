// /assets/js/tool-connect.js
// ─────────────────────────────────────────────────────────────────────────
// Shared connector loaded on EVERY tool page. Wires creations.js into a
// visible UI: a "continue your last work" banner, and a "send to another
// tool" picker. Works for logged-in AND anonymous users (creations.js
// already handles that split internally).
//
// REQUIRES from the host page:
//   1. window.__WM_TOOL__ = { slug, name, emoji, url }   (you already have this)
//   2. <div id="wm-connect-root"></div>  — one empty placeholder, anywhere
//      you want the "Send to another tool" picker to appear (e.g. right
//      after the Download panel). Same pattern as #tool-nav / #site-footer.
//   3. /assets/js/tools-data.js loaded on the page (you already have this) —
//      its global WC_TOOLS array is read automatically to build the picker,
//      so the tool list always stays in sync with the real site.
//
// REQUIRES from the host tool's own JS (e.g. background-remover.js):
//   window.WM_getCurrentBlob   — async () => ({ blob, fileName, mimeType }) | null
//                                 Return null/undefined if there's nothing
//                                 to send yet (no image processed).
//   window.WM_loadIncomingFile — async (file) => void
//                                 Load a File into this tool exactly like a
//                                 normal user upload would.
//   Only implement these on tools that actually produce/accept image files.
//   Text-only tools (Video Prompt Generator, Font Pairing, etc.) can skip
//   both — the picker UI simply won't show a save/restore banner for them
//   and "current result" entries will just stay empty.
// ─────────────────────────────────────────────────────────────────────────

import { saveResult, getResultForTool, getLatestResult, recordToFile } from '/assets/js/creations.js'

// Hardcoded fallback — only used if tools-data.js somehow isn't loaded.
// Kept in sync with WC_TOOLS in /assets/js/tools-data.js as of this writing.
const FALLBACK_TOOLS = [
  { slug: 'aspect-ratio',       name: 'Aspect Ratio Calculator', emoji: '📐', url: 'https://westcrestmedia.in/tools/aspect-ratio/' },
  { slug: 'background-remover', name: 'AI Background Remover',   emoji: '✂️', url: 'https://westcrestmedia.in/tools/background-remover/' },
  { slug: 'color-palette',      name: 'Color Palette Generator', emoji: '🎨', url: 'https://westcrestmedia.in/tools/color-palette/' },
  { slug: 'font-pairing',       name: 'Font Pairing Tool',       emoji: '🔤', url: 'https://westcrestmedia.in/tools/font-pairing/' },
  { slug: 'image-compressor',   name: 'Image Compressor',        emoji: '⚡', url: 'https://westcrestmedia.in/tools/image-compressor/' },
  { slug: 'image-converter',    name: 'Image Converter',         emoji: '🖼️', url: 'https://westcrestmedia.in/tools/image-converter/' },
  { slug: 'image-prompt',       name: 'Image Prompt Generator',  emoji: '🎰', url: 'https://westcrestmedia.in/tools/image-prompt/' },
  { slug: 'lut-preview',        name: 'LUT Studio',              emoji: '🎞️', url: 'https://westcrestmedia.in/tools/lut-preview/' },
  { slug: 'thumbnail-maker',    name: 'Video Thumbnail Maker',   emoji: '🎬', url: 'https://westcrestmedia.in/tools/thumbnail-maker/' },
  { slug: 'video-prompt',       name: 'Video Prompt Generator',  emoji: '🎥', url: 'https://westcrestmedia.in/tools/video-prompt/' },
  { slug: 'image-resizer-pro',  name: 'Image Resizer Pro',       emoji: '↔️', url: 'https://westcrestmedia.in/tools/image-resizer-pro/' },
  { slug: 'pdf-studio',         name: 'PDF Studio',              emoji: '📑', url: 'https://westcrestmedia.in/tools/pdf-studio/' },
  { slug: 'photo-editor-pro',   name: 'Photo Editor Pro',        emoji: '🖌️', url: 'https://westcrestmedia.in/tools/photo-editor-pro/' },
]

// Derive a slug from a tool URL, e.g. ".../tools/color-palette/" -> "color-palette"
function deriveSlug(url) {
  const parts = url.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1]
}

// Reads the real tool list from tools-data.js (global WC_TOOLS, loaded as a
// classic <script> on every tool page) so this list never drifts out of
// sync. Falls back to the hardcoded list above only if WC_TOOLS is missing.
function getToolsList() {
  try {
    if (typeof WC_TOOLS !== 'undefined' && Array.isArray(WC_TOOLS) && WC_TOOLS.length) {
      return WC_TOOLS.map(t => ({
        slug: deriveSlug(t.url),
        name: t.name,
        emoji: t.icon,
        url: t.url
      }))
    }
  } catch (e) { /* WC_TOOLS not defined — fall through */ }
  return FALLBACK_TOOLS
}

function getCurrentTool() {
  return window.__WM_TOOL__ || null
}

function timeAgo(ts) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h ago'
  return Math.floor(h / 24) + 'd ago'
}

// ─── Banner: "Continue your previous work?" ────────────────────────────
function renderBanner({ record, message, actionLabel }) {
  // Avoid duplicate banners if this somehow runs twice.
  document.getElementById('wm-restore-banner')?.remove()

  const bar = document.createElement('div')
  bar.id = 'wm-restore-banner'
  bar.style.cssText = `
    display:flex;align-items:center;gap:12px;flex-wrap:wrap;
    background:#161616;border:1px solid rgba(201,168,76,0.3);
    border-radius:8px;padding:12px 16px;margin:0 auto 18px;
    max-width:900px;font-family:'DM Sans',sans-serif;
  `
  bar.innerHTML = `
    <span style="font-size:18px;">↻</span>
    <span style="flex:1;font-size:13px;color:#e8e4dc;min-width:180px;">
      ${message} <span style="color:#666;font-size:11px;">· ${timeAgo(record.createdAt)}</span>
    </span>
    <button id="wm-restore-btn" style="background:#C9A84C;color:#0c0c0c;border:none;border-radius:4px;padding:7px 16px;font-size:12px;font-weight:600;cursor:pointer;">${actionLabel}</button>
    <button id="wm-dismiss-btn" style="background:none;border:1px solid #1e1e1e;color:#666;border-radius:4px;padding:7px 12px;font-size:12px;cursor:pointer;">Dismiss</button>
  `

  const dropZone = document.querySelector('.drop-zone') || document.querySelector('.tool-wrap')
  if (dropZone?.parentNode) {
    dropZone.parentNode.insertBefore(bar, dropZone)
  } else {
    document.body.insertBefore(bar, document.body.firstChild)
  }

  document.getElementById('wm-restore-btn').addEventListener('click', async () => {
    if (typeof window.WM_loadIncomingFile === 'function') {
      const file = recordToFile(record)
      await window.WM_loadIncomingFile(file)
    }
    bar.remove()
  })
  document.getElementById('wm-dismiss-btn').addEventListener('click', () => bar.remove())
}

async function checkForContinuation() {
  const tool = getCurrentTool()
  if (!tool) return

  const params = new URLSearchParams(window.location.search)
  const incoming = params.get('continue') === '1'

  if (incoming) {
    // User clicked "Send to this tool" from elsewhere — pull the latest
    // cross-tool result regardless of which tool produced it.
    const latest = await getLatestResult()
    if (latest && latest.toolSlug !== tool.slug) {
      renderBanner({
        record: latest,
        message: `Continue with the image from <b>${latest.toolName}</b>?`,
        actionLabel: 'Load it here'
      })
      return
    }
  }

  // No incoming handoff — check if the user has their OWN earlier work in
  // this exact tool from earlier in the session.
  const mine = await getResultForTool(tool.slug)
  if (mine) {
    renderBanner({
      record: mine,
      message: `Welcome back — restore your previous ${tool.name} work?`,
      actionLabel: 'Restore'
    })
  }
}

// ─── "Send to another tool" picker ─────────────────────────────────────
function renderPicker() {
  const root = document.getElementById('wm-connect-root')
  if (!root) return

  const tool = getCurrentTool()
  const allTools = getToolsList()
  const others = allTools.filter(t => t.slug !== tool?.slug)

  root.innerHTML = `
    <div style="margin:24px auto;max-width:900px;font-family:'DM Sans',sans-serif;">
      <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#666;margin-bottom:10px;">
        Continue editing in another tool
      </div>
      <div id="wm-picker-grid" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
    </div>
  `
  const grid = document.getElementById('wm-picker-grid')
  others.forEach(t => {
    const btn = document.createElement('button')
    btn.style.cssText = `
      background:#111;border:1px solid #1e1e1e;border-radius:6px;
      padding:8px 14px;font-size:12px;color:#aaa;cursor:pointer;
      display:flex;align-items:center;gap:6px;transition:border-color .2s,color .2s;
    `
    btn.innerHTML = `<span>${t.emoji}</span><span>${t.name}</span>`
    btn.onmouseover = () => { btn.style.borderColor = 'rgba(201,168,76,0.4)'; btn.style.color = '#C9A84C' }
    btn.onmouseout  = () => { btn.style.borderColor = '#1e1e1e'; btn.style.color = '#aaa' }
    btn.addEventListener('click', () => sendToTool(t))
    grid.appendChild(btn)
  })
}

async function sendToTool(target) {
  const tool = getCurrentTool()
  if (typeof window.WM_getCurrentBlob !== 'function') {
    window.location.href = target.url
    return
  }
  const result = await window.WM_getCurrentBlob()
  if (result?.blob) {
    await saveResult({
      toolSlug: tool.slug,
      toolName: tool.name,
      blob: result.blob,
      fileName: result.fileName || 'image.png',
      mimeType: result.mimeType
    })
  }
  window.location.href = target.url + '?continue=1'
}

// ─── Init ───────────────────────────────────────────────────────────────
function init() {
  checkForContinuation()
  renderPicker()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
