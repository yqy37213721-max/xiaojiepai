-- =====================================================
-- 小姐牌 - 数据库迁移 v2
-- 1. 观战功能（已有）
-- 2. 游戏途中加入
-- 3. 玩家游戏饮酒记录
-- =====================================================

-- 1. rooms 表增加 is_spectatable 字段
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_spectatable BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. players 表增加游戏饮酒记录
ALTER TABLE players ADD COLUMN IF NOT EXISTS drinks_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS cards_drawn INTEGER NOT NULL DEFAULT 0;

-- 3. 更新 RLS 策略（如果不存在）
CREATE POLICY IF NOT EXISTS "public_read_players" ON players FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "public_insert_players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "public_update_players" ON players FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "public_delete_players" ON players FOR DELETE USING (true);
