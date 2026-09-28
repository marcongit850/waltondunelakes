// The only site header. Pages load this script where the header should appear.
// Edit the markup here to change the brand and primary nav on every page.
// Redirect-only pages (get-involved, impact, membership) do not load it.
//
// Relative links follow the script src: each "../" is one directory above
// the site root. Lake and contact pages keep the same hrefs they had when
// the header was copied into each HTML file.
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
  var lakesAttrs = onLakesIndex ? ' aria-current="page"' : "";
  var contactAttrs = onContact ? ' aria-current="page"' : "";

  script.insertAdjacentHTML("beforebegin", [
    '<a class="skip-link" href="#content">Skip to content</a>',
    '<header class="site-header">',
    '  <div class="wrap header-inner">',
    '    <a class="brand" href="' + root + '">',
    '      <img class="brand-logo" src="' + root + 'images/logo-walton-dune-lakes.png" alt="Walton Dune Lakes, Walton County, Florida" width="960" height="654">',
    '    </a>',
    '    <details class="nav-disclosure">',
    '      <summary class="menu-toggle">Menu</summary>',
    '      <nav class="nav" id="site-nav" aria-label="Primary">',
    '        <a href="' + lakesHref + '"' + lakesAttrs + '>THE LAKES</a>',
    '        <a href="' + root + '#about">UNDERSTANDING DUNE LAKES</a>',
    '        <a href="' + contactHref + '"' + contactAttrs + '>CONTACT</a>',
    '      </nav>',
    '    </details>',
    '  </div>',
    '</header>'
  ].join("\n"));
})();
