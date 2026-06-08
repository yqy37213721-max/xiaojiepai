-- =====================================================
-- 小姐牌 - Supabase 数据库完整建表脚本
-- 在 Supabase SQL Editor 中执行
-- =====================================================

-- 1. 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- rooms - 房间表
-- =====================================================
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(4) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'playing', 'finished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- players - 玩家表
-- =====================================================
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_uuid VARCHAR(36) NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  seat_number INTEGER NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, player_uuid),
  UNIQUE(room_id, seat_number)
);

-- =====================================================
-- game_state - 游戏状态表（阶段2使用）
-- =====================================================
CREATE TABLE game_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,
  current_turn INTEGER,
  card_pile JSONB,
  current_index INTEGER NOT NULL DEFAULT 0,
  drawn_cards JSONB DEFAULT '[]'::jsonb,
  turn_order JSONB,
  special_states JSONB,
  current_turn_index INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'playing'
    CHECK (status IN ('playing', 'finished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 索引
-- =====================================================
CREATE INDEX idx_rooms_room_code ON rooms(room_code);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_players_room_id ON players(room_id);
CREATE INDEX idx_players_player_uuid ON players(player_uuid);
CREATE INDEX idx_players_room_seat ON players(room_id, seat_number);
CREATE INDEX idx_game_state_room_id ON game_state(room_id);

-- =====================================================
-- 启用 Realtime（关键步骤！）
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;

-- =====================================================
-- RLS 策略（无认证，公开访问）
-- =====================================================
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;

-- rooms
CREATE POLICY "public_read_rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "public_insert_rooms" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_rooms" ON rooms FOR UPDATE USING (true);

-- players
CREATE POLICY "public_read_players" ON players FOR SELECT USING (true);
CREATE POLICY "public_insert_players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_players" ON players FOR UPDATE USING (true);
CREATE POLICY "public_delete_players" ON players FOR DELETE USING (true);

-- game_state
CREATE POLICY "public_read_game_state" ON game_state FOR SELECT USING (true);
CREATE POLICY "public_insert_game_state" ON game_state FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_game_state" ON game_state FOR UPDATE USING (true);

