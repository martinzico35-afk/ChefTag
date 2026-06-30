/**
 * ChefTag — Chef Sign-Up Form Logic
 * Handles photo upload (Supabase Storage), cuisine "Others",
 * Nigerian city select, and Supabase submission.
 */

(function () {
  "use strict";

  var uploadedImageUrl = null;
  var uploadedFile = null;

  var form = document.getElementById("chefSignupForm");
  var statusMsg = document.getElementById("statusMsg");
  var submitBtn = document.getElementById("submitBtn");

  // ---- Photo Upload ----
  var uploadZone = document.getElementById("photoUploadZone");
  var fileInput = document.getElementById("chefImageUpload");
  var photoPreview = document.getElementById("photoPreview");
  var photoPlaceholder = document.getElementById("photoPlaceholder");

  uploadZone.addEventListener("click", function () { fileInput.click(); });

  uploadZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    uploadZone.classList.add("dragover");
  });

  uploadZone.addEventListener("dragleave", function () {
    uploadZone.classList.remove("dragover");
  });

  uploadZone.addEventListener("drop", function (e) {
    e.preventDefault();
    uploadZone.classList.remove("dragover");
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener("change", function () {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      showStatus("error", "Please upload a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showStatus("error", "Image must be under 5MB.");
      return;
    }
    uploadedFile = file;
    console.log("[ChefTag Signup] Photo selected:", file.name, file.size, "bytes");

    var reader = new FileReader();
    reader.onload = function (e) {
      photoPreview.src = e.target.result;
      photoPreview.style.display = "block";
      photoPlaceholder.style.display = "none";
    };
    reader.readAsDataURL(file);
  }

  // ---- Others Cuisine Toggle ----
  var otherCuisineCheck = document.getElementById("otherCuisineCheck");
  var otherCuisineField = document.getElementById("otherCuisineField");

  if (otherCuisineCheck) {
    otherCuisineCheck.addEventListener("change", function () {
      otherCuisineField.style.display = this.checked ? "grid" : "none";
    });
  }

  // ---- Form Submission ----
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideStatus();

    console.log("[ChefTag Signup] Form submitted.");

    // Gather data
    var name = document.getElementById("chefName").value.trim();
    var email = document.getElementById("chefEmail").value.trim();
    var phone = document.getElementById("chefPhone").value.trim();
    var password = document.getElementById("chefPassword").value;
    var location = document.getElementById("chefLocation").value;
    var specialty = document.getElementById("chefSpecialty").value.trim();

    var cuisines = [];
    document.querySelectorAll("#cuisineChecks input:checked").forEach(function (cb) {
      if (cb.value !== "others") cuisines.push(cb.value);
    });

    var otherCuisineText = document.getElementById("otherCuisineText").value.trim();
    if (otherCuisineCheck && otherCuisineCheck.checked && otherCuisineText) {
      cuisines.push("others");
      specialty = specialty + "\n\nOther cuisines: " + otherCuisineText;
    } else if (otherCuisineCheck && otherCuisineCheck.checked && !otherCuisineText) {
      showStatus("error", "Please describe your cuisine in the 'Others' field.");
      return;
    }

    var events = [];
    document.querySelectorAll("#eventChecks input:checked").forEach(function (cb) {
      events.push(cb.value);
    });

    // Validation
    var errors = [];
    if (!name) errors.push("Name is required.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("A valid email is required.");
    if (!password || password.length < 6) errors.push("Password must be at least 6 characters.");
    if (!location) errors.push("Select a city.");
    if (!specialty) errors.push("Specialty / bio is required.");
    if (cuisines.length === 0) errors.push("Select at least one cuisine.");
    if (events.length === 0) errors.push("Select at least one event type.");

    if (errors.length > 0) {
      showStatus("error", errors.join(" "));
      return;
    }

    // Create Supabase client
    var sb;
    try {
      sb = createSupabaseClient();
    } catch (err) {
      console.error("[ChefTag Signup] createSupabaseClient threw:", err);
      sb = null;
    }

    if (!sb) {
      showStatus("error", "Unable to connect to the server. Please make sure you have internet and try again.");
      console.error("[ChefTag Signup] Supabase client is null. Check if the CDN loaded (window.supabase).");
      return;
    }

    console.log("[ChefTag Signup] Supabase client ready. Registering authentication account...");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    var chefData = {
      name: name,
      email: email,
      phone: phone || null,
      location: location,
      areas: [location.toLowerCase()],
      cuisines: cuisines,
      events: events,
      specialty: specialty,
      rate: 0,
      rating: 0,
      capacity: 20,
      is_verified: false,
      is_approved: false
    };

    // 1. Sign up the user in Supabase Auth first, sending custom metadata role="chef"
    sb.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { name: name, role: "chef" }
      }
    }).then(function (authResult) {
      if (authResult.error) {
        throw new Error(authResult.error.message || "Auth registration failed.");
      }
      var userId = authResult.data.user.id;
      chefData.id = userId; // set chef's UUID to be their Auth user ID!

      // 2. Upload photo and submit chef profile
      if (uploadedFile) {
        console.log("[ChefTag Signup] Uploading photo to Supabase Storage...");
        uploadPhoto(sb, name)
          .then(function (url) {
            console.log("[ChefTag Signup] Photo uploaded:", url);
            chefData.image_url = url;
            submitToSupabase(sb, chefData);
          })
          .catch(function (err) {
            console.error("[ChefTag Signup] Photo upload failed:", err);
            // Photo failed — submit anyway with default image
            console.log("[ChefTag Signup] Falling back to default image.");
            chefData.image_url = "https://sfile.chatglm.cn/images-ppt/86026829c333.jpg";
            submitToSupabase(sb, chefData);
          });
      } else {
        console.log("[ChefTag Signup] No photo uploaded, using default image.");
        chefData.image_url = "https://sfile.chatglm.cn/images-ppt/86026829c333.jpg";
        submitToSupabase(sb, chefData);
      }
    }).catch(function (err) {
      console.error("[ChefTag Signup] Auth/Signup error:", err);
      showStatus("error", err.message || "Sign-up failed.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Application";
    });
  });

  function uploadPhoto(sb, name) {
    var safeName = name.toLowerCase().replace(/[^a-z0-9]/g, "-").substring(0, 30);
    var ext = uploadedFile.name.split(".").pop().toLowerCase();
    var filename = safeName + "-" + Date.now() + "." + ext;

    return sb.storage
      .from("chef-photos")
      .upload(filename, uploadedFile, {
        cacheControl: "3600",
        upsert: true
      })
      .then(function (result) {
        console.log("[ChefTag Signup] Storage upload result:", result);
        if (result.error) throw new Error(result.error.message || "Storage upload error");
        var url = sb.storage.from("chef-photos").getPublicUrl(filename).data.publicUrl;
        return url;
      });
  }

  function submitToSupabase(sb, chefData) {
    console.log("[ChefTag Signup] Inserting chef data:", JSON.stringify(chefData, null, 2));

    sb.from("chefs")
      .insert([chefData])
      .then(function (result) {
        console.log("[ChefTag Signup] Insert result:", result);
        if (result.error) {
          var msg = result.error.message || "Unknown error";
          var code = result.error.code || "";
          console.error("[ChefTag Signup] Insert error:", code, msg);

          if (code === "23505") {
            showStatus("error", "This email is already registered. If this is you, contact us.");
          } else if (msg.toLowerCase().indexOf("relation") !== -1 && msg.toLowerCase().indexOf("does not exist") !== -1) {
            showStatus("error", "Database table not found. Please run the SQL setup in your Supabase SQL Editor.");
          } else if (msg.toLowerCase().indexOf("policy") !== -1 || msg.toLowerCase().indexOf("rls") !== -1) {
            showStatus("error", "Permission denied. Check your Row Level Security policies in Supabase.");
          } else {
            showStatus("error", "Sign-up failed: " + msg + (code ? " (code: " + code + ")" : ""));
          }
        } else {
          showStatus("success", "Application submitted! Our team will review your profile and get back to you at " + escapeHtml(chefData.email) + ".");
          form.reset();
          uploadedFile = null;
          uploadedImageUrl = null;
          photoPreview.style.display = "none";
          photoPlaceholder.style.display = "flex";
          if (otherCuisineField) otherCuisineField.style.display = "none";
        }
      })
      .catch(function (err) {
        console.error("[ChefTag Signup] Insert threw an error:", err);
        var errMsg = err.message || "unknown";
        // Detect network / unreachable errors (paused project, DNS fail, offline)
        if (errMsg === "Load failed" || errMsg === "Failed to fetch" || errMsg === "NetworkError" || errMsg.indexOf("network") !== -1 || errMsg.indexOf("fetch") !== -1) {
          showStatus("error", "Cannot reach the server. Your Supabase project may be paused — go to supabase.com/dashboard and click 'Restore project'.");
        } else {
          showStatus("error", "Something went wrong. Please try again. (" + errMsg + ")");
        }
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Application";
      });
  }

  function showStatus(type, msg) {
    statusMsg.className = "status-msg " + type;
    statusMsg.textContent = msg;
  }

  function hideStatus() {
    statusMsg.className = "status-msg";
    statusMsg.textContent = "";
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
})();