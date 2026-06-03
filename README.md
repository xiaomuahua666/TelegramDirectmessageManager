# TGDM - Telegram 私聊机器人

<p align="center">
  <img src="https://img.shields.io/badge/python-3.8+-blue.svg" alt="Python">
  <img src="https://img.shields.io/badge/cloudflare-workers-orange.svg" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/telegram-bot-blue.svg" alt="Telegram Bot">
</p>

一个功能完整的 Telegram 私聊机器人，支持自定义标签格式、关键词匹配、延迟回复等功能。

**提供两种部署方式：**
- 🐍 **Python 版**：适合 VPS、本地服务器、Railway 等
- ☁️ **Cloudflare Workers 版**：适合无服务器环境，免费额度

---

## ✨ 功能特性

| 功能 | Python 版 | Workers 版 |
|------|:---------:|:----------:|
| 自动回复（关键词 + 默认） | ✅ | ✅ |
| 自定义标签转 HTML | ✅ | ✅ |
| 毫秒级延迟响应 | ✅ | ✅ |
| 黑名单功能 | ✅ | ✅ |
| Business 账号支持 | ✅ | ✅ |
| 用户数据统计 | ✅ | ❌ |
| 不重复随机回复 | ✅ | ❌ |
| 配置热加载 | ✅ | ⚠️* |

> *Workers 版修改环境变量后需重新部署

---

## 📁 文件结构

```

tgdm/
├── main.py              # Python 版主程序
├── config.json          # Python 版配置文件
├── token.txt            # Python 版 Bot Token
├── users.json           # Python 版用户数据（自动生成）
├── worker.js            # Cloudflare Workers 版代码
├── .gitignore           # Git 忽略文件
├── LICENSE              # MIT 许可证
└── README.md            # 本文件

```

---

## 🐍 Python 版部署

### 1️⃣ 安装依赖

```bash
pip install aiogram
```

2️⃣ 获取 Bot Token

在 Telegram 中搜索 @BotFather，创建机器人并获取 Token。

3️⃣ 配置 Token

创建 token.txt 文件，写入你的 Token：

```text
你的BotToken
```

4️⃣ 配置 config.json

```json
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
```

5️⃣ 运行

```bash
python main.py
```

📋 Python 版配置说明

字段 类型 说明
enabled boolean 机器人总开关
owner_id int 管理员 ID
ignore_owner boolean 是否忽略管理员消息
reply_mode boolean 是否引用回复原消息
delay.enabled boolean 是否启用延迟
delay.min int 最小延迟（毫秒）
delay.max int 最大延迟（毫秒）
default_reply string/array 默认回复（数组时为随机）
rules array 关键词匹配规则
blacklist array 黑名单用户 ID 列表

⚠️ Python 版注意事项

1. Token 安全：token.txt 不要上传到公开仓库
2. Business 账号：默认使用 business_message，普通账号需将 main.py 中的 allowed_updates 改为 ["message"]
3. 热加载：修改 config.json 后下一条消息即生效，无需重启

---

☁️ Cloudflare Workers 版部署

1️⃣ 获取 Bot Token

同上，通过 @BotFather 获取。

2️⃣ 创建 Worker

1. 登录 Cloudflare 仪表板
2. 进入 Workers & Pages → 创建 Worker
3. 命名为 tgdm-bot

3️⃣ 粘贴代码

将 worker.js 中的代码复制粘贴到 Worker 编辑器中，点击 部署。

4️⃣ 配置环境变量

进入 Worker → 设置 → 变量，添加以下变量：

🔐 密钥类型：

变量名 值
TG_TOKEN 你的 Bot Token

📝 纯文本类型：

变量名 值
BOT_ENABLED true
OWNER_ID 你的 Telegram ID
IGNORE_OWNER true
REPLY_MODE true
DELAY_ENABLED true
DELAY_MIN 50
DELAY_MAX 100

📦 JSON 类型：

DEFAULT_REPLY:

```json
[
  "<jh>[AutoReply]</jh></n></n><yy>你好，有什么可以帮助你的吗？</yy>",
  "<jh>[AutoReply]</jh></n></n><yy>请稍等，我会尽快回复你的。</yy>",
  "<jh>[AutoReply]</jh></n></n><yy>收到你的消息了，请等待主人回复。</yy>"
]
```

RULES:

```json
[
  {
    "keywords": ["广告", "推广"],
    "reply": "<yy><jd><xt>广告勿扰😅</xt></jd></yy>"
  },
  {
    "keywords": ["1", "在吗"],
    "reply": "<jh>[AutoReply]</jh><yy>有</n>事</n>直</n>说</n>🙏</yy>"
  },
  {
    "keywords": ["你好", "您好", "👋"],
    "reply": "<jh>[AutoReply]</jh></n></n>👋 你好，我是机器人<yy>示例：<lj url=\"https://example.com\">这是我的网站</lj></yy></n><yy>Telegram：<tj>123456789</tj></yy>"
  }
]
```

BLACKLIST:

```json
[]
```

5️⃣ 设置 Webhook

部署完成后，访问以下 URL：

```
https://你的worker域名/setup
```

看到 {"ok":true} 即表示成功。

6️⃣ 测试

给 Bot 发送消息，验证自动回复功能。

🔍 Workers 版调试端点

路径 功能
/ 健康检查
/setup 设置 Webhook
/webhook-info 查看 Webhook 状态
/delete-webhook 删除 Webhook
/config 查看当前配置摘要

⚠️ Workers 版注意事项

1. 免费额度：每天 10 万次请求，个人使用完全足够
2. 配置修改：修改环境变量后 Worker 会自动重新部署
3. 日志查看：进入 Worker → 日志 页面查看

---

🏷️ 自定义标签语法

标签 功能 示例
<yy>text</yy> 引用 <yy>这是一段引用</yy>
<yyzd>text</yyzd> 可折叠引用 <yyzd>点我展开</yyzd>
<dk>text</dk> 行内代码 <dk>print("hello")</dk>
<jd>text</jd> 加粗 <jd>重要内容</jd>
<xt>text</xt> 斜体 <xt>强调一下</xt>
<sc>text</sc> 删除线 <sc>过期信息</sc>
<xh>text</xh> 下划线 <xh>重点标记</xh>
<js>text</js> 代码块 <js>def test(): return True</js>
<jh>text</jh> 剧透/模糊 <jh>猜猜是什么</jh>
<lj url="URL">text</lj> 超链接 <lj url="https://example.com">点击</lj>
<tj>user_id</tj> 用户提及 <tj>123456789</tj>
</n> 换行 第一行</n>第二行

📐 标签嵌套规则

规则 说明
✅ 可嵌套 <jd>、<xt>、<xh>、<sc>、<jh>
✅ 可嵌套 <yy> 内可包含上述格式
❌ 不可嵌套 <dk>、<js>、<yy> 内不能再套 <yy>

---

❓ 常见问题

<details>
<summary><b>Q: 机器人没有反应？</b></summary>

Python 版：

· 检查 token.txt 是否正确
· 检查 config.json 中 enabled 是否为 true
· 普通账号将 allowed_updates 中的 business_message 改为 message

Workers 版：

· 检查 TG_TOKEN 环境变量是否正确设置
· 检查 BOT_ENABLED 是否为 true
· 访问 /webhook-info 查看 webhook 状态

</details>

<details>
<summary><b>Q: 如何获取用户 ID？</b></summary>

用户给机器人发消息后：

· Python 版：查看控制台打印的 [uid]
· Workers 版：查看 Worker 日志

</details>

<details>
<summary><b>Q: 默认回复如何添加更多？</b></summary>

将 default_reply 改为数组：

```json
"default_reply": ["文案1", "文案2", "文案3"]
```

</details>

<details>
<summary><b>Q: Python 版和 Workers 版可以同时运行吗？</b></summary>

不可以。同一个 Bot Token 只能绑定一个消息接收端点（要么轮询，要么 webhook）。建议选择一个部署方式。

</details>

---

📄 许可证

MIT License


```