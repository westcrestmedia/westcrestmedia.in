/**
 * auth.js — Westcrest Media Global Auth
 * ─────────────────────────────────────
 import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL     = 'https://arxhryvhmnxkwqwnxoei.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeGhyeXZobW54a3dxd254b2VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDQxNzEsImV4cCI6MjA5NjU4MDE3MX0.0FJtAGOkCflI3ZpGm9ZdfIHWr3GHj_2xqysIMIqXonI'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SITE = 'https://westcrestmedia.in'
const LOGIN_PAGE = '/login.html'

/** Current page ka path, login ke baad yahan wapas aana hai */
function currentPath() {
  return window.location.pathname + window.location.search
}

/** login.html pe bhejo, current page ko ?next= mein save karke */
function goToLogin() {
  const next = encodeURIComponent(currentPath())
  window.location.href = LOGIN_PAGE + '?next=' + next
}

/** ?next= se redirect target nikalo, default: homepage */
function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search)
  const next = params.get('next')
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  if (next && next.startsWith(SITE)) return next
  return '/'
}

/** Login ke baad redirect */
export function redirectAfterLogin() {
  window.location.href = getRedirectTarget()
}

// ─── DOM Updater ──────────────────────────────────────────────────────────────

function applyAuthState(user) {
  const isAuthed = !!user

  // data-wm-show="authed" / "guest"
  document.querySelectorAll('[data-wm-show]').forEach(el => {
    const rule = el.dataset.wmShow
    el.style.display = (rule === 'authed' && isAuthed) || (rule === 'guest' && !isAuthed)
      ? ''
      : 'none'
  })

  // data-wm-user="name" / "avatar"
  if (user) {
    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Creator'
    const avatar = user.user_metadata?.avatar_url || null

    document.querySelectorAll('[data-wm-user="name"]').forEach(el => {
      el.textContent = name
    })
    document.querySelectorAll('[data-wm-user="avatar"]').forEach(el => {
      if (avatar) {
        el.src = avatar
        el.alt = name
      } else {
        // Avatar nahi hai to initials dikhao (agar <span> ya <div> hai)
        el.textContent = name.charAt(0).toUpperCase()
      }
    })
  }

  // data-wm-signin → href update with ?next=
  document.querySelectorAll('[data-wm-signin]').forEach(el => {
    const next = encodeURIComponent(currentPath())
    el.href = LOGIN_PAGE + '?next=' + next
  })

  // data-wm-signout → click handler
  document.querySelectorAll('[data-wm-signout]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault()
      await supabase.auth.signOut()
      window.location.reload()
    })
  })
}

// ─── Page Guard ───────────────────────────────────────────────────────────────

/** <meta name="wm-auth" content="required" /> wala page guard */
function checkPageGuard(user) {
  const meta = document.querySelector('meta[name="wm-auth"]')
  if (!meta) return  // koi restriction nahi
  if (meta.content === 'required' && !user) {
    goToLogin()
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  // login.html pe hain aur already logged in → redirect karo
  if (user && window.location.pathname.endsWith('login.html')) {
    redirectAfterLogin()
    return
  }

  checkPageGuard(user)
  applyAuthState(user)

  // Real-time session changes (tab switch, sign out dusri tab mein, etc.)
  supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user ?? null
    checkPageGuard(u)
    applyAuthState(u)
  })
}

// Export taaki login.html bhi use kar sake
export { supabase, goToLogin, getRedirectTarget }

// Auto-run
init()
