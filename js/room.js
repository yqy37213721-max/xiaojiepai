// =====================================================
// 房间页逻辑 - 玩家列表、实时同步、开始游戏
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
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(el._timer);
  el._timer = setTimeout(function() {
    el.className = 'toast';
  }, 2000);
}

// 获取玩家 UUID
function getPlayerUuid() {
  var uuid = localStorage.getItem('player_uuid');
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem('player_uuid', uuid);
  }
  return uuid;
}

// 获取昵称
function getStoredNickname() {
  return localStorage.getItem('nickname') || '';
}

// 保存昵称
function setStoredNickname(name) {
  localStorage.setItem('nickname', name);
}

// 确认昵称
function confirmNickname() {
  var input = document.getElementById('nicknameInput');
  var name = input.value.trim();
  if (!name) {
    showToast('请输入昵称', true);
    input.focus();
    return;
  }
  setStoredNickname(name);
  document.getElementById('nicknameModal').style.display = 'none';
  // 显示加载状态
  var loadingEl = document.getElementById('loadingPage');
  if (loadingEl) {
    loadingEl.style.display = 'flex';
    loadingEl.querySelector('span').textContent = '加入房间中...';
  }
  nicknameModalShown = true;
  joinRoomChannel();
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
      var btn = document.getElementById('copyRoomBtn');
      btn.textContent = '已复制 ✓';
      btn.classList.add('copied');
      setTimeout(function() {
        btn.textContent = '复制房间号';
        btn.classList.remove('copied');
      }, 2000);
    }).catch(function() {
      fallbackCopy();
    });
  } else {
    fallbackCopy();
  }
}

function fallbackCopy() {
  var ta = document.createElement('textarea');
  ta.value = roomCode;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast('已复制: ' + roomCode);
}

// 分享房间链接
function shareRoom() {
  var url = window.location.origin + '/room.html?room=' + roomCode;
  if (navigator.share) {
    navigator.share({
      title: '小姐牌 - 微信群喝酒小游戏',
      text: '一起来玩小姐牌！房间号: ' + roomCode,
      url: url
    }).catch(function(){});
  } else {
    var ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('链接已复制，发送到微信群即可');
  }
}
  var ta = document.createElement('textarea');
  ta.value = roomCode;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast('已复制: ' + roomCode);
}

// 离开房间
async function leaveRoom() {
  RealtimeManager.unsubscribe();
  if (roomId && currentPlayerUuid) {
    try {
      await supabase
        .from('players')
        .update({ is_online: false })
        .eq('room_id', roomId)
        .eq('player_uuid', currentPlayerUuid);
    } catch (e) { /* ignore */ }
  }
  window.location.href = 'index.html';
}

// =====================================================
// 页面初始化
// =====================================================
async function init() {
  roomCode = getQueryParam('room');
  if (!roomCode) {
    showToast('缺少房间号', true);
    setTimeout(function() { window.location.href = 'index.html'; }, 1500);
    return;
  }

  // 显示房间号
  document.getElementById('roomCodeDisplay').textContent = roomCode;

  // 获取玩家 UUID
  currentPlayerUuid = getPlayerUuid();

  try {
    // 查询房间信息
    var roomRes = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', roomCode)
      .maybeSingle();

    if (roomRes.error) throw roomRes.error;

    if (!roomRes.data) {
      showToast('房间不存在', true);
      setTimeout(function() { window.location.href = 'index.html'; }, 1500);
      return;
    }

    var room = roomRes.data;
    roomId = room.id;

    // 如果游戏已开始，跳转到游戏页
    if (room.status === 'playing') {
      window.location.href = 'game.html?room=' + roomCode;
      return;
    }

    if (room.status === 'finished') {
      showToast('该房间游戏已结束', true);
      setTimeout(function() { window.location.href = 'index.html'; }, 1500);
      return;
    }

    // 检查该玩家是否已在此房间
    var playerRes = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .eq('player_uuid', currentPlayerUuid)
      .maybeSingle();

    if (playerRes.data) {
      // 已有记录
      var existing = playerRes.data;
      isHost = existing.is_host;
      var storedName = getStoredNickname();
      if (storedName) {
        nicknameModalShown = true;
        document.getElementById('nicknameModal').style.display = 'none';
        joinRoomChannel();
      } else {
        showNicknameModal();
      }
    } else {
      // 新玩家
      showNicknameModal();
    }

    // 加载已有的玩家列表（用于预填充）
    var listRes = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('seat_number', { ascending: true });

    if (listRes.data) {
      players = listRes.data;
      renderPlayerList();
    }

  } catch (err) {
    console.error('init error:', err);
    showToast('加载失败：' + (err.message || '未知错误'), true);
  }
}

function showNicknameModal() {
  var modal = document.getElementById('nicknameModal');
  modal.style.display = 'flex';
  var stored = getStoredNickname();
  if (stored) {
    document.getElementById('nicknameInput').value = stored;
  }
  setTimeout(function() {
    document.getElementById('nicknameInput').focus();
  }, 300);
}

// =====================================================
// 加入房间频道（设置昵称后调用）
// =====================================================
async function joinRoomChannel() {
  var nickname = getStoredNickname();

  try {
    // 查询是否已有记录
    var existingRes = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .eq('player_uuid', currentPlayerUuid)
      .maybeSingle();

    var existingPlayer = existingRes.data;

    if (existingPlayer) {
      // 已有记录 → 更新昵称和在线状态
      isHost = existingPlayer.is_host;
      await supabase
        .from('players')
        .update({
          nickname: nickname,
          is_online: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPlayer.id);
    } else {
      // 新玩家 → 分配座位号
      var seatNumber = await getNextSeatNumber();

      var insertRes = await supabase
        .from('players')
        .insert({
          room_id: roomId,
          player_uuid: currentPlayerUuid,
          nickname: nickname,
          seat_number: seatNumber,
          is_host: false,
          is_online: true
        })
        .select()
        .single();

      if (insertRes.error) throw insertRes.error;
    }

    // 订阅实时频道
    subscribeToRoom();

    // 显示页面
    document.getElementById('loadingPage').style.display = 'none';
    document.getElementById('roomPage').style.display = 'flex';

    // 更新按钮状态
    updateHostControls();

  } catch (err) {
    console.error('joinRoomChannel error:', err);
    var msg = err.message || err.toString() || '未知错误';
    showToast('加入房间失败：' + msg, true);
  }
}

// 分配最小可用座位号
async function getNextSeatNumber() {
  var res = await supabase
    .from('players')
    .select('seat_number')
    .eq('room_id', roomId)
    .order('seat_number', { ascending: true });

  var usedSeats = (res.data || []).map(function(p) { return p.seat_number; });
  for (var i = 1; i <= 10; i++) {
    if (usedSeats.indexOf(i) === -1) return i;
  }
  throw new Error('房间已满');
}

// =====================================================
// 实时订阅
// =====================================================
function subscribeToRoom() {
  RealtimeManager.subscribeRoom(roomId, roomCode, {
    onPlayerChange: function(payload) {
      handlePlayerChange(payload);
    },
    onGameStart: function(roomData) {
      // 房主开始游戏 → 所有人跳转
      window.location.href = 'game.html?room=' + roomCode;
    },
    onError: function(err) {
      if (err) showToast(err, true);
    },
    onSubscribe: function() {
      console.log('Realtime subscribed');
    }
  });
}

// 处理玩家数据变更
function handlePlayerChange(payload) {
  var event = payload.eventType;
  var newRecord = payload.new;
  var oldRecord = payload.old;

  switch (event) {
    case 'INSERT':
      // 添加新玩家
      if (!players.find(function(p) { return p.id === newRecord.id; })) {
        players.push(newRecord);
      }
      break;

    case 'UPDATE':
      // 更新玩家信息
      for (var i = 0; i < players.length; i++) {
        if (players[i].id === newRecord.id) {
          players[i] = newRecord;
          break;
        }
      }
      break;

    case 'DELETE':
      // 移除玩家
      players = players.filter(function(p) { return p.id !== oldRecord.id; });
      break;
  }

  renderPlayerList();

  // 如果当前玩家是房主身份变更（理论上不会发生，但防御处理）
  if (newRecord && newRecord.player_uuid === currentPlayerUuid) {
    isHost = newRecord.is_host;
    updateHostControls();
  }
}

// =====================================================
// 渲染玩家列表
// =====================================================
function renderPlayerList() {
  var listEl = document.getElementById('playerList');
  var countEl = document.getElementById('playerCount');

  var sorted = players.slice().sort(function(a, b) {
    return a.seat_number - b.seat_number;
  });

  countEl.textContent = sorted.length + ' 人';

  if (sorted.length === 0) {
    listEl.innerHTML = '<div class="empty-state">等待玩家加入...</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < sorted.length; i++) {
    var p = sorted[i];
    var isMe = p.player_uuid === currentPlayerUuid;
    var seatLabel = '#' + p.seat_number;

    html += '<div class="player-item' + (p.is_online ? '' : ' waiting') + '">';
    html += '  <div class="seat">' + seatLabel + '</div>';
    html += '  <div class="name">' + escapeHtml(p.nickname) + '</div>';

    if (p.is_host) {
      html += '  <span class="badge host">房主</span>';
    }
    if (isMe) {
      html += '  <span class="badge you">我</span>';
    }
    html += '  <span class="badge ' + (p.is_online ? 'online' : 'offline') + '"></span>';
    html += '</div>';
  }

  listEl.innerHTML = html;
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// =====================================================
// 房主控制
// =====================================================
function updateHostControls() {
  var startBtn = document.getElementById('startGameBtn');
  var hint = document.getElementById('waitingHint');

  if (isHost) {
    startBtn.style.display = 'flex';
    hint.style.display = 'none';
    startBtn.disabled = false;
    startBtn.textContent = '开始游戏';
  } else {
    startBtn.style.display = 'none';
    hint.style.display = 'block';
  }
}

// =====================================================
// 牌堆工具
// =====================================================
function buildDeck() {
  var suits = ['spade', 'heart', 'diamond', 'club'];
  var values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var deck = [];
  for (var s = 0; s < suits.length; s++) {
    for (var v = 0; v < values.length; v++) {
      deck.push({ suit: suits[s], value: values[v] });
    }
  }
  deck.push({ suit: 'joker', value: 'small' });
  deck.push({ suit: 'joker', value: 'big' });
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

  var btn = document.getElementById('startGameBtn');
  btn.disabled = true;
  btn.textContent = '准备中...';

  try {
    // 检查玩家数量
    var onlinePlayers = players.filter(function(p) { return p.is_online; });
    if (onlinePlayers.length < 2) {
      showToast('至少需要2名玩家才能开始', true);
      btn.disabled = false;
      btn.textContent = '开始游戏';
      return;
    }

    // 构建已排序的座位号顺序
    var turnOrder = onlinePlayers
      .map(function(p) { return p.seat_number; })
      .sort(function(a, b) { return a - b; });

    // 洗牌
    var deck = shuffleDeck(buildDeck());

    // 创建游戏状态
    var gsRes = await supabase
      .from('game_state')
      .insert({
        room_id: roomId,
        current_turn: turnOrder[0],
        card_pile: deck,
        current_index: 0,
        drawn_cards: [],
        status: 'playing',
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

    // 更新房间状态为 'playing'
    var updateRes = await supabase
      .from('rooms')
      .update({ status: 'playing', updated_at: new Date().toISOString() })
      .eq('id', roomId);

    if (updateRes.error) throw updateRes.error;

    // 给 Realtime 一点传播时间后跳转
    setTimeout(function() {
      window.location.href = 'game.html?room=' + roomCode;
    }, 500);

  } catch (err) {
    console.error('startGame error:', err);
    showToast('开始失败：' + (err.message || '未知错误'), true);
    btn.disabled = false;
    btn.textContent = '开始游戏';
  }
}

// beforeunload - 标记离线
window.addEventListener('beforeunload', function() {
  if (roomId && currentPlayerUuid) {
    // 使用 sendBeacon 更可靠
    var payload = JSON.stringify({
      is_online: false,
      updated_at: new Date().toISOString()
    });
    var url = SUPABASE_CONFIG.url + '/rest/v1/players?room_id=eq.' + roomId + '&player_uuid=eq.' + currentPlayerUuid;
    try {
      navigator.sendBeacon(url, payload);
    } catch (e) { /* ignore */ }
  }
});

// 页面可见性变化 - 恢复在线状态
document.addEventListener('visibilitychange', function() {
  if (!document.hidden && roomId && currentPlayerUuid) {
    supabase
      .from('players')
      .update({ is_online: true, updated_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('player_uuid', currentPlayerUuid)
      .then(function() {})
      .catch(function() {});
  }
});

// =====================================================
// 启动
// =====================================================
document.addEventListener('DOMContentLoaded', init);


