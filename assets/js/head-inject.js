/**
 * head-inject.js — Westcrest Media
 * Har page ke <head> mein sirf yeh ek line lagao:
 * <script src="/assets/js/head-inject.js"></script>
 *
 * Kya karta hai:
 * — Google AdSense load karta hai (har page pe)
 * — Page type ke hisaab se alag scripts inject karta hai
 */

(function () {
  const path = window.location.pathname;

  // ═══════════════════════════════════════════
  // 1. GOOGLE ADSENSE — har page pe load hoga
  // ═══════════════════════════════════════════
  const adsScript = document.createElement('script');
  adsScript.async = true;
  adsScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3571045080403257';
  adsScript.crossOrigin = 'anonymous';
  document.head.appendChild(adsScript);


  // ═══════════════════════════════════════════
  // 2. PAGE-SPECIFIC LOGIC
  // ═══════════════════════════════════════════

  // ── Landing Page ──
  if (path === '/' || path === '/index.html') {
    // Landing pe abhi kuch extra nahi
    // Yahan future mein A/B testing ya heatmap script add kar sakte ho
  }

  // ── Tool Pages ──
  if (path.startsWith('/tools/')) {
    // Tool pages pe explore-tools section already hai
    // Future mein tool-specific analytics ya upsell script yahan aayegi
  }

  // ── Blog Listing Page ──
  if (path === '/blog/' || path === '/blog/index.html') {
    // Blog listing pe abhi kuch extra nahi
  }

  // ── Blog Article Pages ──
  if (path.startsWith('/blog/') && path !== '/blog/' && path !== '/blog/index.html') {
    // Sirf article pages pe — reading progress bar ya share buttons
    // future mein yahan inject kar sakte ho
  }

  // ── About Page ──
  if (path === '/about/' || path.includes('/about/')) {
    // About pe ads nahi dikhane toh ad units wahan lagana hi mat
    // Script load hogi lekin unit nahi hogi toh koi ad nahi aayega
  }

})();
