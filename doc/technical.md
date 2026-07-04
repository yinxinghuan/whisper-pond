# Technical

## 1. 技术栈

- 构建：Vite 5，`base: './'`，产物可部署到任意子路径。
- 语言：Vanilla JavaScript ES Module。
- 渲染：Three.js WebGLRenderer、InstancedMesh、MeshToonMaterial、MeshPhongMaterial、MeshBasicMaterial。
- 物理：cannon-es World、Sphere、Box、SAPBroadphase、ContactMaterial。
- 输入：Pointer Events、Keyboard Events、Raycaster 固定平面拾取。
- 存储：`localStorage.whisper_pond_best` 保存最高分。
- 平台：`public/aigram-bridge.js` 暴露 `window.Aigram`，用于 Aigram 内提交和读取排行榜。
- 音频：Web Audio API 实时合成。

## 2. 目录结构

- `index.html`：游戏根 DOM、WebGL stage、内含目标说明的统一 HUD、底部目标槽提示、开始/游戏/结算三态容器、UUID meta、Aigram 水印。
- `src/main.js`：Three.js 场景、Cannon 物理世界、5 关配置、球体/可拖动挡板/目标槽、目标说明文案、计时计分、排行榜、手机操作、音频和状态切换。
- `src/styles.css`：明亮舞台、无框顶部文字 HUD、无外层底框的三色接收仓、目标光束、排行榜按钮/弹层、玻璃卡片、combo 徽章、按钮、中文/英文字体排版分支、纯文字底部提示和桌面 390px × 680px 容器。
- `public/aigram-bridge.js`：vanilla Aigram 平台桥，支持 `callAigramAPI()`、`postAigramAPI()` 和 `openAigramProfile()`。
- `public/img/aigram.svg`：右下角单色平台水印。
- `doc/requirements.md`：玩法和视觉需求。
- `doc/technical.md`：当前实现说明。
- `meta.json`：平台标题和封面图路径。

## 3. 核心模块

- 状态管理与主循环：`phase` 控制 start/playing/end 三态；`requestAnimationFrame(render)` 每帧执行 Cannon `world.step()`、`syncMeshes()`、关卡完成检测、倒计时和 `renderer.render()`。
- 屏幕适配：`resize()` 根据 `stage.clientWidth/clientHeight` 更新 renderer pixel ratio、canvas size 和 camera aspect；CSS 在桌面端固定 390px × 680px，移动端全屏。
- 固定相机：相机位置为 `(0,0,7)` 并 `lookAt(0,-0.3,0)`；不使用 OrbitControls，游戏中没有旋转、缩放或平移。
- 物理世界：`world.gravity` 为 `(0,-9.82,0)`，`SAPBroadphase` 加速碰撞，默认 ContactMaterial 设置 friction=0.08、restitution=0.38。
- 球体系统：`bodies` 保存 500 个 Cannon Sphere body、scale 和 colorIndex；Three.js 端用一个 `InstancedMesh` 批量渲染 500 个球体，球几何补全白色 vertex color，并用 instance color 控制调色盘。
- 防漏球约束：每帧在 `syncMeshes()` 中强制 `body.position.z=0`、`body.velocity.z=0`、`body.force.z=0`；挡板碰撞体 z halfExtent 为 0.1；动态 InstancedMesh 关闭 `frustumCulled`，避免主相机只看见阴影。
- 关卡系统：`LEVELS` 定义 5 关的时间、目标槽、目标命中数、6 条挡板初始角度和可移动挡板编号；`applyLevel()` 切换关卡、重置命中数、设置锁定挡板和 HUD。
- 挡板系统：6 个 Three.js Box mesh 与 6 个 mass=0 Cannon Box body 使用相同位置和 z 旋转；`applyRampAngle()` 将拖动后的角度限制在 -42° 到 +42° 并同步 mesh/body quaternion；锁定挡板透明度为 0.62 且跳过拾取。
- 挡板拾取：`projectPointerToPlane()` 用 Raycaster 把触点投射到 z=0 平面；`findRampAt()` 把点转换到每条可动挡板本地坐标，选中最近挡板；拖动横向位移乘以 0.42 rad/world unit 后更新角度。
- 目标槽：`targetSlot` 由当前关卡固定指定；`updateColors()` 同步场景槽透明度、scale、底部槽位颜色、目标高亮、`slotHud[data-target]` 和目标光束颜色；`updateSlotProgress()` 用 `levelHits / currentGoal()` 驱动目标槽内部纵向液面填充和 `hits/goal` 数字；`showSlotPop()` 在目标槽命中时创建 0.72s 浮动反馈并触发 0.22s 槽位弹跳；`levelBadge`、`objectiveTitle` 和 `objectiveDetail` 均位于顶部无框 `wp-hud` 内，分别显示关卡序号、目标槽、剩余命中数和可拖动挡板数量。
- 收集与计分：`syncMeshes()` 检测 `body.position.y < -7` 后先调用 `collectBall()`，再 `resetBody(body, i, true)`；`collectBall()` 根据 x 坐标分配收集槽，命中 `targetSlot` 得 5 分、`levelHits + 1` 并增加 streak，否则得 1 分并清空 streak。
- 计时与结算：每关 `remaining` 使用当前 `LEVELS[n].time`；`levelHits >= goal` 后进入下一关，第 5 关完成则通关；时间归零未达目标则失败结算；`endGame()` 写入最终分数、最高分、收集数和最高 streak，并更新 `localStorage.whisper_pond_best`。
- 排行榜：`canRank` 来自 `window.Aigram.canRank && window.Aigram.gameUuid`；仅 Aigram 内显示 `leaderboardButton`。`endGame()` 调用 `submitLeaderboardScore(score)` 写入 `/note/aigram/ai/game/rank/score/save`，`showLeaderboard()` 调用 `/note/aigram/ai/game/rank/score/list/by/session_id` 拉榜，并渲染头像、用户名、分数和可点击用户主页。
- 色彩系统：`paletteSets` 保存 4 组 5 色；当前版本固定使用第 1 组，颜色只服务于球体层次和底部目标槽可读性，不参与得分。
- 光照与阴影：renderer 开启 `PCFSoftShadowMap`；平面和挡板接收阴影，球体投射/接收阴影；环境光强度 1.28、半球光强度 0.55，两盏聚光灯提供方向阴影；`centerLight` 在 `(-0.15,-0.25,2.4)` 提供强度 1.55、距离 7.2、decay 1.3 的宽中心光，`centerGlow` 使用 CanvasTexture + AdditiveBlending 在球群汇聚区叠加 4.6 world units 暖白光晕，材质 opacity 为 0.5。
- 多语言与排版：`messages` 提供 zh/en 文案；`detectLocale()` 优先读取 URL 参数 `?lang=` / `?locale=`，其次读取 `localStorage.game_locale`，再根据浏览器语言判断；运行时写入 `document.documentElement.lang` 和 `body[data-locale]`，CSS 使用中文分支取消过大的英文字距并切换到 `"PingFang SC"` 等中文字体栈；整体字体改为圆润大字方向，英文优先 `"Arial Rounded MT Bold"` / `Nunito`。
- 音频：`tone()` 封装 OscillatorNode 和 GainNode；开始、换色、匹配收集、不匹配收集和结算都有短音效，音频解锁在用户手势后执行。

## 4. 扩展点

- 改球数：修改 `src/main.js` 顶部 `COUNT`，并同步需求文档；超过 700 个球需要重新做移动端性能检查。
- 改挡板结构：修改 6 条挡板循环里的 x、y、angle、BoxGeometry 和 Cannon halfExtents；视觉尺寸和碰撞体深度必须一起调整。
- 调挡板操作：修改 `RAMP_MIN_ANGLE`、`RAMP_MAX_ANGLE`、`RAMP_DRAG_SENSITIVITY`、`findRampAt()` 的本地坐标阈值和键盘微调角度。
- 调收集规则：修改 `collectBall()` 的 x 分槽阈值、目标槽得分、非目标得分和 streak 展示规则。
- 调关卡：修改 `LEVELS` 中每关的 `time`、`target`、`goal`、`angles` 和 `movable`。
- 调物理手感：修改 world gravity、ContactMaterial restitution/friction、球体 damping、`resetBody()` 的初始位置。
- 调 UI 说明：修改 `index.html` 的 `wp-hud` / `objectivePanel` / `slotHud` 结构、`src/main.js` 的 `objectiveTitle` / `objectiveDetail` / `targetMark` 文案和 `updateSlotProgress()`，以及 `src/styles.css` 中 `.wp-hud`、`.wp-objective`、`.wp-slots` 和 `body[data-locale="zh"]` 样式。
- 调亮度：修改 renderer clear color、scene background、AmbientLight、HemisphereLight、`centerLight`、`centerGlow` 和两盏 SpotLight 强度。
- 换色盘：修改 `paletteSets`；每组 5 色，前三色会同时作为底部目标槽颜色。
- 加平台接口：排行榜已通过 `public/aigram-bridge.js` 接入；后续加存档或事件统计时继续保留 `meta name="game-uuid"` 不变，并使用同一个 `window.Aigram.gameUuid`。
