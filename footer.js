// The only site footer. Pages load this script where the footer should appear.
// Edit the markup here to change navigation and Resources on every page.
// Redirect-only pages (get-involved, impact, membership) do not load it.
//
// Relative links follow the script src: each "../" is one directory above
// the site root. Lake and contact pages keep the same hrefs they had when
// the footer was copied into each HTML file.
(function () {
  var script = document.currentScript;
  if (!script) return;

  var src = script.getAttribute("src") || "";
  var depth = 0;
  while (src.indexOf("../") === 0) {
    depth += 1;
    src = src.slice(3);
  }
  var root = depth === 0 ? "./" : "../".repeat(depth);

  var path = location.pathname || "/";
  if (path.slice(-11) === "/index.html") path = path.slice(0, -10);
  else if (path.slice(-5) === ".html") path = path.slice(0, path.lastIndexOf("/") + 1);
  if (path.slice(-1) !== "/") path += "/";

  var onLakePage = /\/lakes\/[^/]+\/$/.test(path);
  var onLakesIndex = /\/lakes\/$/.test(path) && !onLakePage;
  var onContact = /\/contact\/$/.test(path);

  var lakesHref = onLakePage ? "../" : onLakesIndex ? "./" : root + "lakes/";
  var contactHref = onContact ? "./" : root + "contact/";
  var contactAttrs = onContact ? ' aria-current="page"' : "";

  script.insertAdjacentHTML("beforebegin", [
    '<footer class="site-footer">',
    '  <div class="wrap footer-grid">',
    '    <div>',
    '      <h2>Coastal Dune Lakes of Walton County</h2>',
    '      <p class="legal">Not affiliated with Walton County, Florida DEP, or Choctawhatchee Basin Alliance.</p>',
    '      <section class="footer-partners" aria-labelledby="partners-heading">',
    '        <h2 id="partners-heading">Resources</h2>',
    '        <ul class="partner-list">',
    '          <li><a href="https://www.friendsofscenic30a.org/" target="_blank" rel="noopener noreferrer">Friends of Scenic 30A<span class="visually-hidden"> (opens in a new tab)</span></a></li>',
    '          <li><a href="https://www.scenicwalton.org/" target="_blank" rel="noopener noreferrer">Scenic Walton<span class="visually-hidden"> (opens in a new tab)</span></a></li>',
    '        </ul>',
    '      </section>',
    '    </div>',
    '    <nav class="footer-nav" aria-label="Footer">',
    '      <a href="' + root + '">Home</a>',
    '      <a href="' + lakesHref + '">THE LAKES</a>',
    '      <a href="' + root + '#about">UNDERSTANDING DUNE LAKES</a>',
    '      <a href="' + contactHref + '"' + contactAttrs + '>CONTACT US</a>',
    '    </nav>',
    '  </div>',
    '</footer>'
  ].join("\n"));
})();
