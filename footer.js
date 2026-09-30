// The only site footer. Pages load this script where the footer should appear.
// Edit the markup here to change navigation on every page.
// Partner logos live on the homepage only, not in this footer.
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
  var onData = /\/the-data\/$/.test(path);

  var lakesHref = onLakePage ? "../" : onLakesIndex ? "./" : root + "lakes/";
  var contactHref = onContact ? "./" : root + "contact/";
  var dataHref = onData ? "./" : root + "the-data/";
  var contactAttrs = onContact ? ' aria-current="page"' : "";
  var dataAttrs = onData ? ' aria-current="page"' : "";

  script.insertAdjacentHTML("beforebegin", [
    '<footer class="site-footer">',
    '  <div class="wrap footer-grid">',
    '    <div>',
    '      <h2>Coastal Dune Lakes of Walton County</h2>',
    '      <p class="legal">Not affiliated with Walton County, Florida DEP, or Choctawhatchee Basin Alliance.</p>',
    '    </div>',
    '    <nav class="footer-nav" aria-label="Footer">',
    '      <a href="' + root + '">HOME</a>',
    '      <a href="' + lakesHref + '">THE LAKES</a>',
    '      <a href="' + root + '#about">UNDERSTANDING DUNE LAKES</a>',
    '      <a href="' + dataHref + '"' + dataAttrs + '>THE DATA</a>',
    '      <a href="' + contactHref + '"' + contactAttrs + '>CONTACT US</a>',
    '    </nav>',
    '  </div>',
    '</footer>'
  ].join("\n"));
})();
