// =====================================================
// Realtime 订阅封装
// =====================================================
const RealtimeManager = {
  channel: null,

  // 订阅房间频道
  subscribeRoom(roomId, roomCode, callbacks) {
    const { onPlayerChange, onGameStart, onGameStateChange, onError, onSubscribe } = callbacks;

    this.channel = supabase.channel('room-' + roomCode, {
      config: { broadcast: { self: true } }
    });

    // 监听 players 表变更
    this.channel.on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: 'room_id=eq.' + roomId
      },
      (payload) => {
        if (onPlayerChange) onPlayerChange(payload);
      }
    );

    // 监听 rooms 表变更（开始游戏、状态变更）
    this.channel.on('postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: 'id=eq.' + roomId
      },
      (payload) => {
        const newStatus = payload.new.status;
        if (newStatus === 'playing' && onGameStart) {
          onGameStart(payload.new);
        }
        if (onError) onError(null, 'room_updated');
      }
    );

    // 监听游戏状态变更
    this.channel.on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'game_state',
        filter: 'room_id=eq.' + roomId
      },
      (payload) => {
        if (onGameStateChange) onGameStateChange(payload);
      }
    );

    // 订阅
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (onSubscribe) onSubscribe();
      } else if (status === 'CHANNEL_ERROR') {
        if (onError) onError('连接失败，请刷新页面重试');
      }
    });
  },

  // 添加玩家到频道（记录在线状态）
  async trackPresence(playerUuid, nickname, seatNumber) {
    if (!this.channel) return;
    try {
      await this.channel.track({
        player_uuid: playerUuid,
        nickname: nickname,
        seat_number: seatNumber,
        online_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('trackPresence error:', e);
    }
  },

  // 监听在线状态变更
  onPresence(callbacks) {
    if (!this.channel) return;
    const { onJoin, onLeave } = callbacks;

    this.channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      if (onJoin) onJoin(newPresences);
    });

    this.channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      if (onLeave) onLeave(leftPresences);
    });
  },

  // 获取当前在线玩家
  getPresenceState() {
    return this.channel ? this.channel.presenceState() : {};
  },

  // 退订
  unsubscribe() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
};
