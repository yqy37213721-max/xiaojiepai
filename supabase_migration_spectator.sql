-- =====================================================
-- 小姐牌 - 观战功能数据库迁移
-- 在 Supabase SQL Editor 中执行
-- =====================================================

-- 1. rooms 表增加 is_spectatable 字段
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_spectatable BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. 如果 room_code 为观战专用前缀，标记为观战房间
--    观战房间格式：spectator-XXXX，前端 URL 为 spectator.html?room=XXXX
