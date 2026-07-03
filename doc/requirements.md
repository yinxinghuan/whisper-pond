# Requirements

## 1. Overview

《Physics Pond》是一款参考 TroisJS Physics Demo 1 的 3D 物理感官玩具：500 个彩色小球在明亮舞台里受重力、挡板、侧墙和阴影影响滚落，玩家用手机点按、长按和拖动观察物理效果。

## 2. Visual Design

- 画面为竖屏全屏 3D 舞台，设计基准 390px × 680px，桌面端固定 390px × 680px，圆角 24px。
- 场景背景接近原版浅色展示环境，renderer clear color 和 scene background 均为 `#f8f7f2`。
- 外层 CSS 背景使用 `#f8f7f2` 到 `#e8e2d3` 渐变，并叠加中心白色径向光，整体必须明亮。
- 主体为 500 个 instanced 球体，视觉半径 0.15 world units，物理半径为 `0.1 * scale`，实例缩放 0.45 到 1.0，材质为 `MeshPhongMaterial(vertexColors=true)`。
- 球体几何写入全白 vertex color，再由 instance color 乘出真实球色；颜色从 4 组高饱和线性 RGB 调色盘循环，默认调色盘为蓝、红、黄、绿 4 色。
- 物理平面尺寸为 15 × 15 world units，位置 z=-0.16，颜色 `#e9e4d7`，接收阴影。
- 场景有 6 条交错挡板，视觉尺寸 3 × 0.05 × 0.5 world units，x 在 -1 和 1 间交替，y 为 `(i - 3.5) * 1.5`，z 旋转角为 `±Math.PI / 6`。
- 挡板碰撞体深度为 0.5 world units，对应 Cannon halfExtents z=0.25，用来拦住所有球体，避免球从挡板深度方向越过去。
- 两侧有不可见静态墙，位置 x=-1.72 和 x=1.72，高度 16 world units，厚度 0.16 world units，防止球从画面左右流失。
- 灯光必须清楚显示阴影：AmbientLight 白色 1.15、HemisphereLight 白色/暖地色 0.65、白色 SpotLight 强度 1.15 位于 `(0,1.2,3)`、红色 SpotLight 强度 0.8 位于 `(0,-1.2,3)`，两盏聚光灯都启用 1024 阴影贴图。
- 相机为 45° 透视相机，初始位置 `(0,0,7)`，OrbitControls 阻尼 0.08，距离限制 4.3 到 10。
- HUD 显示小球数量 500 和喷洒次数；底部提示字号 11px、字距 0.22em，不遮挡中央挡板。
- 素材清单：`public/img/aigram.svg` 作为右下角 52px 水印；其余视觉全部由 Three.js 几何、灯光、材质和 Cannon 物理生成。

## 3. Game Mechanics

- 物理世界使用 Cannon，重力为 `(0, -9.82, 0)`，固定步长 1/60s，每帧最多补 3 步。
- 初始创建 500 个 Cannon Sphere body，半径为 `0.1 * scale`，质量为 `scale * 0.012`，linearDamping=0.54，angularDamping=0.58。
- 每个球初始或重置时 x 在 -1.3 到 1.3 范围内，y 可在 -3 到 7 范围内，z 必须为 0。
- 每帧同步 mesh 前，强制 `body.position.z=0`、`body.velocity.z=0`、`body.force.z=0`，形成 2.5D 物理剖面但保留真实 3D 渲染、阴影、相机旋转和透视。
- 球体 y<-7.2 或 |x|>2.7 时重置到上方 y=5 到 7，防止越界后永久消失。
- 6 条挡板是 mass=0 的 Cannon Box static body，位置和旋转与 Three.js mesh 一致。
- 点按游戏区域喷出 36 个球；开始时自动喷出 44 个球；长按每 130ms 喷出 12 个球。
- 每次喷球会递增 sprays 计数，历史最高使用 `localStorage` 键 `whisper_pond_best` 持久化。
- 换色按钮或键盘 C 会循环切换调色盘，并更新 500 个 instanced color。
- 当前版本不设置失败、关卡和得分目标，只验证原版物理技术效果、亮度、挡板阻拦和手机操作。

## 4. Controls

- 开始按钮：`pointerdown` 进入物理场景，解锁音频，并立即喷出第一批球。
- 单指拖动：OrbitControls 旋转相机，允许玩家观察挡板透视、阴影和球体空间关系。
- 单指点按：移动距离未超过 OrbitControls 判定且按压小于 430ms 时喷出 36 个球。
- 单指长按：每 130ms 连续喷出 12 个球，松手停止。
- 换色按钮：循环切换 4 组调色盘。
- 键盘 Space：开始或喷出 44 个球；键盘 C：切换调色盘。
- 所有游戏动作使用 pointer 事件，不同时绑定 mouse 与 touch。

## 5. Win / Lose Conditions

- 当前版本没有胜利或失败条件。
- 开始页用于说明手机操作；体验中显示球数、喷洒次数和提示；结束页保留“再来一次 / 换色 / 返回首页”的结构但不自动触发。
- 历史最高记录为最大喷洒次数，不代表胜负，仅用于验证本地持久化和 UI 展示。
- 球体越界会自动回收，不作为失败。

## 6. Sound Effects

- 开始：triangle 波 300Hz 到 520Hz 持续 0.10s，音量 0.045；叠加 sine 波 620Hz 持续 0.12s，延迟 0.06s，音量 0.03。
- 喷球：square 波 180Hz 到 90Hz 持续 0.07s，音量 0.018；叠加 sine 波 `560 + paletteIndex * 45` Hz 持续 0.08s，音量 0.022。
- 换色：sine 波 `660 + paletteIndex * 70` Hz 持续 0.10s，音量 0.03。
- 音效使用 Web Audio 实时合成，不加载外部音频文件。
- 浏览器限制音频时静默失败，物理与视觉体验继续运行。
