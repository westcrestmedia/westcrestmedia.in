/**
 * header-landing.js — Landing Page Header
 * ────────────────────────────────────────
 * Landing page ke <body> ke shuru mein paste karo:
 *
 *   <script src="/header-landing.js" type="module"></script>
 *   <nav id="navbar"></nav>
 *
 * Puri <nav id="navbar">...</nav> ka HTML hata do existing se,
 * sirf yeh khali tag rakhna hai.
 */

import { supabase, getRedirectTarget, redirectAfterLogin } from '/auth.js'

// ─── Nav HTML inject ──────────────────────────────────────────────────────────

function renderNav(user) {
  const name   = user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const avatar = user?.user_metadata?.avatar_url || null
  const initial = name ? name.charAt(0).toUpperCase() : '?'

  document.getElementById('navbar').innerHTML = `
    <a href="/" class="nav-logo">
      <img src="/images/logo.png" alt="Westcrest Media" width="180" height="52" style="height:52px;width:auto;object-fit:contain;mix-blend-mode:lighten;display:block;" />
    </a>

    <ul class="nav-links">
      <li class="nav-dropdown"><a href="#tools">Tools</a>
        <div class="dropdown-menu">
          <div class="dropdown-label">Image Tools</div>
          <a href="/tools/image-converter/"><span class="drop-icon-sm">🖼️</span>Image Converter</a>
          <a href="/tools/image-compressor/"><span class="drop-icon-sm">⚡</span>Image Compressor</a>
          <a href="/tools/background-remover/"><span class="drop-icon-sm">✂️</span>Background Remover</a>
          <a href="/tools/color-palette/"><span class="drop-icon-sm">🎨</span>Color Palette Generator</a>
          <div class="dropdown-divider"></div>
          <div class="dropdown-label">Video Tools</div>
          <a href="/tools/thumbnail-maker/"><span class="drop-icon-sm">🎬</span>Thumbnail Maker</a>
          <a href="/tools/lut-preview/"><span class="drop-icon-sm">🎞️</span>LUT Preview Tool</a>
          <a href="/tools/aspect-ratio/"><span class="drop-icon-sm">📐</span>Aspect Ratio Calculator</a>
          <div class="dropdown-divider"></div>
          <div class="dropdown-label">AI Prompt Tools</div>
          <a href="/tools/image-prompt/"><span class="drop-icon-sm">🎴</span>Image Prompt Generator</a>
          <a href="/tools/video-prompt/"><span class="drop-icon-sm">🎥</span>Video Prompt Generator</a>
          <div class="dropdown-divider"></div>
          <a href="/tools/font-pairing/"><span class="drop-icon-sm">🔤</span>Font Pairing Tool</a>
          <a href="/tools/png-to-pdf.html"><span class="drop-icon-sm">📄</span>PNG to PDF</a>
        </div>
      </li>
      <li><a href="#services">Services</a></li>
      <li><a href="#portfolio">Portfolio</a></li>
      <li><a href="#shop">Shop</a></li>
      <li><a href="#process">Process</a></li>
      <li><a href="/about/">About</a></li>
      <li><a href="/blog/">Blog</a></li>
      <li><a href="#contact">Contact</a></li>
    </ul>

    <div class="nav-right">
      <a href="#contact" class="nav-cta">Start a Project</a>

      ${user ? `
        <!-- Logged in: avatar dropdown -->
        <div id="wm-avatar-wrap" style="position:relative;">
          <button id="wm-avatar-btn" aria-label="Account menu" aria-expanded="false"
            style="width:36px;height:36px;border-radius:50%;border:1.5px solid #C9A84C;cursor:pointer;background:#1a1a1a;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#C9A84C;font-size:14px;font-weight:600;padding:0;transition:border-color .2s,box-shadow .2s;">
            ${avatar ? `<img src="${avatar}" alt="${name}" width="36" height="36" style="width:100%;height:100%;object-fit:cover;" />` : initial}
          </button>
          ${dropdownHTML(name, user.email)}
        </div>
      ` : `
        <!-- Guest: Sign In button -->
        <a href="/login/?next=/" class="nav-signin" id="wm-signin-btn">Sign In</a>
      `}

      <button class="hamburger" id="hamburger" type="button" aria-label="Toggle navigation menu" aria-expanded="false" onclick="toggleMobile()" style="background:none;border:none;padding:0;cursor:pointer;-webkit-appearance:none;appearance:none;">
        <span></span><span></span><span></span>
      </button>
    </div>
  `

  bindDropdown()
}

// ─── Dropdown HTML ────────────────────────────────────────────────────────────

function dropdownHTML(name, email) {
  return `
    <div id="wm-dropdown"
      style="display:none;position:absolute;right:0;top:calc(100% + 10px);width:220px;background:#131313;border:1px solid #242424;border-radius:6px;box-shadow:0 12px 40px rgba(0,0,0,0.6);z-index:9999;overflow:hidden;">
      <div style="padding:14px 16px 12px;border-bottom:1px solid #1e1e1e;">
        <div style="color:#f0ede6;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
        <div style="color:#555;font-size:11px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${email}</div>
      </div>
      <div style="padding:6px 0;">
        <a href="/dashboard.html" style="${ddLink}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
          Dashboard
        </a>
        <a href="/dashboard.html#bookmarks" style="${ddLink}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 1h8a1 1 0 0 1 1 1v10l-5-3-5 3V2a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          Bookmarks
        </a>
        <a href="/dashboard.html#downloads" style="${ddLink}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Downloads
        </a>
        <div style="height:1px;background:#1e1e1e;margin:4px 0;"></div>
        <button id="wm-signout-btn" style="${ddLink};background:none;border:none;cursor:pointer;width:100%;text-align:left;color:#666 !important;">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3M9 10l3-3-3-3M13 7H5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Sign Out
        </button>
      </div>
    </div>
  `
}

const ddLink = `display:flex;align-items:center;gap:10px;padding:9px 16px;color:#999;font-size:12.5px;text-decoration:none;font-family:'Syne',sans-serif;transition:color .15s;`

// ─── Bind interactions ────────────────────────────────────────────────────────

function bindDropdown() {
  const btn = document.getElementById('wm-avatar-btn')
  const dd  = document.getElementById('wm-dropdown')
  if (!btn || !dd) return

  btn.addEventListener('click', e => {
    e.stopPropagation()
    const open = dd.style.display === 'block'
    dd.style.display = open ? 'none' : 'block'
    btn.setAttribute('aria-expanded', !open)
  })
  document.addEventListener('click', () => {
    if (dd) dd.style.display = 'none'
  })

  document.getElementById('wm-signout-btn')?.addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.reload()
  })
}

// ─── Active nav link ──────────────────────────────────────────────────────────

function initActiveNav() {
  const path = window.location.pathname
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active')
  })
}

// ─── Scroll shrink ────────────────────────────────────────────────────────────

function initScroll() {
  const nav = document.getElementById('navbar')
  if (!nav) return
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40)
  }, { passive: true })
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const { data: { session } } = await supabase.auth.getSession()
  renderNav(session?.user ?? null)
  initScroll()
  initActiveNav()

  supabase.auth.onAuthStateChange((_e, session) => {
    renderNav(session?.user ?? null)
  })
}

init()
