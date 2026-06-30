/**
 * ChefTag — Client Chat Logic
 * Real-time chat, typing indicators, read receipts, notifications.
 */

(function () {
  "use strict";

  // ---- URL Params ----
  var params = new URLSearchParams(window.location.search);
  var chefId = params.get("chef_id");
  var chefName = params.get("chef_name") || "Chef";
  var chefLocation = params.get("chef_location") || "";
  var chefImage = params.get("chef_image") || "";

  // ---- State ----
  var clientName = localStorage.getItem("cheftag_chat_name") || "";
  var clientEmail = localStorage.getItem("cheftag_chat_email") || "";
  var clientPhone = localStorage.getItem("cheftag_chat_phone") || "";
  var conversationId = null;
  var realtimeChannel = null;
  var typingChannel = null;
  var sb = null;
  var isLoading = false;
  var lastRenderedDate = "";
  var typingTimeout = null;
  var isTyping = false;

  // ---- DOM ----
  var identitySection = document.getElementById("identitySection");
  var chatContainer = document.getElementById("chatContainer");
  var chatMessages = document.getElementById("chatMessages");
  var chatEmpty = document.getElementById("chatEmpty");
  var messageInput = document.getElementById("messageInput");
  var sendBtn = document.getElementById("sendBtn");
  var startChatBtn = document.getElementById("startChatBtn");
  var identityError = document.getElementById("identityError");
  var chatTyping = document.getElementById("chatTyping");

  // ---- Init ----
  document.getElementById("identityChefName").textContent = "Chat with " + chefName;
  if (chefImage) document.getElementById("identityChefImg").src = chefImage;

  // Wait for auth check to complete (auth-check.js sets window.ChefTagAuth)
  function checkAuthAndInit() {
    if (window.ChefTagAuth && !window.ChefTagAuth.loading) {
      if (window.ChefTagAuth.user) {
        var profile = window.ChefTagAuth.profile;
        var user = window.ChefTagAuth.user;
        clientName = (profile && profile.name) || (user.user_metadata && user.user_metadata.name) || user.email.split("@")[0];
        clientEmail = user.email;
        clientPhone = (profile && profile.phone) || "";
        initChat();
      } else {
        var returnPath = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = "auth.html?redirect=" + returnPath;
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
        window.location.href = "auth.html";
        return;
      }
      if (window.ChefTagAuth && !window.ChefTagAuth.loading) {
        clearInterval(authTimer);
        checkAuthAndInit();
      }
    }, 100);
  }

  startChatBtn.addEventListener("click", handleIdentitySubmit);
  document.getElementById("clientEmailInput").addEventListener("keydown", function (e) { if (e.key === "Enter") handleIdentitySubmit(); });
  document.getElementById("clientPhoneInput").addEventListener("keydown", function (e) { if (e.key === "Enter") handleIdentitySubmit(); });

  // ---- Identity Form ----
  function handleIdentitySubmit() {
    var name = document.getElementById("clientNameInput").value.trim();
    var email = document.getElementById("clientEmailInput").value.trim();
    var phone = document.getElementById("clientPhoneInput").value.trim();

    identityError.style.display = "none";

    if (!name) { showIdentityError("Please enter your name."); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showIdentityError("Please enter a valid email."); return; }

    clientName = name;
    clientEmail = email;
    clientPhone = phone;
    localStorage.setItem("cheftag_chat_name", name);
    localStorage.setItem("cheftag_chat_email", email);
    localStorage.setItem("cheftag_chat_phone", phone);

    initChat();
  }

  function showIdentityError(msg) {
    identityError.textContent = msg;
    identityError.style.display = "block";
  }

  // ---- Initialize Chat ----
  function initChat() {
    sb = createSupabaseClient();
    if (!sb) {
      identitySection.innerHTML = '<div class="chat-identity-box"><p style="color:var(--tomato);font-weight:700;">Unable to connect. Please check your internet and try again.</p><br><a href="index.html" style="color:var(--basil);font-weight:800;">Back to ChefTag</a></div>';
      return;
    }

    identitySection.style.display = "none";
    chatContainer.style.display = "flex";
    document.getElementById("chatChefName").textContent = chefName;

    findOrCreateConversation().then(function (convId) {
      conversationId = convId;
      loadMessages();
      subscribeToRealtime();
      subscribeToTyping();
    });

    sendBtn.addEventListener("click", sendMessage);
    messageInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    // Typing detection
    messageInput.addEventListener("input", function () {
      if (!conversationId) return;
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
  }

  // ---- Typing Indicator (Realtime Broadcast) ----
  function subscribeToTyping() {
    if (!conversationId || !sb) return;
    typingChannel = sb.channel("typing-" + conversationId);
    typingChannel
      .on("broadcast", { event: "typing_start" }, function () {
        if (chatTyping) chatTyping.style.display = "flex";
        scrollToBottom();
      })
      .on("broadcast", { event: "typing_stop" }, function () {
        if (chatTyping) chatTyping.style.display = "none";
      })
      .subscribe();
  }

  function broadcastTyping(event) {
    if (!typingChannel || !conversationId) return;
    typingChannel.send({
      type: "broadcast",
      event: event,
      payload: { conversation_id: conversationId, sender: "client" }
    });
  }

  // ---- Find or Create Conversation ----
  function findOrCreateConversation() {
    return sb.from("conversations")
      .select("id")
      .eq("chef_id", chefId)
      .eq("client_email", clientEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(function (result) {
        if (result.error) {
          console.error("[ChefTag Chat] Error finding conversation:", result.error);
          return createConversation();
        }
        if (result.data && result.data.length > 0) {
          console.log("[ChefTag Chat] Found existing conversation:", result.data[0].id);
          return result.data[0].id;
        }
        return createConversation();
      });
  }

  function createConversation() {
    return sb.from("conversations").insert([{
      chef_id: chefId,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone || null,
      last_message: "",
      last_message_at: new Date().toISOString()
    }]).select("id").single().then(function (result) {
      if (result.error) {
        console.error("[ChefTag Chat] Error creating conversation:", result.error);
        return null;
      }
      console.log("[ChefTag Chat] Created conversation:", result.data.id);
      return result.data.id;
    });
  }

  // ---- Load Messages ----
  function loadMessages() {
    if (!conversationId) return;

    sb.from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .then(function (result) {
        if (result.error) {
          console.error("[ChefTag Chat] Error loading messages:", result.error);
          return;
        }
        if (!result.data || result.data.length === 0) {
          return;
        }
        chatEmpty.style.display = "none";

        // Mark chef's messages as read
        var unreadIds = result.data
          .filter(function (m) { return m.sender_type === "chef" && !m.is_read; })
          .map(function (m) { return m.id; });

        if (unreadIds.length > 0) {
          sb.from("messages")
            .update({ is_read: true })
            .in("id", unreadIds)
            .then(function () {});
        }

        result.data.forEach(function (msg) {
          renderMessage(msg, false);
        });
        scrollToBottom();
      });
  }

  // ---- Render Message ----
  function renderMessage(msg, animate) {
    chatEmpty.style.display = "none";

    var isClient = msg.sender_type === "client";
    var msgDate = new Date(msg.created_at);
    var dateStr = msgDate.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

    // Date divider
    if (dateStr !== lastRenderedDate) {
      lastRenderedDate = dateStr;
      var divider = document.createElement("div");
      divider.className = "chat-date-divider";
      divider.innerHTML = "<span>" + dateStr + "</span>";
      chatMessages.appendChild(divider);
    }

    var wrap = document.createElement("div");
    wrap.className = "chat-bubble-wrap " + (isClient ? "client" : "chef");
    if (animate) {
      wrap.style.opacity = "0";
      wrap.style.transform = "translateY(8px)";
      wrap.style.transition = "opacity 0.25s ease, transform 0.25s ease";
    }

    var senderName = isClient ? escapeHtml(clientName) : escapeHtml(chefName);
    var timeStr = msgDate.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

    // Read receipt indicator for sent messages
    var readIndicator = "";
    if (isClient) {
      readIndicator = msg.is_read
        ? '<span class="chat-read-receipt read" title="Read">✓✓</span>'
        : '<span class="chat-read-receipt" title="Sent">✓</span>';
    }

    wrap.innerHTML =
      '<span class="chat-sender-name">' + senderName + '</span>' +
      '<div class="chat-bubble ' + (isClient ? "client" : "chef") + '">' +
        '<p style="margin:0;">' + formatContent(msg.content) + '</p>' +
      '</div>' +
      '<span class="chat-time">' + timeStr + readIndicator + '</span>';

    chatMessages.appendChild(wrap);

    if (animate) {
      requestAnimationFrame(function () {
        wrap.style.opacity = "1";
        wrap.style.transform = "translateY(0)";
      });
    }
  }

  // ---- Update Read Receipt for a Sent Message ----
  function updateReadReceipts() {
    var sentBubbles = chatMessages.querySelectorAll(".chat-bubble-wrap.client");
    var lastSent = sentBubbles[sentBubbles.length - 1];
    if (lastSent) {
      var receipt = lastSent.querySelector(".chat-read-receipt");
      if (receipt) {
        receipt.textContent = "✓✓";
        receipt.classList.add("read");
      }
    }
  }

  // ---- Send Message ----
  function sendMessage() {
    var content = messageInput.value.trim();
    if (!content || isLoading || !conversationId) return;

    isLoading = true;
    sendBtn.disabled = true;
    messageInput.value = "";

    // Stop typing
    if (isTyping) {
      isTyping = false;
      clearTimeout(typingTimeout);
      broadcastTyping("typing_stop");
    }

    sb.from("messages").insert([{
      conversation_id: conversationId,
      sender_type: "client",
      content: content,
      is_read: false
    }]).then(function (result) {
      if (result.error) {
        console.error("[ChefTag Chat] Send error:", result.error);
        messageInput.value = content;
      } else {
        sb.from("conversations").update({
          last_message: content.substring(0, 100),
          last_message_at: new Date().toISOString()
        }).eq("id", conversationId).then(function () {});
      }
      isLoading = false;
      sendBtn.disabled = false;
      messageInput.focus();
    });
  }

  // ---- Notification Helpers ----
  function playNotificationSound() {
    try {
      // Short subtle chime using Web Audio API
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

  // ---- Realtime Subscription ----
  function subscribeToRealtime() {
    if (!conversationId || !sb) return;

    realtimeChannel = sb
      .channel("chat-" + conversationId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "conversation_id=eq." + conversationId
        },
        function (payload) {
          var msg = payload.new;
          if (msg.sender_type === "chef") {
            renderMessage(msg, true);
            scrollToBottom();

            // Notify if tab not focused
            if (document.hidden) {
              playNotificationSound();
              showBrowserNotification(chefName, msg.content.substring(0, 120));
              document.title = "✉ " + chefName + " | ChefTag";
            }

            // Mark as read if tab is visible
            if (!document.hidden) {
              sb.from("messages").update({ is_read: true }).eq("id", msg.id).then(function () {
                updateReadReceipts();
              });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: "conversation_id=eq." + conversationId
        },
        function (payload) {
          var msg = payload.new;
          // When a message gets marked as read by the chef
          if (msg.sender_type === "client" && msg.is_read) {
            updateReadReceipts();
          }
        }
      )
      .subscribe(function (status) {
        console.log("[ChefTag Chat] Realtime status:", status);
      });
  }

  // Mark messages as read when tab regains focus
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && conversationId) {
      document.title = "Chat with " + chefName + " | ChefTag";
      // Mark unread chef messages as read
      sb.from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .eq("sender_type", "chef")
        .eq("is_read", false)
        .then(function () {
          updateReadReceipts();
        });
    }
  });

  // ---- Helpers ----
  function scrollToBottom() {
    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function formatContent(text) {
    if (!text) return "";
    var escaped = escapeHtml(text);
    return escaped.replace(/\n/g, "<br>");
  }
})();
