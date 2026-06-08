-- =====================================================
-- 阶段2：游戏状态表补充字段
-- 在 Supabase SQL Editor 中执行
-- =====================================================
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS turn_order JSONB;
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS special_states JSONB;
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS current_turn_index INTEGER NOT NULL DEFAULT 0;
