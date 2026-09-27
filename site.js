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
})();
