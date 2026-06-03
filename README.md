# TGDM - Telegram 私聊机器人

[![Cloudflare Workers](https://img.shields.io/badge/cloudflare-workers-orange.svg)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

TGDM 是一个功能完备的 Telegram 私聊机器人，支持**自定义标签格式**、**关键词匹配**、**媒体回复**、**内联按钮**、**冷却时间**等核心功能，旨在帮助用户高效管理和自动化 Telegram 私聊互动。

## 部署方式

TGDM 提供两种灵活的部署方案，以适应不同的使用场景和技术偏好：

*   **🐍 Python 版**：适用于拥有 VPS 或本地服务器的用户，提供更强的自定义能力和数据持久化。
*   **☁️ Cloudflare Workers 版**：基于无服务器架构，利用 Cloudflare 的免费额度即可运行，部署简便，适合轻量级应用。

## 目录

*   [功能特性](#-功能特性)
*   [文件结构](#-文件结构)
*   [Python 版部署](#-python-版部署)
*   [Cloudflare Workers 版部署](#-cloudflare-workers-版部署)
*   [自定义标签语法](#-自定义标签语法)
*   [内联按钮](#-内联按钮)
*   [媒体回复](#-媒体回复)
*   [规则优先级与冷却时间](#-规则优先级与冷却时间)
*   [常见问题](#-常见问题)
*   [许可证](#-许可证)

## ✨ 功能特性

以下表格详细对比了 Python 版和 Cloudflare Workers 版的功能支持情况：

| 功能特性                   | Python 版 | Workers 版 | 备注                                   |
| :------------------------- | :-------- | :--------- | :------------------------------------- |
| 自动回复（关键词+默认）    | ✅        | ✅         |                                        |
| 自定义标签转 HTML          | ✅        | ✅         |                                        |
| 毫秒级延迟响应             | ✅        | ✅         |                                        |
| 黑名单功能                 | ✅        | ✅         |                                        |
| Business 账号支持          | ✅        | ✅         |                                        |
| 内联按钮（URL）            | ✅        | ✅         |                                        |
| 媒体回复（图片/视频/文件等）| ✅        | ✅         |                                        |
| Premium Emoji 发送         | ✅        | ✅         | 通过 `<em>` 标签实现                  |
| "正在输入"状态             | ✅        | ✅         | 可开关                                 |
| 用户冷却时间               | ✅        | ✅         | 纯内存实现，重启重置                   |
| 规则优先级                 | ✅        | ✅         | 多条规则同时命中时选最高优先级         |
| 全消息类型响应             | ✅        | ✅         | 图片/贴纸/文件等非文本消息也会自动回复 |
| 用户数据统计               | ✅        | ❌         |                                        |
| 不重复随机回复             | ✅        | ❌         |                                        |
| 配置热加载                 | ✅        | ⚠️         | Workers 版修改环境变量后需重新部署     |

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

## 🐍 Python 版部署

### 1. 安装依赖

```bash
pip install aiogram
```

### 2. 获取 Bot Token

在 Telegram 中搜索 `@BotFather`，创建机器人并获取您的 Bot Token。

### 3. 配置 Token

创建 `token.txt` 文件，并将您的 Bot Token 写入其中：

```text
你的BotToken
```

### 4. 配置 `config.json`

编辑 `config.json` 文件，根据您的需求进行配置：

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

**配置说明：**

| 字段          | 类型    | 说明                                     |
| :------------ | :------ | :--------------------------------------- |
| `enabled`     | boolean | 机器人总开关                             |
| `owner_id`    | int     | 管理员 Telegram ID                       |
| `ignore_owner`| boolean | 是否忽略管理员消息                       |
| `reply_mode`  | boolean | 是否引用回复原消息                       |
| `delay.enabled`| boolean | 是否启用延迟回复                         |
| `delay.min`   | int     | 最小延迟时间（毫秒）                     |
| `delay.max`   | int     | 最大延迟时间（毫秒）                     |
| `default_reply`| string/array | 默认回复内容，可为字符串或字符串数组     |
| `rules`       | array   | 关键词匹配规则，包含 `keywords` 和 `reply` |
| `blacklist`   | array   | 黑名单用户 ID 列表                       |

### 5. 运行

```bash
python main.py
```

### 注意事项

1.  **Token 安全**：请勿将 `token.txt` 上传到公开仓库。
2.  **Business 账号**：默认使用 `business_message`。普通账号需将 `main.py` 中的 `allowed_updates` 改为 `["message"]`。
3.  **热加载**：修改 `config.json` 后，下一条消息即可生效，无需重启机器人。

## ☁️ Cloudflare Workers 版部署

### 1. 获取 Bot Token

同 Python 版，通过 `@BotFather` 获取您的 Bot Token。

### 2. 创建 Worker

1.  登录 [Cloudflare 仪表板](https://dash.cloudflare.com/)。
2.  导航至 **Workers & Pages** → **创建 Worker**。
3.  将 Worker 命名为 `tgdm-bot`。

### 3. 粘贴代码

将 `worker.js` 文件中的代码复制并粘贴到 Cloudflare Worker 编辑器中，然后点击 **部署**。

### 4. 配置环境变量

进入 Worker 的 **设置** → **变量** 页面，添加以下环境变量：

**密钥类型：**

| 变量名           | 值           | 说明             |
| :--------------- | :----------- | :--------------- |
| `TG_TOKEN`       | 你的 Bot Token | 机器人 Token     |
| `ADMIN_TOKEN`    | 自定义密钥     | 管理端点鉴权 Token |
| `WEBHOOK_SECRET` | 自定义密钥     | Webhook 安全校验 Token |

**纯文本类型：**

| 变量名           | 值     | 默认值 | 说明                 |
| :--------------- | :----- | :----- | :------------------- |
| `BOT_ENABLED`    | `true` | `true` | 机器人总开关         |
| `OWNER_ID`       | 你的 ID | `null` | 管理员 Telegram ID   |
| `IGNORE_OWNER`   | `true` | `true` | 是否忽略管理员消息   |
| `REPLY_MODE`     | `true` | `true` | 是否引用回复原消息   |
| `DELAY_ENABLED`  | `true` | `true` | 是否启用延迟回复     |
| `DELAY_MIN`      | `50`   | `50`   | 最小延迟时间（毫秒） |
| `DELAY_MAX`      | `100`  | `100`  | 最大延迟时间（毫秒） |
| `TYPING_ENABLED` | `true` | `false`| 是否发送"正在输入"状态 |
| `COOLDOWN_ENABLED`| `false`| `false`| 是否启用用户冷却     |
| `COOLDOWN_SECONDS`| `30`   | `30`   | 冷却秒数             |

**JSON 类型：**

*   **`DEFAULT_REPLY`:**

    ```json
    [
      "<jh>[AutoReply]</jh></n></n><yy>你好，有什么可以帮助你的吗？</yy>",
      "<jh>[AutoReply]</jh></n></n><yy>请稍等，我会尽快回复你的。</yy>",
      "<jh>[AutoReply]</jh></n></n><yy>收到你的消息了，请等待主人回复。</yy>"
    ]
    ```

*   **`RULES`:**

    ```json
    [
      {
        "keywords": ["广告", "推广"],
        "reply": "<yy><jd><xt>广告勿扰😅</xt></jd></yy>"
      },
      {
        "keywords": ["1", "在吗"],
        "reply": "<jh>[AutoReply]</jh><yy>有</n>事</n>直</n>说</n>🙏</yy>",
        "buttons": [
          [
            { "text": "nohello", "url": "https://nohello.net" }
          ]
        ]
      },
      {
        "keywords": ["你好", "您好", "👋"],
        "reply": "<jh>[AutoReply]</jh></n></n>👋 你好！<yy>自述：<lj url=\"https://example.com\">这是我的网站</lj></yy></n><yy>Telegram：<tj>123456789</tj></yy>",
        "buttons": [
          [
            { "text": "💬 私聊", "url": "https://t.me/username" },
            { "text": "🌐 网站", "url": "https://example.com" }
          ]
        ],
        "priority": 10
      }
    ]
    ```

*   **`BLACKLIST`:**

    ```json
    []
    ```

### 5. 设置 Webhook

部署完成后，访问以下 URL 以设置 Webhook：

```
https://你的worker域名/setup?token=你的ADMIN_TOKEN
```

看到 `{"ok":true}` 即表示设置成功。

### 6. 测试

向您的 Bot 发送消息，验证自动回复功能是否正常工作。

### 调试端点

所有管理端点均需鉴权，请在请求中携带 `?token=你的ADMIN_TOKEN` 或在 Header 中设置 `Authorization: Bearer 你的ADMIN_TOKEN`。

| 路径              | 功能           | 鉴权 |
| :---------------- | :------------- | :--- |
| `/`               | 健康检查       | 否   |
| `/setup`          | 设置 Webhook   | 是   |
| `/webhook-info`   | 查看 Webhook 状态 | 是   |
| `/config`         | 查看当前配置摘要 | 是   |
| `/delete-webhook` | 删除 Webhook   | 是   |

### 注意事项

1.  **免费额度**：Cloudflare Workers 每天提供 10 万次请求的免费额度，个人使用完全足够。
2.  **配置修改**：修改环境变量后，Worker 会自动重新部署。
3.  **日志查看**：可在 Worker 的 **日志** 页面查看运行日志。
4.  **冷却时间**：基于内存实现，Worker 实例重启后冷却记录会重置。

## 🏷️ 自定义标签语法

TGDM 支持丰富的自定义标签，用于格式化机器人的回复消息，使其更具表现力。

| 标签                       | 功能         | 示例                                     |
| :------------------------- | :----------- | :--------------------------------------- |
| `<yy>text</yy>`            | 引用         | `<yy>这是一段引用</yy>`                 |
| `<yyzd>text</yyzd>`        | 可折叠引用   | `<yyzd>点我展开</yyzd>`                 |
| `<dk>text</dk>`            | 行内代码     | `<dk>print("hello")</dk>`              |
| `<jd>text</jd>`            | 加粗         | `<jd>重要内容</jd>`                     |
| `<xt>text</xt>`            | 斜体         | `<xt>强调一下</xt>`                     |
| `<sc>text</sc>`            | 删除线       | `<sc>过期信息</sc>`                     |
| `<xh>text</xh>`            | 下划线       | `<xh>重点标记</xh>`                     |
| `<js>text</js>`            | 代码块       | `<js>def test():\n  return True</js>` |
| `<jh>text</jh>`            | 剧透/模糊    | `<jh>猜猜是什么</jh>`                   |
| `<lj url="URL">text</lj>`| 超链接       | `<lj url="https://example.com">点击</lj>`|
| `<tj>user_id</tj>`        | 用户提及     | `<tj>123456789</tj>`                   |
| `<em id="数字ID">fallback</em>`| Premium Emoji | `<em id="6323518884347381156">👋</em>`|
| `</n>`                     | 换行         | `第一行</n>第二行`                       |

### 标签嵌套规则

*   ✅ **可嵌套**：`<jd>`、`<xt>`、`<xh>`、`<sc>`、`<jh>` 之间可互相嵌套。
*   ✅ **可嵌套**：`<yy>` 内可包含上述格式。
*   ❌ **不可嵌套**：`<dk>`、`<js>`、`<yy>` 内不能再嵌套 `<yy>`。

## 🔘 内联按钮

Workers 版支持在回复消息下方附加内联按钮，用于展示链接。

### 配置方式

在 `RULES` 规则中添加 `buttons` 字段即可：

```json
{
  "keywords": ["合作"],
  "reply": "感谢关注，请通过以下方式联系：",
  "buttons": [
    [
      { "text": "📧 邮件", "url": "mailto:hello@example.com" },
      { "text": "💬 私聊", "url": "https://t.me/username" }
    ],
    [
      { "text": "🌐 网站", "url": "https://example.com" }
    ]
  ]
}
```

### 格式说明

| 字段   | 类型   | 必填 | 说明                 |
| :----- | :----- | :--- | :------------------- |
| `text` | string | 是   | 按钮上显示的文字     |
| `url`  | string | 是   | 点击按钮跳转的链接   |

*   `buttons` 是二维数组，外层每个元素代表一行。
*   一行内可放置多个按钮，Telegram 会自动并排排列（建议 1-3 个）。
*   `url` 支持 `https://`、`tg://`、`mailto:` 等协议。
*   不配置 `buttons` 的规则将走纯文字回复，完全兼容。

## 🖼️ 媒体回复

Workers 版支持通过规则直接发送图片、视频、音频、文件等媒体内容，需提供公开直链 URL。

### 配置方式

在 `RULES` 规则中添加 `media` 字段：

```json
{
  "keywords": ["图片", "美图"],
  "reply": "送你一张好看的图 👇",
  "media": {
    "type": "photo",
    "url": "https://example.com/your-image.jpg"
  },
  "buttons": [
    [
      { "text": "🌐 查看原图", "url": "https://example.com/your-image.jpg" }
    ]
  ]
}
```

### 支持的媒体类型

| `type`     | 对应 API    | 说明   |
| :--------- | :---------- | :----- |
| `photo`    | `sendPhoto` | 图片   |
| `video`    | `sendVideo` | 视频   |
| `audio`    | `sendAudio` | 音频   |
| `document` | `sendDocument`| 文件   |
| `animation`| `sendAnimation`| GIF 动图 |

*   `reply` 字段会自动作为媒体的标题（caption）。
*   按钮（`buttons`）可同时使用，显示在媒体下方。
*   不配置 `media` 的规则将走原有纯文字/按钮回复。

## ⚡ 规则优先级与冷却时间

### 规则优先级

当多条规则同时命中时，系统将选择 `priority` 值最高的规则进行回复。

```json
{
  "keywords": ["你好", "hi"],
  "reply": "你好，我在的",
  "priority": 5
}
```

| 字段       | 类型   | 默认值 | 说明             |
| :--------- | :----- | :----- | :--------------- |
| `priority` | number | `0`    | 优先级，越大越优先 |

未设置 `priority` 的规则默认为 `0`，与原有行为一致。

### 用户冷却时间

此功能用于防止同一用户在短时间内反复触发机器人回复。

**环境变量配置：**

| 变量名             | 值     | 说明     |
| :----------------- | :----- | :------- |
| `COOLDOWN_ENABLED` | `true` | 开启冷却 |
| `COOLDOWN_SECONDS` | `30`   | 冷却秒数 |

冷却期间，该用户的消息将被机器人忽略。冷却记录存储在内存中，Worker 实例重启后将清空。

## ❓ 常见问题

<details>
<summary><b>Q: 机器人没有反应？</b></summary>

**Python 版：**

*   检查 `token.txt` 中的 Bot Token 是否正确。
*   检查 `config.json` 中 `enabled` 字段是否为 `true`。
*   如果使用的是普通 Telegram 账号，请将 `main.py` 中的 `allowed_updates` 从 `business_message` 改为 `["message"]`。

**Workers 版：**

*   检查 `TG_TOKEN` 环境变量是否正确设置。
*   检查 `BOT_ENABLED` 环境变量是否为 `true`。
*   访问 `/webhook-info?token=你的ADMIN_TOKEN` 调试端点查看 Webhook 状态。

</details>

<details>
<summary><b>Q: 如何获取用户 ID？</b></summary>

用户向机器人发送消息后：

*   **Python 版**：查看控制台打印的 `[uid]` 信息。
*   **Workers 版**：查看 Cloudflare Worker 的日志，或在消息中临时添加 `<tj>ID</tj>` 标签回复给用户。

</details>

<details>
<summary><b>Q: 默认回复如何添加更多？</b></summary>

将 `default_reply` 配置项改为一个字符串数组，例如：

```json
"default_reply": ["文案1", "文案2", "文案3"]
```

</details>

<details>
<summary><b>Q: 对方发图片/贴纸不会自动回复？</b></summary>

Workers 版已支持全消息类型响应（图片、贴纸、文件、语音等）。对方发送非文本消息时，机器人会走默认回复逻辑，日志显示为 `[图片]`、`[贴纸]` 等标记。

</details>

<details>
<summary><b>Q: 如何获取 Premium Emoji 的 ID？</b></summary>

1.  将已有的 Premium emoji 消息转发给 `@raw_data_bot`。
2.  在返回的 JSON 中搜索 `custom_emoji_id`，后面的数字即为 ID。
3.  在规则中使用：`<em id="数字ID">fallback emoji</em>`。

</details>

<details>
<summary><b>Q: Python 版和 Workers 版可以同时运行吗？</b></summary>

**不可以**。同一个 Bot Token 只能绑定一个消息接收端点（要么通过轮询，要么通过 Webhook）。建议您根据实际需求选择一种部署方式。

</details>

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源。

