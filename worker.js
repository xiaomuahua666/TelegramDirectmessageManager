// ==================== Telegram DM Bot for Cloudflare Workers ====================
// TG_TOKEN / ADMIN_TOKEN / WEBHOOK_SECRET / BOT_ENABLED / OWNER_ID
// IGNORE_OWNER / REPLY_MODE / DELAY_ENABLED / DELAY_MIN / DELAY_MAX
// TYPING_ENABLED / COOLDOWN_ENABLED / COOLDOWN_SECONDS
// DEFAULT_REPLY / RULES / BLACKLIST
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

// ==================== 回复匹配（优先级 + 随机数表去重） ====================

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

  // 默认回复：随机数表，一轮内不重复
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

// 消息类型识别
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

    // 健康检查
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

        if (!config.enabled) {
          return new Response('OK', { status: 200 });
        }

        const uid      = msg.from.id;
        const username = msg.from.username || msg.from.first_name || String(uid);

        // 忽略管理员
        if (config.ignore_owner && uid === config.owner_id) {
          log('INFO', `Ignored owner: ${username} (${uid})`);
          return new Response('OK', { status: 200 });
        }

        // 黑名单
        if (config.blacklist && config.blacklist.includes(uid)) {
          log('INFO', `Blocked user: ${username} (${uid})`);
          return new Response('OK', { status: 200 });
        }

        // 冷却
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

        // 正在输入
        if (config.typing_enabled) {
          try {
            await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: msg.chat.id,
                action: replyData.media?.type === 'video' ? 'upload_video' :
                        replyData.media?.type === 'photo' ? 'upload_photo' :
                        replyData.media?.type === 'audio' ? 'upload_audio' :
                        replyData.media?.type === 'document' ? 'upload_document' : 'typing',
                ...(msg.business_connection_id ? { business_connection_id: msg.business_connection_id } : {})
              }),
            });
          } catch (e) {
            log('WARN', 'sendChatAction failed', e.message);
          }
        }

        // 延迟
        if (config.delay?.enabled) {
          const min = config.delay.min || 50;
          const max = config.delay.max || 100;
          await sleep(Math.random() * (max - min) + min);
        }

        // 构建 payload
        let apiMethod = 'sendMessage';
        const payload = { chat_id: msg.chat.id };

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

        // 按钮
        if (replyData.buttons && replyData.buttons.length) {
          payload.reply_markup = { inline_keyboard: replyData.buttons };
        }

        // 引用回复
        if (config.reply_mode) {
          payload.reply_parameters = { message_id: msg.message_id };
        }
        if (msg.business_connection_id) {
          payload.business_connection_id = msg.business_connection_id;
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

    return new Response('Not found', { status: 404 });
  },
};