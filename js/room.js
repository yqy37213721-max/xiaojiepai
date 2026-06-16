// =====================================================
// 房间页逻辑 - 玩家列表、实时同步、开始游戏
// 新增：游戏途中加入功能、观战模式
// =====================================================

var roomCode = null;
var roomId = null;
var currentPlayerUuid = null;
var isHost = false;
var players = [];
var nicknameModalShown = false;
var playerCache = {};

// Toast
function showToast(msg, isError) {
  var el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show" + (isError ? " error" : "");
  clearTimeout(el._timer);
  el._timer = setTimeout(function() {
    el.className = "toast";
  }, 2000);
}

// 获取玩家 UUID
function getPlayerUuid() {
  var uuid = localStorage.getItem("player_uuid");
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem("player_uuid", uuid);
  }
  return uuid;
}

// 获取昵称
function getStoredNickname() {
  return localStorage.getItem("nickname") || "";
}

// 保存昵称
function setStoredNickname(name) {
  localStorage.setItem("nickname", name);
}

// 确认昵称
function confirmNickname() {
  console.log("DEBUG: confirmNickname called");
  var input = document.getElementById("nicknameInput");
  var name = input.value.trim();
  if (!name) {
    showToast("请输入昵称", true);
    input.focus();
    return;
  }
  setStoredNickname(name);
  document.getElementById("nicknameModal").style.display = "none";
  var loadingEl = document.getElementById("loadingPage");
  if (loadingEl) {
    loadingEl.style.display = "flex";
    loadingEl.querySelector("span").textContent = "加入房间中...";
  }
  nicknameModalShown = true;
  joinRoomChannel();
}

// 游戏途中加入
async function joinGameDuringPlay() {
  var name = getStoredNickname();
  if (!name) {
    showToast("请先设置昵称", true);
    return;
  }

  try {
    var roomRes = await supabase
      .from("rooms")
      .select("*")
      .eq("room_code", roomCode)
      .maybeSingle();
    if (roomRes.error) throw roomRes.error;
    if (!roomRes.data) {
      showToast("房间不存在", true);
      return;
    }

    roomId = roomRes.data.id;
    currentPlayerUuid = getPlayerUuid();

    var existingRes = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .eq("player_uuid", currentPlayerUuid)
      .maybeSingle();

    var seatNumber;
    if (existingRes.data) {
      seatNumber = existingRes.data.seat_number;
      await supabase
        .from("players")
        .update({ 
          is_online: true, 
          updated_at: new Date().toISOString() 
        })
        .eq("id", existingRes.data.id);
      showToast("已重新加入游戏！", false);
    } else {
      var maxSeatRes = await supabase
        .from("players")
        .select("seat_number")
        .eq("room_id", roomId)
        .order("seat_number", { ascending: false })
        .limit(1);
      
      seatNumber = 1;
      if (maxSeatRes.data && maxSeatRes.data.length > 0) {
        seatNumber = maxSeatRes.data[0].seat_number + 1;
      }

      var insertRes = await supabase
        .from("players")
        .insert({
          room_id: roomId,
          player_uuid: currentPlayerUuid,
          nickname: name,
          seat_number: seatNumber,
          is_host: false,
          is_online: true,
          cards_drawn: 0,
          drinks_count: 0
        })
        .select()
        .single();

      if (insertRes.error) throw insertRes.error;
      showToast("已加入游戏！座位号: " + seatNumber, false);

      // 更新 game_state 的 turn_order
      try {
        var gsRes = await supabase
          .from("game_state")
          .select("turn_order")
          .eq("room_id", roomId)
          .maybeSingle();
        if (gsRes.data && gsRes.data.turn_order) {
          var turnOrder = gsRes.data.turn_order.slice();
          if (turnOrder.indexOf(seatNumber) === -1) {
            turnOrder.push(seatNumber);
            turnOrder.sort(function(a, b) { return a - b; });
            await supabase
              .from("game_state")
              .update({ turn_order: turnOrder, updated_at: new Date().toISOString() })
              .eq("room_id", roomId);
          }
        }
      } catch (e) {
        console.error("update turn_order error:", e);
      }
    }

    setTimeout(function() {
      window.location.href = "game.html?room=" + roomCode;
    }, 1000);

  } catch (err) {
    console.error("joinGameDuringPlay error:", err);
    showToast("加入失败：" + (err.message || "未知错误"), true);
  }
}

// 解析 URL 参数
function getQueryParam(name) {
  var params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// 复制房间号
function copyRoomCode() {
  if (!roomCode) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(roomCode).then(function() {
      var btn = document.getElementById("copyRoomBtn");
      btn.textContent = "已复制 ✓";
      btn.classList.add("copied");
      setTimeout(function() {
        btn.textContent = "复制房间号";
        btn.classList.remove("copied");
      }, 2000);
    }).catch(function() {
      fallbackCopy();
    });
  } else {
    fallbackCopy();
  }
}

function fallbackCopy() {
  var ta = document.createElement("textarea");
  ta.value = roomCode;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  showToast("已复制: " + roomCode);
}

// 分享房间
function shareRoom() {
  var url = window.location.origin + "/game.html?room=" + roomCode;
  if (navigator.share) {
    navigator.share({
      title: "小姐牌 - 微信群喝酒小游戏",
      text: "一起来玩小姐牌！房间号: " + roomCode,
      url: url
    }).catch(function(){});
  } else {
    var ta = document.createElement("textarea");
    ta.value = url;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast("链接已复制");
  }
}

// 离开房间
async function leaveRoom() {
  RealtimeManager.unsubscribe();
  if (roomId && currentPlayerUuid) {
    try {
      await supabase
        .from("players")
        .update({ is_online: false })
        .eq("room_id", roomId)
        .eq("player_uuid", currentPlayerUuid);
    } catch (e) { /* ignore */ }
  }
  window.location.href = "index.html";
}

// 进入观战模式
function openSpectator() {
  window.location.href = "spectator.html?room=" + roomCode;
}

// 切换观战开关
async function toggleSpectatable() {
  try {
    var sw = await supabase
      .from("rooms")
      .select("is_spectatable")
      .eq("id", roomId)
      .maybeSingle();
    if (sw.error) throw sw.error;
    var nv = !sw.data.is_spectatable;
    await supabase
      .from("rooms")
      .update({ is_spectatable: nv, updated_at: new Date().toISOString() })
      .eq("id", roomId);
    var el = document.getElementById("spectatableSwitch");
    var lk = document.getElementById("spectatorLink");
    if (nv) {
      if (el) el.classList.add("active");
      if (lk) lk.style.display = "inline-flex";
    } else {
      if (el) el.classList.remove("active");
      if (lk) lk.style.display = "none";
    }
  } catch (e) {
    showToast("操作失败", true);
  }
}

// =====================================================
// 页面初始化
// =====================================================
async function init() {
  roomCode = getQueryParam("room");
  if (!roomCode) {
    showToast("缺少房间号", true);
    setTimeout(function() { window.location.href = "index.html"; }, 1500);
    return;
  }

  document.getElementById("roomCodeDisplay").textContent = roomCode;
  currentPlayerUuid = getPlayerUuid();

  try {
    var roomRes = await supabase
      .from("rooms")
      .select("*")
      .eq("room_code", roomCode)
      .maybeSingle();
    if (roomRes.error) throw roomRes.error;
    if (!roomRes.data) {
      showToast("房间不存在", true);
      setTimeout(function() { window.location.href = "index.html"; }, 1500);
      return;
    }

    var room = roomRes.data;
    roomId = room.id;

    // 观战链接显示
    if (room.is_spectatable) {
      var linkEl = document.getElementById("spectatorLink");
      if (linkEl) linkEl.style.display = "inline-flex";
      var sw = document.getElementById("spectatableSwitch");
      if (sw && room.is_spectatable) sw.classList.add("active");
    }

    // 如果游戏已开始，询问是否加入
    if (room.status === "playing") {
      var existingRes = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomId)
        .eq("player_uuid", currentPlayerUuid)
        .maybeSingle();
      if (existingRes.data) {
        window.location.href = "game.html?room=" + roomCode;
        return;
      }
      if (confirm("游戏已开始！是否加入游戏？")) {
        await joinGameDuringPlay();
        return;
      } else {
        window.location.href = "spectator.html?room=" + roomCode;
        return;
      }
    }

    if (room.status === "finished") {
      showToast("该房间游戏已结束，无法加入", true);
      setTimeout(function() { window.location.href = "index.html"; }, 1500);
      return;
    }

    // 加入房间频道
    await joinRoomChannel();

  } catch (err) {
    console.error("init error:", err);
    showToast("加载失败：" + (err.message || "未知错误"), true);
  }
}

// 加入房间频道
async function joinRoomChannel() {
  try {
    currentPlayerUuid = getPlayerUuid();
    
    var existingRes = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .eq("player_uuid", currentPlayerUuid)
      .maybeSingle();

    if (!existingRes.data) {
      var maxSeatRes = await supabase
        .from("players")
        .select("seat_number")
        .eq("room_id", roomId)
        .order("seat_number", { ascending: false })
        .limit(1);
      
      var seatNumber = 1;
      if (maxSeatRes.data && maxSeatRes.data.length > 0) {
        seatNumber = maxSeatRes.data[0].seat_number + 1;
      }

      var insertRes = await supabase
        .from("players")
        .insert({
          room_id: roomId,
          player_uuid: currentPlayerUuid,
          nickname: getStoredNickname() || "玩家",
          seat_number: seatNumber,
          is_host: false,
          is_online: true,
          cards_drawn: 0,
          drinks_count: 0
        })
        .select()
        .single();
      
      if (insertRes.error) throw insertRes.error;
    } else {
      await supabase
        .from("players")
        .update({ is_online: true, updated_at: new Date().toISOString() })
        .eq("id", existingRes.data.id);
    }

    // 加载玩家列表
    var plRes = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .order("seat_number", { ascending: true });
    if (plRes.data) players = plRes.data;

    // 判断是否是房主
    for (var i = 0; i < players.length; i++) {
      if (players[i].player_uuid === currentPlayerUuid && players[i].is_host) {
        isHost = true;
        break;
      }
    }

    // 显示页面
    document.getElementById("loadingPage").style.display = "none";
    document.getElementById("roomPage").style.display = "flex";

    // 渲染玩家列表
    renderPlayerList();

    // 房主控制
    if (isHost) {
      document.getElementById("hostControls").style.display = "block";
    }
    updateHostControls();

    // 订阅实时
    RealtimeManager.subscribeRoom(roomId, roomCode, {
      onPlayerChange: function(payload) {
        var ev = payload.eventType;
        var rec = payload.new;
        if (ev === "INSERT" || ev === "UPDATE") {
          var found = false;
          for (var i = 0; i < players.length; i++) {
            if (players[i].id === rec.id) { players[i] = rec; found = true; break; }
          }
          if (!found) players.push(rec);
        } else if (ev === "DELETE") {
          players = players.filter(function(p) { return p.id !== payload.old.id; });
        }
        renderPlayerList();
        updateHostControls();
      },
      onGameStart: function(room) {
        window.location.href = "game.html?room=" + roomCode;
      },
      onError: function(err) {
        if (err) showToast(err, true);
      }
    });

  } catch (err) {
    console.error("joinRoomChannel error:", err);
    showToast("加入失败：" + (err.message || "未知错误"), true);
  }
}

// 渲染玩家列表
function renderPlayerList() {
  var listEl = document.getElementById("playerList");
  var countEl = document.getElementById("playerCount");
  
  if (!players || players.length === 0) {
    listEl.innerHTML = "<div class=\"empty-state\">等待玩家加入...</div>";
    countEl.textContent = "0 人";
    return;
  }

  countEl.textContent = players.length + " 人";
  
  var html = "";
  for (var i = 0; i < players.length; i++) {
    var p = players[i];
    var isMe = (p.player_uuid === currentPlayerUuid);
    
    html += "<div class=\"player-item\">";
    html += "  <span class=\"seat\">#" + p.seat_number + "</span>";
    html += "  <span class=\"name\">" + escapeHtml(p.nickname) + "</span>";
    if (p.is_host) {
      html += "  <span class=\"badge host\">房主</span>";
    }
    if (isMe) {
      html += "  <span class=\"badge you\">我</span>";
    }
    html += "  <span class=\"badge " + (p.is_online ? "online" : "offline") + "\"></span>";
    html += "</div>";
  }

  listEl.innerHTML = html;
}

function escapeHtml(text) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// =====================================================
// 房主控制
// =====================================================
function updateHostControls() {
  var startBtn = document.getElementById("startGameBtn");
  var hint = document.getElementById("waitingHint");

  if (isHost) {
    startBtn.style.display = "flex";
    hint.style.display = "none";
    startBtn.disabled = false;
    startBtn.textContent = "开始游戏";
  } else {
    startBtn.style.display = "none";
    hint.style.display = "block";
  }
}

// =====================================================
// 牌堆工具
// =====================================================
function buildDeck() {
  var suits = ["spade", "heart", "diamond", "club"];
  var values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  var deck = [];
  for (var s = 0; s < suits.length; s++) {
    for (var v = 0; v < values.length; v++) {
      deck.push({ suit: suits[s], value: values[v] });
    }
  }
  deck.push({ suit: "joker", value: "small" });
  deck.push({ suit: "joker", value: "big" });
  return deck;
}

function shuffleDeck(deck) {
  var arr = deck.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

async function startGame() {
  if (!isHost) return;

  var btn = document.getElementById("startGameBtn");
  btn.disabled = true;
  btn.textContent = "准备中...";

  try {
    var onlinePlayers = players.filter(function(p) { return p.is_online; });
    if (onlinePlayers.length < 2) {
      showToast("至少需要2名玩家才能开始", true);
      btn.disabled = false;
      btn.textContent = "开始游戏";
      return;
    }

    var turnOrder = onlinePlayers
      .map(function(p) { return p.seat_number; })
      .sort(function(a, b) { return a - b; });

    var deck = shuffleDeck(buildDeck());

    var gsRes = await supabase
      .from("game_state")
      .insert({
        room_id: roomId,
        current_turn: turnOrder[0],
        card_pile: deck,
        current_index: 0,
        drawn_cards: [],
        status: "playing",
        turn_order: turnOrder,
        current_turn_index: 0,
        special_states: {
          miss: null,
          camera: false,
          crazy: null,
          toilet: null
        }
      })
      .select()
      .single();

    if (gsRes.error) throw gsRes.error;

    var updateRes = await supabase
      .from("rooms")
      .update({ status: "playing", updated_at: new Date().toISOString() })
      .eq("id", roomId);

    if (updateRes.error) throw updateRes.error;

    setTimeout(function() {
      window.location.href = "game.html?room=" + roomCode;
    }, 500);

  } catch (err) {
    console.error("startGame error:", err);
    showToast("开始失败：" + (err.message || "未知错误"), true);
    btn.disabled = false;
    btn.textContent = "开始游戏";
  }
}

window.addEventListener("beforeunload", function() {
  if (roomId && currentPlayerUuid) {
    var payload = JSON.stringify({
      is_online: false,
      updated_at: new Date().toISOString()
    });
    var url = SUPABASE_CONFIG.url + "/rest/v1/players?room_id=eq." + roomId + "&player_uuid=eq." + currentPlayerUuid;
    try {
      navigator.sendBeacon(url, payload);
    } catch (e) { /* ignore */ }
  }
});

document.addEventListener("visibilitychange", function() {
  if (!document.hidden && roomId && currentPlayerUuid) {
    supabase
      .from("players")
      .update({ is_online: true, updated_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("player_uuid", currentPlayerUuid)
      .then(function() {})
      .catch(function() {});
  }
});

window.addEventListener("error", function(e) {
  console.error("GLOBAL ERROR:", e.message, e.filename, e.lineno);
  showToast("JS错误: " + (e.message || "未知"), true);
});

document.addEventListener("DOMContentLoaded", init);
