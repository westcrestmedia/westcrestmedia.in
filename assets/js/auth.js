/**
 * auth.js — Westcrest Media Global Auth
 * ─────────────────────────────────────
 * Har HTML page ke </body> se pehle include karo:
 *   <script src="/assets/js/auth.js" type="module"></script>
 *
 * ATTRIBUTES (kisi bhi element pe):
 *   data-wm-signin        → href auto-set hoga with ?next=
 *   data-wm-signout       → click pe logout
 *   data-wm-show="authed" → sirf logged-in users ko dikhao
 *   data-wm-show="guest"  → sirf guests ko dikhao
 *   data-wm-user="name"   → user ka naam inject
 *   data-wm-user="avatar" → user ki photo (img tag mein src set hoga)
 *
 * PAGE GUARD (sirf is page ke <head> mein):
 *   <meta name="wm-auth" content="required" />
 *
 * HEADER AVATAR DROPDOWN:
 *   <div id="wm-avatar-wrap"></div>  ← yahan inject hoga
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL      = 'https://arxhryvhmnxkwqwnxoei.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeGhyeXZobW54a3dxd254b2VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDQxNzEsImV4cCI6MjA5NjU4MDE3MX0.0FJtAGOkCflI3ZpGm9ZdfIHWr3GHj_2xqysIMIqXonI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const SITE       = 'https://westcrestmedia.in'
const LOGIN_PAGE = '/login/'

// ─── Redirect helpers ─────────────────────────────────────────────────────────

function currentPath() {
  return window.location.pathname + window.location.search
}

export function goToLogin() {
  window.location.href = LOGIN_PAGE + '?next=' + encodeURIComponent(currentPath())
}

export function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search)
  const next = params.get('next')
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  if (next && next.startsWith(SITE)) return next
  return '/'
}

export function redirectAfterLogin() {
  window.location.href = getRedirectTarget()
}

// ─── Bookmark helpers (tools pages se call karo) ──────────────────────────────

export async function addBookmark({ slug, name, url, emoji = '🛠️' }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { goToLogin(); return }
  const { error } = await supabase.from('bookmarks').upsert({
    user_id: session.user.id, tool_slug: slug,
    tool_name: name, tool_url: url, tool_emoji: emoji
  }, { onConflict: 'user_id,tool_slug' })
  return !error
}

export async function removeBookmark(slug) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  await supabase.from('bookmarks').delete()
    .eq('user_id', session.user.id).eq('tool_slug', slug)
}

export async function isBookmarked(slug) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  const { data } = await supabase.from('bookmarks').select('id')
    .eq('user_id', session.user.id).eq('tool_slug', slug).maybeSingle()
  return !!data
}

// ─── Download logger (tool download ke waqt call karo) ───────────────────────

export async function logDownload({ toolSlug, toolName, fileName, fileType }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return  // guest downloads track nahi hote
  await supabase.from('downloads').insert({
    user_id: session.user.id,
    tool_slug: toolSlug, tool_name: toolName,
    file_name: fileName, file_type: fileType
  })
}

// ─── Avatar Dropdown HTML ─────────────────────────────────────────────────────

const DROPDOWN_STYLES = `
#wm-avatar-wrap { position: relative; display: inline-block; font-family: 'Inter', sans-serif; }

#wm-avatar-btn {
  width: 36px; height: 36px; border-radius: 50%;
  border: 1.5px solid #C9A84C;
  cursor: pointer; background: #1a1a1a;
  overflow: hidden; display: flex; align-items: center; justify-content: center;
  color: #C9A84C; font-size: 14px; font-weight: 600;
  transition: border-color 0.2s, box-shadow 0.2s;
  padding: 0;
}
#wm-avatar-btn:hover { border-color: #d4b560; box-shadow: 0 0 0 3px rgba(201,168,76,0.15); }
#wm-avatar-btn img { width: 100%; height: 100%; object-fit: cover; }

#wm-dropdown {
  display: none; position: absolute; right: 0; top: calc(100% + 10px);
  width: 220px; background: #131313;
  border: 1px solid #242424; border-radius: 6px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.6);
  z-index: 9999; overflow: hidden;
}
#wm-dropdown.open { display: block; }

.wm-dd-header {
  padding: 14px 16px 12px;
  border-bottom: 1px solid #1e1e1e;
}
.wm-dd-name { color: #f0ede6; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wm-dd-email { color: #555; font-size: 11px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.wm-dd-links { padding: 6px 0; }
.wm-dd-links a, .wm-dd-links button {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 9px 16px;
  color: #999; font-size: 12.5px; text-decoration: none;
  background: none; border: none; cursor: pointer; text-align: left;
  transition: color 0.15s, background 0.15s;
}
.wm-dd-links a:hover, .wm-dd-links button:hover { color: #C9A84C; background: rgba(201,168,76,0.05); }
.wm-dd-links a svg, .wm-dd-links button svg { flex-shrink: 0; }

.wm-dd-divider { height: 1px; background: #1e1e1e; margin: 4px 0; }

.wm-dd-signout { color: #666 !important; }
.wm-dd-signout:hover { color: #e05252 !important; background: rgba(224,82,82,0.06) !important; }
`

function injectDropdown(user) {
  const wrap = document.getElementById('wm-avatar-wrap')
  if (!wrap) return

  // Styles inject (ek baar)
  if (!document.getElementById('wm-auth-styles')) {
    const style = document.createElement('style')
    style.id = 'wm-auth-styles'
    style.textContent = DROPDOWN_STYLES
    document.head.appendChild(style)
  }

  const name   = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Creator'
  const email  = user.email || ''
  const avatar = user.user_metadata?.avatar_url || null
  const initial = name.charAt(0).toUpperCase()

  wrap.innerHTML = `
    <button id="wm-avatar-btn" aria-label="Account menu" aria-expanded="false">
      ${avatar ? `<img src="${avatar}" alt="${name}" />` : initial}
    </button>
    <div id="wm-dropdown" role="menu">
      <div class="wm-dd-header">
        <div class="wm-dd-name">${name}</div>
        <div class="wm-dd-email">${email}</div>
      </div>
      <div class="wm-dd-links">
        <a href="/dashboard.html">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
          Dashboard
        </a>
        <a href="/dashboard.html#bookmarks">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 1h8a1 1 0 0 1 1 1v10l-5-3-5 3V2a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          Bookmarks
        </a>
        <a href="/dashboard.html#downloads">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Downloads
        </a>
        <div class="wm-dd-divider"></div>
        <button class="wm-dd-signout" id="wm-signout-btn">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3M9 10l3-3-3-3M13 7H5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Sign Out
        </button>
      </div>
    </div>
  `

  // Toggle dropdown
  const btn = document.getElementById('wm-avatar-btn')
  const dd  = document.getElementById('wm-dropdown')
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const open = dd.classList.toggle('open')
    btn.setAttribute('aria-expanded', open)
  })
  document.addEventListener('click', () => {
    dd.classList.remove('open')
    btn.setAttribute('aria-expanded', 'false')
  })

  // Sign out
  document.getElementById('wm-signout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.reload()
  })
}

function removeDropdown() {
  const wrap = document.getElementById('wm-avatar-wrap')
  if (wrap) wrap.innerHTML = ''
}

// ─── DOM Attributes ───────────────────────────────────────────────────────────

function applyAuthState(user) {
  const isAuthed = !!user

  document.querySelectorAll('[data-wm-show]').forEach(el => {
    const rule = el.dataset.wmShow
    el.style.display =
      (rule === 'authed' && isAuthed) || (rule === 'guest' && !isAuthed) ? '' : 'none'
  })

  if (user) {
    const name   = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Creator'
    const avatar = user.user_metadata?.avatar_url || null
    document.querySelectorAll('[data-wm-user="name"]').forEach(el => el.textContent = name)
    document.querySelectorAll('[data-wm-user="avatar"]').forEach(el => {
      if (avatar && el.tagName === 'IMG') { el.src = avatar; el.alt = name }
      else el.textContent = name.charAt(0).toUpperCase()
    })
    injectDropdown(user)
  } else {
    removeDropdown()
  }

  document.querySelectorAll('[data-wm-signin]').forEach(el => {
    el.href = LOGIN_PAGE + '?next=' + encodeURIComponent(currentPath())
  })
  document.querySelectorAll('[data-wm-signout]').forEach(el => {
    el.onclick = async (e) => { e.preventDefault(); await supabase.auth.signOut(); window.location.reload() }
  })
}

// ─── Page Guard ───────────────────────────────────────────────────────────────

function checkPageGuard(user) {
  const meta = document.querySelector('meta[name="wm-auth"]')
  if (meta?.content === 'required' && !user) goToLogin()
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (user && window.location.pathname.includes('login.html')) {
    redirectAfterLogin(); return
  }

  checkPageGuard(user)
  applyAuthState(user)

  supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user ?? null
    checkPageGuard(u)
    applyAuthState(u)
  })
}

init()
