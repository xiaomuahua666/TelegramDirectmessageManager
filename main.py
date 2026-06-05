import asyncio
import json
import os
import random
import re
import time
from copy import deepcopy
from typing import Dict, List, Optional

from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.types import (
    ReplyParameters,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
)

# ==================== 初始化 ====================

def load_token():
    with open("token.txt", "r", encoding="utf-8") as f:
        return f.read().strip()

TOKEN = load_token()

CONFIG_FILE = "config.json"
USERS_FILE = "users.json"
KV_FILE = "kv_store.json"

# 全局变量
default_reply_pool: List[str] = []
default_reply_original: List[str] = []
cooldown_map: Dict[int, float] = {}

# ==================== 文件操作 ====================

def load_config():
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def load_kv():
    if not os.path.exists(KV_FILE):
        return {}
    with open(KV_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_kv(kv):
    with open(KV_FILE, "w", encoding="utf-8") as f:
        json.dump(kv, f, ensure_ascii=False, indent=2)

# ==================== 配置兼容处理 ====================

def get_keep_last_count(config):
    """获取保留回复数量，兼容旧版 keep_last_only"""
    count = config.get("keep_last_count", 0)
    if count > 0:
        return count
    if config.get("keep_last_only", False):
        return 1
    return 0

# ==================== 用户管理 ====================

def update_user(users, msg):
    uid = str(msg.from_user.id)
    if uid not in users:
        users[uid] = {
            "username": msg.from_user.username,
            "first_name": msg.from_user.first_name,
            "first_seen": int(time.time()),
            "last_seen": int(time.time()),
            "message_count": 1,
        }
    else:
        users[uid]["last_seen"] = int(time.time())
        users[uid]["message_count"] = int(users[uid].get("message_count", 0)) + 1
        users[uid]["username"] = msg.from_user.username
        users[uid]["first_name"] = msg.from_user.first_name
    save_users(users)

# ==================== 标签转换 ====================

def convert_custom_tags_to_html(text):
    if not text:
        return text

    text = text.replace('</n>', '\n')

    def replace_lj(match):
        url = match.group(1)
        content = match.group(2)
        return f'<a href="{url}">{content}</a>'
    text = re.sub(r'<lj\s+url="([^"]+)"\s*>([\s\S]*?)</lj>', replace_lj, text)

    def replace_tj(match):
        user_id = match.group(1)
        return f'<a href="tg://user?id={user_id}">{user_id}</a>'
    text = re.sub(r'<tj>([\s\S]*?)</tj>', replace_tj, text)

    def replace_em(match):
        emoji_id = match.group(1)
        fallback = match.group(2)
        return f'<tg-emoji emoji-id="{emoji_id}">{fallback}</tg-emoji>'
    text = re.sub(r'<em\s+id="(\d+)"\s*>([\s\S]*?)</em>', replace_em, text)

    tag_map = {
        ('<yy>', '</yy>'): ('<blockquote>', '</blockquote>'),
        ('<yyzd>', '</yyzd>'): ('<blockquote expandable>', '</blockquote>'),
        ('<dk>', '</dk>'): ('<code>', '</code>'),
        ('<jd>', '</jd>'): ('<b>', '</b>'),
        ('<xt>', '</xt>'): ('<i>', '</i>'),
        ('<sc>', '</sc>'): ('<s>', '</s>'),
        ('<xh>', '</xh>'): ('<u>', '</u>'),
        ('<js>', '</js>'): ('<pre>', '</pre>'),
        ('<jh>', '</jh>'): ('<tg-spoiler>', '</tg-spoiler>'),
    }

    for (custom_open, custom_close), (html_open, html_close) in tag_map.items():
        pattern = re.escape(custom_open) + r'([\s\S]*?)' + re.escape(custom_close)
        text = re.sub(pattern, lambda m: f'{html_open}{m.group(1)}{html_close}', text)

    return text

# ==================== 回复匹配（优先级 + 随机去重） ====================

def get_reply_data(text, config, uid):
    lower_text = (text or "").lower()
    best_match = None
    best_priority = float('-inf')

    for rule in config.get("rules", []):
        matched = False
        for keyword in rule.get("keywords", []):
            if keyword.lower() in lower_text:
                matched = True
                break
        if matched:
            priority = rule.get("priority", 0)
            if priority > best_priority:
                best_priority = priority
                best_match = rule

    if best_match:
        return {
            "text": convert_custom_tags_to_html(best_match.get("reply", "")),
            "buttons": best_match.get("buttons"),
            "media": best_match.get("media"),
        }

    default_reply_config = config.get("default_reply", [])
    reply_text = get_default_reply(default_reply_config)

    return {
        "text": convert_custom_tags_to_html(reply_text),
        "buttons": None,
        "media": None,
    }

def get_default_reply(default_reply_config):
    global default_reply_pool, default_reply_original

    if isinstance(default_reply_config, str):
        return default_reply_config

    if isinstance(default_reply_config, list):
        if not default_reply_config:
            return ""
        if not default_reply_pool:
            default_reply_original = deepcopy(default_reply_config)
            default_reply_pool = deepcopy(default_reply_config)
            random.shuffle(default_reply_pool)
        return default_reply_pool.pop()

    return ""

def init_reply_pool():
    global default_reply_pool, default_reply_original
    default_reply_pool = []
    default_reply_original = []

# ==================== KV 操作（滑动窗口） ====================

KV_TTL = 48 * 60 * 60  # 48小时

def kv_get_replies(kv, uid):
    """获取用户的所有历史回复列表"""
    key = str(uid)
    if key not in kv:
        return []
    entries = kv[key]
    # 兼容旧版单条记录格式
    if isinstance(entries, dict) and "message_id" in entries:
        if time.time() - entries.get("timestamp", 0) <= KV_TTL:
            return [entries]
        return []
    if not isinstance(entries, list):
        return []
    # 过期清理
    now = time.time()
    return [e for e in entries if now - e.get("timestamp", 0) <= KV_TTL]

def kv_add_reply(kv, uid, data):
    """添加一条回复记录"""
    key = str(uid)
    if key not in kv or not isinstance(kv[key], list):
        kv[key] = []
    kv[key].append({**data, "timestamp": int(time.time())})

def kv_set_replies(kv, uid, entries):
    """直接设置用户的回复列表"""
    kv[str(uid)] = entries

# ==================== 滑动窗口：删除多余回复 ====================

async def trim_old_replies(bot, kv, uid, keep_count):
    """
    保留最新的 keep_count 条，删除多余的
    返回实际删除的数量
    """
    entries = kv_get_replies(kv, uid)
    if len(entries) <= keep_count:
        return 0

    # 按时间排序，最旧的在前
    entries.sort(key=lambda e: e.get("timestamp", 0))
    to_delete = entries[:len(entries) - keep_count]
    to_keep = entries[len(entries) - keep_count:]
    deleted = 0

    for entry in to_delete:
        try:
            biz_id = entry.get("business_connection_id")
            if biz_id:
                await bot.delete_business_messages(
                    business_connection_id=biz_id,
                    message_ids=[entry["message_id"]],
                )
            else:
                await bot.delete_message(
                    chat_id=entry["chat_id"],
                    message_id=entry["message_id"],
                )
            deleted += 1
        except Exception as e:
            print(f"[WARN] 删除旧回复失败 msg_id={entry['message_id']}: {e}")

    kv_set_replies(kv, uid, to_keep)
    save_kv(kv)

    if deleted > 0:
        print(f"[KV] 已删除 {deleted} 条旧回复，保留 {len(to_keep)} 条")

    return deleted

# ==================== 正在输入状态 ====================

async def send_typing_action(bot, msg, media_type=None):
    action_map = {
        "video": "upload_video",
        "photo": "upload_photo",
        "audio": "upload_audio",
        "document": "upload_document",
        "animation": "upload_video",
    }
    action = action_map.get(media_type, "typing")
    try:
        await bot.send_chat_action(
            chat_id=msg.chat.id,
            action=action,
            business_connection_id=msg.business_connection_id,
        )
    except Exception as e:
        print(f"[WARN] sendChatAction 失败: {e}")

# ==================== 发送消息 ====================

async def send_reply(bot, msg, reply_data, config):
    chat_id = msg.chat.id
    biz_id = msg.business_connection_id
    text = reply_data["text"]
    buttons = reply_data.get("buttons")
    media = reply_data.get("media")

    reply_markup = None
    if buttons and isinstance(buttons, list):
        keyboard = []
        for row in buttons:
            if isinstance(row, list):
                keyboard.append([
                    InlineKeyboardButton(
                        text=btn["text"],
                        url=btn.get("url"),
                        callback_data=btn.get("callback_data"),
                    ) for btn in row
                ])
            elif isinstance(row, dict):
                keyboard.append([
                    InlineKeyboardButton(
                        text=row["text"],
                        url=row.get("url"),
                        callback_data=row.get("callback_data"),
                    )
                ])
        reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)

    reply_params = ReplyParameters(message_id=msg.message_id) if config.get("reply_mode", True) else None

    kwargs = {
        "chat_id": chat_id,
        "business_connection_id": biz_id,
        "reply_parameters": reply_params,
        "reply_markup": reply_markup,
    }

    if media and media.get("url"):
        media_type = media.get("type", "document")
        media_url = media["url"]

        send_map = {
            "photo": ("send_photo", "photo"),
            "video": ("send_video", "video"),
            "audio": ("send_audio", "audio"),
            "animation": ("send_animation", "animation"),
        }

        method_name, field = send_map.get(media_type, ("send_document", "document"))
        method = getattr(bot, method_name)
        sent = await method(**{field: media_url, "caption": text, "parse_mode": "HTML", **kwargs})
    else:
        sent = await bot.send_message(text=text, parse_mode="HTML", **kwargs)

    return sent

# ==================== 主程序 ====================

async def main():
    global default_reply_pool, default_reply_original

    bot = Bot(TOKEN, default=DefaultBotProperties(parse_mode="HTML"))
    offset = None

    print("=" * 55)
    print("  TGDM Bot 已启动 (Python + aiogram)")
    print("=" * 55)
    print("  支持标签: <yy> <yyzd> <dk> <jd> <xt> <sc> <xh>")
    print("            <js> <jh> <lj> <tj> <em> </n>")
    print("  功能: 优先级 / 媒体回复 / 按钮 / 冷却 / 正在输入")
    print("        滑动窗口保留N条回复 (keep_last_count)")
    print("  延迟单位: 毫秒 (ms)")
    print("  默认回复: 不重复随机（发完一轮再重新洗牌）")
    print("=" * 55)

    while True:
        try:
            updates = await bot.get_updates(
                offset=offset,
                timeout=60,
                allowed_updates=["business_message"],
            )

            for upd in updates:
                offset = upd.update_id + 1
                msg = upd.business_message

                if not msg:
                    continue

                config = load_config()

                if not config.get("enabled", True):
                    continue

                # 配置变化时重置回复池
                current_default = config.get("default_reply")
                if isinstance(current_default, list) and current_default != default_reply_original:
                    init_reply_pool()

                uid = msg.from_user.id

                # 忽略 owner
                if config.get("ignore_owner", True) and uid == config.get("owner_id"):
                    continue

                # 黑名单
                if uid in config.get("blacklist", []):
                    continue

                # 更新用户记录
                users = load_users()
                update_user(users, msg)

                # 冷却检查
                cooldown_cfg = config.get("cooldown", {})
                if cooldown_cfg.get("enabled", False):
                    now = time.time()
                    last = cooldown_map.get(uid)
                    cd_seconds = cooldown_cfg.get("seconds", 30)
                    if last and (now - last) < cd_seconds:
                        print(f"[COOLDOWN] 忽略 {uid} (剩余 {cd_seconds - (now - last):.1f}s)")
                        continue
                    cooldown_map[uid] = now

                # 匹配回复
                reply_data = get_reply_data(msg.text, config, uid)
                if not reply_data["text"] and not reply_data.get("media", {}).get("url"):
                    print(f"[WARN] 无回复内容: {msg.text}")
                    continue

                # 正在输入状态
                if config.get("typing_enabled", False):
                    media_type = reply_data.get("media", {}).get("type") if reply_data.get("media") else None
                    await send_typing_action(bot, msg, media_type)

                # 延迟
                delay_cfg = config.get("delay", {})
                if delay_cfg.get("enabled", False):
                    min_d = delay_cfg.get("min", 50) / 1000.0
                    max_d = delay_cfg.get("max", 100) / 1000.0
                    await asyncio.sleep(random.uniform(min_d, max_d))

                # 发送回复
                sent = await send_reply(bot, msg, reply_data, config)

                # 滑动窗口：保存 + 清理旧回复
                keep_count = get_keep_last_count(config)
                if keep_count > 0 and sent:
                    kv = load_kv()
                    kv_add_reply(kv, uid, {
                        "message_id": sent.message_id,
                        "chat_id": msg.chat.id,
                        "business_connection_id": msg.business_connection_id,
                    })
                    save_kv(kv)
                    await trim_old_replies(bot, kv, uid, keep_count)

                short_in = msg.text[:50] + "..." if msg.text and len(msg.text) > 50 else msg.text
                short_out = (reply_data["text"] or "")[:50] + "..." if reply_data["text"] and len(reply_data["text"]) > 50 else reply_data["text"]
                print(f"[{uid}] {short_in} -> {short_out}")

        except Exception as e:
            print(f"[ERROR] {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())