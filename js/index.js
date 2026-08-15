// =====================================================
// 首页逻辑 - 创建/加入房间 + 观战入口
// =====================================================

let isProcessing = false;

// 获取存储的昵称
function getStoredNickname() {
  try {
    return localStorage.getItem('nickname') || '';
  } catch(e) { return ''; }
}

// Toast 提示
function showToast(msg, isError) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(el._timer);
  el._timer = setTimeout(function() {
    el.className = 'toast';
  }, 2000);
}

// 生成唯一房间码
async function generateRoomCode() {
  for (var attempt = 0; attempt < 50; attempt++) {
    var code = String(Math.floor(1000 + Math.random() * 9000));
    var res = await supabase
      .from('rooms')
      .select('id')
      .eq('room_code', code)
      .maybeSingle();
    if (!res.data) return code;
  }
  throw new Error('无法生成房间号，请重试');
}

// 获取或创建玩家 UUID
function getPlayerUuid() {
  var uuid = localStorage.getItem('player_uuid');
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem('player_uuid', uuid);
  }
  return uuid;
}

// 创建房间（增加 is_spectatable 字段）
async function createRoom() {
  if (isProcessing) return;
  isProcessing = true;

  var btn = document.getElementById('createRoomBtn');
  btn.disabled = true;
  btn.textContent = '创建中...';

  try {
    // 1. 生成唯一房间码
    var roomCode = await generateRoomCode();

    // 2. 创建房间（默认允许观战）
    var res = await supabase
      .from('rooms')
      .insert({ room_code: roomCode, status: 'waiting', is_spectatable: true })
      .select()
      .single();

    if (res.error) throw res.error;
    var room = res.data;

    // 3. 获取玩家 UUID
    var playerUuid = getPlayerUuid();

    // 4. 插入房主（默认昵称 "房主"，进入房间后可修改）
    var playerRes = await supabase
      .from('players')
      .insert({
        room_id: room.id,
        player_uuid: playerUuid,
        nickname: '房主',
        seat_number: 1,
        is_host: true,
        is_online: true
      })
      .select()
      .single();

    if (playerRes.error) throw playerRes.error;

    // 5. 保存房间历史并跳转
    saveRoomHistory(roomCode, '房主');
    window.location.href = 'room.html?room=' + roomCode;

  } catch (err) {
    console.error('createRoom error:', err);
    showToast('创建失败：' + (err.message || '未知错误'), true);
    btn.disabled = false;
    btn.textContent = '创建房间';
    isProcessing = false;
  }
}

// 加入房间
async function joinRoom() {
  if (isProcessing) return;

  var input = document.getElementById('roomCodeInput');
  var code = input.value.trim();

  if (!code || code.length !== 4) {
    showToast('请输入4位房间号', true);
    input.focus();
    return;
  }

  isProcessing = true;
  var btn = document.getElementById('joinRoomBtn');
  btn.disabled = true;
  btn.textContent = '加入中...';

  try {
    // 查询房间是否存在及状态
    var res = await supabase
      .from('rooms')
      .select('id, status, is_spectatable')
      .eq('room_code', code)
      .maybeSingle();

    if (res.error) throw res.error;

    if (!res.data) {
      showToast('房间不存在，请检查房间号', true);
      btn.disabled = false;
      btn.textContent = '加入房间';
      isProcessing = false;
      return;
    }

    if (res.data.status === 'playing') {
      // 游戏已开始，显示观战入口
      showSpectatorBanner(code);
      btn.disabled = false;
      btn.textContent = '加入房间';
      isProcessing = false;
      return;
    }
    if (res.data.status === 'finished') {
      showToast('该房间游戏已结束', true);
      btn.disabled = false;
      btn.textContent = '加入房间';
      isProcessing = false;
      return;
    }

    // 保存房间历史并跳转
    saveRoomHistory(code, '');
    window.location.href = 'room.html?room=' + code;

  } catch (err) {
    console.error('joinRoom error:', err);
    showToast('加入失败：' + (err.message || '未知错误'), true);
    btn.disabled = false;
    btn.textContent = '加入房间';
    isProcessing = false;
  }
}

// 显示观战入口横幅
function showSpectatorBanner(code) {
  var banner = document.getElementById('spectatorBanner');
  if (banner) {
    banner.style.display = 'block';
    // 在 URL 中记录当前房间号
    var url = new URL(window.location.href);
    url.searchParams.set('room', code);
    window.history.replaceState({}, '', url);
  }
}

// 加入观战（ live ）
function liveWatch() {
  var url = new URL(window.location.href);
  var room = url.searchParams.get('room');
  if (room) {
    window.location.href = 'spectator.html?room=' + room;
  }
}

// 作为玩家加入（进入房间页）
function joinAsPlayer() {
  var url = new URL(window.location.href);
  var room = url.searchParams.get('room');
  if (room) {
    window.location.href = 'room.html?room=' + room;
  }
}

// 页面加载时检查 URL 参数
window.addEventListener('DOMContentLoaded', function() {
  var params = new URLSearchParams(window.location.search);
  var room = params.get('room');
  if (room) {
    var input = document.getElementById('roomCodeInput');
    if (input) input.value = room;
  }
});
