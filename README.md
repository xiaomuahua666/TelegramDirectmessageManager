# TGDM - Telegram 私聊机器人

提供两种部署方式：Python 版 和 Cloudflare Workers 版

## 文件结构

- main.py           # Python 版主程序
- config.json       # Python 版配置文件
- token.txt         # Python 版 Bot Token
- users.json        # Python 版用户数据（自动生成）
- worker.js         # Cloudflare Workers 版代码
- .gitignore        # Git 忽略文件
- LICENSE           # MIT 许可证
- README.md         # 本文件

## Python 版部署

### 1. 安装依赖

pip install aiogram

### 2. 获取 Bot Token

在 Telegram 中搜索 @BotFather，创建机器人并获取 Token。

### 3. 配置 Token

创建 token.txt 文件，写入你的 Token（仅一行）

### 4. 配置 config.json

{
  "enabled": true,
  "owner_id": 你的TelegramID,
  "ignore_owner": true,
  "reply_mode": true,
  "delay": {
    "enabled": true,
    "min": 50,
    "max": 100
  },
  "default_reply": [
    "[AutoReply] 你好，有什么可以帮助你的吗？",
    "[AutoReply] 请稍等，我会尽快回复你的。"
  ],
  "rules": [
    {
      "keywords": ["你好", "您好"],
      "reply": "你好呀！"
    }
  ],
  "blacklist": []
}

### 5. 运行

python main.py

## Cloudflare Workers 版部署

### 1. 获取 Bot Token（同上）

### 2. 创建 Worker

登录 Cloudflare 仪表板 -> Workers & Pages -> 创建 Worker

### 3. 粘贴代码

将 worker.js 中的代码复制粘贴到 Worker 编辑器，点击部署

### 4. 配置环境变量

进入 Worker -> 设置 -> 变量，添加：

密钥类型：TG_TOKEN = 你的 Bot Token

纯文本类型：
- BOT_ENABLED = true
- OWNER_ID = 你的 Telegram ID
- IGNORE_OWNER = true
- REPLY_MODE = true
- DELAY_ENABLED = true
- DELAY_MIN = 50
- DELAY_MAX = 100

JSON 类型：
- DEFAULT_REPLY = ["回复1", "回复2", "回复3"]
- RULES = [{"keywords":["你好"],"reply":"你好呀"}]
- BLACKLIST = []

### 5. 设置 Webhook

访问 https://你的worker域名/setup

### 6. 测试

给 Bot 发消息

## 自定义标签语法

<yy>text</yy>      -> 引用
<jd>text</jd>      -> 加粗
<xt>text</xt>      -> 斜体
<dk>text</dk>      -> 行内代码
<js>text</js>      -> 代码块
<jh>text</jh>      -> 剧透
<lj url="URL">text</lj> -> 超链接
<tj>user_id</tj>   -> 用户提及
</n>               -> 换行

## 许可证

MIT License