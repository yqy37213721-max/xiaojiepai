// =====================================================
// 房间历史记录 - localStorage 存储最近加入的房间
// =====================================================

// 保存房间记录
function saveRoomHistory(roomCode, nickname) {
  var history = getRoomHistory();
  // 去除重复
  history = history.filter(function(r) { return r.code !== roomCode; });
  // 加到最前面
  history.unshift({ code: roomCode, nickname: nickname || '', time: Date.now() });
  // 只保留最近 5 个
  if (history.length > 5) history = history.slice(0, 5);
  try {
    localStorage.setItem('room_history', JSON.stringify(history));
  } catch(e) {}
  renderRoomHistory();
}

// 获取房间记录
function getRoomHistory() {
  try {
    var data = localStorage.getItem('room_history');
    return data ? JSON.parse(data) : [];
  } catch(e) { return []; }
}

// 复制房间号
function copyRoomCode(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  showToast('已复制: ' + text);
}

// 渲染房间历史
function renderRoomHistory() {
  var container = document.getElementById('recentRooms');
  var list = document.getElementById('recentList');
  var history = getRoomHistory();
  
  if (history.length === 0) {
    if (container) container.style.display = 'none';
    return;
  }
  
  if (container) container.style.display = 'block';
  if (!list) return;
  
  // 查询每个房间的状态
  list.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.15);padding:8px;text-align:center;">加载中...</div>';
  
  var html = '';
  var pending = history.length;
  
  history.forEach(function(room) {
    supabase
      .from('rooms')
      .select('status')
      .eq('room_code', room.code)
      .maybeSingle()
      .then(function(res) {
        var status = res.data ? res.data.status : 'unknown';
        var timeStr = '';
        if (room.time) {
          var d = new Date(room.time);
          timeStr = d.getMonth()+1 + '/' + d.getDate() + ' ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
        }
        
        var statusMap = {
          'waiting': '<span style="color:#4ade80;">等待中</span>',
          'playing': '<span style="color:#a78bfa;">进行中</span>',
          'finished': '<span style="color:rgba(255,255,255,0.3);">已结束</span>',
          'unknown': '<span style="color:rgba(255,255,255,0.2);">未知</span>'
        };
        var statusTag = statusMap[status] || statusMap.unknown;
        
        html += `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:10px;cursor:pointer;transition:all 0.15s;" onclick="rejoinRoom('${room.code}')">
          <div style="flex-shrink:0;width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:rgba(139,92,246,0.15);border-radius:8px;font-size:18px;font-weight:700;color:#a78bfa;">${room.code.substring(0,2)}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:500;color:rgba(255,255,255,0.8);">房间 ${room.code}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px;">${room.nickname} · ${timeStr}</div>
          </div>
          <div style="flex-shrink:0;font-size:12px;">${statusTag}</div>
          <div style="flex-shrink:0;font-size:11px;color:rgba(255,255,255,0.2);padding:4px;" onclick="event.stopPropagation();copyRoomCode('${room.code}')">📋</div>
        </div>`;
        
        pending--;
        if (pending === 0) {
          list.innerHTML = html;
        }
      })
      .catch(function() {
        pending--;
        if (pending === 0) {
          html += '<div style="font-size:12px;color:rgba(255,255,255,0.15);padding:8px;text-align:center;">无法获取部分房间状态</div>';
          list.innerHTML = html;
        }
      });
  });
}

// 重新进入房间
function rejoinRoom(code) {
  // 直接跳转 game.html，由 game.js 处理身份找回
  window.location.href = 'game.html?room=' + code;
}

// 页面加载时渲染历史
document.addEventListener('DOMContentLoaded', function() {
  // 稍等片刻让 supabase 初始化完成
  setTimeout(renderRoomHistory, 500);
});
