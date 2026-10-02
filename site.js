(function () {
  var details = document.querySelector(".nav-disclosure");
  if (details) {
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && details.open) {
        details.removeAttribute("open");
        var summary = details.querySelector("summary");
        if (summary) summary.focus();
      }
    });
    details.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        details.removeAttribute("open");
      });
    });
  }

  var caption = document.getElementById("map-caption");
  var lakes = document.querySelectorAll("[data-lake]");
  if (lakes.length) {
    function activate(id) {
      lakes.forEach(function (el) {
        el.classList.toggle("is-active", el.getAttribute("data-lake") === id);
      });
      if (!caption) return;
      var source = document.querySelector('[data-caption][data-lake="' + id + '"]');
      var text = source && source.getAttribute("data-caption");
      if (text) caption.textContent = text;
    }

    lakes.forEach(function (el) {
      var id = el.getAttribute("data-lake");
      el.addEventListener("mouseenter", function () { activate(id); });
      el.addEventListener("focus", function () { activate(id); });
    });
  }

  document.querySelectorAll(".map-frame").forEach(function (frame) {
    var buttons = frame.querySelectorAll("[data-map-mode]");
    var panels = frame.querySelectorAll("[data-map-panel]");
    var scroll = frame.querySelector(".map-scroll");
    var pad = frame.querySelector(".map-pad");
    if (!buttons.length || !panels.length) return;

    var zoom = 1;

    function prefersStill() {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function designWidth() {
      return Math.max(1860, frame.clientWidth || 0);
    }

    function zoomSteps() {
      var design = designWidth();
      var view = scroll ? scroll.clientWidth : design;
      var floor = Math.max(view, Math.min(design, 1020));
      var fit = floor / design;
      var list = [];
      if (fit < 0.97) list.push(Math.round(fit * 1000) / 1000);
      [1, 1.45, 2, 2.65].forEach(function (step) {
        if (!list.length || step - list[list.length - 1] > 0.03) list.push(step);
      });
      return list;
    }

    function nearestStep(list, value) {
      var best = 0;
      var bestDist = Infinity;
      list.forEach(function (step, index) {
        var dist = Math.abs(step - value);
        if (dist < bestDist) {
          best = index;
          bestDist = dist;
        }
      });
      return best;
    }

    function applyZoomStyles() {
      var sat = frame.querySelector(".satellite-map");
      if (!sat || !scroll) return;
      if (!frame.classList.contains("is-satellite") || Math.abs(zoom - 1) < 0.001) {
        sat.style.width = "";
        sat.style.minWidth = "";
        scroll.style.maxHeight = "";
        scroll.style.overflowY = "";
        return;
      }
      var base = designWidth();
      var width = Math.round(base * zoom);
      sat.style.width = width + "px";
      sat.style.minWidth = width + "px";
      if (zoom > 1) {
        scroll.style.maxHeight = Math.round(base * 1100 / 3000) + "px";
        scroll.style.overflowY = "auto";
      } else {
        scroll.style.maxHeight = "";
        scroll.style.overflowY = "";
      }
    }

    function updateEastEnd() {
      if (!scroll || !frame.classList.contains("is-satellite")) {
        frame.classList.remove("is-east-end");
        return;
      }
      var remaining = scroll.scrollWidth - scroll.clientWidth - scroll.scrollLeft;
      frame.classList.toggle("is-east-end", remaining < 32);
    }

    function updatePad() {
      if (!pad || !scroll) return;
      var list = zoomSteps();
      var index = nearestStep(list, zoom);
      var maxLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
      var west = pad.querySelector('[data-map-move="west"]');
      var east = pad.querySelector('[data-map-move="east"]');
      var zoomIn = pad.querySelector('[data-map-move="in"]');
      var zoomOut = pad.querySelector('[data-map-move="out"]');
      if (west) west.disabled = scroll.scrollLeft <= 2;
      if (east) east.disabled = maxLeft - scroll.scrollLeft <= 2;
      if (zoomIn) zoomIn.disabled = index >= list.length - 1;
      if (zoomOut) zoomOut.disabled = index <= 0;
    }

    function syncMap() {
      applyZoomStyles();
      updateEastEnd();
      updatePad();
    }

    function pan(direction) {
      if (!scroll || !frame.classList.contains("is-satellite")) return;
      var amount = Math.max(140, Math.round(scroll.clientWidth * 0.42));
      scroll.scrollBy({
        left: direction * amount,
        behavior: prefersStill() ? "auto" : "smooth"
      });
    }

    function changeZoom(direction) {
      if (!scroll || !frame.classList.contains("is-satellite")) return;
      var list = zoomSteps();
      var index = nearestStep(list, zoom);
      var next = index + direction;
      if (next < 0 || next >= list.length) return;
      var previous = zoom;
      var anchorX = scroll.scrollLeft + scroll.clientWidth / 2;
      var anchorY = scroll.scrollTop + scroll.clientHeight / 2;
      zoom = list[next];
      applyZoomStyles();
      var ratio = previous ? zoom / previous : 1;
      scroll.scrollLeft = anchorX * ratio - scroll.clientWidth / 2;
      scroll.scrollTop = anchorY * ratio - scroll.clientHeight / 2;
      updateEastEnd();
      updatePad();
    }

    function moveMap(move) {
      if (move === "west") pan(-1);
      else if (move === "east") pan(1);
      else if (move === "in") changeZoom(1);
      else if (move === "out") changeZoom(-1);
    }

    function setMode(mode) {
      buttons.forEach(function (button) {
        var on = button.getAttribute("data-map-mode") === mode;
        button.setAttribute("aria-pressed", on ? "true" : "false");
      });
      panels.forEach(function (panel) {
        var on = panel.getAttribute("data-map-panel") === mode;
        if (!on && panel.contains(document.activeElement)) {
          document.activeElement.blur();
        }
        if (on) panel.removeAttribute("hidden");
        else panel.setAttribute("hidden", "");
      });
      frame.classList.toggle("is-satellite", mode === "satellite");
      if (scroll) {
        var active = frame.querySelector('[data-map-panel="' + mode + '"]');
        var label = active && active.getAttribute("data-map-label");
        if (label) scroll.setAttribute("aria-label", label);
      }
      window.requestAnimationFrame(syncMap);
    }

    if (scroll) {
      scroll.addEventListener("scroll", function () {
        updateEastEnd();
        updatePad();
      }, { passive: true });
      scroll.addEventListener("keydown", function (event) {
        if (!frame.classList.contains("is-satellite")) return;
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        var move = { ArrowLeft: "west", ArrowRight: "east", ArrowUp: "in", ArrowDown: "out" }[event.key];
        if (!move) return;
        event.preventDefault();
        moveMap(move);
      });
    }

    if (pad) {
      pad.addEventListener("click", function (event) {
        var button = event.target.closest("button");
        if (!button || button.disabled || !pad.contains(button)) return;
        moveMap(button.getAttribute("data-map-move"));
      });
      pad.addEventListener("keydown", function (event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        var move = { ArrowLeft: "west", ArrowRight: "east", ArrowUp: "in", ArrowDown: "out" }[event.key];
        if (!move) return;
        event.preventDefault();
        moveMap(move);
      });
    }

    window.addEventListener("resize", function () {
      if (frame.classList.contains("is-satellite") && zoom < 0.98) {
        zoom = zoomSteps()[0];
      }
      syncMap();
    });

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        setMode(button.getAttribute("data-map-mode"));
      });
    });
  });

  var form = document.getElementById("contact-form");
  if (form) {
    var status = document.getElementById("form-status");
    var success = document.getElementById("contact-success");
    var submit = form.querySelector("[type=submit]");
    var nameInput = form.querySelector("#contact-name");
    var emailInput = form.querySelector("#contact-email");
    var subjectInput = form.querySelector("#contact-subject");
    var messageInput = form.querySelector("#contact-message");
    var honeypotInput = form.querySelector("#hp-field");

    function setStatus(message, kind) {
      if (!status) return;
      status.textContent = message;
      status.classList.remove("is-error", "is-success");
      if (kind) status.classList.add(kind);
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = nameInput ? nameInput.value.trim() : "";
      var email = emailInput ? emailInput.value.trim() : "";
      var subject = subjectInput ? subjectInput.value.trim() : "";
      var message = messageInput ? messageInput.value.trim() : "";
      var honeypot = honeypotInput ? honeypotInput.value.trim() : "";

      if (honeypot) {
        setStatus("Could not send that message.", "is-error");
        return;
      }
      if (!name) {
        setStatus("Please add your name.", "is-error");
        if (nameInput) nameInput.focus();
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus("Please enter a valid email address.", "is-error");
        if (emailInput) emailInput.focus();
        return;
      }
      if (!message) {
        setStatus("Please add a message.", "is-error");
        if (messageInput) messageInput.focus();
        return;
      }
      if (name.length > 100 || email.length > 254 || subject.length > 140 || message.length > 4000) {
        setStatus("That message is too long.", "is-error");
        return;
      }

      if (submit) {
        submit.disabled = true;
        submit.textContent = "Sending…";
      }
      setStatus("Sending your message…", "");

      fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          name: name,
          email: email,
          subject: subject,
          message: message,
          hp_field: honeypot
        })
      }).then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (data) {
          return { ok: response.ok, data: data };
        });
      }).then(function (result) {
        var data = result.data || {};
        var errorText = typeof data.error === "string" && data.error.length > 0 && data.error.length < 200
          ? data.error
          : "";
        if (result.ok && data.ok) {
          form.hidden = true;
          if (success) {
            success.hidden = false;
            success.focus();
          }
          setStatus("", "");
          return;
        }
        setStatus(errorText || "Could not send that message. Please try again.", "is-error");
      }).catch(function () {
        setStatus("Could not send that message. Please try again.", "is-error");
      }).then(function () {
        if (submit && !form.hidden) {
          submit.disabled = false;
          submit.textContent = "Send message";
        }
      });
    });
  }

  var gallery = document.querySelector(".statement-gallery");
  if (gallery) initStatementGallery(gallery);
})();

function initStatementGallery(root) {
  var frame = root.querySelector("img");
  var prev = root.querySelector(".statement-gallery-prev");
  var next = root.querySelector(".statement-gallery-next");
  var status = root.querySelector(".statement-gallery-status");
  var manifest = root.getAttribute("data-gallery");
  if (!frame || !manifest) return;

  fetch(manifest).then(function (response) {
    if (!response.ok) throw new Error("gallery");
    return response.json();
  }).then(function (list) {
    var photos = statementGalleryPhotos(list, manifest);
    if (!photos.length) return;
    var index = 0;

    function show(nextIndex) {
      index = (nextIndex + photos.length) % photos.length;
      var photo = photos[index];
      if (frame.getAttribute("src") !== photo.src) frame.src = photo.src;
      frame.alt = photo.alt;
      frame.style.objectPosition = photo.position || "center";
      var many = photos.length > 1;
      if (prev) prev.hidden = !many;
      if (next) next.hidden = !many;
      if (status) status.textContent = many ? "Photo " + (index + 1) + " of " + photos.length : "";
      if (many) {
        root.setAttribute("role", "region");
        root.setAttribute("aria-roledescription", "carousel");
        root.setAttribute("aria-label", "Coastal dune lake photos");
        root.tabIndex = 0;
      }
    }

    show(0);
    if (photos.length < 2 || !prev || !next) return;

    prev.addEventListener("click", function () { show(index - 1); });
    next.addEventListener("click", function () { show(index + 1); });
    root.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        show(index - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        show(index + 1);
      }
    });

    var startX = null;
    root.addEventListener("touchstart", function (event) {
      if (event.touches.length === 1) startX = event.touches[0].clientX;
    }, { passive: true });
    root.addEventListener("touchend", function (event) {
      if (startX == null || !event.changedTouches.length) return;
      var delta = event.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(delta) < 40) return;
      show(delta < 0 ? index + 1 : index - 1);
    }, { passive: true });
  }).catch(function () {});
}

function statementGalleryPhotos(list, manifest) {
  if (!Array.isArray(list)) return [];
  var base = manifest.replace(/[^/]*$/, "");
  return list.map(function (item) {
    var file = typeof item === "string" ? item : item && (item.file || item.src);
    if (typeof file !== "string") return null;
    file = file.trim();
    if (!statementGalleryFilename(file)) return null;
    var alt = statementGalleryAlt(item, file);
    var position = item && typeof item === "object" && typeof item.position === "string"
      ? item.position.trim()
      : "";
    return { src: base + file, alt: alt, position: position };
  }).filter(Boolean);
}

function statementGalleryFilename(file) {
  if (!file || file.indexOf("..") !== -1 || file.indexOf("/") !== -1 || file.indexOf("\\") !== -1) return false;
  return /\.(jpe?g|png|webp)$/i.test(file);
}

function statementGalleryAlt(item, file) {
  if (item && typeof item === "object" && typeof item.alt === "string" && item.alt.trim()) {
    return item.alt.trim();
  }
  return file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}
