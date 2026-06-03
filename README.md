# TGDM - Telegram 私聊机器人

一个功能完整的 Telegram 私聊机器人，支持自定义标签格式、不重复随机回复、用户统计等功能。

## 功能特性

- ✅ 自动回复（关键词匹配 + 默认回复）
- ✅ 自定义标签转 HTML 格式（引用、加粗、斜体、代码块等）
- ✅ 不重复随机默认回复（一轮内不重复）
- ✅ 用户数据统计（首次对话时间、消息数量等）
- ✅ 毫秒级延迟响应
- ✅ 配置热加载（修改 config.json 即时生效）
- ✅ 黑名单功能
- ✅ 支持 Business 账号

## 文件结构

```
├── main.py          # 主程序
├── config.json      # 配置文件
├── token.txt        # Bot Token（仅一行）
└── users.json       # 用户数据（自动生成）
```

## 安装与运行

### 1. 安装依赖

```bash
pip install aiogram
```

### 2. 获取 Bot Token

在 Telegram 中搜索 [@BotFather](https://t.me/BotFather)，创建机器人并获取 Token。

### 3. 配置 Token

创建 `token.txt` 文件，写入你的 Token（仅一行）：

```
BotFather创建自己的
```

### 4. 配置 config.json

```json
{
  "enabled": true,
  "owner_id": 本人TelegramID,
  "ignore_owner": true,
  "reply_mode": true,
  "delay": {
    "enabled": true,
    "min": 100,
    "max": 200
  },
  "default_reply": [
    "填内容 1",
    "填内容 2"
  ],
  "rules": [
    {
      "keywords": ["关键词 1", "关键词 2"],
      "reply": "填内容"
    },
    {
      "keywords": ["关键词 1", "关键词 2", "关键词 3"],
      "reply": "填内容"
    }
  ],
  "blacklist": []
}
```

### 5. 运行

```bash
python main.py
```

## 配置文件说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `enabled` | boolean | 机器人总开关 |
| `owner_id` | int | 管理员 ID |
| `ignore_owner` | boolean | 是否忽略管理员消息 |
| `reply_mode` | boolean | 是否引用回复原消息 |
| `delay.enabled` | boolean | 是否启用延迟 |
| `delay.min` | int | 最小延迟（毫秒） |
| `delay.max` | int | 最大延迟（毫秒） |
| `default_reply` | string/array | 默认回复（数组时为随机不重复） |
| `rules` | array | 关键词匹配规则 |
| `blacklist` | array | 黑名单用户 ID 列表 |

## 自定义标签语法

| 标签 | 功能 | 示例 |
|------|------|------|
| `<yy>text</yy>` | 引用 | `<yy>这是一段引用</yy>` |
| `<yyzd>text</yyzd>` | 可折叠引用 | `<yyzd>点我展开</yyzd>` |
| `<dk>text</dk>` | 等宽/行内代码 | `<dk>print("hello")</dk>` |
| `<jd>text</jd>` | 加粗 | `<jd>重要内容</jd>` |
| `<xt>text</xt>` | 斜体 | `<xt>强调一下</xt>` |
| `<sc>text</sc>` | 删除线 | `<sc>过期信息</sc>` |
| `<xh>text</xh>` | 下划线 | `<xh>重点标记</xh>` |
| `<js>text</js>` | 代码块 | `<js>def test(): return True</js>` |
| `<jh>text</jh>` | 剧透/模糊 | `<jh>猜猜是什么</jh>` |
| `<lj url="URL">text</lj>` | 超链接 | `<lj url="https://example.com">点击</lj>` |
| `<tj>user_id</tj>` | 用户提及 | `<tj>5455684444</tj>` |
| `</n>` | 换行 | `第一行</n>第二行` |

## 标签嵌套规则

- ✅ 可嵌套：`<jd>`、`<xt>`、`<xh>`、`<sc>`、`<jh>`
- ✅ 可嵌套：`<yy>` 内可包含上述格式
- ❌ 不可嵌套：`<dk>`、`<js>`、`<yy>` 内不能再套 `<yy>`

## 注意事项

1. **Token 安全**：`token.txt` 不要上传到公开仓库
2. **Business 账号**：默认使用 `business_message`，普通账号需改为 `message`
3. **延迟单位**：配置中的 `min`/`max` 单位为毫秒（ms）
4. **热加载**：修改 `config.json` 后下一条消息即生效，无需重启

## 常见问题

### Q: 机器人没有反应？

A: 检查以下几点：
- `token.txt` 是否正确
- `config.json` 中 `enabled` 是否为 `true`
- 如果是普通账号，将 `allowed_updates` 中的 `business_message` 改为 `message`

### Q: 如何获取用户 ID？

A: 用户给机器人发消息后，查看控制台打印的 `[uid]` 即可看到。

### Q: 默认回复如何添加更多？

A: 将 `default_reply` 改为数组，添加更多文案即可：

```json
"default_reply": ["文案1", "文案2", "文案3"]
```

## 许可证

MIT License