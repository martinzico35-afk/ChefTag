/**
 * ChefTag — Chef Inbox Logic
 * Chefs can view and reply to client messages.
 * Includes: unread indicators, typing indicators, read receipts, notifications.
 */

(function () {
  "use strict";

  // ---- State ----
  var sb = null;
  var chefEmail = "";
  var chefName = "";
  var chefId = null;
  var conversations = [];
  var activeConvId = null;
  var realtimeChannel = null;
  var typingChannel = null;
  var typingTimeout = null;
  var isTyping = false;
  var isSending = false;
  var lastRenderedDate = "";

  // ---- DOM ----
  var chefLogin = document.getElementById("chefLogin");
  var inboxContainer = document.getElementById("inboxContainer");
  var chefEmailInput = document.getElementById("chefEmailInput");
  var chefLoginBtn = document.getElementById("chefLoginBtn");
  var loginError = document.getElementById("loginError");
  var chefWelcomeName = document.getElementById("chefWelcomeName");
  var inboxList = document.getElementById("inboxList");
  var inboxCount = document.getElementById("inboxCount");
  var inboxNoChat = document.getElementById("inboxNoChat");
  var inboxChatPanel = document.getElementById("inboxChatPanel");
  var inboxChatName = document.getElementById("inboxChatName");
  var inboxChatEmail = document.getElementById("inboxChatEmail");
  var inboxMessages = document.getElementById("inboxMessages");
  var inboxMessageInput = document.getElementById("inboxMessageInput");
  var inboxSendBtn = document.getElementById("inboxSendBtn");
  var inboxSidebar = document.getElementById("inboxSidebar");
  var backToList = document.getElementById("backToList");
  var inboxLogout = document.getElementById("inboxLogout");

  // ---- Check localStorage for cached login ----
  var cachedEmail = localStorage.getItem("cheftag_chef_email") || "";
  if (cachedEmail) {
    chefEmailInput.value = cachedEmail;
  }

  // ---- Events ----
  chefLoginBtn.addEventListener("click", handleLogin);
  chefEmailInput.addEventListener("keydown", function (e) { if (e.key === "Enter") handleLogin(); });
  document.getElementById("chefPasswordInput").addEventListener("keydown", function (e) { if (e.key === "Enter") handleLogin(); });
  backToList.addEventListener("click", closeChatPanel);
  inboxSendBtn.addEventListener("click", sendReply);
  inboxMessageInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
  });
  inboxLogout.addEventListener("click", function () {
    localStorage.removeItem("cheftag_chef_email");
    if (sb) {
      sb.auth.signOut().then(function () { location.reload(); });
    } else {
      location.reload();
    }
  });

  // Typing detection
  inboxMessageInput.addEventListener("input", function () {
    if (!activeConvId) return;
    if (!isTyping) {
      isTyping = true;
      broadcastTyping("typing_start");
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function () {
      isTyping = false;
      broadcastTyping("typing_stop");
    }, 1500);
  });

  // ---- Auth Gate Check ----
  function checkAuthAndInit() {
    if (window.ChefTagAuth && !window.ChefTagAuth.loading) {
      var user = window.ChefTagAuth.user;
      var profile = window.ChefTagAuth.profile;
      if (user && profile && profile.role === "chef") {
        sb = createSupabaseClient();
        chefId = user.id;
        chefEmail = user.email;
        sb.from("chefs").select("name").eq("id", chefId).single().then(function (result) {
          chefName = (result.data && result.data.name) || profile.name || user.email.split("@")[0];
          showInbox();
        });
      } else {
        if (user && profile && profile.role !== "chef") {
          loginError.textContent = "Your account is not registered as a chef.";
          loginError.style.display = "block";
        }
        chefLogin.style.display = "flex";
      }
    }
  }

  if (window.ChefTagAuth && !window.ChefTagAuth.loading) {
    checkAuthAndInit();
  } else {
    var authPolls = 0;
    var authTimer = setInterval(function () {
      authPolls++;
      if (authPolls > 30) {
        clearInterval(authTimer);
        chefLogin.style.display = "flex";
        return;
      }
      if (window.ChefTagAuth && !window.ChefTagAuth.loading) {
        clearInterval(authTimer);
        checkAuthAndInit();
      }
    }, 100);
  }

  // ---- Login ----
  function handleLogin() {
    var email = chefEmailInput.value.trim().toLowerCase();
    var password = document.getElementById("chefPasswordInput").value;
    loginError.style.display = "none";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      loginError.textContent = "Please enter a valid email address.";
      loginError.style.display = "block";
      return;
    }
    if (!password) {
      loginError.textContent = "Please enter your password.";
      loginError.style.display = "block";
      return;
    }

    chefLoginBtn.disabled = true;
    chefLoginBtn.textContent = "Loading...";

    sb = createSupabaseClient();
    if (!sb) {
      loginError.textContent = "Cannot connect to server. Check your internet.";
      loginError.style.display = "block";
      chefLoginBtn.disabled = false;
      chefLoginBtn.textContent = "Open Inbox";
      return;
    }

    sb.auth.signInWithPassword({
      email: email,
      password: password
    }).then(function (result) {
      if (result.error) {
        chefLoginBtn.disabled = false;
        chefLoginBtn.textContent = "Open Inbox";
        loginError.textContent = "Login failed: " + result.error.message;
        loginError.style.display = "block";
        return;
      }

      var user = result.data.user;
      sb.from("profiles").select("role, name").eq("id", user.id).single().then(function (profResult) {
        if (profResult.data && profResult.data.role === "chef") {
          chefId = user.id;
          chefEmail = user.email;
          localStorage.setItem("cheftag_chef_email", email);
          sb.from("chefs").select("name").eq("id", chefId).single().then(function (chefResult) {
            chefLoginBtn.disabled = false;
            chefLoginBtn.textContent = "Open Inbox";
            chefName = (chefResult.data && chefResult.data.name) || profResult.data.name || user.email.split("@")[0];
            showInbox();
          });
        } else {
          chefLoginBtn.disabled = false;
          chefLoginBtn.textContent = "Open Inbox";
          loginError.textContent = "Your account is not registered as a chef.";
          loginError.style.display = "block";
          sb.auth.signOut();
        }
      });
    });
  }

  // ---- Show Inbox ----
  function showInbox() {
    chefLogin.style.display = "none";
    inboxContainer.style.display = "flex";
    chefWelcomeName.textContent = chefName;

    loadConversations();
    subscribeToNewMessages();
  }

  // ---- Load Conversations with Unread Counts ----
  function loadConversations() {
    // Fetch conversations
    sb.from("conversations")
      .select("*")
      .eq("chef_id", chefId)
      .eq("status", "active")
      .order("last_message_at", { ascending: false })
      .then(function (result) {
        if (result.error) {
          console.error("[ChefTag Inbox] Error loading conversations:", result.error);
          return;
        }
        conversations = result.data || [];

        // Fetch unread counts for each conversation
        if (conversations.length > 0) {
          var convIds = conversations.map(function (c) { return c.id; });
          sb.from("messages")
            .select("conversation_id, id")
            .in("conversation_id", convIds)
            .eq("sender_type", "client")
            .eq("is_read", false)
            .then(function (unreadResult) {
              if (!unreadResult.error && unreadResult.data) {
                var unreadMap = {};
                unreadResult.data.forEach(function (m) {
                  unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
                });
                conversations.forEach(function (c) {
                  c.unread = unreadMap[c.id] || 0;
                  // Update document title with total unread
                  var totalUnread = conversations.reduce(function (sum, conv) {
                    return sum + (conv.unread || 0);
                  }, 0);
                  document.title = totalUnread > 0
                    ? "(" + totalUnread + ") Inbox | ChefTag"
                    : "Chef Inbox | ChefTag";
                });
              }
              renderConversations();
            });
        } else {
          renderConversations();
        }
      });
  }

  // ---- Render Conversations (with unread badges) ----
  function renderConversations() {
    var totalUnread = conversations.reduce(function (sum, c) { return sum + (c.unread || 0); }, 0);
    inboxCount.textContent = conversations.length + " conversation" + (conversations.length !== 1 ? "s" : "") +
      (totalUnread > 0 ? " (" + totalUnread + " unread)" : "");

    if (conversations.length === 0) {
      inboxList.innerHTML =
        '<div class="inbox-empty-list">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' +
          '<h3>No messages yet</h3>' +
          '<p>When clients start a chat with you, it will appear here.</p>' +
        '</div>';
      return;
    }

    inboxList.innerHTML = conversations.map(function (conv) {
      var initials = (conv.client_name || "C").substring(0, 2).toUpperCase();
      var preview = conv.last_message || "Started a conversation";
      if (preview.length > 40) preview = preview.substring(0, 40) + "...";
      var timeStr = formatRelativeTime(conv.last_message_at || conv.created_at);
      var isActive = activeConvId === conv.id ? " active" : "";
      var unreadBadge = (conv.unread && conv.unread > 0)
        ? '<span class="conv-unread">' + Math.min(conv.unread, 99) + '</span>'
        : "";
      var convClass = isActive + (conv.unread > 0 ? " conv-unread-highlight" : "");

      return '<li class="conv-item' + convClass + '" data-id="' + conv.id + '">' +
        '<div class="conv-avatar' + (conv.unread > 0 ? ' conv-avatar-unread' : '') + '">' + esc(initials) + '</div>' +
        '<div class="conv-info">' +
          '<div class="conv-name">' + esc(conv.client_name) + '</div>' +
          '<div class="conv-preview">' + esc(preview) + '</div>' +
          '<div class="conv-time">' + timeStr + '</div>' +
        '</div>' +
        unreadBadge +
      '</li>';
    }).join("");

    // Click handler
    inboxList.querySelectorAll(".conv-item").forEach(function (item) {
      item.addEventListener("click", function () {
        openConversation(item.dataset.id);
      });
    });

    // Re-open active conversation if it still exists
    if (activeConvId) {
      var activeItem = inboxList.querySelector('[data-id="' + activeConvId + '"]');
      if (activeItem) activeItem.classList.add("active");
    }
  }

  // ---- Typing Indicator (Realtime Broadcast) ----
  function subscribeToTyping(convId) {
    if (typingChannel) {
      sb.removeChannel(typingChannel);
    }
    typingChannel = sb.channel("typing-" + convId);
    typingChannel
      .on("broadcast", { event: "typing_start" }, function () {
        var typingEl = document.getElementById("inboxTyping");
        if (typingEl) typingEl.style.display = "flex";
        scrollToInboxBottom();
      })
      .on("broadcast", { event: "typing_stop" }, function () {
        var typingEl = document.getElementById("inboxTyping");
        if (typingEl) typingEl.style.display = "none";
      })
      .subscribe();
  }

  function broadcastTyping(event) {
    if (!typingChannel || !activeConvId) return;
    typingChannel.send({
      type: "broadcast",
      event: event,
      payload: { conversation_id: activeConvId, sender: "chef" }
    });
  }

  // ---- Open Conversation ----
  function openConversation(convId) {
    activeConvId = convId;
    var conv = conversations.find(function (c) { return c.id === convId; });
    if (!conv) return;

    inboxChatName.textContent = conv.client_name;
    inboxChatEmail.textContent = conv.client_email || "";
    inboxNoChat.style.display = "none";
    inboxChatPanel.classList.add("open");
    inboxSidebar.classList.add("hidden");

    // Mark active in sidebar
    inboxList.querySelectorAll(".conv-item").forEach(function (item) {
      item.classList.toggle("active", item.dataset.id === convId);
    });

    lastRenderedDate = "";
    inboxMessages.innerHTML = "";

    // Load messages + mark them as read
    sb.from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .then(function (result) {
        if (result.error) {
          console.error("[ChefTag Inbox] Error loading messages:", result.error);
          return;
        }

        // Mark client's unread messages as read
        var unreadIds = [];
        if (result.data && result.data.length > 0) {
          result.data.forEach(function (msg) {
            if (msg.sender_type === "client" && !msg.is_read) {
              unreadIds.push(msg.id);
            }
            renderInboxMessage(msg, false);
          });
          scrollToInboxBottom();
        } else {
          inboxMessages.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-size:0.92rem;">No messages yet. Say hello!</div>';
        }

        if (unreadIds.length > 0) {
          sb.from("messages")
            .update({ is_read: true })
            .in("id", unreadIds)
            .then(function () {
              // Update unread count in sidebar
              if (conv) conv.unread = 0;
              renderConversations();
              updateReadReceipts();
            });
        }
      });

    inboxMessageInput.focus();

    // Subscribe to this conversation's realtime
    if (realtimeChannel) {
      sb.removeChannel(realtimeChannel);
    }

    realtimeChannel = sb
      .channel("inbox-" + convId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: "conversation_id=eq." + convId },
        function (payload) {
          var msg = payload.new;
          if (msg.sender_type === "client") {
            var placeholder = inboxMessages.querySelector("div[style]");
            if (placeholder && placeholder.textContent.indexOf("No messages") !== -1) {
              placeholder.remove();
            }
            renderInboxMessage(msg, true);
            scrollToInboxBottom();

            // Mark as read immediately since the chef has this conversation open
            sb.from("messages").update({ is_read: true }).eq("id", msg.id).then(function () {
              updateReadReceipts();
            });

            // Notify if tab not focused
            if (document.hidden) {
              playNotificationSound();
              showBrowserNotification(conv.client_name, msg.content.substring(0, 120));
              document.title = "✉ New message | ChefTag";
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: "conversation_id=eq." + convId },
        function (payload) {
          var msg = payload.new;
          // Read receipt: when client reads chef's message
          if (msg.sender_type === "chef" && msg.is_read) {
            updateReadReceipts();
          }
        }
      )
      .subscribe();

    // Subscribe to typing indicator
    subscribeToTyping(convId);
  }

  // ---- Close Chat Panel ----
  function closeChatPanel() {
    activeConvId = null;
    inboxChatPanel.classList.remove("open");
    inboxNoChat.style.display = "flex";
    inboxSidebar.classList.remove("hidden");

    if (realtimeChannel) {
      sb.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    if (typingChannel) {
      sb.removeChannel(typingChannel);
      typingChannel = null;
    }

    // Reload conversations to get fresh unread counts
    loadConversations();
  }

  // ---- Render Inbox Message ----
  function renderInboxMessage(msg, animate) {
    var isChef = msg.sender_type === "chef";
    var msgDate = new Date(msg.created_at);
    var dateStr = msgDate.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

    if (dateStr !== lastRenderedDate) {
      lastRenderedDate = dateStr;
      var divider = document.createElement("div");
      divider.className = "inbox-date-divider";
      divider.innerHTML = "<span>" + dateStr + "</span>";
      inboxMessages.appendChild(divider);
    }

    var wrap = document.createElement("div");
    wrap.className = "inbox-bubble-wrap " + (isChef ? "chef" : "client");
    if (animate) {
      wrap.style.opacity = "0";
      wrap.style.transform = isChef ? "translateY(8px)" : "translateY(8px)";
      wrap.style.transition = "opacity 0.25s ease, transform 0.25s ease";
    }

    var senderName = isChef ? escapeHtml(chefName) : escapeHtml(document.getElementById("inboxChatName").textContent || "Client");
    var timeStr = msgDate.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

    // Read receipt for chef's sent messages
    var readIndicator = "";
    if (isChef) {
      readIndicator = msg.is_read
        ? '<span class="inbox-read-receipt read" title="Read">✓✓</span>'
        : '<span class="inbox-read-receipt" title="Sent">✓</span>';
    }

    wrap.innerHTML =
      '<span class="chat-sender-name">' + senderName + '</span>' +
      '<div class="inbox-bubble ' + (isChef ? "chef" : "client") + '">' +
        '<p style="margin:0;">' + formatContent(msg.content) + '</p>' +
      '</div>' +
      '<span class="chat-time">' + timeStr + readIndicator + '</span>';

    inboxMessages.appendChild(wrap);

    if (animate) {
      requestAnimationFrame(function () {
        wrap.style.opacity = "1";
        wrap.style.transform = "translateY(0)";
      });
    }
  }

  // ---- Update Read Receipts ----
  function updateReadReceipts() {
    var sentBubbles = inboxMessages.querySelectorAll(".inbox-bubble-wrap.chef");
    var lastSent = sentBubbles[sentBubbles.length - 1];
    if (lastSent) {
      var receipt = lastSent.querySelector(".inbox-read-receipt");
      if (receipt && !receipt.classList.contains("read")) {
        receipt.textContent = "✓✓";
        receipt.classList.add("read");
      }
    }
  }

  // ---- Send Reply ----
  function sendReply() {
    var content = inboxMessageInput.value.trim();
    if (!content || isSending || !activeConvId) return;

    isSending = true;
    inboxSendBtn.disabled = true;
    inboxMessageInput.value = "";

    // Stop typing
    if (isTyping) {
      isTyping = false;
      clearTimeout(typingTimeout);
      broadcastTyping("typing_stop");
    }

    sb.from("messages").insert([{
      conversation_id: activeConvId,
      sender_type: "chef",
      content: content,
      is_read: false
    }]).then(function (result) {
      if (result.error) {
        console.error("[ChefTag Inbox] Send error:", result.error);
        inboxMessageInput.value = content;
      } else {
        sb.from("conversations").update({
          last_message: content.substring(0, 100),
          last_message_at: new Date().toISOString()
        }).eq("id", activeConvId).then(function () {
          // Refresh conversations to update preview + order
          loadConversations();
        });
      }
      isSending = false;
      inboxSendBtn.disabled = false;
      inboxMessageInput.focus();
    });
  }

  // ---- Subscribe to New Messages (for notification when no conversation is open) ----
  function subscribeToNewMessages() {
    // Listen for new messages across all chef's conversations
    var newMsgChannel = sb
      .channel("inbox-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        function (payload) {
          var msg = payload.new;
          // Check if this message belongs to one of our conversations
          var conv = conversations.find(function (c) { return c.id === msg.conversation_id; });
          if (!conv) return;
          if (msg.sender_type !== "client") return;

          // Update last_message in our local list
          conv.last_message = msg.content;
          conv.last_message_at = msg.created_at;

          // If this conversation is NOT the active one, increment unread
          if (activeConvId !== msg.conversation_id) {
            conv.unread = (conv.unread || 0) + 1;
            renderConversations();

            // Notification
            if (document.hidden) {
              playNotificationSound();
              showBrowserNotification(conv.client_name, msg.content.substring(0, 120));
              document.title = "✉ New message from " + conv.client_name + " | ChefTag";
            }
          }

          // Re-sort conversations (newest first)
          conversations.sort(function (a, b) {
            return new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at);
          });
          renderConversations();
        }
      )
      .subscribe();
  }

  // ---- Notification Helpers ----
  function playNotificationSound() {
    try {
      var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var oscillator = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.frequency.value = 523.25; // C5
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) { /* audio not supported */ }
  }

  function showBrowserNotification(title, body) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      try { new Notification(title, { body: body, icon: "assets/favicon.svg" }); } catch (e) {}
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }

  // Clean up document title when tab regains focus
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      var totalUnread = conversations.reduce(function (sum, c) { return sum + (c.unread || 0); }, 0);
      document.title = totalUnread > 0
        ? "(" + totalUnread + ") Inbox | ChefTag"
        : "Chef Inbox | ChefTag";
    }
  });

  // ---- Helpers ----
  function scrollToInboxBottom() {
    requestAnimationFrame(function () { inboxMessages.scrollTop = inboxMessages.scrollHeight; });
  }

  function esc(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escapeHtml(str) {
    return esc(str);
  }

  function formatContent(text) {
    if (!text) return "";
    return esc(text).replace(/\n/g, "<br>");
  }

  function formatRelativeTime(dateStr) {
    if (!dateStr) return "";
    var now = new Date();
    var d = new Date(dateStr);
    var diffMs = now - d;
    var diffMin = Math.floor(diffMs / 60000);
    var diffHr = Math.floor(diffMs / 3600000);
    var diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return diffMin + "m ago";
    if (diffHr < 24) return diffHr + "h ago";
    if (diffDay < 7) return diffDay + "d ago";
    return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
  }
})();
