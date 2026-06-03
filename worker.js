// ==================== Telegram DM Bot for Cloudflare Workers ====================
// 环境变量配置（拆分为独立变量）：
// - TG_TOKEN：Bot Token（密钥类型）
// - BOT_ENABLED：机器人总开关（纯文本）
// - OWNER_ID：管理员 ID（纯文本）
// - IGNORE_OWNER：是否忽略管理员（纯文本）
// - REPLY_MODE：是否引用回复（纯文本）
// - DELAY_ENABLED：是否启用延迟（纯文本）
// - DELAY_MIN：最小延迟毫秒数（纯文本）
// - DELAY_MAX：最大延迟毫秒数（纯文本）
// - DEFAULT_REPLY：默认回复数组（JSON 类型）
// - RULES：关键词匹配规则（JSON 类型）
// - BLACKLIST：黑名单用户 ID 数组（JSON 类型）
// ==================== 代码开始 ====================

// ==================== 标签转换函数 ====================

function convertTagsToHTML(text) {
  if (!text) return '';
  
  // 换行标签
  let html = text.replace(/<\/n>/g, '\n');
  
  // 链接标签 <lj url="URL">text</lj>
  html = html.replace(/<lj\s+url="([^"]+)"\s*>([\s\S]*?)<\/lj>/g, 
    (_, url, content) => `<a href="${url}">${content}</a>`);
  
  // 用户提及标签 <tj>user_id</tj>
  html = html.replace(/<tj>([\s\S]*?)<\/tj>/g,
    (_, uid) => `<a href="tg://user?id=${uid}">${uid}</a>`);
  
  // 基础标签映射表
  const tagPairs = [
    ['<yy>', '</yy>', '<blockquote>', '</blockquote>'],
    ['<yyzd>', '</yyzd>', '<blockquote expandable>', '</blockquote>'],
    ['<dk>', '</dk>', '<code>', '</code>'],
    ['<jd>', '</jd>', '<b>', '</b>'],
    ['<xt>', '</xt>', '<i>', '</i>'],
    ['<sc>', '</sc>', '<s>', '</s>'],
    ['<xh>', '</xh>', '<u>', '</u>'],
    ['<js>', '</js>', '<pre>', '</pre>'],
    ['<jh>', '</jh>', '<tg-spoiler>', '</tg-spoiler>']
  ];
  
  for (const [open, close, htmlOpen, htmlClose] of tagPairs) {
    const regex = new RegExp(escapeRegex(open) + '([\\s\\S]*?)' + escapeRegex(close), 'g');
    html = html.replace(regex, (_, content) => `${htmlOpen}${content}${htmlClose}`);
  }
  
  return html;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==================== 配置获取（从独立变量组装）====================

function getConfig(env) {
  // 辅助函数：解析 JSON 变量（支持 JSON 类型和字符串类型）
  function parseJsonVariable(value, defaultValue) {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        console.error('JSON parse error:', e);
        return defaultValue;
      }
    }
    return defaultValue;
  }
  
  // 辅助函数：解析布尔值
  function parseBoolean(value, defaultValue) {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return defaultValue;
  }
  
  // 辅助函数：解析整数
  function parseIntValue(value, defaultValue) {
    if (value === undefined || value === null) return defaultValue;
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }
  
  return {
    enabled: parseBoolean(env.BOT_ENABLED, true),
    owner_id: parseIntValue(env.OWNER_ID, null),
    ignore_owner: parseBoolean(env.IGNORE_OWNER, true),
    reply_mode: parseBoolean(env.REPLY_MODE, true),
    delay: {
      enabled: parseBoolean(env.DELAY_ENABLED, true),
      min: parseIntValue(env.DELAY_MIN, 50),
      max: parseIntValue(env.DELAY_MAX, 100)
    },
    default_reply: parseJsonVariable(env.DEFAULT_REPLY, [
      "[AutoReply] 你好，有什么可以帮助你的吗？",
      "[AutoReply] 请稍等，我会尽快回复你的。",
      "[AutoReply] 收到你的消息了，请等待主人回复。"
    ]),
    rules: parseJsonVariable(env.RULES, []),
    blacklist: parseJsonVariable(env.BLACKLIST, [])
  };
}

// ==================== 回复匹配 ====================

function getReply(text, config) {
  const lowerText = (text || "").toLowerCase();
  
  // 遍历规则，匹配关键词
  for (const rule of config.rules || []) {
    for (const keyword of rule.keywords || []) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return convertTagsToHTML(rule.reply);
      }
    }
  }
  
  // 没有匹配到规则，使用默认回复（简单随机）
  const replies = config.default_reply;
  if (Array.isArray(replies) && replies.length > 0) {
    const randomIndex = Math.floor(Math.random() * replies.length);
    return convertTagsToHTML(replies[randomIndex]);
  }
  
  // 默认回复是字符串
  if (typeof replies === 'string') {
    return convertTagsToHTML(replies);
  }
  
  return "";
}

// ==================== 延迟函数 ====================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 日志函数 ====================

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] [${level}] ${message}`;
  if (data) {
    console.log(logMsg, data);
  } else {
    console.log(logMsg);
  }
}

// ==================== 主程序 ====================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 健康检查
    if (path === '/') {
      return new Response('TGDM Bot Worker is running', { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // ==================== Webhook 端点 ====================
    if (path === '/webhook') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }
      
      try {
        const update = await request.json();
        
        // 获取消息（支持普通消息和 Business 消息）
        const msg = update.message || update.business_message;
        
        // 只处理文本消息
        if (!msg || !msg.text) {
          return new Response('OK', { status: 200 });
        }
        
        // 获取配置
        const config = getConfig(env);
        
        // 检查机器人是否启用
        if (!config.enabled) {
          return new Response('OK', { status: 200 });
        }
        
        const uid = msg.from.id;
        const username = msg.from.username || msg.from.first_name || String(uid);
        
        // 忽略管理员消息
        if (config.ignore_owner && uid === config.owner_id) {
          log('INFO', `Ignored owner: ${username} (${uid})`);
          return new Response('OK', { status: 200 });
        }
        
        // 黑名单检查
        if (config.blacklist && config.blacklist.includes(uid)) {
          log('INFO', `Blocked user: ${username} (${uid})`);
          return new Response('OK', { status: 200 });
        }
        
        // 获取回复内容
        const reply = getReply(msg.text, config);
        
        if (!reply) {
          log('WARN', `No reply generated for: ${msg.text}`);
          return new Response('OK', { status: 200 });
        }
        
        // 延迟回复
        if (config.delay && config.delay.enabled) {
          const minMs = config.delay.min || 50;
          const maxMs = config.delay.max || 100;
          const delayMs = Math.random() * (maxMs - minMs) + minMs;
          await delay(delayMs);
        }
        
        // 获取 Bot Token
        const token = env.TG_TOKEN;
        if (!token) {
          log('ERROR', 'TG_TOKEN not set');
          return new Response('Token missing', { status: 500 });
        }
        
        // 发送回复消息
        const sendUrl = `https://api.telegram.org/bot${token}/sendMessage`;
        const payload = {
          chat_id: msg.chat.id,
          text: reply,
          parse_mode: 'HTML'
        };
        
        // 引用回复模式
        if (config.reply_mode) {
          payload.reply_parameters = { message_id: msg.message_id };
        }
        
        // Business 账号支持
        if (msg.business_connection_id) {
          payload.business_connection_id = msg.business_connection_id;
        }
        
        const sendResponse = await fetch(sendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const sendResult = await sendResponse.json();
        
        if (!sendResult.ok) {
          log('ERROR', 'Send message failed', sendResult);
        } else {
          // 截取日志长度，避免过长
          const shortOriginal = msg.text.length > 50 ? msg.text.substring(0, 50) + '...' : msg.text;
          const shortReply = reply.length > 50 ? reply.substring(0, 50) + '...' : reply;
          log('INFO', `[${username} (${uid})] ${shortOriginal} -> ${shortReply}`);
        }
        
        return new Response('OK', { status: 200 });
        
      } catch (error) {
        log('ERROR', 'Webhook error', error.message);
        return new Response('Error: ' + error.message, { status: 500 });
      }
    }
    
    // ==================== 设置 Webhook ====================
    if (path === '/setup') {
      const token = env.TG_TOKEN;
      if (!token) {
        return new Response('Error: TG_TOKEN not set. Please add it as a secret.', { 
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
      
      const webhookUrl = `${url.origin}/webhook`;
      
      const response = await fetch(
        `https://api.telegram.org/bot${token}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl })
        }
      );
      
      const result = await response.json();
      
      return new Response(JSON.stringify(result, null, 2), {
        status: result.ok ? 200 : 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // ==================== 查看 Webhook 状态 ====================
    if (path === '/webhook-info') {
      const token = env.TG_TOKEN;
      if (!token) {
        return new Response('TG_TOKEN not set', { status: 500 });
      }
      
      const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const result = await response.json();
      
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // ==================== 查看当前配置（调试用）====================
    if (path === '/config') {
      const config = getConfig(env);
      // 返回配置摘要（不输出完整 rules 内容，避免过长）
      const safeConfig = {
        enabled: config.enabled,
        owner_id: config.owner_id,
        ignore_owner: config.ignore_owner,
        reply_mode: config.reply_mode,
        delay: config.delay,
        default_reply_count: Array.isArray(config.default_reply) ? config.default_reply.length : 1,
        rules_count: config.rules?.length || 0,
        blacklist_count: config.blacklist?.length || 0
      };
      return new Response(JSON.stringify(safeConfig, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // ==================== 删除 Webhook ====================
    if (path === '/delete-webhook') {
      const token = env.TG_TOKEN;
      if (!token) {
        return new Response('TG_TOKEN not set', { status: 500 });
      }
      
      const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
      const result = await response.json();
      
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 404
    return new Response('Not found', { status: 404 });
  }
};