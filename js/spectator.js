// =====================================================
// 小姐牌 - 观战模式 [只读，不操作游戏]
// =====================================================

// ---- 卡牌规则表（与 game.js 一致） ----
var CARD_RULES = {
  'A':    { name:'命令牌',   emoji:'👑', desc:'抽到者指定任意一人喝 1 杯！👑 权力之牌，你说了算！' },
  '2':    { name:'小姐牌',   emoji:'👩', desc:'抽到者成为"小姐"👩，之后每次有人喝酒，都可喊"小姐陪我喝！"，小姐必须陪喝 1 杯。直到下一张 2 出现替换新小姐。' },
  '3':    { name:'逛三园',   emoji:'🌳', desc:'抽牌者说"星期天，逛三园，什么园？"选（动物园/植物园/果园），轮流说该园内事物，卡住或重复者罚酒🍺。' },
  '4':    { name:'摸鼻子',   emoji:'👃', desc:'抽牌者随时可以摸自己鼻子👃，其他人看到必须立刻跟着摸。最后摸到鼻子的人喝酒🍺！' },
  '5':    { name:'照相机',   emoji:'📸', desc:'抽牌者获得"照相机"📸，可随时喊"咔嚓"所有人必须定格，先动的人喝酒🍺！持续到下一张 5 出现。' },
  '6':    { name:'柳树扭一扭', emoji:'🌿', desc:'抽牌者说"柳树扭一扭，扭到 X！"然后轮流说"扭一扭"，到第 X 次说错的人罚酒🍺！' },
  '7':    { name:'逢七过',   emoji:'7️⃣', desc:'从抽牌者开始顺时针报数，逢 7 和 7 的倍数要说"过"🙅，说错或卡住的人罚酒🍺！' },
  '8':    { name:'厕所牌',   emoji:'🚽', desc:'抽到者获得"如厕许可证"🚽，只有持 8 者可以去厕所！没牌去厕所罚酒🍺！' },
  '9':    { name:'自罚一杯', emoji:'🍺', desc:'抽牌者自己喝 1 杯！🍺 站起来举杯说"我干了！"没站起来再罚 1 杯！' },
  '10':   { name:'神经病',   emoji:'🤪', desc:'抽到者成为"神经病"🤪，此后任何人不能理他！谁跟他说话谁喝酒🍺！直到下一张 10 替换。' },
  'J':    { name:'左边喝',   emoji:'👈', desc:'抽牌者左边的人喝 1 杯！🍺' },
  'Q':    { name:'右边喝',   emoji:'👉', desc:'抽牌者右边的人喝 1 杯！🍺' },
  'K':    { name:'自定规矩', emoji:'📜', desc:'抽牌者自己喝 1 杯🍺，并为游戏定一条新规矩！全场必须遵守！' },
  'small_joker': { name:'小王', emoji:'🃏', desc:'小王驾到！指定任意一人喝 1 杯！🍺' },
  'big_joker':   { name:'大王', emoji:'🃏', desc:'大王驾到！指定任意一人喝 2 杯！！🍺🍺' }
};

var SUIT_SYMBOLS = { spade:'♠', heart:'♥', diamond:'♦', club:'♣' };
var SUIT_COLORS  = { spade:'#1a1a2e', heart:'#ef4444', diamond:'#ef4444', club:'#1a1a2e', joker:'#8b5cf6' };

// ---- 状态变量 ----
var roomCode = null;
var roomId = null;
var players = [];
var gameState = null;
var historyOpen = false;

// ---- DOM 缓存 ----
function $(id) { return document.getElementById(id); }

function showToast(msg, isErr) {
  var el = $('toast');
  el.textContent = msg;
  el.className = 'toast show' + (isErr ? ' error' : '');
  clearTimeout(el._timer);
  el._timer = setTimeout(function() { el.className = 'toast'; }, 2000);
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function getPlayerBySeat(seat) {
  for (var i = 0; i < players.length; i++) {
    if (players[i].seat_number === seat) return players[i];
  }
  return null;
}

// ---- 卡牌显示 ----
function getCardDisplay(card) {
  if (card.suit === 'joker') {
    var label = card.value === 'small' ? '小' : '大';
    return { symbol: label, suit: '🃏', color: '#8b5cf6', isJoker: true };
  }
  return {
    symbol: card.value,
    suit: SUIT_SYMBOLS[card.suit] || '?',
    color: SUIT_COLORS[card.suit] || '#fff',
    isJoker: false
  };
}

// ---- 返回上一页 ----
function goBack() {
  if (document.referrer && document.referrer.indexOf(window.location.origin) === 0) {
    window.history.back();
  } else {
    window.location.href = 'index.html';
  }
}

// ---- 切换历史 ----
function toggleHistory() {
  var list = $('historyList');
  var label = $('histLabel');
  historyOpen = !historyOpen;
  if (historyOpen) {
    list.classList.add('open');
    label.textContent = '收起记录';
  } else {
    list.classList.remove('open');
    label.textContent = '抽牌记录';
  }
}

// ---- 渲染特殊状态 ----
function renderStates(states) {
  var bar = $('statesBar');
  if (!states || !Object.keys(states).length) {
    bar.innerHTML = '';
    return;
  }
  var html = '';
  var stateLabels = {
    miss: { emoji: '👩', label: '小姐: ' },
    camera: { emoji: '📸', label: '照相机活跃' },
    crazy: { emoji: '🤪', label: '神经病: ' },
    toilet: { emoji: '🚽', label: '厕所许可证' }
  };
  for (var key in states) {
    if (states[key] === null || states[key] === false) continue;
    var cfg = stateLabels[key];
    if (!cfg) continue;
    var target = '';
    if (typeof states[key] === 'number') {
      var p = getPlayerBySeat(states[key]);
      target = p ? p.nickname : '玩家';
    } else {
      target = '活跃';
    }
    html += '<div class="state-tag">' + cfg.emoji + ' ' + cfg.label + target + '</div>';
  }
  bar.innerHTML = html;
}

// ---- 渲染历史 ----
function renderHistory(drawn) {
  var list = $('historyList');
  if (!drawn || drawn.length === 0) {
    list.innerHTML = '<div class="history-item" style="color:rgba(255,255,255,0.2);">暂无抽牌记录</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < drawn.length; i++) {
    var c = drawn[i];
    var rule = CARD_RULES[c.value] || { name: '?', emoji: '❓' };
    var by = '';
    if (c.drawn_by) {
      var p = getPlayerBySeat(c.drawn_by);
      by = p ? p.nickname : '玩家 ' + c.drawn_by;
    }
    var suitDisp = c.suit === 'joker' ? '🃏' : (SUIT_SYMBOLS[c.suit] || '?');
    html += '<div class="history-item">'
      + '<span class="h-seq">#' + (i + 1) + '</span>'
      + '<span class="h-card">' + suitDisp + c.value + '</span>'
      + '<span class="h-rule">' + rule.emoji + rule.name + '</span>'
      + (by ? '<span class="h-by">by ' + by + '</span>' : '')
      + '</div>';
  }
  list.innerHTML = html;
}

// ---- 渲染玩家列表（显示在线状态、座位号） ----
function renderPlayerList() {
  var container = $('playerList');
  if (!container) return;
  if (!players || players.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无玩家</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < players.length; i++) {
    var p = players[i];
    var online = p.is_online !== false;
    html += '<div class="spectator-player-tag">'
      + '<span class="seat">#' + p.seat_number + '</span>'
      + '<span class="' + (online ? 'online-dot' : 'offline-dot') + '"></span>'
      + p.nickname
      + '</div>';
  }
  container.innerHTML = html;
}

// ---- 渲染抽牌顺序（观战者也能看到排序） ----
function renderTurnOrder(gs) {
  var container = $('turnOrderList');
  if (!container) {
    var indicator = $('turnIndicator');
    if (!indicator) return;
    container = document.createElement('div');
    container.id = 'turnOrderList';
    container.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:8px 0 0;';
    indicator.appendChild(container);
  }
  if (!gs || !gs.turn_order || gs.turn_order.length === 0) {
    container.innerHTML = '<span style="color:rgba(255,255,255,0.2);font-size:12px;">等待游戏开始...</span>';
    return;
  }
  var order = gs.turn_order;
  var highlightSeat = gs.current_turn;
  var html = '';
  for (var i = 0; i < order.length; i++) {
    var seat = order[i];
    var p = getPlayerBySeat(seat);
    var name = p ? p.nickname : '玩家 ' + seat;
    var isCurrent = (seat === highlightSeat);
    html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:8px;font-size:12px;'
      + (isCurrent
        ? 'background:rgba(167,139,250,0.2);border:1px solid rgba(167,139,250,0.3);color:#a78bfa;font-weight:600;'
        : 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.4);')
      + '">'
      + (isCurrent ? '▶ ' : '') + name + '</span>';
  }
  container.innerHTML = html;
}

// ---- 渲染游戏状态 ----
function renderAll(gs) {
  gameState = gs;

  // 轮次
  $('roundNum').textContent = gs.current_index;
  $('totalCards').textContent = gs.card_pile ? gs.card_pile.length : 54;

  // 当前玩家
  var currentPlayer = getPlayerBySeat(gs.current_turn);
  $('turnPlayer').textContent = currentPlayer ? currentPlayer.nickname : '玩家 ' + gs.current_turn;

  // 卡牌显示
  var drawn = gs.drawn_cards || [];
  if (drawn.length > 0) {
    var lastCard = drawn[drawn.length - 1];
    var disp = getCardDisplay(lastCard);
    var rule = CARD_RULES[lastCard.value] || { name: '?', emoji: '❓' };

    var wrapper = $('cardWrapper');
    wrapper.classList.add('flipped');

    var front = $('cardFront');
    front.style.color = disp.color;

    if (disp.isJoker) {
      $('cJoker').textContent = disp.symbol;
      $('cJoker').style.display = 'block';
      $('cValue').textContent = '';
      $('cSuit').textContent = disp.suit;
    } else {
      $('cJoker').style.display = 'none';
      $('cJoker').textContent = '';
      $('cValue').textContent = disp.symbol;
      $('cSuit').textContent = disp.suit;
    }

    $('rEmoji').textContent = rule.emoji;
    $('rEmoji').className = 'r-emoji show';
    $('rName').textContent = rule.name;
    $('rName').className = 'r-name show';
    $('rDesc').textContent = rule.desc;
    $('rDesc').className = 'r-desc show';
  } else {
    $('cardWrapper').classList.remove('flipped');
    $('rEmoji').className = 'r-emoji';
    $('rName').className = 'r-name';
    $('rDesc').className = 'r-desc';
  }

  // 特殊状态
  renderStates(gs.special_states);

  // 历史
  renderHistory(drawn);

  // 玩家列表
  renderPlayerList();

  // 抽牌顺序
  renderTurnOrder(gs);
}

// =====================================================
// 页面初始化
// =====================================================
async function init() {
  roomCode = getQueryParam('room');
  if (!roomCode) {
    showToast('缺少房间号', true);
    setTimeout(function() { goBack(); }, 1500);
    return;
  }

  $('gRoomCode').textContent = roomCode;

  try {
    var roomRes = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', roomCode)
      .maybeSingle();
    if (roomRes.error) throw roomRes.error;
    if (!roomRes.data) {
      showToast('房间不存在', true);
      setTimeout(function() { goBack(); }, 1500);
      return;
    }
    var room = roomRes.data;
    roomId = room.id;

    if (!room.is_spectatable) {
      showToast('该房间不允许观战', true);
      setTimeout(function() { goBack(); }, 1500);
      return;
    }

    var plRes = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('seat_number', { ascending: true });
    if (plRes.data) players = plRes.data;

    var gsRes = await supabase
      .from('game_state')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();
    if (gsRes.error) throw gsRes.error;

    document.getElementById('loadingPage').style.display = 'none';
    document.getElementById('spectatorPage').style.display = 'flex';

    if (gsRes.data) {
      renderAll(gsRes.data);
    } else {
      renderPlayerList();
      $('turnIndicator').innerHTML = '<span style="color:rgba(255,255,255,0.3);">等待房主开始游戏...</span>';
    }

    renderPlayerList();

    RealtimeManager.subscribeRoom(roomId, roomCode, {
      onPlayerChange: function(payload) {
        var ev = payload.eventType;
        var rec = payload.new;
        if (ev === 'INSERT' || ev === 'UPDATE') {
          var found = false;
          for (var i = 0; i < players.length; i++) {
            if (players[i].id === rec.id) { players[i] = rec; found = true; break; }
          }
          if (!found) players.push(rec);
        } else if (ev === 'DELETE') {
          players = players.filter(function(p) { return p.id !== payload.old.id; });
        }
        renderPlayerList();
        if (gameState) renderTurnOrder(gameState);
      },
      onGameStateChange: function(payload) {
        if (payload.new) renderAll(payload.new);
      },
      onError: function(err) {
        if (err) showToast(err, true);
      }
    });

  } catch (err) {
    console.error('spectator init error:', err);
    showToast('加载失败：' + (err.message || '未知错误'), true);
  }
}

document.addEventListener('DOMContentLoaded', init);
