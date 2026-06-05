import asyncio
import json
import os
import random
import re
import time
from copy import deepcopy

import aiohttp
from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.types import ReplyParameters

_R1 = "https://pan.mahua.uk/f/jrJhV/rules.json"
_R2 = "https://pan.mahua.uk/f/kEqiB/default_reply.json"
_R3 = "https://pan.mahua.uk/f/yZlsr/blacklist.json"
_R_TTL = 10

_rc = {
    "d": {"d": None, "t": 0},
    "r": {"d": None, "t": 0},
    "b": {"d": None, "t": 0},
}

def load_token():
    with open("token.txt", "r", encoding="utf-8") as f:
        return f.read().strip()

TOKEN = load_token()

CONFIG_FILE = "config.json"
USERS_FILE = "users.json"

default_reply_pool = []
default_reply_original = []

async def _fetch(session, url, ce):
    now = time.time()
    if ce["d"] is not None and (now - ce["t"]) < _R_TTL:
        return ce["d"]
    try:
        async with session.get(url) as resp:
            if resp.status != 200:
                raise Exception(f"HTTP {resp.status}")
            data = await resp.json()
            ce["d"] = data
            ce["t"] = now
            return data
    except Exception as e:
        print(f"[WARN] {e}")
        return ce["d"]

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
        users[uid]["message_count"] += 1
        users[uid]["username"] = msg.from_user.username
        users[uid]["first_name"] = msg.from_user.first_name
    save_users(users)

def convert_custom_tags_to_html(text):
    if not text:
        return text

    text = text.replace('</n>', '\n')

    def replace_lj(match):
        return f'<a href="{match.group(1)}">{match.group(2)}</a>'
    text = re.sub(r'<lj\s+url="([^"]+)"\s*>([\s\S]*?)</lj>', replace_lj, text)

    def replace_tj(match):
        return f'<a href="tg://user?id={match.group(1)}">{match.group(1)}</a>'
    text = re.sub(r'<tj>([\s\S]*?)</tj>', replace_tj, text)

    tag_map = {
        ('<yy>', '</yy>'):     ('<blockquote>', '</blockquote>'),
        ('<yyzd>', '</yyzd>'): ('<blockquote expandable>', '</blockquote>'),
        ('<dk>', '</dk>'):     ('<code>', '</code>'),
        ('<jd>', '</jd>'):     ('<b>', '</b>'),
        ('<xt>', '</xt>'):     ('<i>', '</i>'),
        ('<sc>', '</sc>'):     ('<s>', '</s>'),
        ('<xh>', '</xh>'):     ('<u>', '</u>'),
        ('<js>', '</js>'):     ('<pre>', '</pre>'),
        ('<jh>', '</jh>'):     ('<tg-spoiler>', '</tg-spoiler>'),
    }

    for (custom_open, custom_close), (html_open, html_close) in tag_map.items():
        pattern = re.escape(custom_open) + r'([\s\S]*?)' + re.escape(custom_close)
        text = re.sub(pattern, lambda m: f'{html_open}{m.group(1)}{html_close}', text)

    return text

def _merge(config, rr, rd, rb):
    if rr and isinstance(rr, list):
        config["rules"] = config.get("rules", []) + rr
    if rd and isinstance(rd, list):
        config["default_reply"] = config.get("default_reply", []) + rd
    if rb and isinstance(rb, list):
        config["blacklist"] = config.get("blacklist", []) + rb
    return config

def get_default_reply(default_reply_config):
    global default_reply_pool, default_reply_original

    if isinstance(default_reply_config, str):
        return default_reply_config

    if isinstance(default_reply_config, list):
        if not default_reply_pool:
            default_reply_original = deepcopy(default_reply_config)
            default_reply_pool = deepcopy(default_reply_config)
            random.shuffle(default_reply_pool)
        return default_reply_pool.pop()

    return ""

def get_reply(text, config):
    text = (text or "").lower()

    for rule in config["rules"]:
        for keyword in rule["keywords"]:
            if keyword.lower() in text:
                reply = rule["reply"]
                return convert_custom_tags_to_html(reply)

    default_reply_config = config["default_reply"]
    reply = get_default_reply(default_reply_config)

    return convert_custom_tags_to_html(reply)

async def main():
    global default_reply_pool, default_reply_original

    bot = Bot(
        TOKEN,
        default=DefaultBotProperties(
            parse_mode="HTML"
        )
    )

    offset = None
    session = None

    print("TGDM 已启动")

    while True:
        try:
            if session is None:
                session = aiohttp.ClientSession()

            updates = await bot.get_updates(
                offset=offset,
                timeout=60,
                allowed_updates=["business_message"]
            )

            for upd in updates:
                offset = upd.update_id + 1

                msg = upd.business_message

                if not msg:
                    continue

                config = load_config()

                rr, rd, rb = await asyncio.gather(
                    _fetch(session, _R1, _rc["r"]),
                    _fetch(session, _R2, _rc["d"]),
                    _fetch(session, _R3, _rc["b"]),
                )
                config = _merge(config, rr, rd, rb)

                if not config.get("enabled", True):
                    continue

                current_default = config.get("default_reply")
                if isinstance(current_default, list) and current_default != default_reply_original:
                    default_reply_pool = []
                    default_reply_original = []

                uid = msg.from_user.id

                if (
                    config.get("ignore_owner", True)
                    and uid == config.get("owner_id")
                ):
                    continue

                if uid in config.get("blacklist", []):
                    continue

                users = load_users()
                update_user(users, msg)

                reply = get_reply(msg.text, config)

                delay_cfg = config.get("delay", {})

                if delay_cfg.get("enabled", False):
                    min_delay = delay_cfg.get("min") / 1000.0
                    max_delay = delay_cfg.get("max") / 1000.0
                    await asyncio.sleep(random.uniform(min_delay, max_delay))

                kwargs = {
                    "chat_id": msg.chat.id,
                    "text": reply,
                    "business_connection_id": msg.business_connection_id
                }

                if config.get("reply_mode", True):
                    kwargs["reply_parameters"] = ReplyParameters(
                        message_id=msg.message_id
                    )

                await bot.send_message(**kwargs)

                print(f"[{uid}] {msg.text} -> {reply}")

        except Exception as e:
            print("ERROR:", e)
            if session:
                await session.close()
                session = None
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())