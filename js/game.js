// =====================================================
// 小姐牌 - 完整游戏逻辑 [规则已按你的描述更新]
// 新增：抽牌顺序显示、游戏途中加入、观战模式
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
  'small_joker': { name:'大冒险', emoji:'🃏', desc:'抽到者完成一个大冒险挑战！🃏 指定在场一人出题，必须完成，拒绝则喝 2 杯！' },
  'big_joker':   { name:'大冒险', emoji:'🃏', desc:'超级大冒险！🃏 抽到者自选或由全场出题，完成一个高难度挑战！拒绝则喝 3 杯！' }
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
var isSpectator = false;

// ---- DOM 缓存 ----
var $ = function(id) { return document.getElementById(id); };

function showToast(msg, isErr) {
  var el = toast;
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
    var label = card.value === 'small_joker' ? '小' : '大';
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

function getPlayerByUuid(uuid) {
  for (var i = 0; i < players.length; i++) {
    if (players[i].player_uuid === uuid) return players[i];
  }
  return null;
}

// ---- 离开 ----
function exitGame() {
  if (!isSpectator && !confirm('确定退出游戏吗？')) return;
  RealtimeManager.unsubscribe();
  // 标记离线
  if (roomId && currentPlayerUuid && !isSpectator) {
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

// ---- 进入观战 ----
function joinAsSpectator() {
  window.location.href = 'spectator.html?room=' + roomCode;
}

// ---- 分享 ----
function shareGame() {
  var url = window.location.origin + '/game.html?room=' + roomCode;
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

// =====================================================
// 渲染函数
// =====================================================

// ---- 渲染抽牌顺序 ----
function renderTurnOrder(turnOrder, currentTurnIndex, drawnCards) {
  var listEl = turnOrderList;
  if (!turnOrder || !Array.isArray(turnOrder) || turnOrder.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:12px;color:rgba(255,255,255,0.3);font-size:13px;">等待游戏开始...</div>';
    return;
  }

  var html = '';
  var drawnCount = drawnCards ? drawnCards.length : 0;

  for (var i = 0; i < turnOrder.length; i++) {
    var seat = turnOrder[i];
    var player = getPlayerBySeat(seat);
    if (!player) continue;

    var isActive = (i === currentTurnIndex);
    var isSeen = (i < currentTurnIndex);
    var isMe = (player.player_uuid === currentPlayerUuid);
    
    var classes = 'turn-order-item';
    if (isActive) classes += ' active';
    if (isMe && !isActive) classes += ' is-my-turn';
    if (isSeen) classes += ' seen';
    if (!player.is_online) classes += ' offline';

    var statusText = '';
    if (isActive) statusText = '<span class="drawing-indicator">🔄 正在抽牌</span>';
    else if (!player.is_online) statusText = '<span class="offline-indicator">💤 离线</span>';

    var badges = '';
    if (isMe) badges += '<span class="badge my">我</span>';
    if (player.cards_drawn && player.cards_drawn > 0) badges += '<span class="badge cards">' + player.cards_drawn + '张</span>';
    if (player.drinks_count && player.drinks_count > 0) badges += '<span class="badge drinks">' + player.drinks_count + '杯</span>';

    html += '<div class="' + classes + '">';
    html += '  <span class="seq">' + (i + 1) + '.</span>';
    html += '  <span class="name">' + escapeHtml(player.nickname) + '</span>';
    html += '  ' + statusText;
    html += '  ' + badges;
    html += '</div>';
  }

  // 显示已在游戏中但不在 turn_order 中的玩家（等待加入）
  var inTurnSeats = {};
  for (var t = 0; t < turnOrder.length; t++) {
    inTurnSeats[turnOrder[t]] = true;
  }
  var waitingPlayers = [];
  for (var p = 0; p < players.length; p++) {
    if (!inTurnSeats[players[p].seat_number] && players[p].is_online) {
      waitingPlayers.push(players[p]);
    }
  }
  if (waitingPlayers.length > 0) {
    html += '<div class="waiting-separator">⏳ 等待加入</div>';
    for (var w = 0; w < waitingPlayers.length; w++) {
      var wp = waitingPlayers[w];
      var wMe = (wp.player_uuid === currentPlayerUuid);
      html += '<div class="turn-order-item waiting">';
      html += '  <span class="seq">-</span>';
      html += '  <span class="name">' + escapeHtml(wp.nickname) + '</span>';
      if (wMe) html += '<span class="badge my">我</span>';
      html += '  <span class="waiting-indicator">等待加入...</span>';
      html += '</div>';
    }
  }

  listEl.innerHTML = html;
}

// ---- 渲染特殊状态 ----
function renderStates(states) {
  var bar = statesBar;
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
    html += '<div class=\"state-tag\">' + cfg.emoji + ' ' + cfg.label + target + '</div>';
  }
  bar.innerHTML = html;
}

// ---- 渲染历史 ----
function renderHistory(drawn) {
  var listEl = historyList;
  var labelEl = histLabel;
  
  if (!drawn || drawn.length === 0) {
    listEl.innerHTML = '<div style=\"text-align:center;padding:12px;color:rgba(255,255,255,0.2);font-size:12px;\">暂无记录</div>';
    labelEl.textContent = '抽牌记录 (0)';
    return;
  }

  var html = '';
  for (var i = drawn.length - 1; i >= 0; i--) {
    var card = drawn[i];
    var rule = CARD_RULES[card.value] || { name: '?', emoji: '❓' };
    var disp = getCardDisplay(card);
    var cardText = disp.isJoker ? disp.symbol + disp.suit : disp.symbol + disp.suit;
    
    html += '<div class=\"history-item\">';
    html += '  <span class=\"h-seq\">' + (i + 1) + '.</span>';
    html += '  <span class=\"h-card\" style=\"color:' + disp.color + ';\">' + cardText + '</span>';
    html += '  <span class=\"h-rule\">' + rule.emoji + ' ' + rule.name + '</span>';
    html += '</div>';
  }
  
  listEl.innerHTML = html;
  labelEl.textContent = '抽牌记录 (' + drawn.length + ')';
}

// ---- 渲染游戏结束 ----
function renderEndModal(gs) {
  var modal = endModal;
  var drawn = gs.drawn_cards || [];
  var highlights = endHighlights;
  var stats = endStats;

  // 统计
  var statsHtml = '';
  for (var i = 0; i < players.length; i++) {
    var p = players[i];
    var badges = '';
    if (p.player_uuid === currentPlayerUuid) badges = ' <span style=\"color:#60a5fa;\">(我)</span>';
    statsHtml += '<div class=\"end-player\">';
    statsHtml += '  <div class=\"ep-name\">' + escapeHtml(p.nickname) + badges + '</div>';
    statsHtml += '  <div class=\"ep-stat\">';
    statsHtml += '    抽牌: <strong>' + (p.cards_drawn || 0) + '</strong> 张 | ';
    statsHtml += '    喝酒: <strong>' + (p.drinks_count || 0) + '</strong> 杯';
    statsHtml += '  </div>';
    statsHtml += '</div>';
  }
  stats.innerHTML = statsHtml;

  // 亮点
  var missSeat = gs.special_states && gs.special_states.miss;
  var missName = missSeat ? getPlayerBySeat(missSeat) : null;
  var highlightsHtml = '';
  if (missName) highlightsHtml += '<div class=\"end-hl\">👩 最终小姐: ' + escapeHtml(missName.nickname) + '</div>';
  if (drawn.length > 0) {
    var lastCard = drawn[drawn.length - 1];
    var rule = CARD_RULES[lastCard.value] || { name: '?' };
    highlightsHtml += '<div class=\"end-hl\">🃏 最后一张牌: ' + rule.emoji + ' ' + rule.name + '</div>';
  }
  highlights.innerHTML = highlightsHtml;

  modal.classList.add('show');
}

function closeEndModal() {
  endModal.classList.remove('show');
}

function playAgain() {
  closeEndModal();
  // TODO: 重新开始游戏
  showToast('功能开发中...', false);
}

// ---- 渲染所有 ----
function renderAll(gs) {
  gameState = gs;

  // 轮次
  roundNum.textContent = gs.current_index;
  totalCards.textContent = gs.card_pile ? gs.card_pile.length : 54;

  // 当前玩家
  var currentPlayer = getPlayerBySeat(gs.current_turn);
  turnPlayer.textContent = currentPlayer ? currentPlayer.nickname : '玩家 ' + gs.current_turn;

  // 判断是否轮到我
  isMyTurn = (currentPlayer && currentPlayer.player_uuid === currentPlayerUuid);
  
  // 抽牌按钮显示
  var drawBtn = document.getElementById("drawBtn");
  if (isMyTurn && !isDrawing && !isSpectator) {
    drawBtn.style.display = 'block';
    backHint.textContent = '轮到你了！点击抽牌';
  } else {
    drawBtn.style.display = 'none';
    if (isSpectator) {
      backHint.textContent = '观战模式';
    } else {
      backHint.textContent = '等待抽牌...';
    }
  }

  // 跳过按钮显示：轮到别人时显示（可跳过离线/卡住的玩家）；轮到自己时显示"跳过不抽"
  var skipBtn = document.getElementById("skipBtn");
  if (!isSpectator && currentPlayer) {
    skipBtn.style.display = 'inline-block';
  } else {
    skipBtn.style.display = 'none';
  }

  // 卡牌显示
  var drawn = gs.drawn_cards || [];
  if (drawn.length > 0) {
    var lastCard = drawn[drawn.length - 1];
    var disp = getCardDisplay(lastCard);
    var rule = CARD_RULES[lastCard.value] || { name: '?', emoji: '❓' };

    // 显示正面
    var wrapper = cardWrapper;
    wrapper.classList.add('flipped');

    var front = cardFront;
    front.style.color = disp.color;

    if (disp.isJoker) {
      cJoker.textContent = disp.symbol;
      cJoker.style.display = 'block';
      cValue.textContent = '';
      cSuit.textContent = disp.suit;
    } else {
      cJoker.style.display = 'none';
      cJoker.textContent = '';
      cValue.textContent = disp.symbol;
      cSuit.textContent = disp.suit;
    }

    // 规则
    rEmoji.textContent = rule.emoji;
    rEmoji.className = 'r-emoji show';
    rName.textContent = rule.name;
    rName.className = 'r-name show';
    rDesc.textContent = rule.desc;
    rDesc.className = 'r-desc show';
    
    // 显示抽牌者
    var drawer = getPlayerBySeat(gs.current_turn);
    cardWho.textContent = drawer ? (drawer.nickname + ' 抽了 ' + rule.name) : '';
    rWho.textContent = '由 ' + (drawer ? drawer.nickname : '玩家') + ' 抽出';
    rWho.className = 'r-who show';
  } else {
    // 还未抽牌，显示背面
    cardWrapper.classList.remove('flipped');
    rEmoji.className = 'r-emoji';
    rName.className = 'r-name';
    rDesc.className = 'r-desc';
    rWho.className = 'r-who';
  }

  // 特殊状态
  renderStates(gs.special_states);

  // 历史
  renderHistory(drawn);

  // 抽牌顺序
  renderTurnOrder(gs.turn_order, gs.current_turn_index || 0, drawn);

  // 游戏结束检测
  if (drawn.length >= 54 && gs.status === 'playing') {
    gs.status = 'finished';
    renderEndModal(gs);
  }
}

// =====================================================
// 游戏操作
// =====================================================

function onCardClick() {
  if (isMyTurn && !isDrawing) {
    drawCard();
  }
}

async function drawCard() {
  if (!isMyTurn || isDrawing) return;
  if (!gameState) return;

  isDrawing = true;
  drawBtn.disabled = true;

  try {
    var drawn = gameState.drawn_cards || [];
    var pile = gameState.card_pile || [];
    
    if (pile.length <= 0) {
      showToast('牌已抽完！', true);
      isDrawing = false;
      return;
    }

    // 抽牌
    var card = pile.shift();
    drawn.push(card);

    // 计算下一个玩家（循环轮转，防止越界）
    var turnOrder = gameState.turn_order || [];
    if (!turnOrder || turnOrder.length === 0) {
      showToast('玩家顺序数据异常', true);
      isDrawing = false;
      return;
    }
    var nextIndex = ((gameState.current_turn_index || 0) + 1) % turnOrder.length;
    var nextSeat = turnOrder[nextIndex];

    // 更新游戏状态
    var updateData = {
      card_pile: pile,
      drawn_cards: drawn,
      current_index: gameState.current_index + 1,
      current_turn: nextSeat,
      current_turn_index: nextIndex,
      updated_at: new Date().toISOString()
    };

    // 处理特殊牌
    var specialStates = gameState.special_states || {};
    if (card.value === '2') {
      specialStates.miss = gameState.current_turn;
    } else if (card.value === '10') {
      specialStates.crazy = gameState.current_turn;
    }
    updateData.special_states = specialStates;

    var res = await supabase
      .from('game_state')
      .update(updateData)
      .eq('room_id', roomId)
      .eq('current_turn_index', gameState.current_turn_index)
      .select()
      .single();

    if (res.error) throw res.error;

    // 更新玩家抽牌计数
    var me = getPlayerByUuid(currentPlayerUuid);
    if (me) {
      await supabase
        .from('players')
        .update({ 
          cards_drawn: (me.cards_drawn || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', me.id);
    }

    // 根据牌面处理喝酒逻辑
    await handleCardEffect(card);

  } catch (err) {
    console.error('drawCard error:', err);
    showToast('抽牌失败：' + (err.message || '未知错误'), true);
  } finally {
    isDrawing = false;
    drawBtn.disabled = false;
  }
}

async function handleCardEffect(card) {
  var rule = CARD_RULES[card.value];
  if (!rule) return;

  var me = getPlayerByUuid(currentPlayerUuid);
  if (!me) return;

  try {
    switch(card.value) {
      case '9': // 自罚一杯
        await supabase
          .from('players')
          .update({ 
            drinks_count: (me.drinks_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', me.id);
        showToast('😱 自罚一杯！');
        break;
      
      case 'J': // 左边喝
        var leftSeat = getLeftSeat(me.seat_number);
        var leftPlayer = getPlayerBySeat(leftSeat);
        if (leftPlayer) {
          await supabase
            .from('players')
            .update({ 
              drinks_count: (leftPlayer.drinks_count || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', leftPlayer.id);
          showToast('👈 ' + leftPlayer.nickname + ' 喝 1 杯！');
        }
        break;
      
      case 'Q': // 右边喝
        var rightSeat = getRightSeat(me.seat_number);
        var rightPlayer = getPlayerBySeat(rightSeat);
        if (rightPlayer) {
          await supabase
            .from('players')
            .update({ 
              drinks_count: (rightPlayer.drinks_count || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', rightPlayer.id);
          showToast('👉 ' + rightPlayer.nickname + ' 喝 1 杯！');
        }
        break;
      
      case 'K': // 自定规矩 - 自罚
        await supabase
          .from('players')
          .update({ 
            drinks_count: (me.drinks_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', me.id);
        showToast('📜 自罚一杯并定规矩！');
        break;
      
      case 'small_joker': // 小王 = 大冒险
        showToast('🃏 大冒险！完成挑战，拒绝喝 2 杯');
        break;
      
      case 'big_joker': // 大王 = 大冒险
        showToast('🃏 超级大冒险！完成挑战，拒绝喝 3 杯');
        break;
    }
  } catch (err) {
    console.error('handleCardEffect error:', err);
  }
}

function getLeftSeat(seat) {
  if (gameState && gameState.turn_order && gameState.turn_order.length > 0) {
    var order = gameState.turn_order;
    var idx = order.indexOf(seat);
    if (idx >= 0) return idx < order.length - 1 ? order[idx + 1] : order[0];
  }
  // fallback: 按玩家座位号排序
  if (!players || players.length === 0) return seat;
  var sortedSeats = players.map(function(p) { return p.seat_number; }).sort(function(a, b) { return a - b; });
  var idx = sortedSeats.indexOf(seat);
  return idx >= 0 && idx < sortedSeats.length - 1 ? sortedSeats[idx + 1] : sortedSeats[0];
}

function getRightSeat(seat) {
  if (gameState && gameState.turn_order && gameState.turn_order.length > 0) {
    var order = gameState.turn_order;
    var idx = order.indexOf(seat);
    if (idx >= 0) return idx > 0 ? order[idx - 1] : order[order.length - 1];
  }
  // fallback: 按玩家座位号排序
  if (!players || players.length === 0) return seat;
  var sortedSeats = players.map(function(p) { return p.seat_number; }).sort(function(a, b) { return a - b; });
  var idx = sortedSeats.indexOf(seat);
  return idx > 0 ? sortedSeats[idx - 1] : sortedSeats[sortedSeats.length - 1];
}

async function skipTurn() {
  if (!gameState || isDrawing) return;
  
  try {
    var turnOrder = gameState.turn_order || [];
    if (!turnOrder || turnOrder.length === 0) {
      showToast('玩家顺序数据异常', true);
      return;
    }
    var nextIndex = ((gameState.current_turn_index || 0) + 1) % turnOrder.length;
    var nextSeat = turnOrder[nextIndex];

    var res = await supabase
      .from('game_state')
      .update({
        current_turn: nextSeat,
        current_turn_index: nextIndex,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('current_turn_index', gameState.current_turn_index)
      .select()
      .single();

    if (res.error) throw res.error;

    var skippedSeat = gameState.current_turn;
    var skippedPlayer = getPlayerBySeat(skippedSeat);
    var skippedName = skippedPlayer ? skippedPlayer.nickname : ('玩家 ' + skippedSeat);
    showToast('⏭️ 已跳过 ' + skippedName, false);
  } catch (err) {
    console.error('skipTurn error:', err);
    if (err && err.code === 'PGRST116') {
      showToast('已有其他人跳过了，稍等', false);
    } else {
      showToast('跳过失败', true);
    }
  }
}

// ---- 切换历史 ----
function toggleHistory() {
  var list = historyList;
  var label = histLabel;
  historyOpen = !historyOpen;
  if (historyOpen) {
    list.classList.add('open');
    label.textContent = '收起记录';
  } else {
    list.classList.remove('open');
    label.textContent = '抽牌记录';
  }
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
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

  gRoomCode.textContent = roomCode;
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
            // 不是玩家，进入观战模式
            isSpectator = true;
            showToast('你将以观战模式观看', false);
          }
        } else {
          // 不是玩家，进入观战模式
          isSpectator = true;
          showToast('你将以观战模式观看', false);
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
      
      // 如果是观战模式，显示观战入口
      if (isSpectator) {
        joinGameBtn.style.display = 'inline-block';
        joinGameBtn.textContent = '👁️ 进入观战';
      }
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
