// =====================================================
// Supabase 客户端初始化
// =====================================================
const supabase = window.supabase.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);
