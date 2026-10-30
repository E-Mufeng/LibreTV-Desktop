# LibreTV Desktop（非官方桌面整合版）

基于 [LibreSpark/LibreTV](https://github.com/LibreSpark/LibreTV) v2.21.1，保留 **AGPL-3.0-or-later**。
本仓库记录桌面整合与功能增量，不是 LibreSpark 官方桌面发行。

## 下载与使用

从本仓库 Releases 下载 `LibreTV-Desktop-1.1.0-win-x64.exe`，放入可写目录启动。
Windows x64，无需另装 Node.js；当前成品未签名。默认本机访问密码 `123`。
仅监听 `127.0.0.1:28921`；会话签名密钥在本机首次运行随机生成。
配置、收藏、观看历史、下载和日志放在EXE旁 `LibreTV-data/`，不随本仓库和附件公开。

**新安装没有预置点播源。** 本机的7路源是外置数据，不是EXE默认预置。
可在设置中导入独立的 `sources.public.json`（同样附于Release）；它只含公开接口，无账号、令牌、观看记录。
已有使用者可先导出自己的源列表，注意避免重复；不要覆盖自己的完整用户数据目录。

## 1.1.0 增量

- 电影/电视剧、题材、地区、单年/年代和排序组合选片及分页；保留热门推荐。
- 复用原影片卡片、搜索与播放器；选片后仍需已配置源具有资源。
- 桌面增加读取外置 `sources.json` 的预置机制；公开列表含7路接口，可用性会变化。
- Electron便携EXE、内嵌本地服务、独立用户数据、帮助菜单中的对应源码和许可证。

开发与原项目验证证据日期为 **2026-10-30**；首次公开不是今天实现了整个上游产品。
既有证据：551项应用测试、4项桌面策略测试、lint/typecheck、生产构建及EXE启动抽检通过。
本次发布检查范围见 [PUBLICATION.md](PUBLICATION.md)，短时播放抽检不等于全库或长期稳定验证。

## 源码与重建

见 [desktop/BUILD-DESKTOP.md](desktop/BUILD-DESKTOP.md)。Release的 `*-source.zip`
与EXE内嵌对应源码字节一致。仓库产品源码与它一致，首页、发布说明和公开源列表是额外文档。
原上游说明保留在 [UPSTREAM-README.md](UPSTREAM-README.md)，许可证见 [LICENSE](LICENSE)。
