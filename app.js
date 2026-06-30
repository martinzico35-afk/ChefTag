/**
 * ChefTag — Main App Logic
 * Loads chefs from Supabase (fallback to hardcoded), reviews, and verified badges.
 */

// ---- Fallback chefs (used when Supabase is not configured) ----
var FALLBACK_CHEFS = [
  {
    id: "amara-oke",
    name: "Chef Amara Oke",
    image_url: "https://sfile.chatglm.cn/images-ppt/3318b5e331ef.jpg",
    location: "Lagos",
    rate: 65000,
    rating: 4.9,
    cuisines: ["afrofusion", "continental", "grill"],
    specialty: "Afro-fusion tasting menus, flame-grilled mains, and polished dinner service.",
    is_verified: true
  },
  {
    id: "leo-martins",
    name: "Chef Leo Martins",
    image_url: "https://sfile.chatglm.cn/images-ppt/8fb8360ec5b1.jpg",
    location: "Abuja",
    rate: 55000,
    rating: 4.8,
    cuisines: ["italian", "continental", "dessert"],
    specialty: "Handmade pasta, plated desserts, and intimate dinner-party menus.",
    is_verified: true
  },
  {
    id: "tomi-ade",
    name: "Chef Tomi Ade",
    image_url: "https://sfile.chatglm.cn/images-ppt/c99664597746.jpg",
    location: "Lagos",
    rate: 42000,
    rating: 4.7,
    cuisines: ["vegan", "afrofusion", "continental"],
    specialty: "Bright plant-forward menus, wellness brunches, and weekly meal prep.",
    is_verified: true
  },
  {
    id: "nora-bassey",
    name: "Chef Nora Bassey",
    image_url: "https://sfile.chatglm.cn/images-ppt/16d0acbdd095.jpg",
    location: "Port Harcourt",
    rate: 70000,
    rating: 5,
    cuisines: ["grill", "afrofusion", "continental"],
    specialty: "Large-format grills, seafood spreads, and celebration catering.",
    is_verified: true
  },
  {
    id: "sade-cole",
    name: "Chef Sade Cole",
    image_url: "https://sfile.chatglm.cn/images-ppt/5a61f50c2afd.jpg",
    location: "Lagos",
    rate: 58000,
    rating: 4.8,
    cuisines: ["continental", "vegan", "dessert"],
    specialty: "Modern small plates, elegant brunches, and allergy-aware menus.",
    is_verified: true
  }
];

// ---- State ----
var chefs = [];
var chefReviews = {};
var activeChefId = null;

// ---- DOM refs ----
var sortSelect = document.querySelector("#sortSelect");
var chefGrid = document.querySelector("#chefGrid");
var resultHeading = document.querySelector("#resultHeading");
var matchCountHero = document.querySelector("#matchCountHero");

// ---- Initialize ----
initApp();

function initApp() {
  if (typeof supabase !== "undefined") {
    var client = createSupabaseClient();
    if (client) {
      loadChefsFromSupabase(client);
      return;
    }
  }
  chefs = FALLBACK_CHEFS.slice();
  attachListeners();
  render();
}

function loadChefsFromSupabase(client) {
  client.from("chefs").select("*").eq("is_approved", true).eq("is_verified", true).then(function (result) {
    if (result.error || !result.data || !result.data.length) {
      chefs = FALLBACK_CHEFS.slice();
    } else {
      chefs = result.data.map(normalizeChef);
    }
    attachListeners();
    render();
    loadReviewsFromSupabase(client);
  });
}

function loadReviewsFromSupabase(client) {
  var chefIds = chefs.map(function (c) { return c.id; });
  if (!chefIds.length) return;
  client.from("reviews").select("*").in("chef_id", chefIds).then(function (result) {
    if (!result.error && result.data) {
      result.data.forEach(function (r) {
        if (!chefReviews[r.chef_id]) chefReviews[r.chef_id] = [];
        chefReviews[r.chef_id].push(r);
      });
    }
    renderChefs(chefs);
  });
}

function normalizeChef(c) {
  return {
    id: c.id,
    name: c.name || "",
    image_url: c.image_url || c.image || "https://sfile.chatglm.cn/images-ppt/86026829c333.jpg",
    location: c.location || "",
    rate: Number(c.rate) || 0,
    rating: Number(c.rating) || 0,
    cuisines: c.cuisines || [],
    specialty: c.specialty || "",
    is_verified: !!c.is_verified
  };
}

// ---- Utility ----
function formatRate(rate) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(rate);
}

function escapeHtml(str) {
  if (!str) return "";
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ---- Scoring ----
function chefScore(chef) {
  // Simple score based on rating (out of 100)
  return Math.round((chef.rating / 5) * 100);
}

function sortedChefs(list) {
  var sorted = list.slice();
  if (sortSelect.value === "rate") {
    return sorted.sort(function (a, b) { return a.rate - b.rate; });
  }
  if (sortSelect.value === "rating") {
    return sorted.sort(function (a, b) { return b.rating - a.rating; });
  }
  // Default: best match = highest rating
  return sorted.sort(function (a, b) { return b.rating - a.rating; });
}

// ---- Render ----
function getReviewCount(chefId) {
  return (chefReviews[chefId] || []).length;
}

function getStarDisplay(rating) {
  var full = Math.floor(rating);
  var s = "";
  for (var i = 0; i < full; i++) s += "\u2605";
  return s;
}

function renderChefCard(chef) {
  var reviews = chefReviews[chef.id] || [];
  var reviewCount = reviews.length;
  var card = document.createElement("article");
  card.className = "chef-card";

  var verifiedBadge = chef.is_verified
    ? '<span class="verified-badge" title="Verified Chef"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></span>'
    : "";

  var reviewLink = '<button class="reviews-toggle" type="button" data-id="' + escapeHtml(chef.id) + '">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> ' +
    reviewCount + (reviewCount === 1 ? ' review' : ' reviews') +
    '</button>';

  var cardHtml =
    '<img src="' + escapeHtml(chef.image_url) + '" alt="' + escapeHtml(chef.name) + ' signature menu" loading="lazy" onerror="this.src=\'https://sfile.chatglm.cn/images-ppt/86026829c333.jpg\'">' +
    '<div class="card-body">' +
      '<div class="card-topline">' +
        '<div>' +
          '<h3>' + escapeHtml(chef.name) + ' ' + verifiedBadge + '</h3>' +
          '<span class="location-chip">' + escapeHtml(chef.location) + ' &bull; <span class="star-display">' + getStarDisplay(chef.rating) + '</span> ' + chef.rating.toFixed(1) + '</span>' +
        '</div>' +
        '<span class="rate-chip">' + formatRate(chef.rate) + '</span>' +
      '</div>' +
      '<p>' + escapeHtml(chef.specialty) + '</p>' +
      '<div class="mini-tags">' +
        chef.cuisines.slice(0, 3).map(function (cuisine) { return '<span>' + escapeHtml(cuisine) + '</span>'; }).join("") +
      '</div>' +
      '<div class="card-actions">' +
        '<span class="match-meter">' + chefScore(chef) + '%</span>' +
        reviewLink +
      '</div>' +
    '</div>';

  if (reviewCount > 0) {
    cardHtml += '<div class="chef-reviews" id="reviews-' + escapeHtml(chef.id) + '" style="display:none;">' +
      '<div class="reviews-header"><span>Clients say</span></div>';
    reviews.slice(0, 3).forEach(function (r) {
      cardHtml += '<div class="review-item">' +
        '<div class="review-item-head"><strong>' + escapeHtml(r.client_name) + '</strong> <span class="star-display">' + getStarDisplay(r.rating) + '</span></div>' +
        '<p>' + escapeHtml(r.comment) + '</p>' +
      '</div>';
    });
    if (reviewCount > 3) {
      cardHtml += '<p class="more-reviews">+ ' + (reviewCount - 3) + ' more</p>';
    }
    cardHtml += '</div>';
  }

  var chatHref = 'chat.html?chef_id=' + encodeURIComponent(chef.id) +
    '&chef_name=' + encodeURIComponent(chef.name) +
    '&chef_location=' + encodeURIComponent(chef.location) +
    '&chef_image=' + encodeURIComponent(chef.image_url);
  cardHtml += '<div class="card-chat-row"><a href="' + chatHref + '" class="chat-button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> Chat</a></div>';

  card.innerHTML = cardHtml;
  return card;
}

function renderChefs(list) {
  chefGrid.innerHTML = "";
  sortedChefs(list).forEach(function (chef) {
    chefGrid.append(renderChefCard(chef));
  });
}

function render() {
  matchCountHero.textContent = chefs.length;
  resultHeading.textContent = chefs.length === 1 ? "1 Chef" : chefs.length + " Chefs Available";
  renderChefs(chefs);
}

// ---- Mobile Nav ----
var menuToggle = document.getElementById("menuToggle");
var mobileNav = document.getElementById("mobileNav");
var navBackdrop = document.getElementById("navBackdrop");

function openMobileNav() {
  mobileNav.classList.add("open");
  navBackdrop.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeMobileNav() {
  mobileNav.classList.remove("open");
  navBackdrop.classList.remove("open");
  document.body.style.overflow = "";
}

if (menuToggle) {
  menuToggle.addEventListener("click", function () {
    mobileNav.classList.contains("open") ? closeMobileNav() : openMobileNav();
  });
}
if (navBackdrop) {
  navBackdrop.addEventListener("click", closeMobileNav);
}
if (mobileNav) {
  mobileNav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", closeMobileNav);
  });
}

// ---- Event Listeners ----
function attachListeners() {
  chefGrid.addEventListener("click", function (event) {
    var reviewBtn = event.target.closest(".reviews-toggle");
    if (reviewBtn) {
      var chefId = reviewBtn.dataset.id;
      var reviewEl = document.getElementById("reviews-" + chefId);
      if (reviewEl) {
        reviewEl.style.display = reviewEl.style.display !== "none" ? "none" : "block";
      }
    }
  });

  sortSelect.addEventListener("change", render);
}
