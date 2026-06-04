// ==================== Telegram DM Bot for Cloudflare Workers ====================
// 环境变量新增（可选）：
// KEEP_LAST_ONLY = true   # 是否只保留最后一条机器人回复，默认 false
// 需要绑定 KV Namespace，变量名: LAST_REPLY_KV
// ==================== 代码开始 ====================

const cooldownMap = new Map();
const shuffleMap = new Map();

// Fisher-Yates 洗牌
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ==================== 标签转换 ====================

function convertTagsToHTML(text) {
  if (!text) return '';

  let html = text.replace(/<\/n>/g, '\n');

  html = html.replace(/<lj\s+url="([^"]+)"\s*>([\s\S]*?)<\/lj>/g,
    (_, url, content) => `<a href="${url}">${content}</a>`);

  html = html.replace(/<tj>([\s\S]*?)<\/tj>/g,
    (_, uid) => `<a href="tg://user?id=${uid}">${uid}</a>`);

  html = html.replace(/<em\s+id="(\d+)"\s*>([\s\S]*?)<\/em>/g,
    (_, id, fallback) => `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`);

  const tagPairs = [
    ['<yy>',   '</yy>',   '<blockquote>',          '</blockquote>'],
    ['<yyzd>', '</yyzd>', '<blockquote expandable>', '</blockquote>'],
    ['<dk>',   '</dk>',   '<code>',                '</code>'],
    ['<jd>',   '</jd>',   '<b>',                   '</b>'],
    ['<xt>',   '</xt>',   '<i>',                   '</i>'],
    ['<sc>',   '</sc>',   '<s>',                   '</s>'],
    ['<xh>',   '</xh>',   '<u>',                   '</u>'],
    ['<js>',   '</js>',   '<pre>',                 '</pre>'],
    ['<jh>',   '</jh>',   '<tg-spoiler>',          '</tg-spoiler>'],
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

// ==================== 配置获取 ====================

function getConfig(env) {
  function parseJsonVariable(value, defaultValue) {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try { return JSON.parse(value); }
      catch (e) { console.error('JSON parse error:', e); return defaultValue; }
    }
    return defaultValue;
  }

  function parseBoolean(value, defaultValue) {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return defaultValue;
  }

  function parseIntValue(value, defaultValue) {
    if (value === undefined || value === null) return defaultValue;
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }

  return {
    enabled:       parseBoolean(env.BOT_ENABLED, true),
    owner_id:      parseIntValue(env.OWNER_ID, null),
    ignore_owner:  parseBoolean(env.IGNORE_OWNER, true),
    reply_mode:    parseBoolean(env.REPLY_MODE, true),
    typing_enabled: parseBoolean(env.TYPING_ENABLED, false),
    keep_last_only: parseBoolean(env.KEEP_LAST_ONLY, false),
    cooldown: {
      enabled:  parseBoolean(env.COOLDOWN_ENABLED, false),
      seconds:  parseIntValue(env.COOLDOWN_SECONDS, 30),
    },
    delay: {
      enabled: parseBoolean(env.DELAY_ENABLED, true),
      min:     parseIntValue(env.DELAY_MIN, 50),
      max:     parseIntValue(env.DELAY_MAX, 100),
    },
    default_reply: parseJsonVariable(env.DEFAULT_REPLY, [
      "[AutoReply] 你好，有什么可以帮助你的吗？",
      "[AutoReply] 请稍等，我会尽快回复你的。",
      "[AutoReply] 收到你的消息了，请等待主人回复。",
    ]),
    rules:     parseJsonVariable(env.RULES, []),
    blacklist: parseJsonVariable(env.BLACKLIST, []),
  };
}

// ==================== KV 操作 ====================

async function getLastBotMessageId(kv, userId, chatId) {
  if (!kv) return null;
  const key = `bot_msg:${userId}:${chatId}`;
  const value = await kv.get(key);
  return value ? parseInt(value, 10) : null;
}

async function saveLastBotMessageId(kv, userId, chatId, messageId) {
  if (!kv) return;
  const key = `bot_msg:${userId}:${chatId}`;
  await kv.put(key, String(messageId), { expirationTtl: 86400 * 7 });
  console.log(`[KV] Saved: ${key} -> ${messageId}`);
}

// 修复版：支持商业账号删除消息
async function deletePreviousBotMessage(kv, token, userId, chatId, businessConnectionId) {
  if (!kv) return false;
  const lastMsgId = await getLastBotMessageId(kv, userId, chatId);
  if (!lastMsgId) {
    console.log(`[KV] No previous message for user ${userId}`);
    return false;
  }

  try {
    let url, payload;
    
    // 关键修复：根据是否是商业消息使用不同的 API
    if (businessConnectionId) {
      // 商业账号：使用 deleteBusinessMessages
      url = `https://api.telegram.org/bot${token}/deleteBusinessMessages`;
      payload = {
        business_connection_id: businessConnectionId,
        message_ids: [lastMsgId]  // 注意是数组
      };
      console.log(`[KV] Using deleteBusinessMessages for business account, message ${lastMsgId}`);
    } else {
      // 普通账号：使用 deleteMessage
      url = `https://api.telegram.org/bot${token}/deleteMessage`;
      payload = {
        chat_id: chatId,
        message_id: lastMsgId
      };
      console.log(`[KV] Using deleteMessage for normal chat, message ${lastMsgId}`);
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await resp.json();
    
    if (result.ok) {
      console.log(`[KV] Deleted previous bot message ${lastMsgId} for user ${userId}`);
      return true;
    } else {
      console.log(`[KV] Delete failed: ${JSON.stringify(result)}`);
      return false;
    }
  } catch (e) {
    console.log(`[KV] Delete error: ${e.message}`);
    return false;
  }
}

// ==================== 回复匹配 ====================

function getReplyData(text, config, uid) {
  const lowerText = (text || "").toLowerCase();
  let bestMatch = null;
  let bestPriority = -Infinity;

  for (const rule of config.rules || []) {
    let matched = false;
    for (const keyword of rule.keywords || []) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matched = true;
        break;
      }
    }
    if (matched) {
      const priority = typeof rule.priority === 'number' ? rule.priority : 0;
      if (priority > bestPriority) {
        bestPriority = priority;
        bestMatch = rule;
      }
    }
  }

  if (bestMatch) {
    return {
      text: convertTagsToHTML(bestMatch.reply),
      buttons: bestMatch.buttons || null,
      media: bestMatch.media || null,
    };
  }

  const replies = config.default_reply;
  let replyText = '';

  if (Array.isArray(replies) && replies.length > 0) {
    if (replies.length === 1) {
      replyText = replies[0];
    } else {
      let entry = shuffleMap.get(uid);
      if (!entry || entry.pointer >= entry.table.length) {
        entry = { table: shuffle(replies), pointer: 0 };
      }
      replyText = entry.table[entry.pointer];
      entry.pointer++;
      shuffleMap.set(uid, entry);
    }
  } else if (typeof replies === 'string') {
    replyText = replies;
  }

  return {
    text: convertTagsToHTML(replyText),
    buttons: null,
    media: null,
  };
}

// ==================== 工具函数 ====================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(level, message, data = null) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${message}`;
  data ? console.log(line, data) : console.log(line);
}

function isAdminAuthorized(request, env) {
  const adminToken = env.ADMIN_TOKEN;
  if (!adminToken) return false;
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader === `Bearer ${adminToken}`) return true;
  const url = new URL(request.url);
  if (url.searchParams.get('token') === adminToken) return true;
  return false;
}

function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getMessageText(msg) {
  if (!msg) return null;
  if (msg.text) return msg.text;
  if (msg.caption) return msg.caption;
  if (msg.photo) return '[图片]';
  if (msg.video) return '[视频]';
  if (msg.sticker) return '[贴纸]';
  if (msg.document) return '[文件]';
  if (msg.audio) return '[音频]';
  if (msg.voice) return '[语音]';
  if (msg.animation) return '[GIF]';
  if (msg.video_note) return '[视频消息]';
  if (msg.contact) return '[联系人]';
  if (msg.location) return '[位置]';
  if (msg.poll) return '[投票]';
  if (msg.dice) return '[骰子]';
  return null;
}

// ==================== 主程序 ====================

export default {
  async fetch(request, env, ctx) {
    const url  = new URL(request.url);
    const path = url.pathname;

    if (path === '/') {
      return new Response('TGDM Bot Worker is running', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // ==================== Webhook ====================
    if (path === '/webhook') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      const webhookSecret = env.WEBHOOK_SECRET;
      if (webhookSecret) {
        const incoming = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
        if (incoming !== webhookSecret) {
          log('WARN', 'Webhook secret mismatch, request rejected');
          return new Response('Forbidden', { status: 403 });
        }
      }

      try {
        const update = await request.json();
        const msg = update.message || update.business_message;
        const msgText = getMessageText(msg);

        if (!msg || !msgText) {
          return new Response('OK', { status: 200 });
        }

        const config = getConfig(env);
        const kv = env.LAST_REPLY_KV;

        if (!config.enabled) {
          return new Response('OK', { status: 200 });
        }

        const uid      = msg.from.id;
        const username = msg.from.username || msg.from.first_name || String(uid);
        const chatId   = msg.chat.id;
        const businessConnectionId = msg.business_connection_id;

        if (config.ignore_owner && uid === config.owner_id) {
          log('INFO', `Ignored owner: ${username} (${uid})`);
          return new Response('OK', { status: 200 });
        }

        if (config.blacklist && config.blacklist.includes(uid)) {
          log('INFO', `Blocked user: ${username} (${uid})`);
          return new Response('OK', { status: 200 });
        }

        if (config.cooldown.enabled) {
          const now = Date.now();
          const last = cooldownMap.get(uid);
          if (last && (now - last) < config.cooldown.seconds * 1000) {
            log('INFO', `Cooldown: ignored ${username} (${uid})`);
            return new Response('OK', { status: 200 });
          }
          cooldownMap.set(uid, now);
        }

        const replyData = getReplyData(msgText, config, uid);
        if (!replyData.text && !replyData.media?.url) {
          log('WARN', `No reply generated for: ${msgText}`);
          return new Response('OK', { status: 200 });
        }

        const token = env.TG_TOKEN;
        if (!token) {
          log('ERROR', 'TG_TOKEN not set');
          return new Response('Token missing', { status: 500 });
        }

        // 删除上一条回复（自动识别商业/普通账号）
        if (config.keep_last_only && kv) {
          await deletePreviousBotMessage(kv, token, uid, chatId, businessConnectionId);
        }

        // 正在输入
        if (config.typing_enabled) {
          try {
            await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                action: replyData.media?.type === 'video' ? 'upload_video' :
                        replyData.media?.type === 'photo' ? 'upload_photo' :
                        replyData.media?.type === 'audio' ? 'upload_audio' :
                        replyData.media?.type === 'document' ? 'upload_document' : 'typing',
                ...(businessConnectionId ? { business_connection_id: businessConnectionId } : {})
              }),
            });
          } catch (e) {
            log('WARN', 'sendChatAction failed', e.message);
          }
        }

        if (config.delay?.enabled) {
          const min = config.delay.min || 50;
          const max = config.delay.max || 100;
          await sleep(Math.random() * (max - min) + min);
        }

        let apiMethod = 'sendMessage';
        const payload = { chat_id: chatId };

        if (replyData.media && replyData.media.url) {
          const type = replyData.media.type || 'document';
          const methodMap = {
            photo: 'sendPhoto', video: 'sendVideo', audio: 'sendAudio',
            document: 'sendDocument', animation: 'sendAnimation',
          };
          apiMethod = methodMap[type] || 'sendDocument';
          payload[type] = replyData.media.url;
          if (replyData.text) {
            payload.caption = replyData.text;
            payload.parse_mode = 'HTML';
          }
        } else {
          payload.text = replyData.text;
          payload.parse_mode = 'HTML';
        }

        if (replyData.buttons && replyData.buttons.length) {
          payload.reply_markup = { inline_keyboard: replyData.buttons };
        }

        if (config.reply_mode) {
          payload.reply_parameters = { message_id: msg.message_id };
        }
        if (businessConnectionId) {
          payload.business_connection_id = businessConnectionId;
        }

        const sendResp = await fetch(`https://api.telegram.org/bot${token}/${apiMethod}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const sendResult = await sendResp.json();

        if (!sendResult.ok) {
          log('ERROR', 'Send failed', { method: apiMethod, result: sendResult });
        } else {
          if (config.keep_last_only && kv && sendResult.result && sendResult.result.message_id) {
            await saveLastBotMessageId(kv, uid, chatId, sendResult.result.message_id);
          }
          
          const shortIn  = msgText.length > 50 ? msgText.slice(0, 50) + '...' : msgText;
          const shortOut = replyData.text ? (replyData.text.length > 50 ? replyData.text.slice(0, 50) + '...' : replyData.text) : '[media]';
          log('INFO', `[${username} (${uid})] ${shortIn} -> ${shortOut} (${apiMethod})`);
        }

        return new Response('OK', { status: 200 });

      } catch (error) {
        log('ERROR', 'Webhook error', error.message);
        return new Response('Error: ' + error.message, { status: 500 });
      }
    }

    // ==================== 管理端点 ====================

    if (path === '/setup') {
      if (!isAdminAuthorized(request, env)) return unauthorizedResponse();
      const token = env.TG_TOKEN;
      if (!token) return new Response('Error: TG_TOKEN not set', { status: 500 });
      const webhookUrl = `${url.origin}/webhook`;
      const body = { url: webhookUrl };
      if (env.WEBHOOK_SECRET) body.secret_token = env.WEBHOOK_SECRET;
      const resp = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await resp.json();
      return new Response(JSON.stringify(result, null, 2), {
        status: result.ok ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (path === '/webhook-info') {
      if (!isAdminAuthorized(request, env)) return unauthorizedResponse();
      const token = env.TG_TOKEN;
      if (!token) return new Response('TG_TOKEN not set', { status: 500 });
      const resp = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const result = await resp.json();
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (path === '/config') {
      if (!isAdminAuthorized(request, env)) return unauthorizedResponse();
      const config = getConfig(env);
      const safeConfig = {
        enabled:             config.enabled,
        owner_id:            config.owner_id,
        ignore_owner:        config.ignore_owner,
        reply_mode:          config.reply_mode,
        typing_enabled:      config.typing_enabled,
        keep_last_only:      config.keep_last_only,
        kv_bound:            !!env.LAST_REPLY_KV,
        cooldown:            config.cooldown,
        delay:               config.delay,
        default_reply_count: Array.isArray(config.default_reply) ? config.default_reply.length : 1,
        rules_count:         config.rules?.length || 0,
        blacklist_count:     config.blacklist?.length || 0,
      };
      return new Response(JSON.stringify(safeConfig, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (path === '/delete-webhook') {
      if (!isAdminAuthorized(request, env)) return unauthorizedResponse();
      const token = env.TG_TOKEN;
      if (!token) return new Response('TG_TOKEN not set', { status: 500 });
      const resp = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
      const result = await resp.json();
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 测试接口：查看某用户的最后一条消息记录
    if (path === '/get-user-record') {
      if (!isAdminAuthorized(request, env)) return unauthorizedResponse();
      const kv = env.LAST_REPLY_KV;
      if (!kv) return new Response(JSON.stringify({ error: 'LAST_REPLY_KV not bound' }), { status: 500 });
      
      const userId = url.searchParams.get('user_id');
      const chatId = url.searchParams.get('chat_id') || userId;
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Missing user_id parameter' }), { status: 400 });
      }
      
      const key = `bot_msg:${userId}:${chatId}`;
      const value = await kv.get(key);
      
      return new Response(JSON.stringify({ 
        user_id: userId,
        chat_id: chatId,
        last_message_id: value ? parseInt(value, 10) : null,
        exists: !!value
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 测试接口：手动删除某条消息
    if (path === '/delete-message') {
      if (!isAdminAuthorized(request, env)) return unauthorizedResponse();
      const token = env.TG_TOKEN;
      if (!token) return new Response(JSON.stringify({ error: 'TG_TOKEN not set' }), { status: 500 });
      
      const chatId = url.searchParams.get('chat_id');
      const messageId = url.searchParams.get('message_id');
      const businessConnectionId = url.searchParams.get('business_connection_id');
      
      if (!chatId || !messageId) {
        return new Response(JSON.stringify({ error: 'Missing chat_id or message_id' }), { status: 400 });
      }
      
      const payload = { chat_id: chatId, message_id: parseInt(messageId, 10) };
      if (businessConnectionId) payload.business_connection_id = businessConnectionId;
      
      const resp = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await resp.json();
      
      return new Response(JSON.stringify(result, null, 2), {
        status: result.ok ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  },
};