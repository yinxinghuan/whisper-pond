# Technical

## 1. 技术栈

- 构建工具：Vite 5，`base: './'`，构建产物可部署到任意子路径。
- 语言与框架：Vanilla JavaScript、HTML、CSS，不引入 React/Vue/Three，降低感官玩具模板复用成本。
- 渲染方式：单个 2D Canvas 渲染背景水面、涟漪、光点和字石；DOM 层负责开始页、HUD、结算页和按钮。
- 音频：Web Audio API 合成按钮、开始、落水、combo 和结算音效，不使用音频文件。
- 存储：`localStorage` 保存历史最高分，键名为 `whisper_pond_best`。

## 2. 目录结构

- `index.html`：页面结构、三态 DOM、Canvas、HUD、水印和入口脚本。
- `src/main.js`：i18n、状态机、Canvas 渲染循环、触摸交互、计分、音效和本地存储。
- `src/styles.css`：全屏布局、开始卡、HUD、结算卡、按钮、水印和响应式桌面容器样式。
- `public/img/aigram.svg`：Aigram 水印资产，构建时复制到 `dist/img/aigram.svg`。
- `public/poster.svg`：游戏封面，供 `meta.json` 的 `cover_url` 使用。
- `doc/requirements.md`：玩法、视觉、数值、输入、结算和音效需求。
- `meta.json`：平台标题和封面路径配置。
- `vite.config.js`：Vite 构建配置，强制相对 base。

## 3. 核心模块

- 状态管理：`phase` 只取 `start`、`playing`、`end` 三态；`setPhase()` 同步 DOM active class 和 HUD 显隐。
- 主循环：`requestAnimationFrame(frame)` 常驻运行；开始页和结束页只产生有界空闲涟漪，游戏中更新倒计时与水面视觉。
- 屏幕适配：Canvas 根据元素实际尺寸和 `devicePixelRatio` 缩放，桌面端 CSS 把体验固定为 390px × 680px，移动端全屏铺满。
- 互动与计分：游戏层 `gameScreen` 监听 `pointerdown`；每次触摸生成 3 层水波、1 枚字石、8 个光点，并按 `10 + combo * 3` 加分。
- Combo：1.8 秒内连续触摸递增 combo，最高按 5 计算加分，历史最高 combo 在结算页显示。
- 水面渲染：`drawBackground()` 绘制渐变、水下光晕和横向微波；`drawRipples()`、`drawSparks()`、`drawStones()` 分别管理生命周期并移除过期对象。
- 文本拆分：`splitThought()` 将英文按单词、中文按 1-2 字片段拆成循环字石；空输入使用本地化默认短句。
- i18n：`detectLocale()` 读取 `localStorage.game_locale`，否则按浏览器语言判断 `zh/en`；所有可见文本由 `messages` 表驱动。
- 音频：`tone()` 封装 Oscillator 和 Gain；`resumeAudio()` 在首次用户手势后解锁浏览器音频。

## 4. 扩展点

- 调整轮次时长：修改 `src/main.js` 的 `ROUND_MS`。
- 调整涟漪数量、速度、生命周期：修改 `addRipple()` 中的 `layers`、`speed`、`life` 和 `strength`。
- 调整计分与 combo：修改 `handleWaterPointer()` 中的 combo 时间窗、上限和 `points` 公式。
- 调整视觉风格：修改 `src/styles.css` 的背景、卡片、HUD、按钮样式，以及 `drawBackground()` 中的 Canvas 颜色和波形。
- 调整字石行为：修改 `splitThought()`、`addStone()` 和 `drawStones()`。
- 调整音效：修改 `playClick()`、`playStart()`、`playDrop()`、`playComplete()` 的频率、波形、音量和延迟。
- 增加平台能力：在 `src/main.js` 中接入 Aigram runtime、排行榜或分享；新增接口后同步更新本文件。
- 替换封面/水印：替换 `public/poster.svg` 或 `public/img/aigram.svg`，并保持 `meta.json` 的 `cover_url` 指向构建后存在的 public 资源。
