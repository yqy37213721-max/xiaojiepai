// =====================================================
// Supabase 客户端初始化（含 10 秒超时）
// =====================================================
const supabase = window.supabase.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey,
  {
    global: {
      fetch: function(url, options) {
        var controller = new AbortController();
        options = options || {};
        var existingSignal = options.signal;
        options.signal = controller.signal;
        var timeoutId = setTimeout(function() {
          controller.abort();
        }, 10000);
        if (existingSignal) {
          existingSignal.addEventListener("abort", function() {
            controller.abort();
            clearTimeout(timeoutId);
          });
        }
        return fetch(url, options).then(function(r) {
          clearTimeout(timeoutId);
          return r;
        }).catch(function(e) {
          clearTimeout(timeoutId);
          throw e;
        });
      }
    }
  }
);