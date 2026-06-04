import asyncio
import json
import os
import random
import re
import time
from copy import deepcopy

from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.types import ReplyParameters

# 从 token.txt 读取 TOKEN
def load_token():
    with open("token.txt", "r", encoding="utf-8") as f:
        return f.read().strip()

TOKEN = load_token()

CONFIG_FILE = "config.json"
USERS_FILE = "users.json"

# 全局变量：记录默认回复的待发队列
default_reply_pool = []
default_reply_original = []

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
        json.dump(
            users,
            f,
            ensure_ascii=False,
            indent=2
        )

def update_user(users, msg):
    uid = str(msg.from_user.id)
    
    if uid not in users:
        users[uid] = {
            "username": msg.from_user.username,
            "first_name": msg.from_user.first_name,
            "first_seen": int(time.time()),
            "last_seen": int(time.time()),
            "message_count": 1
        }
    else:
        users[uid]["last_seen"] = int(time.time())
        users[uid]["message_count"] += 1
        users[uid]["username"] = msg.from_user.username
        users[uid]["first_name"] = msg.from_user.first_name
    
    save_users(users)

def convert_custom_tags_to_html(text):
    """
    将自定义标签转换为 Telegram HTML 格式
    
    支持的标签：
    <yy>text</yy>        -> <blockquote>text</blockquote>
    <yyzd>text</yyzd>    -> <blockquote expandable>text</blockquote>
    <dk>text</dk>        -> <code>text</code>
    <jd>text</jd>        -> <b>text</b>
    <xt>text</xt>        -> <i>text</i>
    <sc>text</sc>        -> <s>text</s>
    <xh>text</xh>        -> <u>text</u>
    <js>text</js>        -> <pre>text</pre>
    <jh>text</jh>        -> <tg-spoiler>text</tg-spoiler>
    <lj url="URL">text</lj> -> <a href="URL">text</a>
    <tj>user_id</tj>     -> <a href="tg://user?id=user_id">user_id</a>
    </n>                 -> 换行符 \n
    """
    
    if not text:
        return text
    
    # 先处理换行标签
    text = text.replace('</n>', '\n')
    
    # 处理链接标签 <lj>
    def replace_lj(match):
        url = match.group(1)
        content = match.group(2)
        return f'<a href="{url}">{content}</a>'
    text = re.sub(r'<lj\s+url="([^"]+)"\s*>([\s\S]*?)</lj>', replace_lj, text)
    
    # 处理用户提及链接标签 <tj>
    def replace_tj(match):
        user_id = match.group(1)
        return f'<a href="tg://user?id={user_id}">{user_id}</a>'
    text = re.sub(r'<tj>([\s\S]*?)</tj>', replace_tj, text)
    
    # 标签映射表：其他基础标签
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

def get_default_reply(default_reply_config):
    """从不重复队列中获取默认回复"""
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
    
    print("TGDM 已启动")
    print("支持的标签：<yy>, <yyzd>, <dk>, <jd>, <xt>, <sc>, <xh>, <js>, <jh>, <lj url=\"...\">, <tj>, </n>")
    print("延迟单位：毫秒 (ms)")
    print("默认回复：不重复随机模式（发完一轮再重新随机）")
    
    while True:
        try:
            updates = await bot.get_updates(
                offset=offset,
                timeout=60,
                allowed_updates=[
                    "business_message"
                ]
            )
            
            for upd in updates:
                offset = upd.update_id + 1
                
                msg = upd.business_message
                
                if not msg:
                    continue
                
                config = load_config()
                
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
                
                reply = get_reply(
                    msg.text,
                    config
                )
                
                delay_cfg = config.get("delay", {})
                
                if delay_cfg.get("enabled", False):
                    min_delay = delay_cfg.get("min") / 1000.0
                    max_delay = delay_cfg.get("max") / 1000.0
                    await asyncio.sleep(
                        random.uniform(min_delay, max_delay)
                    )
                
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
                
                print(
                    f"[{uid}] "
                    f"{msg.text} "
                    f" -> "
                    f"{reply}"
                )
        
        except Exception as e:
            print("ERROR:", e)
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())