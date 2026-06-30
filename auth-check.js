/**
 * ChefTag — Auth State Checker
 * Include this script on every page AFTER supabase-client.js.
 * It checks for an active session and updates the nav to show user info or Sign Up/In links.
 *
 * Usage: just add <script src="auth-check.js"></script> before </body>
 *
 * It looks for elements with these IDs and updates them:
 *   #navAuthArea  — replaced with user menu or sign-up/sign-in links
 *   #mobileNavAuthArea — same, for mobile nav
 *
 * Also exposes window.ChefTagAuth = { user, profile, session, client }
 * so other scripts (chat.js, chef-inbox.js) can use the auth state.
 */

(function () {
  "use strict";

  window.ChefTagAuth = {
    user: null,
    profile: null,
    session: null,
    client: null,
    loading: true
  };

  var sb = null;
  try { sb = createSupabaseClient(); } catch (e) {}

  if (!sb) {
    window.ChefTagAuth.loading = false;
    renderDefaultNav();
    return;
  }

  // Check session
  sb.auth.getSession().then(function (result) {
    if (result.data.session) {
      window.ChefTagAuth.session = result.data.session;
      window.ChefTagAuth.user = result.data.session.user;
      window.ChefTagAuth.client = sb;

      // Fetch profile
      sb.from("profiles").select("*").eq("id", result.data.session.user.id).single()
        .then(function (profResult) {
          window.ChefTagAuth.loading = false;
          if (profResult.data) {
            window.ChefTagAuth.profile = profResult.data;
          }
          renderAuthNav();
        })
        .catch(function () {
          window.ChefTagAuth.loading = false;
          renderAuthNav();
        });
    } else {
      window.ChefTagAuth.loading = false;
      renderDefaultNav();
    }
  });

  // Listen for auth state changes (sign in, sign out in other tabs)
  sb.auth.onAuthStateChange(function (event, session) {
    if (event === "SIGNED_IN" && session) {
      window.ChefTagAuth.session = session;
      window.ChefTagAuth.user = session.user;
      window.ChefTagAuth.client = sb;
      sb.from("profiles").select("*").eq("id", session.user.id).single()
        .then(function (r) {
          if (r.data) window.ChefTagAuth.profile = r.data;
          renderAuthNav();
        });
    } else if (event === "SIGNED_OUT") {
      window.ChefTagAuth.user = null;
      window.ChefTagAuth.profile = null;
      window.ChefTagAuth.session = null;
      window.ChefTagAuth.client = null;
      renderDefaultNav();
    }
  });

  // ---- Render Functions ----

  function renderDefaultNav() {
    // Desktop nav
    var desktopAuth = document.getElementById("navAuthArea");
    if (desktopAuth) {
      desktopAuth.innerHTML =
        '<a href="auth.html" class="nav-signin">Sign In</a>' +
        '<a href="auth.html" class="nav-signup-btn">Sign Up</a>';
    }
    // Mobile nav
    var mobileAuth = document.getElementById("mobileNavAuthArea");
    if (mobileAuth) {
      mobileAuth.innerHTML =
        '<a href="auth.html">Sign In</a>' +
        '<a href="auth.html" style="color:var(--basil);font-weight:800;">Sign Up</a>';
    }
    injectNavStyles();
  }

  function renderAuthNav() {
    var user = window.ChefTagAuth.user;
    var profile = window.ChefTagAuth.profile;
    if (!user) { renderDefaultNav(); return; }

    var displayName = (profile && profile.name) ? profile.name : (user.user_metadata && user.user_metadata.name) || user.email.split("@")[0];
    var initials = displayName.split(" ").map(function (w) { return w[0]; }).join("").substring(0, 2).toUpperCase();
    var isInbox = (profile && profile.role === "chef");

    // Desktop nav
    var desktopAuth = document.getElementById("navAuthArea");
    if (desktopAuth) {
      var html = '<div class="user-menu" id="userMenu">';
      html += '<button class="user-menu-btn" id="userMenuBtn" type="button">';
      html += '<span class="user-avatar">' + esc(initials) + '</span>';
      html += '<span class="user-name">' + esc(displayName) + '</span>';
      html += '</button>';
      html += '<div class="user-dropdown" id="userDropdown">';
      if (isInbox) html += '<a href="chef-inbox.html">My Inbox</a>';
      html += '<a href="#" id="signOutLink">Sign Out</a>';
      html += '</div></div>';
      desktopAuth.innerHTML = html;

      // Toggle dropdown
      var menuBtn = document.getElementById("userMenuBtn");
      var dropdown = document.getElementById("userDropdown");
      if (menuBtn && dropdown) {
        menuBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          dropdown.classList.toggle("open");
        });
        document.addEventListener("click", function () { dropdown.classList.remove("open"); });
      }

      // Sign out
      var signOutLink = document.getElementById("signOutLink");
      if (signOutLink) {
        signOutLink.addEventListener("click", function (e) {
          e.preventDefault();
          sb.auth.signOut().then(function () {
            window.location.href = "index.html";
          });
        });
      }
    }

    // Mobile nav
    var mobileAuth = document.getElementById("mobileNavAuthArea");
    if (mobileAuth) {
      var mhtml = '<a href="#" class="mobile-user-info">' + esc(displayName) + '</a>';
      if (isInbox) mhtml += '<a href="chef-inbox.html">My Inbox</a>';
      mhtml += '<a href="#" id="mobileSignOut">Sign Out</a>';
      mobileAuth.innerHTML = mhtml;

      var mobileSignOut = document.getElementById("mobileSignOut");
      if (mobileSignOut) {
        mobileSignOut.addEventListener("click", function (e) {
          e.preventDefault();
          sb.auth.signOut().then(function () {
            window.location.href = "index.html";
          });
        });
      }
    }

    injectNavStyles();
  }

  function injectNavStyles() {
    if (document.getElementById("cheftag-auth-styles")) return;
    var style = document.createElement("style");
    style.id = "cheftag-auth-styles";
    style.textContent =
      '.user-menu{position:relative;}' +
      '.user-menu-btn{display:flex;align-items:center;gap:8px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:var(--white);cursor:pointer;font:inherit;transition:border-color 0.2s,box-shadow 0.2s;}' +
      '.user-menu-btn:hover{border-color:var(--basil);box-shadow:0 2px 12px rgba(46,107,79,0.1);}' +
      '.user-avatar{width:30px;height:30px;border-radius:50%;background:var(--basil);color:var(--white);display:grid;place-items:center;font-size:0.72rem;font-weight:900;flex-shrink:0;}' +
      '.user-name{font-weight:800;font-size:0.85rem;color:var(--ink);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.user-dropdown{display:none;position:absolute;top:calc(100% + 8px);right:0;min-width:180px;padding:6px;border:1px solid var(--line);border-radius:10px;background:var(--white);box-shadow:0 12px 36px rgba(26,37,33,0.14);z-index:50;}' +
      '.user-dropdown.open{display:block;}' +
      '.user-dropdown a{display:block;padding:10px 14px;border-radius:8px;font-weight:700;font-size:0.88rem;color:var(--ink);transition:background 0.15s;}' +
      '.user-dropdown a:hover{background:rgba(46,107,79,0.08);color:var(--basil);}' +
      '.nav-signin{min-height:38px;padding:9px 13px;border-radius:8px;color:#37433f;font-weight:750;}' +
      '.nav-signin:hover{background:rgba(46,107,79,0.1);}' +
      '.nav-signup-btn{min-height:38px;padding:9px 16px;border-radius:8px;background:var(--basil)!important;color:var(--white)!important;font-weight:900!important;}' +
      '.nav-signup-btn:hover{opacity:0.9;}' +
      '.mobile-user-info{color:var(--basil)!important;font-weight:800!important;border-bottom:1px solid var(--line);padding-bottom:12px!important;margin-bottom:4px;}';
    document.head.appendChild(style);
  }

  function esc(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
})();