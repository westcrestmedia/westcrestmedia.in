(function () {
  // Current page ka URL
  const currentURL = window.location.href;

  // Current tool ko exclude karke baaki tools filter karo
  const otherTools = WC_TOOLS.filter(tool => !currentURL.includes(tool.url.replace("https://westcrestmedia.in", "")));

  // Section HTML banao
  const section = document.createElement("section");
  section.className = "section";
  section.style.paddingBottom = "2rem";

  const grid = otherTools.map(tool => `
    <a href="${tool.url}" style="text-decoration:none;" class="other-tool-card">
      <div class="other-tool-icon">${tool.icon}</div>
      <div>
        <div class="other-tool-name">${tool.name}</div>
        <div class="other-tool-desc">${tool.desc}</div>
      </div>
      <span class="other-tool-arrow">→</span>
    </a>
  `).join("");

  section.innerHTML = `
    <p class="sec-tag">More Free Tools</p>
    <h2 class="sec-heading">Explore Our <em>Tools</em></h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.75rem;margin-bottom:1.2rem;">
      ${grid}
    </div>
    <a href="https://westcrestmedia.in/#tools" style="font-size:12px;color:var(--gold);text-decoration:none;letter-spacing:.08em;font-weight:600;">View All Tools →</a>
  `;

  // Jahan bhi <div id="explore-tools"></div> ho wahan inject karo
  const target = document.getElementById("explore-tools");
  if (target) target.replaceWith(section);
})();
