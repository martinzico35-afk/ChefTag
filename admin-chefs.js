/**
 * ChefTag — Admin Dashboard Logic
 * Handles auth gate, chef approval/verification, and review management.
 * Uses service_role key for full admin access (bypasses RLS).
 *
 * IMPORTANT: For full admin access (read all chefs, update status),
 * you need to add your service_role key to supabase-client.js.
 * Go to Supabase > Settings > API > service_role key.
 * Add it as: var SUPABASE_SERVICE_KEY = "your_service_role_key";
 */

(function () {
  "use strict";

  var authGate = document.getElementById("authGate");
  var authBtn = document.getElementById("authBtn");
  var authInput = document.getElementById("adminPassword");
  var authError = document.getElementById("authError");
  var dashboard = document.getElementById("adminDashboard");
  var logoutBtn = document.getElementById("logoutBtn");

  var sb = null;
  var allChefs = [];
  var allReviews = [];

  // ---- Auth Gate ----
  if (sessionStorage.getItem("cheftag_admin_key")) {
    showDashboard();
  }

  authBtn.addEventListener("click", tryAuth);
  authInput.addEventListener("keydown", function (e) { if (e.key === "Enter") tryAuth(); });

  function tryAuth() {
    var key = authInput.value.trim();
    if (!key) {
      showAuthError("Please enter your Supabase Service Role Key.");
      return;
    }

    authBtn.disabled = true;
    authBtn.textContent = "Verifying...";
    authError.style.display = "none";

    try {
      var testClient = supabase.createClient(SUPABASE_URL, key);
      // Query chefs to verify that this key works
      testClient.from("chefs").select("id").limit(1).then(function (result) {
        authBtn.disabled = false;
        authBtn.textContent = "Unlock";
        if (result.error) {
          showAuthError("Invalid key: " + result.error.message);
        } else {
          sessionStorage.setItem("cheftag_admin_key", key);
          showDashboard();
        }
      }).catch(function (err) {
        authBtn.disabled = false;
        authBtn.textContent = "Unlock";
        showAuthError("Connection failed: " + err.message);
      });
    } catch (e) {
      authBtn.disabled = false;
      authBtn.textContent = "Unlock";
      showAuthError("Invalid format: " + e.message);
    }
  }

  function showAuthError(msg) {
    authError.textContent = msg;
    authError.style.display = "block";
    authInput.value = "";
    authInput.focus();
  }

  logoutBtn.addEventListener("click", function () {
    sessionStorage.removeItem("cheftag_admin_key");
    location.reload();
  });

  function showDashboard() {
    authGate.style.display = "none";
    dashboard.style.display = "block";
    initAdmin();
  }

  // ---- Tabs ----
  document.querySelectorAll(".admin-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".admin-tab").forEach(function (t) { t.classList.remove("active"); });
      document.querySelectorAll(".admin-panel").forEach(function (p) { p.classList.remove("active"); });
      tab.classList.add("active");
      document.getElementById("panel-" + tab.dataset.tab).classList.add("active");
    });
  });

  // ---- Init ----
  function initAdmin() {
    var key = sessionStorage.getItem("cheftag_admin_key");
    if (key) {
      sb = supabase.createClient(SUPABASE_URL, key);
    } else {
      sessionStorage.removeItem("cheftag_admin_key");
      location.reload();
      return;
    }

    if (!sb) {
      document.querySelector(".admin-wrapper").innerHTML =
        '<div class="empty-admin">' +
        '<p style="font-size:1.1rem;font-weight:800;margin-bottom:8px;">Supabase Not Configured</p>' +
        '<p>Set up your Supabase project and enter a valid Service Role Key in the login gate.</p>' +
        '</div>';
      return;
    }

    loadChefs();
    loadReviews();
  }

  // ---- Load Chefs ----
  function loadChefs() {
    sb.from("chefs").select("*").order("created_at", { ascending: false }).then(function (result) {
      if (result.error) {
        console.error("Error loading chefs:", result.error);
        return;
      }
      allChefs = result.data || [];
      renderStats();
      renderPending();
      renderApproved();
      renderAll();
    });
  }

  // ---- Load Reviews ----
  function loadReviews() {
    sb.from("reviews").select("*, chefs(name)").order("created_at", { ascending: false }).then(function (result) {
      if (result.error) {
        console.error("Error loading reviews:", result.error);
        return;
      }
      allReviews = result.data || [];
      renderReviews();
      // Update stat
      var el = document.getElementById("statReviews");
      if (el) el.textContent = allReviews.length;
    });
  }

  // ---- Render Stats ----
  function renderStats() {
    var total = allChefs.length;
    var pending = allChefs.filter(function (c) { return !c.is_approved; }).length;
    var approved = allChefs.filter(function (c) { return c.is_approved; }).length;
    var verified = allChefs.filter(function (c) { return c.is_verified && c.is_approved; }).length;

    document.getElementById("statTotal").textContent = total;
    document.getElementById("statPending").textContent = pending;
    document.getElementById("statApproved").textContent = approved;
    document.getElementById("statVerified").textContent = verified;
  }

  // ---- Render Pending ----
  function renderPending() {
    var tbody = document.getElementById("pendingBody");
    var pending = allChefs.filter(function (c) { return !c.is_approved; });

    if (!pending.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-admin">No pending applications</div></td></tr>';
      return;
    }

    tbody.innerHTML = pending.map(function (c) {
      return '<tr>' +
        '<td><div class="chef-cell"><img class="chef-avatar" src="' + esc(c.image_url) + '" alt="" onerror="this.src=\'https://sfile.chatglm.cn/images-ppt/86026829c333.jpg\'"><div><strong>' + esc(c.name) + '</strong><br><span style="font-size:0.8rem;color:var(--muted);">' + esc(c.email) + '</span></div></div></td>' +
        '<td>' + esc(c.location) + '</td>' +
        '<td>' + (c.cuisines || []).join(", ") + '</td>' +
        '<td>' + formatNGN(c.rate) + '</td>' +
        '<td>' + formatDate(c.created_at) + '</td>' +
        '<td class="actions-cell">' +
          '<button class="action-btn approve" data-id="' + c.id + '" data-action="approve">Approve</button>' +
          '<button class="action-btn reject" data-id="' + c.id + '" data-action="reject">Reject</button>' +
        '</td>' +
        '</tr>';
    }).join("");
  }

  // ---- Render Approved ----
  function renderApproved() {
    var tbody = document.getElementById("approvedBody");
    var approved = allChefs.filter(function (c) { return c.is_approved; });

    if (!approved.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-admin">No approved chefs yet</div></td></tr>';
      return;
    }

    tbody.innerHTML = approved.map(function (c) {
      var verifiedBadge = c.is_verified
        ? '<span class="badge badge-verified">Verified</span>'
        : '<button class="action-btn verify" data-id="' + c.id + '" data-action="verify">Verify</button>';

      return '<tr>' +
        '<td><div class="chef-cell"><img class="chef-avatar" src="' + esc(c.image_url) + '" alt="" onerror="this.src=\'https://sfile.chatglm.cn/images-ppt/86026829c333.jpg\'"><strong>' + esc(c.name) + '</strong></div></td>' +
        '<td>' + esc(c.location) + '</td>' +
        '<td><span class="review-stars">' + starStr(c.rating) + '</span> ' + c.rating.toFixed(1) + '</td>' +
        '<td>' + verifiedBadge + '</td>' +
        '<td class="actions-cell">' +
          (c.is_approved ? '<button class="action-btn reject" data-id="' + c.id + '" data-action="unapprove">Unapprove</button>' : '') +
          '<button class="action-btn delete" data-id="' + c.id + '" data-action="delete">Delete</button>' +
        '</td>' +
        '</tr>';
    }).join("");
  }

  // ---- Render All ----
  function renderAll() {
    var tbody = document.getElementById("allBody");

    if (!allChefs.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-admin">No chefs in database</div></td></tr>';
      return;
    }

    tbody.innerHTML = allChefs.map(function (c) {
      var statusBadge;
      if (!c.is_approved) statusBadge = '<span class="badge badge-pending">Pending</span>';
      else if (c.is_verified) statusBadge = '<span class="badge badge-verified">Verified</span>';
      else statusBadge = '<span class="badge badge-approved">Approved</span>';

      return '<tr>' +
        '<td><div class="chef-cell"><img class="chef-avatar" src="' + esc(c.image_url) + '" alt="" onerror="this.src=\'https://sfile.chatglm.cn/images-ppt/86026829c333.jpg\'"><strong>' + esc(c.name) + '</strong></div></td>' +
        '<td>' + esc(c.email) + '</td>' +
        '<td>' + esc(c.location) + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td class="actions-cell">' +
          '<button class="action-btn delete" data-id="' + c.id + '" data-action="delete">Delete</button>' +
        '</td>' +
        '</tr>';
    }).join("");
  }

  // ---- Render Reviews ----
  function renderReviews() {
    var container = document.getElementById("reviewsList");

    if (!allReviews.length) {
      container.innerHTML = '<div class="empty-admin">No reviews yet</div>';
      return;
    }

    container.innerHTML = allReviews.map(function (r) {
      var chefName = (r.chefs && r.chefs.name) ? r.chefs.name : "Unknown Chef";
      return '<div class="review-card">' +
        '<div class="review-head">' +
          '<div>' +
            '<span class="review-client">' + esc(r.client_name) + '</span><br>' +
            '<span class="review-chef-name">for ' + esc(chefName) + '</span>' +
          '</div>' +
          '<span class="review-stars">' + starStr(r.rating) + '</span>' +
        '</div>' +
        '<p class="review-comment">' + esc(r.comment) + '</p>' +
        '<p class="review-date">' + formatDate(r.created_at) + '</p>' +
      '</div>';
    }).join("");
  }

  // ---- Action Handler (delegated) ----
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".action-btn");
    if (!btn || !sb) return;

    var id = btn.dataset.id;
    var action = btn.dataset.action;

    if (action === "approve") {
      updateChef(id, { is_approved: true });
    } else if (action === "reject") {
      if (confirm("Delete this application? This cannot be undone.")) {
        deleteChef(id);
      }
    } else if (action === "verify") {
      updateChef(id, { is_verified: true });
    } else if (action === "unapprove") {
      updateChef(id, { is_approved: false, is_verified: false });
    } else if (action === "delete") {
      if (confirm("Permanently delete this chef and all their reviews?")) {
        deleteChef(id);
      }
    }
  });

  function updateChef(id, updates) {
    sb.from("chefs").update(updates).eq("id", id).then(function (result) {
      if (result.error) { alert("Error: " + result.error.message); return; }
      loadChefs();
    });
  }

  function deleteChef(id) {
    sb.from("chefs").delete().eq("id", id).then(function (result) {
      if (result.error) { alert("Error: " + result.error.message); return; }
      loadChefs();
      loadReviews();
    });
  }

  // ---- Helpers ----
  function esc(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }

  function formatNGN(n) {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n || 0);
  }

  function starStr(rating) {
    var full = Math.floor(rating);
    var s = "";
    for (var i = 0; i < full; i++) s += "\u2605";
    return s;
  }

  function formatDate(d) {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  }
})();