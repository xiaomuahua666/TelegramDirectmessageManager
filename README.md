# TGDM - Telegram 私聊机器人

[![Python](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/)
[![Cloudflare Workers](https://img.shields.io/badge/cloudflare-workers-orange.svg)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

TGDM 是一个功能完备的 Telegram 私聊机器人，支持**自定义标签格式**、**关键词匹配**、**延迟回复**等核心功能，旨在帮助用户高效管理和自动化 Telegram 私聊互动。

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
*   [常见问题](#-常见问题)
*   [许可证](#-许可证)

## ✨ 功能特性

以下表格详细对比了 Python 版和 Cloudflare Workers 版的功能支持情况：

| 功能特性             | Python 版 | Workers 版 | 备注                                   |
| :------------------- | :-------- | :--------- | :------------------------------------- |
| 自动回复（关键词+默认） | ✅        | ✅         |                                        |
| 自定义标签转 HTML    | ✅        | ✅         |                                        |
| 毫秒级延迟响应       | ✅        | ✅         |                                        |
| 黑名单功能           | ✅        | ✅         |                                        |
| Business 账号支持    | ✅        | ✅         |                                        |
| 用户数据统计         | ✅        | ❌         |                                        |
| 不重复随机回复       | ✅        | ❌         |                                        |
| 配置热加载           | ✅        | ⚠️         | Workers 版修改环境变量后需重新部署 |

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

| 变量名     | 值         |
| :--------- | :--------- |
| `TG_TOKEN` | 你的 Bot Token |

**纯文本类型：**

| 变量名        | 值     |
| :------------ | :----- |
| `BOT_ENABLED` | `true` |
| `OWNER_ID`    | 你的 Telegram ID |
| `IGNORE_OWNER`| `true` |
| `REPLY_MODE`  | `true` |
| `DELAY_ENABLED`| `true` |
| `DELAY_MIN`   | `50`   |
| `DELAY_MAX`   | `100`  |

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
        "reply": "<jh>[AutoReply]</jh><yy>有</n>事</n>直</n>说</n>🙏</yy>"
      },
      {
        "keywords": ["你好", "您好", "👋"],
        "reply": "<jh>[AutoReply]</jh></n></n>👋 你好，我是机器人<yy>示例：<lj url=\"https://example.com\">这是我的网站</lj></yy></n><yy>Telegram：<tj>123456789</tj></yy>"
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
https://你的worker域名/setup
```

看到 `{"ok":true}` 即表示设置成功。

### 6. 测试

向您的 Bot 发送消息，验证自动回复功能是否正常工作。

### 调试端点

| 路径            | 功能           |
| :-------------- | :------------- |
| `/`             | 健康检查       |
| `/setup`        | 设置 Webhook   |
| `/webhook-info` | 查看 Webhook 状态 |
| `/delete-webhook`| 删除 Webhook   |
| `/config`       | 查看当前配置摘要 |

### 注意事项

1.  **免费额度**：Cloudflare Workers 每天提供 10 万次请求的免费额度，个人使用完全足够。
2.  **配置修改**：修改环境变量后，Worker 会自动重新部署。
3.  **日志查看**：可在 Worker 的 **日志** 页面查看运行日志。

## 🏷️ 自定义标签语法

TGDM 支持丰富的自定义标签，用于格式化机器人的回复消息，使其更具表现力。

| 标签           | 功能         | 示例                                     |
| :------------- | :----------- | :--------------------------------------- |
| `<yy>text</yy>` | 引用         | `<yy>这是一段引用</yy>`                 |
| `<yyzd>text</yyzd>`| 可折叠引用   | `<yyzd>点我展开</yyzd>`                 |
| `<dk>text</dk>`| 行内代码     | `<dk>print("hello")</dk>`              |
| `<jd>text</jd>`| 加粗         | `<jd>重要内容</jd>`                     |
| `<xt>text</xt>`| 斜体         | `<xt>强调一下</xt>`                     |
| `<sc>text</sc>`| 删除线       | `<sc>过期信息</sc>`                     |
| `<xh>text</xh>`| 下划线       | `<xh>重点标记</xh>`                     |
| `<js>text</js>`| 代码块       | `<js>def test():\n  return True</js>` |
| `<jh>text</jh>`| 剧透/模糊    | `<jh>猜猜是什么</jh>`                   |
| `<lj url="URL">text</lj>`| 超链接       | `<lj url="https://example.com">点击</lj>`|
| `<tj>user_id</tj>`| 用户提及     | `<tj>123456789</tj>`                   |
| `</n>`         | 换行         | `第一行</n>第二行`                       |

### 标签嵌套规则

*   ✅ **可嵌套**：`<jd>`、`<xt>`、`<xh>`、`<sc>`、`<jh>`
*   ✅ **可嵌套**：`<yy>` 内可包含上述格式
*   ❌ **不可嵌套**：`<dk>`、`<js>`、`<yy>` 内不能再嵌套 `<yy>`

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
*   访问 `/webhook-info` 调试端点查看 Webhook 状态。

</details>

<details>
<summary><b>Q: 如何获取用户 ID？</b></summary>

用户向机器人发送消息后：

*   **Python 版**：查看控制台打印的 `[uid]` 信息。
*   **Workers 版**：查看 Cloudflare Worker 的日志。

</details>

<details>
<summary><b>Q: 默认回复如何添加更多？</b></summary>

将 `default_reply` 配置项改为一个字符串数组，例如：

```json
"default_reply": ["文案1", "文案2", "文案3"]
```

</details>

<details>
<summary><b>Q: Python 版和 Workers 版可以同时运行吗？</b></summary>

**不可以**。同一个 Bot Token 只能绑定一个消息接收端点（要么通过轮询，要么通过 Webhook）。建议您根据实际需求选择一种部署方式。

</details>

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源。

---

<p align="center">
  Made with ❤️ for Telegram Bot Developers
</p>
