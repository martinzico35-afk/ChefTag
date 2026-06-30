/**
 * ChefTag — Auth Page Logic (Sign Up / Sign In)
 * Uses Supabase Auth for persistent user accounts.
 */

(function () {
  "use strict";

  var sb = createSupabaseClient();
  var statusEl = document.getElementById("authStatus");
  var params = new URLSearchParams(window.location.search);
  var redirectParam = params.get("redirect") || "";

  // Get the base directory path dynamically (works for both local file and GitHub Pages subdirectory)
  function getBaseDir() {
    var p = window.location.pathname;
    return p.substring(0, p.lastIndexOf('/') + 1);
  }

  function getRedirectUrl() {
    if (!redirectParam) return getBaseDir() + "index.html";
    var url = decodeURIComponent(redirectParam);
    // Secure redirect: only allow relative paths
    if (url.indexOf("://") !== -1 || url.indexOf("//") === 0) {
      return getBaseDir() + "index.html";
    }
    return url;
  }

  // If already signed in, redirect
  if (sb) {
    sb.auth.getSession().then(function (result) {
      if (result.data.session) {
        window.location.href = getRedirectUrl();
      }
    });
  }

  // ---- Tabs ----
  document.querySelectorAll(".auth-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".auth-tab").forEach(function (t) { t.classList.remove("active"); });
      document.querySelectorAll(".auth-panel").forEach(function (p) { p.classList.remove("active"); });
      tab.classList.add("active");
      document.getElementById("panel-" + tab.dataset.panel).classList.add("active");
      hideStatus();
    });
  });

  // ---- Sign Up ----
  document.getElementById("signupForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!sb) { showStatus("error", "Cannot connect to server."); return; }
    hideStatus();

    var firstName = document.getElementById("suName").value.trim();
    var lastName = document.getElementById("suLastName").value.trim();
    var email = document.getElementById("suEmail").value.trim();
    var password = document.getElementById("suPassword").value;

    if (!firstName) { showStatus("error", "Please enter your first name."); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showStatus("error", "Please enter a valid email."); return; }
    if (password.length < 6) { showStatus("error", "Password must be at least 6 characters."); return; }

    var btn = document.getElementById("signupBtn");
    btn.disabled = true;
    btn.textContent = "Creating account...";

    var fullName = firstName + (lastName ? " " + lastName : "");

    sb.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { name: fullName }
      }
    }).then(function (result) {
      btn.disabled = false;
      btn.textContent = "Create Account";

      if (result.error) {
        var msg = result.error.message || "Sign up failed.";
        if (msg.indexOf("already registered") !== -1 || msg.indexOf("already been") !== -1) {
          showStatus("error", "This email is already registered. Try signing in instead.");
        } else {
          showStatus("error", msg);
        }
        return;
      }

      // Check if email confirmation is required
      if (result.data.user && !result.data.session) {
        showStatus("success", "Account created! Check your email to confirm your account, then sign in.");
        document.getElementById("signupForm").reset();
      } else if (result.data.session) {
        // Auto-confirmed — redirect
        window.location.href = getRedirectUrl();
      }
    });
  });

  // ---- Sign In ----
  document.getElementById("signinForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!sb) { showStatus("error", "Cannot connect to server."); return; }
    hideStatus();

    var email = document.getElementById("siEmail").value.trim();
    var password = document.getElementById("siPassword").value;

    if (!email) { showStatus("error", "Please enter your email."); return; }
    if (!password) { showStatus("error", "Please enter your password."); return; }

    var btn = document.getElementById("signinBtn");
    btn.disabled = true;
    btn.textContent = "Signing in...";

    sb.auth.signInWithPassword({
      email: email,
      password: password
    }).then(function (result) {
      btn.disabled = false;
      btn.textContent = "Sign In";

      if (result.error) {
        var msg = result.error.message || "Sign in failed.";
        if (msg.indexOf("Invalid login") !== -1 || msg.indexOf("Invalid credentials") !== -1) {
          showStatus("error", "Wrong email or password. Please try again.");
        } else if (msg.indexOf("Email not confirmed") !== -1) {
          showStatus("error", "Please confirm your email first. Check your inbox for a confirmation link.");
        } else {
          showStatus("error", msg);
        }
        return;
      }

      window.location.href = getRedirectUrl();
    });
  });

  // ---- Google Auth ----
  document.getElementById("googleSignupBtn").addEventListener("click", function () { googleAuth(); });
  document.getElementById("googleSigninBtn").addEventListener("click", function () { googleAuth(); });

  function googleAuth() {
    if (!sb) { showStatus("error", "Cannot connect to server."); return; }
    sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + getBaseDir() + "index.html" }
    }).then(function (result) {
      if (result.error) {
        showStatus("error", "Google sign-in failed: " + (result.error.message || "Unknown error"));
      }
    });
  }

  // ---- Forgot Password ----
  document.getElementById("forgotLink").addEventListener("click", function (e) {
    e.preventDefault();
    var email = document.getElementById("siEmail").value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showStatus("error", "Enter your email above first, then click Forgot Password.");
      return;
    }
    if (!sb) { showStatus("error", "Cannot connect to server."); return; }

    sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + getBaseDir() + "auth.html"
    }).then(function (result) {
      if (result.error) {
        showStatus("error", "Could not send reset email: " + result.error.message);
      } else {
        showStatus("success", "Password reset link sent to " + email + ". Check your inbox.");
      }
    });
  });

  // ---- Helpers ----
  function showStatus(type, msg) {
    statusEl.className = "auth-status " + type;
    statusEl.textContent = msg;
  }

  function hideStatus() {
    statusEl.className = "auth-status";
    statusEl.textContent = "";
  }
})();