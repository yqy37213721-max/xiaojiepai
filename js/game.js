// =====================================================
// 小姐牌 - 完整游戏逻辑 [规则已按你的描述更新]
// =====================================================

// ---- 卡牌规则表 ----
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
var currentPlayerUuid = null;
var mySeat = null;
var myNickname = '';
var players = [];
var gameState = null;
var isMyTurn = false;
var isDrawing = false;
var historyOpen = false;

// ---- DOM 缓存 ----
var $ = function(id) { return document.getElementById(id); };

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

function getPlayerUuid() {
  var u = localStorage.getItem('player_uuid');
  if (!u) { u = crypto.randomUUID(); localStorage.setItem('player_uuid', u); }
  return u;
}

function getStoredNickname() {
  return localStorage.getItem('nickname') || '';
}

// ---- 卡牌显示辅助 ----
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

function getCardRule(card) {
  return CARD_RULES[card.value] || { name:'?', emoji:'❓', desc:'未知牌' };
}

function getCardSortWeight(value) {
  var order = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  var idx = order.indexOf(value);
  return idx >= 0 ? idx : 99;
}

function getPlayerBySeat(seat) {
  for (var i = 0; i < players.length; i++) {
    if (players[i].seat_number === seat) return players[i];
  }
  return null;
}

// ---- 离开 ----
function exitGame() {
  if (!confirm('确定退出游戏吗？')) return;
  RealtimeManager.unsubscribe();
  // 标记离线
  if (roomId && currentPlayerUuid) {
    supabase
      .from('players')
      .update({ is_online: false, updated_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('player_uuid', currentPlayerUuid)
      .then(function() {})
      .catch(function() {});
  }
  window.location.href = 'index.html';
}

function toggleHistory() {
  historyOpen = !historyOpen;
  var el = $('historyList');
  el.className = 'history-list' + (historyOpen ? ' open' : '');
}

// =====================================================
// 更新特殊状态
// =====================================================
function computeSpecialStates(prev, card, seatNum) {
  var s = {};
  s.miss = prev && prev.miss ? prev.miss : null;
  s.camera = prev ? !!prev.camera : false;
  s.crazy = prev && prev.crazy ? prev.crazy : null;
  s.toilet = prev && prev.toilet ? prev.toilet : null;

  switch (card.value) {
    case '2':
      s.miss = seatNum;
      break;
    case '5':
      s.camera = true;
      break;
    case '10':
      s.crazy = seatNum;
      break;
    case '8':
      s.toilet = seatNum;
      break;
  }
  return s;
}

// =====================================================
// 渲染完整 UI
// =====================================================
function renderAll(gs) {
  if (!gs) return;
  gameState = gs;

  // 轮次
  var total = (gs.card_pile || []).length;
  $('roundNum').textContent = gs.current_index;
  $('totalCards').textContent = total;

  // 当前轮到谁
  var curSeat = gs.current_turn;
  var curPlayer = getPlayerBySeat(curSeat);
  var curName = curPlayer ? curPlayer.nickname : ('#' + curSeat);
  isMyTurn = (curSeat === mySeat);

  var ti = $('turnIndicator');
  if (isMyTurn) {
    ti.innerHTML = '🎯 轮到你了，<strong class="is-me">' + curName + '</strong>';
  } else {
    ti.innerHTML = '⏳ 轮到: <strong>' + curName + '</strong>';
  }

  // 跳过按钮（玩家离线时显示）
  var skipBtn = document.getElementById('skipBtn');
  if (!isMyTurn && curPlayer && !curPlayer.is_online && gs.current_index < total) {
    skipBtn.style.display = 'flex';
    skipBtn.textContent = '⏭️ 跳过 ' + curName + '（离线）';
  } else {
    skipBtn.style.display = 'none';
  }

  // 抽牌按钮
  var btn = $('drawBtn');
  if (isMyTurn && gs.current_index < total) {
    btn.style.display = 'flex';
    btn.disabled = false;
    btn.textContent = '抽牌 🃏';
  } else {
    btn.style.display = 'none';
  }

  // 如果已抽过牌，显示最后一张
  var drawn = gs.drawn_cards || [];
  if (drawn.length > 0) {
    var last = drawn[drawn.length - 1];
    showCard(last.card, last.seat_number);
  } else {
    resetCardDisplay();
  }

  // 特殊状态
  renderStates(gs.special_states);

  // 历史
  renderHistory(drawn);

  // 牌堆耗尽或游戏结束
  if ((gs.current_index >= total && total > 0) || gs.status === 'finished') {
    if (!window._gameEndShown) {
      window._gameEndShown = true;
      $('drawBtn').style.display = 'none';
      $('turnIndicator').innerHTML = '🎉 游戏结束！';
      // 更新房间状态（牌抽完了自动结算）
      if (gs.current_index >= total && total > 0 && gs.status !== 'finished') {
        supabase.from('rooms').update({ status:'finished', updated_at:new Date().toISOString() }).eq('id', roomId).then(function(){}).catch(function(){});
      }
      showEndScreen(gs);
    }
  } else {
    window._gameEndShown = false;
  }
}

function resetCardDisplay() {
  var w = $('cardWrapper');
  w.className = 'card-wrapper';
  $('backHint').textContent = '等待抽牌...';
  $('rEmoji').className = 'r-emoji';
  $('rName').className = 'r-name';
  $('rDesc').className = 'r-desc';
  $('rWho').className = 'r-who';
}

function showCard(card, seatNum) {
  var disp = getCardDisplay(card);
  var rule = getCardRule(card);
  var player = getPlayerBySeat(seatNum);
  var playerName = player ? player.nickname : '#' + seatNum;

  // 正面填充
  if (disp.isJoker) {
    $('cJoker').textContent = disp.suit;
    $('cJoker').style.display = 'block';
    $('cValue').style.display = 'none';
    $('cSuit').style.display = 'none';
  } else {
    $('cJoker').style.display = 'none';
    $('cValue').style.display = 'block';
    $('cSuit').style.display = 'block';
    $('cValue').textContent = disp.symbol;
    $('cValue').style.color = disp.color;
    $('cSuit').textContent = disp.suit;
    $('cSuit').style.color = disp.color;
  }
  $('cardWho').textContent = playerName + ' 抽到';

  // 翻转
  var w = $('cardWrapper');
  w.className = 'card-wrapper flipped';

  // 规则
  $('rEmoji').textContent = rule.emoji;
  $('rEmoji').className = 'r-emoji show';
  $('rName').textContent = rule.name;
  $('rName').className = 'r-name show';
  $('rDesc').textContent = rule.desc;
  $('rDesc').className = 'r-desc show';

  // 补充说明：左右喝时显示谁
  var extra = '';
  if (card.value === 'J' || card.value === 'j') {
    var leftSeat = getLeftPlayer(seatNum);
    var leftP = getPlayerBySeat(leftSeat);
    extra = '👈 左边: ' + (leftP ? leftP.nickname : '#' + leftSeat) + ' 喝 1 杯！';
  } else if (card.value === 'Q' || card.value === 'q') {
    var rightSeat = getRightPlayer(seatNum);
    var rightP = getPlayerBySeat(rightSeat);
    extra = '👉 右边: ' + (rightP ? rightP.nickname : '#' + rightSeat) + ' 喝 1 杯！';
  } else if (card.value === '9') {
    extra = '🍺 ' + playerName + ' 自罚 1 杯！';
  } else if (card.value === 'A') {
    extra = '👑 ' + playerName + ' 获得命令牌，指定任意一人喝 1 杯！';
  } else if (card.value === '2') {
    extra = '👩 ' + playerName + ' 现在是小姐！谁喝酒都可喊她陪喝！';
  } else if (card.value === '10') {
    extra = '🤪 ' + playerName + ' 现在是神经病！谁跟他说话谁喝酒！';
  }

  if (extra) {
    $('rWho').textContent = extra;
    $('rWho').className = 'r-who show';
  } else {
    $('rWho').className = 'r-who';
  }
}

function getLeftPlayer(seat) {
  var seats = (gameState.turn_order || []).slice();
  var idx = seats.indexOf(seat);
  if (idx <= 0) return seats[seats.length - 1];
  return seats[idx - 1];
}

function getRightPlayer(seat) {
  var seats = (gameState.turn_order || []).slice();
  var idx = seats.indexOf(seat);
  if (idx >= seats.length - 1) return seats[0];
  return seats[idx + 1];
}

// ---- 特殊状态渲染 ----
function renderStates(ss) {
  var bar = $('statesBar');
  if (!ss) { bar.innerHTML = ''; return; }
  var tags = [];

  if (ss.miss != null) {
    var p = getPlayerBySeat(ss.miss);
    tags.push('<span class="state-tag"><span class="emoji">👩</span> 小姐: ' + (p ? p.nickname : '#' + ss.miss) + '</span>');
  }
  if (ss.camera) {
    tags.push('<span class="state-tag"><span class="emoji">📸</span> 照相机生效中</span>');
  }
  if (ss.crazy != null) {
    var p = getPlayerBySeat(ss.crazy);
    tags.push('<span class="state-tag"><span class="emoji">🤪</span> 神经病: ' + (p ? p.nickname : '#' + ss.crazy) + '</span>');
  }
  if (ss.toilet != null) {
    var p = getPlayerBySeat(ss.toilet);
    tags.push('<span class="state-tag"><span class="emoji">🚽</span> 厕所: ' + (p ? p.nickname : '#' + ss.toilet) + '</span>');
  }

  bar.innerHTML = tags.join('');
}

// ---- 历史渲染 ----
function renderHistory(drawn) {
  var el = $('historyList');
  if (!drawn || drawn.length === 0) {
    el.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.2);padding:8px;">暂无记录</div>';
    return;
  }

  $('histLabel').textContent = '抽牌记录 (' + drawn.length + ')';

  var html = '';
  // 显示最近20条
  var items = drawn.slice(-20);
  for (var i = 0; i < items.length; i++) {
    var d = items[i];
    var p = getPlayerBySeat(d.seat_number);
    var cardDisp = d.card.suit === 'joker'
      ? (d.card.value === 'small' ? '🃏小' : '🃏大')
      : (SUIT_SYMBOLS[d.card.suit] || '') + d.card.value;
    var name = p ? p.nickname : '#' + d.seat_number;
    html += '<div class="history-item">'
      + '<span class="hs">' + name + '</span>'
      + ' 抽到 '
      + '<span class="hn">' + cardDisp + '</span>'
      + ' · ' + (d.rule_name || '')
      + '</div>';
  }

  if (drawn.length > 20) {
    html += '<div style="font-size:11px;color:rgba(255,255,255,0.15);padding:4px 8px;">仅显示最近20条</div>';
  }

  el.innerHTML = html;
}

// =====================================================
// 抽牌
// =====================================================
async function drawCard() {
  if (isDrawing) return;
  if (!isMyTurn) return;

  var btn = $('drawBtn');
  btn.disabled = true;
  btn.textContent = '抽牌中...';
  isDrawing = true;

  try {
    // 1. 读取当前状态
    var res = await supabase
      .from('game_state')
      .select('*')
      .eq('room_id', roomId)
      .single();

    if (res.error) throw res.error;
    var gs = res.data;

    // 2. 二次验证
    if (gs.current_turn !== mySeat) {
      showToast('还没轮到您', true);
      isDrawing = false;
      btn.style.display = 'none';
      return;
    }

    var deck = gs.card_pile || [];
    var idx = gs.current_index;
    if (idx >= deck.length) {
      showToast('牌已抽完', true);
      isDrawing = false;
      btn.style.display = 'none';
      return;
    }

    var card = deck[idx];
    var rule = getCardRule(card);

    // 3. 计算下一状态
    var newSpecial = computeSpecialStates(gs.special_states, card, mySeat);
    var turnOrder = gs.turn_order || [];
    var ti = (gs.current_turn_index || 0);
    var nextTi = (ti + 1) % turnOrder.length;
    var nextTurn = turnOrder[nextTi];

    var drawnEntry = {
      seat_number: mySeat,
      card: card,
      rule_name: rule.name,
      rule_emoji: rule.emoji,
      drawn_at: new Date().toISOString()
    };

    var newDrawn = (gs.drawn_cards || []).slice();
    newDrawn.push(drawnEntry);

    // 4. 乐观锁更新
    var updateRes = await supabase
      .from('game_state')
      .update({
        current_index: idx + 1,
        current_turn: nextTurn,
        current_turn_index: nextTi,
        drawn_cards: newDrawn,
        special_states: newSpecial,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('current_index', idx)
      .select();

    if (!updateRes.data || updateRes.data.length === 0) {
      showToast('状态已变更，请重试', true);
      btn.disabled = false;
      btn.textContent = '抽牌 🃏';
      isDrawing = false;
      return;
    }

    // 本地立即更新（加速响应）
    renderAll(updateRes.data[0]);

  } catch (err) {
    console.error('drawCard error:', err);
    showToast('抽牌失败：' + (err.message || '未知错误'), true);
    btn.disabled = false;
    btn.textContent = '抽牌 🃏';
  }

  isDrawing = false;
}


// =====================================================
// 跳过离线玩家的回合
// =====================================================
async function skipTurn() {
  if (!gameState) return;
  var gs = gameState;
  var turnOrder = gs.turn_order || [];
  if (turnOrder.length < 2) return;
  
  var ti = (gs.current_turn_index || 0);
  var nextTi = (ti + 1) % turnOrder.length;
  var nextTurn = turnOrder[nextTi];
  
  // 确认跳过
  var curPlayer = getPlayerBySeat(gs.current_turn);
  var curName = curPlayer ? curPlayer.nickname : '#' + gs.current_turn;
  if (!confirm('跳过 ' + curName + ' 的回合？')) return;
  
  try {
    var res = await supabase
      .from('game_state')
      .update({
        current_turn: nextTurn,
        current_turn_index: nextTi,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('current_turn_index', ti)
      .select();
    
    if (res.data && res.data[0]) {
      showToast('⏭️ 已跳过 ' + curName + '，轮到下一位', false);
      document.getElementById('skipBtn').style.display = 'none';
    } else {
      showToast('状态已变更，请刷新重试', true);
    }
  } catch(err) {
    console.error('skipTurn error:', err);
    showToast('跳过失败：' + (err.message || '未知错误'), true);
  }
}

// 点击卡牌背面 = 抽牌
function onCardClick() {
  if (isMyTurn) drawCard();
}

// =====================================================
// 分享房间链接
// =====================================================
function shareGame() {
  var url = window.location.href;
  if (navigator.share) {
    navigator.share({
      title: '小姐牌 - 微信群喝酒小游戏',
      text: '快来一起玩小姐牌！房间号: ' + roomCode,
      url: url
    }).catch(function(){});
  } else {
    copyToClipboard(url);
    showToast('链接已复制，发送到微信群即可邀请好友');
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(function(){
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

// =====================================================
// 游戏结束 - 结算统计
// =====================================================
function showEndScreen(gs) {
  var drawn = gs.drawn_cards || [];
  if (drawn.length === 0) return;

  // 计算每位玩家的统计数据
  var stats = {};
  var seatNames = {};
  for (var i = 0; i < players.length; i++) {
    var seat = players[i].seat_number;
    stats[seat] = { total:0, A:0, '2':0, '5':0, '8':0, '10':0, J:0, Q:0, K:0, '9':0, joker:0 };
    seatNames[seat] = players[i].nickname;
  }

  for (var i = 0; i < drawn.length; i++) {
    var d = drawn[i];
    var s = d.seat_number;
    if (!stats[s]) continue;
    stats[s].total++;
    var v = d.card.value;
    if (v === 'small_joker' || v === 'big_joker') {
      stats[s].joker++;
    } else if (stats[s][v] !== undefined) {
      stats[s][v]++;
    }
  }

  // 找到"酒王"（抽到最多9的人）
  var maxDrink = 0, drinkKing = null;
  for (var s in stats) {
    if (stats[s]['9'] > maxDrink) {
      maxDrink = stats[s]['9'];
      drinkKing = s;
    }
  }

  // 找到抽最多牌的人
  var maxDraw = 0, drawKing = null;
  for (var s in stats) {
    if (stats[s].total > maxDraw) {
      maxDraw = stats[s].total;
      drawKing = s;
    }
  }

  var order = gs.turn_order || [];
  var html = '<div class="end-overlay" id="endOverlay">';
  html += '<div class="end-box">';
  html += '<div class="end-close" onclick="closeEndScreen()">✕</div>';
  html += '<div class="end-title">🎉 游戏结束 🎉</div>';
  html += '<div class="end-sub">共 ' + drawn.length + ' 轮</div>';

  // 趣味称号
  var titles = [];
  if (drinkKing != null) {
    var dkName = (getPlayerBySeat(parseInt(drinkKing)) || {}).nickname || '#' + drinkKing;
    titles.push('🍺 酒王: ' + dkName + ' (喝了' + maxDrink + '杯)');
  }
  if (drawKing != null) {
    var dkName2 = (getPlayerBySeat(parseInt(drawKing)) || {}).nickname || '#' + drawKing;
    titles.push('🃏 手气最佳: ' + dkName2 + ' (抽了' + maxDraw + '张)');
  }

  html += '<div class="end-highlights">';
  for (var t = 0; t < titles.length; t++) {
    html += '<div class="end-hl">' + titles[t] + '</div>';
  }
  html += '</div>';

  // 各玩家详情
  html += '<div class="end-stats">';
  for (var i = 0; i < order.length; i++) {
    var seat = order[i];
    var p = getPlayerBySeat(seat);
    var s = stats[seat] || { total:0 };
    var name = p ? p.nickname : '#' + seat;
    html += '<div class="end-player">';
    html += '<div class="ep-name">' + name + '</div>';
    html += '<div class="ep-stat">抽了 <strong>' + s.total + '</strong> 张牌';
    if (s.A > 0) html += ' · 👑命令牌×' + s.A;
    if (s['2'] > 0) html += ' · 👩小姐牌×' + s['2'];
    if (s['5'] > 0) html += ' · 📸相机×' + s['5'];
    if (s['8'] > 0) html += ' · 🚽厕所×' + s['8'];
    if (s['10'] > 0) html += ' · 🤪神经×' + s['10'];
    if (s['9'] > 0) html += ' · 🍺喝×' + s['9'];
    if (s.joker > 0) html += ' · 🃏王×' + s.joker;
    if (s.J > 0 || s.Q > 0 || s.K > 0) html += ' · 指人' + (s.J + s.Q + s.K) + '次';
    html += '</div></div>';
  }
  html += '</div>';

  // 按钮
  html += '<div class="end-actions">';
  if (isHost) {
    html += '<button class="btn btn-primary" onclick="playAgain()">再来一局 🎮</button>';
  }
  html += '<button class="btn btn-secondary" onclick="closeEndScreen();exitGame();">返回大厅</button>';
  html += '</div>';

  html += '</div></div>';

  var div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div.firstElementChild);
}

function closeEndScreen() {
  var el = document.getElementById('endOverlay');
  if (el) el.remove();
}

// =====================================================
// 再来一局（仅房主）
// =====================================================
async function playAgain() {
  if (!isHost) return;
  if (!confirm('确定重新开始一局吗？所有玩家将同步重置！')) return;

  try {
    // 重新洗牌
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

    // Fisher-Yates 洗牌
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }

    var turnOrder = (gameState.turn_order || []).slice();

    // 重置游戏状态
    var resetRes = await supabase
      .from('game_state')
      .update({
        card_pile: deck,
        current_index: 0,
        current_turn: turnOrder[0],
        current_turn_index: 0,
        drawn_cards: [],
        special_states: {
          miss: null,
          camera: false,
          crazy: null,
          toilet: null
        },
        status: 'playing',
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .select();

    if (resetRes.error) throw resetRes.error;

    closeEndScreen();
    window._gameEndShown = false;

    if (resetRes.data && resetRes.data[0]) {
      renderAll(resetRes.data[0]);
    }

    showToast('新的一局开始了！');

  } catch (err) {
    console.error('playAgain error:', err);
    showToast('重开失败：' + (err.message || '未知错误'), true);
  }
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

  $('gRoomCode').textContent = roomCode;
  currentPlayerUuid = getPlayerUuid();
  myNickname = getStoredNickname();

  try {
    // 加载房间
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
    roomId = roomRes.data.id;

    // 加载玩家列表
    var plRes = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('seat_number', { ascending: true });
    if (plRes.data) players = plRes.data;

    // 找到我的座位
    for (var i = 0; i < players.length; i++) {
      if (players[i].player_uuid === currentPlayerUuid) {
        mySeat = players[i].seat_number;
        myNickname = players[i].nickname;
        break;
      }
    }

    if (!mySeat) {
      // 离线状态，但先检查房间是否在游戏中
      // 可能是在页面刷新后重新加入
      var meRes = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .eq('player_uuid', currentPlayerUuid)
        .maybeSingle();
      if (meRes.data) {
        mySeat = meRes.data.seat_number;
        myNickname = meRes.data.nickname;
      } else {
        // 用昵称尝试找回身份（适用于 localStorage 被清、换设备等情况）
        var storedNickname = getStoredNickname();
        if (storedNickname) {
          var byNickRes = await supabase
            .from('players')
            .select('*')
            .eq('room_id', roomId)
            .eq('nickname', storedNickname)
            .maybeSingle();
          if (byNickRes.data) {
            // 找到旧身份，更新 UUID 重新加入
            await supabase
              .from('players')
              .update({ player_uuid: currentPlayerUuid, is_online: true, updated_at: new Date().toISOString() })
              .eq('id', byNickRes.data.id);
            mySeat = byNickRes.data.seat_number;
            myNickname = byNickRes.data.nickname;
            // 刷新玩家列表
            var plRef = await supabase.from('players').select('*').eq('room_id', roomId);
            if (plRef.data) players = plRef.data;
            showToast('已重新加入游戏！', false);
          } else {
            showToast('你不是本房间的玩家', true);
            setTimeout(function() { window.location.href = 'index.html'; }, 1500);
            return;
          }
        } else {
          showToast('你不是本房间的玩家', true);
          setTimeout(function() { window.location.href = 'index.html'; }, 1500);
          return;
        }
      }
    }

    // 加载游戏状态
    var gsRes = await supabase
      .from('game_state')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();
    if (gsRes.error) throw gsRes.error;

    // 显示页面
    document.getElementById('loadingPage').style.display = 'none';
    document.getElementById('gamePage').style.display = 'flex';

    if (gsRes.data) {
      renderAll(gsRes.data);
    } else {
      showToast('游戏尚未开始', true);
      setTimeout(function() { window.location.href = 'room.html?room=' + roomCode; }, 1500);
      return;
    }

    // 订阅实时
    RealtimeManager.subscribeRoom(roomId, roomCode, {
      onPlayerChange: function(payload) {
        // 玩家变更时刷新列表
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
      },
      onGameStateChange: function(payload) {
        // 游戏状态变更 → 更新 UI
        if (payload.new) renderAll(payload.new);
      },
      onError: function(err) {
        if (err) showToast(err, true);
      }
    });

  } catch (err) {
    console.error('init error:', err);
    showToast('加载失败：' + (err.message || '未知错误'), true);
  }
}

document.addEventListener('DOMContentLoaded', init);

