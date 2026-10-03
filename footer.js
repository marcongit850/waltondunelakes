// The only site footer. Pages load this script where the footer should appear.
// Edit the markup here to change navigation on every page.
// The Friends of Scenic 30A mark sits at the bottom left. A sponsored ad
// for Eating on 30A and Eating in Destin sits to its right. Other partner
// logos stay on the homepage partner strip.
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
    '    <div class="footer-intro">',
    '      <div>',
    '        <h2>Coastal Dune Lakes of Walton County</h2>',
    '        <p class="legal">Not affiliated with Walton County, Florida DEP, or Choctawhatchee Basin Alliance.</p>',
    '      </div>',
    '      <div class="footer-marks">',
    '        <div class="footer-friends">',
    '          <p>Please be sure to check out</p>',
    '          <a href="https://friendsofscenic30a.org/">',
    '            <img src="' + root + 'images/partners/friends-of-scenic-30a.png" width="1000" height="320" alt="Friends of Scenic 30A">',
    '          </a>',
    '        </div>',
    '        <div class="footer-sponsor">',
    '          <p>Sponsored by</p>',
    '          <div class="footer-sponsor-ad">',
    '            <img src="' + root + 'images/sponsors/eating-on-30a-eating-in-destin.webp" width="1120" height="672" alt="Eating on 30A and Eating in Destin" loading="lazy">',
    '            <a class="footer-sponsor-link footer-sponsor-30a" href="https://www.eatingon30a.com/" target="_blank" rel="noopener noreferrer">',
    '              <span class="visually-hidden">Eating on 30A (opens in a new tab)</span>',
    '            </a>',
    '            <a class="footer-sponsor-link footer-sponsor-destin" href="https://www.eatingindestin.com/" target="_blank" rel="noopener noreferrer">',
    '              <span class="visually-hidden">Eating in Destin (opens in a new tab)</span>',
    '            </a>',
    '          </div>',
    '        </div>',
    '      </div>',
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
