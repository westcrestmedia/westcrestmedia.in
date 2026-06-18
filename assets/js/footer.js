/**
 * footer.js — Auto-injects site footer
 * Usage: <script src="/assets/js/footer.js"></script>
 * Place just before </body> — no manual footer HTML needed
 */

(function () {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <p>© ${new Date().getFullYear()} Westcrest Media</p>
    <div class="footer-links">
      <a href="https://westcrestmedia.in/">Home</a>
      <a href="https://westcrestmedia.in/#tools">All Tools</a>
      <a href="https://westcrestmedia.in/#contact">Contact</a>
    </div>
  `;
  document.body.appendChild(footer);
})();
