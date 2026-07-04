# Requirements

## 1. Overview

《Physics Pond》是一款 60 秒 3D 物理收集小游戏：500 个彩色小球沿交错挡板自然滚落，玩家通过旋转观察和点按换色，把落到底部的小球匹配到对应颜色收集槽得分。

## 2. Visual Design

- 画面为竖屏全屏 3D 舞台，设计基准 390px × 680px，桌面端固定 390px × 680px，圆角 24px。
- 场景背景接近原版浅色展示环境，renderer clear color 和 scene background 均为 `#f8f7f2`。
- 外层 CSS 背景使用 `#f8f7f2` 到 `#e8e2d3` 渐变，并叠加中心白色径向光，整体必须明亮。
- 主体为 500 个 instanced 球体，视觉半径和物理基准半径均为 0.1 world units，实例缩放 0.2 到 1.0，材质为 `MeshToonMaterial(vertexColors=true)`。
- 球体几何写入全白 vertex color，再由 instance color 乘出真实球色；颜色从 4 组 5 色调色盘循环。
- 物理平面尺寸为 15 × 15 world units，位置 z=-0.1，颜色 `#aaaaaa`，接收阴影。
- 场景有 6 条交错挡板，视觉尺寸 3 × 0.05 × 0.2 world units，x 在 -1 和 1 间交替，y 为 `(i - 3.5) * 1.5`，z 旋转角为 `±Math.PI / 6`。
- 挡板碰撞体深度为 0.2 world units，对应 Cannon halfExtents z=0.1；球体每帧锁定 z=0，避免从挡板深度方向越过去。
- 底部显示 3 个颜色收集槽，场景内位置 x=-1.05、0、1.05，y=-5.9，尺寸 0.82 × 0.10 × 0.22 world units；同时底部 HUD 显示 3 条 10px 高的同色短条，宽度不超过 224px，颜色取当前调色盘第 1、2、3 色。
- 灯光显示清楚阴影：AmbientLight 白色 1.15、HemisphereLight 白色/暖地色 0.45、白色 SpotLight 强度 0.72 位于 `(0,1,2)`、红色 SpotLight 强度 0.58 位于 `(0,-1,2)`，两盏聚光灯都启用 1024 阴影贴图。
- 相机为 45° 透视相机，初始位置 `(0,0,7)`，OrbitControls 阻尼 0.08，距离限制 4.3 到 10。
- HUD 顶部左侧显示剩余秒数，右侧显示得分；底部提示字号 11px、字距 0.22em，不遮挡中央挡板。
- 右下角使用 `public/img/aigram.svg` 新版 AlterU 单色竖向 mark，宽 28px，透明度 0.72；其余视觉全部由 Three.js 几何、灯光、材质和 Cannon 物理生成。

## 3. Game Mechanics

- 每局时长 60 秒；开始后倒计时每帧减少，归零后进入结算。
- 物理世界使用 Cannon，重力为 `(0, -9.82, 0)`，固定步长 1/60s，每帧最多补 3 步。
- 初始创建 500 个 Cannon Sphere body，半径为 `0.1 * scale`，质量为 `scale * 0.01`，linearDamping=0.7，angularDamping=0.7。
- 每个球初始时 x 为 -1 到 1，y 为 -2.5 到 2.5，z 必须为 0；低于 y=-7 时重置到 x=-1 到 1、y=5 到 7、z=0。
- 每帧同步 mesh 前，强制 `body.position.z=0`、`body.velocity.z=0`、`body.force.z=0`，形成 2.5D 物理剖面但保留真实 3D 渲染、阴影、相机旋转和透视。
- 6 条挡板是 mass=0 的 Cannon Box static body，位置和旋转与 Three.js mesh 一致。
- 每个球固定使用 `i % 5` 作为调色盘颜色索引；调色盘切换只改变显示颜色，不改变球的颜色索引。
- 当球体 y<-7 时先触发收集判定，再重置到顶部；收集槽按 x 坐标划分：x<-0.55 为左槽，-0.55 到 0.55 为中槽，x>0.55 为右槽。
- 左/中/右槽分别匹配当前调色盘颜色索引 0、1、2；匹配得 3 分并增加 streak，不匹配得 1 分并清空 streak。
- 连续 5 次匹配会显示一次 combo 徽章并播放高音反馈；最高 streak 使用本局最大值记录。
- 最高分使用 `localStorage` 键 `whisper_pond_best` 保存。

## 4. Controls

- 开始按钮：`pointerdown` 进入 60 秒游戏，解锁音频，并重置球体、分数、streak 和倒计时。
- 单指拖动：OrbitControls 旋转相机，允许玩家观察挡板透视、阴影和球体空间关系。
- 单指点按：移动距离未超过 OrbitControls 判定且按压小于 430ms 时切换调色盘。
- 换色按钮：循环切换 4 组调色盘。
- 键盘 Space：开始或切换调色盘；键盘 C：切换调色盘。
- 所有游戏动作使用 pointer 事件，不同时绑定 mouse 与 touch。

## 5. Win / Lose Conditions

- 没有失败条件；60 秒结束后进入结算。
- 结算卡显示最终分数、历史最高、收集小球数量、最高 streak 和“Pond settled / 物理结算”标签。
- 再来一次按钮重置分数、倒计时、收集数量、streak 和球体位置；换色按钮保留为调色板切换；返回首页回到开始页。
- 如果本局分数超过历史最高，则立即更新 `localStorage.whisper_pond_best`。

## 6. Sound Effects

- 开始：triangle 波 300Hz 到 520Hz 持续 0.10s，音量 0.045；叠加 sine 波 620Hz 持续 0.12s，延迟 0.06s，音量 0.03。
- 换色：sine 波 `660 + paletteIndex * 70` Hz 持续 0.10s，音量 0.03。
- 匹配收集：sine 波 720Hz 到 960Hz，持续 0.08s，音量 0.026。
- 不匹配收集：triangle 波 180Hz 到 150Hz，持续 0.07s，音量 0.018。
- 结算：sine 波 240Hz 到 360Hz，持续 0.18s，音量 0.035。
- 音效使用 Web Audio 实时合成，不加载外部音频文件；浏览器限制音频时静默失败，物理与视觉体验继续运行。
