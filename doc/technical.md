# Technical

## 1. 技术栈

- 构建：Vite 5，`base: './'`，产物可部署到任意子路径。
- 语言：Vanilla JavaScript ES Module。
- 渲染：Three.js WebGLRenderer、InstancedMesh、MeshToonMaterial、MeshPhongMaterial、MeshBasicMaterial、OrbitControls。
- 物理：cannon-es World、Sphere、Box、SAPBroadphase、ContactMaterial。
- 输入：Pointer Events、Keyboard Events、OrbitControls。
- 存储：`localStorage.whisper_pond_best` 保存最高分。
- 音频：Web Audio API 实时合成。

## 2. 目录结构

- `index.html`：游戏根 DOM、WebGL stage、HUD、底部三色槽、开始/游戏/结算三态容器、UUID meta、Aigram 水印。
- `src/main.js`：Three.js 场景、Cannon 物理世界、球体/挡板/收集槽、计时计分、手机操作、色盘、音频和状态切换。
- `src/styles.css`：明亮舞台、HUD、底部三色槽、玻璃卡片、combo 徽章、按钮、底部提示和桌面 390px × 680px 容器。
- `public/img/aigram.svg`：右下角单色平台水印。
- `doc/requirements.md`：玩法和视觉需求。
- `doc/technical.md`：当前实现说明。
- `meta.json`：平台标题和封面图路径。

## 3. 核心模块

- 状态管理与主循环：`phase` 控制 start/playing/end 三态；`requestAnimationFrame(render)` 每帧执行 Cannon `world.step()`、`syncMeshes()`、倒计时、`controls.update()` 和 `renderer.render()`。
- 屏幕适配：`resize()` 根据 `stage.clientWidth/clientHeight` 更新 renderer pixel ratio、canvas size 和 camera aspect；CSS 在桌面端固定 390px × 680px，移动端全屏。
- 物理世界：`world.gravity` 为 `(0,-9.82,0)`，`SAPBroadphase` 加速碰撞，默认 ContactMaterial 设置 friction=0.08、restitution=0.38。
- 球体系统：`bodies` 保存 500 个 Cannon Sphere body、scale 和 colorIndex；Three.js 端用一个 `InstancedMesh` 批量渲染 500 个球体，球几何补全白色 vertex color，并用 instance color 控制调色盘。
- 防漏球约束：每帧在 `syncMeshes()` 中强制 `body.position.z=0`、`body.velocity.z=0`、`body.force.z=0`；挡板碰撞体 z halfExtent 为 0.1；动态 InstancedMesh 关闭 `frustumCulled`，避免主相机只看见阴影。
- 挡板系统：6 个 Three.js Box mesh 与 6 个 mass=0 Cannon Box body 使用相同位置和 z 旋转，形成交错下落路径。
- 收集槽：`collectionSlots` 创建 3 个底部 Three.js Box mesh，位置为 x=-1.05、0、1.05、y=-5.9；`slotHudItems` 维护底部 3 条 HUD 色槽，`updateColors()` 将两者同步到当前调色盘前三色。
- 收集与计分：`syncMeshes()` 检测 `body.position.y < -7` 后先调用 `collectBall()`，再 `resetBody(body, i, true)`；`collectBall()` 根据 x 坐标分配收集槽，颜色索引匹配得 3 分，否则得 1 分并清空 streak。
- 计时与结算：`remaining` 从 60 秒递减；`endGame()` 写入最终分数、最高分、收集数和最高 streak，并更新 `localStorage.whisper_pond_best`。
- 色盘系统：`paletteSets` 保存 4 组 5 色；`updateColors()` 对 500 个 instance color 和 3 个收集槽批量赋值；点按、换色按钮、Space 和 C 键调用 `randomColors()`。
- 光照与阴影：renderer 开启 `PCFSoftShadowMap`；平面和挡板接收阴影，球体投射/接收阴影；环境光、半球光和两盏聚光灯保证画面明亮。
- 多语言：`messages` 提供 zh/en 文案；`detectLocale()` 优先读取 `localStorage.game_locale`，再根据浏览器语言判断。
- 音频：`tone()` 封装 OscillatorNode 和 GainNode；开始、换色、匹配收集、不匹配收集和结算都有短音效，音频解锁在用户手势后执行。

## 4. 扩展点

- 改球数：修改 `src/main.js` 顶部 `COUNT`，并同步需求文档；超过 700 个球需要重新做移动端性能检查。
- 改挡板结构：修改 6 条挡板循环里的 x、y、angle、BoxGeometry 和 Cannon halfExtents；视觉尺寸和碰撞体深度必须一起调整。
- 调收集规则：修改 `collectBall()` 的 x 分槽阈值、匹配得分、不匹配得分和 streak 展示规则。
- 调局长：修改 `GAME_DURATION`。
- 调物理手感：修改 world gravity、ContactMaterial restitution/friction、球体 damping、`resetBody()` 的初始位置。
- 调亮度：修改 renderer clear color、scene background、AmbientLight、HemisphereLight 和两盏 SpotLight 强度。
- 换色盘：修改 `paletteSets`；每组 5 色，前三色会同时作为底部收集槽颜色。
- 加平台接口：在 `endGame()` 接入 leaderboard/save；保留 `meta name="game-uuid"` 不变。
