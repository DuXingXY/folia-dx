# Folia DX 随机样式测试版

版本：`0.7.18-dx.1`，基于 Folia 0.7.18，发布平台为 Windows x64。

本 fork 提供歌词随机样式、全随机范围开关、收藏预设与收藏重命名。切歌随机默认关闭；手动随机或应用收藏会关闭自动切歌随机，使当前设置持续保留。需要继续自动随机时，可在外观设置重新开启「切歌随机」。

已移除下一首样式预计算与渲染器预加载。开启切歌随机后，在显示歌曲切换时即时选择样式。原项目的音频和歌词预取保持正常工作。

安装名称为 **Folia DX**，使用独立应用 ID 和用户配置目录。发布地址为 [DuXingXY/folia-dx Releases](https://github.com/DuXingXY/folia-dx/releases)，默认更新渠道为 Internal，通过 Releases 手动下载测试版。

当前发行包包含 Windows 壁纸辅助程序和固定版本 FFmpeg 音频运行时。Windows helper 采用此前从可信 Folia 安装包获取的二进制，其源目录与当前项目一致；SHA256 为 `F484041152ABB27A221D356584E8195A61CD981B278859AB0C6DE1E106B551D7`。源码位于 `packaging/windows/wallpaper-helper`，有 Rust 工具链时可使用 `npm run build:wallpaper-helper` 自行编译。

本次通过类型检查、104 项相关单元测试和 27 项浏览器组件测试。Linux/macOS 安装包与桌面模式尚未在本次发行中验证。
