# Technical

## 1. 技术栈

- 构建：Vite 5，`base: './'`，产物可部署到任意子路径。
- 语言：Vanilla JavaScript ES Module。
- 渲染：Three.js WebGLRenderer、InstancedMesh、MeshToonMaterial、MeshPhongMaterial、OrbitControls。
- 物理：cannon-es World、Sphere、Box、SAPBroadphase、ContactMaterial。
- 输入：Pointer Events、Keyboard Events、OrbitControls。
- 音频：Web Audio API 实时合成。

## 2. 目录结构

- `index.html`：游戏根 DOM、WebGL stage、HUD、开始/体验/结算三态容器、UUID meta、Aigram 水印。
- `src/main.js`：Three.js 场景、Cannon 物理世界、球体/挡板/侧墙、手机操作、色盘、音频和状态切换。
- `src/styles.css`：明亮舞台、HUD、玻璃卡片、按钮、底部提示和桌面 390px × 680px 容器。
- `public/img/aigram.svg`：右下角平台水印。
- `doc/requirements.md`：玩法和视觉需求。
- `doc/technical.md`：当前实现说明。
- `meta.json`：平台标题和封面图路径。

## 3. 核心模块

- 状态管理与主循环：`phase` 控制 start/playing/end 三态；`requestAnimationFrame(render)` 每帧执行 Cannon `world.step()`、`syncMeshes()`、`controls.update()` 和 `renderer.render()`。
- 屏幕适配：`resize()` 根据 `stage.clientWidth/clientHeight` 更新 renderer pixel ratio、canvas size 和 camera aspect；CSS 在桌面端固定 390px × 680px，移动端全屏。
- 物理世界：`world.gravity` 为 `(0,-9.82,0)`，`SAPBroadphase` 加速碰撞，默认 ContactMaterial 设置 friction=0.08、restitution=0.38。
- 球体系统：`bodies` 保存 500 个 Cannon Sphere body 和 scale；Three.js 端用一个 `InstancedMesh` 批量渲染 500 个球体，球几何补全白色 vertex color，并用 instance color 控制调色盘。
- 防漏球约束：每帧在 `syncMeshes()` 中强制 `body.position.z=0`、`body.velocity.z=0`、`body.force.z=0`；挡板碰撞体 z halfExtent 为 0.1；动态 InstancedMesh 关闭 `frustumCulled`，避免主相机只看见阴影。
- 挡板系统：6 个 Three.js Box mesh 与 6 个 mass=0 Cannon Box body 使用相同位置和 z 旋转，形成交错下落路径。
- 回收系统：`syncMeshes()` 中检测 `body.position.y < -7` 后调用 `resetBody(body, i, true)`，将球体重置到上方继续自然下落。
- 色盘系统：`paletteSets` 保存 4 组 5 色；`updateColors()` 对 500 个 instance color 批量赋值；点按、换色按钮、Space 和 C 键调用 `randomColors()`。
- 光照与阴影：renderer 开启 `PCFSoftShadowMap`；平面和挡板接收阴影，球体投射/接收阴影；环境光、半球光和两盏聚光灯保证画面明亮。
- 多语言：`messages` 提供 zh/en 文案；`detectLocale()` 优先读取 `localStorage.game_locale`，再根据浏览器语言判断。
- 音频：`tone()` 封装 OscillatorNode 和 GainNode；开始、喷球、换色都有短音效，音频解锁在用户手势后执行。

## 4. 扩展点

- 改球数：修改 `src/main.js` 顶部 `COUNT`，并同步需求文档；超过 700 个球需要重新做移动端性能检查。
- 改挡板结构：修改 6 条挡板循环里的 x、y、angle、BoxGeometry 和 Cannon halfExtents；视觉尺寸和碰撞体深度必须一起调整。
- 调物理手感：修改 world gravity、ContactMaterial restitution/friction、球体 damping、`resetBody()` 的初始速度。
- 调亮度：修改 renderer clear color、scene background、AmbientLight、HemisphereLight 和两盏 SpotLight 强度。
- 换色盘：修改 `paletteSets`；每组建议 4 色，保证球体分布有足够对比。
- 加玩法规则：可在 `spray()` 或 `syncMeshes()` 中增加计分、目标区域和回合计时；高频物理状态不要放进 DOM state。
- 加平台接口：可在未来结算时接入 leaderboard/save；保留 `meta name="game-uuid"` 不变。
