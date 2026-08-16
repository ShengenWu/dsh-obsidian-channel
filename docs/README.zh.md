# dsh-obsidian-channel

[English](../README.md) · 中文

[![version](https://img.shields.io/badge/version-0.1.0-0f766e?style=flat-square)](https://github.com/ShengenWu/dsh-obsidian-channel/releases)
[![dsh](https://img.shields.io/badge/dsh-0.1.0--rc.6-7c3aed?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness)
[![license](https://img.shields.io/badge/license-MIT-2563eb?style=flat-square)](../LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square)](https://nodejs.org)
[![topic](https://img.shields.io/badge/topic-dsh--plugin-111827?style=flat-square)](https://github.com/topics/dsh-plugin)

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 里管本地 Obsidian 库。

点侧边栏的 📓，会打开这个库的首页。从首页丢一句话给 agent，它会在库里读笔记、写日记、改双链。改库之前会先问你；改完能一笔一笔撤回。Obsidian 本身不用开。

## 你需要什么

- 已安装并能跑起来的 **dsh web**
- 适配版本：**dsh `0.1.0-rc.6`**
- 本机有一个普通的 Obsidian vault 目录


## 安装

```bash
dsh plugin --profile web add github:ShengenWu/dsh-obsidian-channel
```

然后重启 `dsh web`，打开 http://127.0.0.1:3080 。

本地开发可以改成 `dsh plugin --profile web add /你的/checkout/路径`。

## 第一次用

1. 点左侧 📓 **Obsidian**。
2. 如果还没绑过库，填 vault 的**绝对路径**（macOS / Linux 类似 `/Users/you/Notes`，Windows 类似 `D:\Notes`），点绑定。
3. 你会看到库首页：今日日记、最近改过的笔记、本插件留下的变更、断链。
4. 点一条笔记或点「写今日日记」之类的快捷操作。dsh 会在这个 vault 上开一个**新会话**，把草稿放进输入框。你改完再自己发送，插件不会偷偷帮你发出去。

绑定过一次就会记住。之后点 📓 只是打开首页，不会再新建一个工作区。

![库首页](homepage.png)

## 平时怎么用

**从首页聊。** 点笔记、点断链、或者自己在底栏打字。每次都是新的 vault 会话，避免跟上一轮对话缠在一起。

**日记跟着 Obsidian 走。** 首页和 agent 会先读库里的 `.obsidian/daily-notes.json`。你在 Obsidian 里把日记设成 `Daily` + `MM-DD-YYYY`，这里就不会自作聪明改成别的格式。真要覆盖，去 Settings → Obsidian。

**改库要过你这一关。** 默认每次写入都会弹出审批。你可以改成「这一轮任务里同类写入只问一次」，也可以改成不问（不建议）。

**写错了就撤回。** Settings → Obsidian 下面有变更历史，能看改前改后，一键回滚。回滚自己也会留一条记录，还可以再撤。

**在设置里改这些：**

- vault 路径
- 写入要不要问你
- 日记目录和日期格式（可选，不填就用 Obsidian 自己的）
- 额外不让碰的目录
- 变更记录留多久（默认 30 天）

![设置](setting.png)

vault 会话默认会走 **Obsidian 模式**：不干涉其他工作空间的模式设定，人设按「帮你整理知识库」来，而不是按写代码来。

读笔记用 dsh 自带的 read / grep / glob 就行。真正改笔记（新建、整篇替换、追加、删除）请让它走 `obsidian_*` 工具，这样才进变更记录、才能撤回。插件会拦住对着这个 vault 的原生 write / edit。


## 0.1.0 里有什么

- [x] 侧边栏入口和库首页（今日 / 最近 / 变更 / 断链 / 快捷操作）
- [x] 带审批的新建、更新、追加、删除、批量改
- [x] 变更日志和一键回滚
- [x] 设置页（绑库、审批策略、日记习惯）
- [x] 日记路径跟 Obsidian 设置对齐
- [x] vault 会话默认 Obsidian 模式；只有在这个库里才会加 vault 说明
- [x] 原生 write / edit 进 vault 会被拒绝
- [ ] 日记 / 模板 / 图谱工具 — 按模板建卡、出周报、扫孤儿笔记；首页已经能看断链，还没有专用工具
- [ ] 跨会话 skill — 写代码的会话里说一句「把今天的活写进日记」，也知道该改哪个库、用哪套写工具
- [ ] 输入框 `[[` 补全 — 打双链时按笔记标题补全

已知限制：agent 如果用 `bash` 直接改文件，还绕得过我们的写守卫，这种改动不会进变更记录。vault 会话里尤其要注意。

## 许可

[MIT](../LICENSE)

欢迎大家提issue：<https://github.com/ShengenWu/dsh-obsidian-channel/issues>

本仓库代码使用 dsh、Grok 4.6 以及 DeepSeek-v4-Pro-0813 构建。
