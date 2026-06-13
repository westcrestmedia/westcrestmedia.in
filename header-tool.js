/**
 * header-tool.js — Tool Pages Header
 * ────────────────────────────────────
 * Har tool page ke <body> ke shuru mein:
 *
 *   <nav class="nav" id="tool-nav"></nav>
 *   <script type="module">
 *     import '/header-tool.js'
 *     window.__WM_TOOL__ = { slug: 'background-remover', name: 'Background Remover', emoji: '✂️', url: '/tools/background-remover/' }
 *   </script>
 *
 * Puri purani <nav>...</nav> ka HTML hata do, sirf yeh khali tag rakhna hai.
 */

import { supabase } from '/auth.js'

const TOOLS = [
  { col: '🖼️ Image Tools', items: [
    { slug: 'image-converter',    name: 'Image Converter',        emoji: '🖼️', url: '/tools/image-converter/' },
    { slug: 'image-compressor',   name: 'Image Compressor',       emoji: '⚡', url: '/tools/image-compressor/' },
    { slug: 'background-remover', name: 'Background Remover',     emoji: '✂️', url: '/tools/background-remover/' },
    { slug: 'color-palette',      name: 'Color Palette',          emoji: '🎨', url: '/tools/color-palette/' },
  ]},
  { col: '🎬 Video Tools', items: [
    { slug: 'thumbnail-maker',    name: 'Thumbnail Maker',        emoji: '🎬', url: '/tools/thumbnail-maker/' },
    { slug: 'lut-studio',         name: 'LUT Studio',             emoji: '🎞️', url: '/tools/lut-studio/' },
    { slug: 'aspect-ratio',       name: 'Aspect Ratio Calc',      emoji: '📐', url: '/tools/aspect-ratio/' },
  ]},
  { col: '✨ AI & Other', items: [
    { slug: 'image-prompt',       name: 'Image Prompts',          emoji: '🎴', url: '/tools/image-prompt/' },
    { slug: 'video-prompt',       name: 'Video Prompts',          emoji: '🎥', url: '/tools/video-prompt/' },
    { slug: 'font-pairing',       name: 'Font Pairing',           emoji: '🔤', url: '/tools/font-pairing/' },
    { slug: 'png-to-pdf',         name: 'PNG to PDF',             emoji: '📄', url: '/tools/png-to-pdf.html' },
  ]},
]

// ─── Render ───────────────────────────────────────────────────────────────────

async function renderNav() {
  const nav = document.getElementById('tool-nav')
  if (!nav) return

  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const tool = window.__WM_TOOL__ || {}


  const dropdownCols = TOOLS.map(group => `
    <div class="tools-col">
      <div class="tools-col-label">${group.col}</div>
      ${group.items.map(t => `
        <a href="${t.url}" ${t.slug === tool.slug ? 'class="current-tool"' : ''}>
          <span class="tool-icon">${t.emoji}</span>${t.name}
        </a>
      `).join('')}
    </div>
  `).join('')

  const name   = user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const avatar = user?.user_metadata?.avatar_url || null
  const initial = name ? name.charAt(0).toUpperCase() : '?'

  // Mobile dropdown CSS inject
  if (!document.getElementById('wm-tool-mobile-css')) {
    const s = document.createElement('style')
    s.id = 'wm-tool-mobile-css'
    s.textContent = `
      @media (max-width: 768px) {
        .tools-dropdown {
          position: fixed !important;
          top: 56px !important;
          left: 0 !important;
          right: 0 !important;
          width: 100vw !important;
          transform: none !important;
          border-radius: 0 0 12px 12px !important;
          padding: 16px !important;
          box-sizing: border-box !important;
          overflow-y: auto !important;
          max-height: calc(100vh - 56px) !important;
        }
        .tools-dropdown-grid {
          grid-template-columns: 1fr !important;
          gap: 0 !important;
        }
        .tools-col { min-width: unset !important; }
      }
    `
    document.head.appendChild(s)
  }

  nav.innerHTML = \`
    <!-- Logo -->
    <a href="/" class="nav-logo">
      <img src="/images/w_logo.svg" alt="Westcrest Media" style="height:26px;">
    </a>

    <!-- All Tools dropdown -->
    <button class="nav-tools-btn" id="toolsBtn" onclick="window.__toggleToolsDD()">
      All Tools
      <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
    </button>

    <div class="tools-dropdown" id="toolsDropdown">
      <div class="tools-dropdown-grid">${dropdownCols}</div>
    </div>

    <!-- Right side -->
    <div style="display:flex;align-items:center;gap:12px;margin-left:auto;">

      ${user ? `
        <!-- Avatar dropdown -->
        <div style="position:relative;">
          <button id="wm-avatar-btn" aria-label="Account" aria-expanded="false"
            style="width:32px;height:32px;border-radius:50%;border:1.5px solid #C9A84C;cursor:pointer;background:rgba(200,169,110,0.12);overflow:hidden;display:flex;align-items:center;justify-content:center;color:#C9A84C;font-weight:700;font-size:13px;padding:0;font-family:'Syne',sans-serif;">
            ${avatar ? `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;" />` : initial}
          </button>
          <div id="wm-dropdown"
            style="display:none;position:absolute;right:0;top:calc(100% + 10px);width:220px;background:#131313;border:1px solid #242424;border-radius:6px;box-shadow:0 12px 40px rgba(0,0,0,0.6);z-index:9999;overflow:hidden;">
            <div style="padding:14px 16px 12px;border-bottom:1px solid #1e1e1e;">
              <div style="color:#f0ede6;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
              <div style="color:#555;font-size:11px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.email}</div>
            </div>
            <div style="padding:6px 0;">
              <a href="/dashboard.html" style="display:flex;align-items:center;gap:10px;padding:9px 16px;color:#999;font-size:12.5px;text-decoration:none;font-family:'Syne',sans-serif;">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
                Dashboard
              </a>
              <a href="/dashboard.html#bookmarks" style="display:flex;align-items:center;gap:10px;padding:9px 16px;color:#999;font-size:12.5px;text-decoration:none;font-family:'Syne',sans-serif;">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 1h8a1 1 0 0 1 1 1v10l-5-3-5 3V2a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
                Bookmarks
              </a>
              <a href="/dashboard.html#downloads" style="display:flex;align-items:center;gap:10px;padding:9px 16px;color:#999;font-size:12.5px;text-decoration:none;font-family:'Syne',sans-serif;">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Downloads
              </a>
              <div style="height:1px;background:#1e1e1e;margin:4px 0;"></div>
              <button id="wm-signout-btn" style="display:flex;align-items:center;gap:10px;padding:9px 16px;color:#666;font-size:12.5px;font-family:'Syne',sans-serif;background:none;border:none;cursor:pointer;width:100%;text-align:left;">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3M9 10l3-3-3-3M13 7H5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      ` : `
        <!-- Guest: Sign In -->
        <a href="/login/?next=${encodeURIComponent(window.location.pathname)}"
          style="font-family:'DM Mono',monospace;font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);text-decoration:none;padding:7px 16px;border:1px solid rgba(200,169,110,0.4);border-radius:2px;transition:background .2s;"
          onmouseover="this.style.background='rgba(200,169,110,0.1)'"
          onmouseout="this.style.background='transparent'">
          Sign In
        </a>
      `}
    </div>
  `

  bindInteractions(user, tool)
}

// ─── Interactions ─────────────────────────────────────────────────────────────

function bindInteractions(user, tool) {
  // Tools dropdown toggle
  window.__toggleToolsDD = () => {
    const btn = document.getElementById('toolsBtn')
    const dd  = document.getElementById('toolsDropdown')
    const open = dd.classList.toggle('open')
    btn.classList.toggle('open', open)
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('#toolsBtn') && !e.target.closest('#toolsDropdown')) {
      document.getElementById('toolsDropdown')?.classList.remove('open')
      document.getElementById('toolsBtn')?.classList.remove('open')
    }
  })

  // Avatar dropdown
  const avatarBtn = document.getElementById('wm-avatar-btn')
  const dd = document.getElementById('wm-dropdown')
  avatarBtn?.addEventListener('click', e => {
    e.stopPropagation()
    const open = dd.style.display === 'block'
    dd.style.display = open ? 'none' : 'block'
  })
  document.addEventListener('click', () => {
    if (dd) dd.style.display = 'none'
  })

  // Sign out
  document.getElementById('wm-signout-btn')?.addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.reload()
  })

}

// ─── Init ─────────────────────────────────────────────────────────────────────

renderNav()
