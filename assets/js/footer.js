/**
 * footer.js — Auto-injects site footer + its CSS
 * Usage: <script src="/assets/js/footer.js"></script>
 * Place just before </body> — no manual footer HTML needed
 */

(function () {
  // CSS inject (agar already nahi hai)
  if (!document.getElementById('wm-footer-css')) {
    const link = document.createElement('link');
    link.id   = 'wm-footer-css';
    link.rel  = 'stylesheet';
    link.href = '/assets/css/footer.css';
    document.head.appendChild(link);
  }

  // Theme toggle CSS inject
  if (!document.getElementById('wm-theme-toggle-css')) {
    const style = document.createElement('style');
    style.id = 'wm-theme-toggle-css';
    style.textContent = `
      .theme-toggle-btn {
        display: inline-flex; align-items: center; gap: 5px;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);
        border-radius: 14px; padding: 3px 10px; cursor: pointer;
        font-size: 10px; color: #6a6258; transition: all 0.3s;
        font-family: 'Syne', sans-serif; white-space: nowrap;
      }
      .theme-toggle-btn:hover { border-color: #c8a96e; color: #c8a96e; }
      .theme-toggle-btn svg { width: 12px; height: 12px; flex-shrink: 0; }
      [data-theme="light"] .theme-toggle-btn {
        background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.10);
      }
    `;
    document.head.appendChild(style);
  }

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <p>&copy; ${new Date().getFullYear()} Westcrest Media. All rights reserved.</p>
    <div class="footer-right" style="display:flex;align-items:center;gap:1rem;">
      <div class="footer-links">
        <a href="https://westcrestmedia.in/privacy-policy/">Privacy Policy</a>
        <a href="https://westcrestmedia.in/terms/">Terms</a>
      </div>
      <button class="theme-toggle-btn" onclick="WMTheme.toggle()" aria-label="Toggle theme">
        <svg class="theme-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg class="theme-icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
    </div>
  `;
  const target = document.getElementById('site-footer');
  if (target) target.replaceWith(footer);
  else document.body.appendChild(footer);

  // Load theme toggle script
  if (!document.getElementById('wm-theme-toggle-script')) {
    var s = document.createElement('script');
    s.id = 'wm-theme-toggle-script';
    s.src = '/assets/js/theme-toggle.js';
    document.body.appendChild(s);
  }
})();
