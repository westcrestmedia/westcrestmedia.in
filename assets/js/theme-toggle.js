/**
 * theme-toggle.js — Dark / Light mode toggle
 * Usage: <script src="/assets/js/theme-toggle.js"></script>
 * Place in <head> or before </body> — applies saved theme immediately
 * Call WMTheme.toggle() from any button/element to switch theme
 */

const WMTheme = (function () {
  const STORAGE_KEY = 'wm-theme';

  function getPreferred() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    updateIcons(theme);
  }

  function updateIcons(theme) {
    document.querySelectorAll('.theme-toggle-btn').forEach(function (btn) {
      const sun = btn.querySelector('.theme-icon-sun');
      const moon = btn.querySelector('.theme-icon-moon');
      if (sun && moon) {
        if (theme === 'light') {
          sun.style.display = 'none';
          moon.style.display = 'inline-block';
        } else {
          sun.style.display = 'inline-block';
          moon.style.display = 'none';
        }
      }
    });
  }

  function toggle() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    apply(next);
  }

  // Apply immediately on script load
  apply(getPreferred());

  // Update icons once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      updateIcons(document.documentElement.getAttribute('data-theme') || 'dark');
    });
  } else {
    updateIcons(document.documentElement.getAttribute('data-theme') || 'dark');
  }

  return { toggle: toggle, apply: apply };
})();
