# TransCube PRD（本地 YouTube 转写 · 翻译 · 摘要）

## 产品愿景
- 在本机将 YouTube 视频快速转为可读字幕与摘要，开发期通过 Vercel AI SDK 调用在线模型（后续再接入本地模型），强调隐私、简单、可控。

## 目标用户与价值
- 学习者、研究者、内容创作者：更快吸收长视频信息，沉淀要点与结论。
- 隐私敏感用户：仅本地处理（除下载外），可控与可复现。

## 范围与约束（MVP）
- 平台：macOS 26（Apple Silicon）。
- 依赖：Homebrew 安装的 `yt-dlp`、`ffmpeg`、`yap`；仅检测缺失并提示，不代安装。
- 识别：仅用 `yap` CLI（不写任何 native 代码，不用 macOS Speech）。
- 字幕：仅 SRT；官方字幕优先且只接受英文（含 `en-auto`），其余语言一律忽略；保留官方 `captions.vtt` 与转出的 `subs_en.srt`。
- 翻译与摘要：
  - 英文原视频：生成中文翻译与双语 SRT（两行：上英文/下中文）；摘要输出为英文（结构化、问答两模板）。
  - 中文原视频：仅保留中文 SRT（不翻译、不生成双语），摘要仍输出为英文。
- 任务与并发：严格单任务，无队列、无并发；一次只接受一个链接。多链接输入仅取第一个（静默忽略其余）。
- UI：英文界面。
- 工作区：默认 `~/Downloads/TransCube`（可配置与迁移）。
- 命名：`{sanitized_title}__{videoId}`（非字母数字→`_`；移除 emoji；最大 80 字符）。

## 关键流程
1) 粘贴链接 → 解析元数据（标题、频道、videoId）。
2) 下载音频（`bestaudio`，m4a/mp3），断点续传、失败分类与重试。
3) 官方字幕优先：若存在英文官方字幕（含 en-auto），保存 `captions.vtt` 并转出 `subs_en.srt`；否则调用 `yap` 生成 `subs_en.srt`（或用户设定的源语言）。
4) 翻译：
   - 若源语言为英文：对齐逐条翻译中文，生成 `subs_zh.srt` 与 `subs_bilingual.srt`（两行：上英文/下中文，SRT 行宽 42）。
   - 若源语言为中文或其他：仅生成该语言的 SRT，MVP 不做翻译与双语。
5) 摘要：用英文输出两种形式（结构化、问答），长度档（短/中/长）。
6) 落盘与展示：写入工作区，前端展示结果与导出日志。

## 目录与数据（每视频一个目录）
- `meta.json`（标题、videoId、频道、发布日期、源语言、状态、创建/更新时间）
- `source.m4a`
- `captions.vtt`（如有官方英文字幕）
- `subs_en.srt`（官方转出或 `yap` 生成）
- `subs_zh.srt`、`subs_bilingual.srt`（仅英文源生成）
- `summary_structured.json`、`summary_qa.json`
- `logs/{download|asr|translate|summarize}.log`

## 依赖与环境检测
- 检测：`which yt-dlp`、`which ffmpeg`、`which yap`，缺失则在 UI 明确提示安装指引（不自动安装）。
- API Key：使用 Wails 本地存储保存（可选支持从环境变量读取），文件权限限制为当前用户。

## 功能需求
- 输入与校验：单链接输入；解析 videoId/标题/频道；不可访问/地区/版权早失败。
- 下载器：`yt-dlp` 仅音频（`--extract-audio --audio-format m4a`），断点续传；错误分类（403/410/地区/版权）。
- 字幕策略：只接受官方英文（含 `en-auto`）；保留 `captions.vtt` 并转 `subs_en.srt`；否则调用 `yap transcribe` 生成 `subs_{lang}.srt`。
- 转写（yap）：用户在任务提交时选择 Source language（默认 `en`）。
- 翻译：英文源生成 `subs_zh.srt` 与 `subs_bilingual.srt`（两行，上英文/下中文）；中文或其他源不翻译。
- 摘要：两模板（结构化、问答），英文输出；长度档（短/中/长）。
- 设置：工作区路径、源语言默认值、模型提供方与 Key、摘要长度档；手动清理旧任务（默认不自动清理）。
- 日志与诊断：阶段日志落盘；一键打包 ZIP 导出。
- 任务控制：运行中禁止再次提交（按钮禁用），新任务静默拒绝。

## UX 概要
- 首页：输入框 + Start 按钮 + 依赖状态（绿色/红色）。
- 任务卡：状态（Downloading/Transcribing/Translating/Summarizing/Done/Failed）、错误原因、Retry 按钮。
- 结果页：字幕视图（EN/ZH/Bilingual 切换），摘要视图（Structured/Q&A 切换），导出日志按钮。
- 设置页：Workspace、Source language 默认、Model/Key、摘要长度、清理工具。

## 错误处理与重试
- 分类：403/410、地区限制、版权受限、依赖缺失、下载失败、字幕缺失、yap 失败、翻译失败、摘要失败。
- 策略：指数退避自动重试（最多 3 次）；最终失败在任务卡显示原因，允许手动重试。

## 非功能
- 隐私：除下载外不使用网络，不上传音视频与文本。
- 性能：1 小时视频（转写+摘要）目标 < 实时×2（视硬件与参数）。
- 可维护：阶段缓存、幂等重试、日志完备；SRT 行宽默认 42。

## MVP 验收标准
- 单链接端到端：下载→官方英文字幕优先/`yap` 兜底→英文 SRT→（英文源）中文与双语 SRT→两类英文摘要→落盘→UI 展示。
- 依赖缺失提示明确；错误分类型；失败可重试。
- 单任务限制生效；工作区可配置与迁移；命名与截断规则生效。

## 里程碑
- M1：下载 + 字幕优先 + `yap` 兜底 + 文件化存储 + 结构化摘要。
- M2：中文译文与双语（英文源）、问答摘要、日志打包、失败重试。
- M3：设置页（Workspace/Source language/Model & Key/摘要长度）、视图优化；预留本地模型对接。

## 技术架构（Wails v2）

### 框架特性
- **Wails v2**：Go 后端 + React 前端，使用系统原生 webview（体积比 Electron 小 90%）
- **自动绑定**：Go struct 方法自动暴露给前端，生成 TypeScript 类型定义
- **单实例限制**：符合 TransCube 单任务要求

### 前端（React/TypeScript/Vite）
- **UI 组件**：输入框、任务状态卡、字幕/摘要视图、设置页
- **状态管理**：任务进度、依赖检测状态、错误展示
- **Wails 集成**：通过 `wailsjs/go/main/App` 调用后端方法
- **日志导出**：触发后端日志打包为 ZIP

### 后端（Go 1.23）

#### 核心服务
- **TaskManager**：
  - 单任务状态机（mutex 锁确保并发安全）
  - 状态：`pending → downloading → transcribing → translating → summarizing → done/failed`
  - 新任务拒绝逻辑（运行中静默拒绝）
  
- **Downloader**：
  - 封装 `yt-dlp` 命令执行
  - 音频下载：`yt-dlp -f bestaudio --extract-audio --audio-format m4a --continue`
  - 字幕下载：`yt-dlp --write-subs --sub-langs "en,en-orig,en-auto" --sub-format vtt`
  - 元数据提取：`yt-dlp --dump-json`
  - 错误分类：403/410、地区限制、版权受限
  
- **SubtitleService**：
  - 官方字幕检测（仅接受英文）
  - VTT→SRT 转换：`ffmpeg -y -i captions.en.vtt subs_en.srt`
  - 双语 SRT 生成（行宽 42 字符限制）
  
- **YapRunner**：
  - 封装 `yap transcribe` 命令
  - 语言映射：en→en-US, zh→zh-CN
  - 命令：`yap transcribe source.m4a --srt --locale {locale} --output-file subs_{lang}.srt`
  
- **TranslateService**：
  - Vercel AI SDK 集成（通过 Node.js 子进程）
  - 模型：Google Gemini 2.5 Flash
  - 逐条对齐翻译（保持时间轴）
  - 参数：`temperature=0.3, max_output_tokens=4096`
  
- **SummaryService**：
  - 结构化摘要：generateObject 与 Zod schema
  - 问答式摘要：预定义 prompt 模板
  - 长度档位控制（short/medium/long）
  
- **Storage**：
  - 工作区管理：默认 `~/Downloads/TransCube`
  - 命名规则：`{sanitized_title}__{videoId}` (最大 80 字符)
  - 文件结构：meta.json + 音频 + 字幕 + 摘要 + 日志
  
- **DependencyChecker**：
  - 启动检测：`exec.LookPath("yt-dlp")` 等
  - 状态反馈：前端显示红/绿标识
  
- **Logs**：
  - 阶段日志：`logs/{download|asr|translate|summarize}.log`
  - ZIP 导出：`archive/zip` 打包所有日志

## 技术实现细节

### 命令行工具集成

#### yt-dlp 命令
```bash
# 下载音频（支持断点续传）
yt-dlp -f bestaudio --extract-audio --audio-format m4a \
       --continue -o "source.%(ext)s" <URL>

# 下载官方字幕（仅英文）
yt-dlp --write-subs --sub-langs "en,en-orig,en-auto" \
       --sub-format vtt --skip-download -o "captions" <URL>

# 提取视频元数据
yt-dlp --dump-json --skip-download <URL>
```

#### yap 转写命令
```bash
# 英文转写
yap transcribe source.m4a --srt --locale en-US --output-file subs_en.srt

# 中文转写
yap transcribe source.m4a --srt --locale zh-CN --output-file subs_zh.srt

# 其他语言（根据 locale 映射）
yap transcribe source.m4a --srt --locale {locale} --output-file subs_{lang}.srt
```

#### ffmpeg 格式转换
```bash
# VTT 转 SRT
ffmpeg -y -i captions.en.vtt subs_en.srt
```

### Go 集成示例

#### 任务管理器
```go
type TaskManager struct {
    currentTask *Task
    mutex      sync.Mutex
    services   *Services
}

func (tm *TaskManager) StartTask(url string, sourceLang string) error {
    tm.mutex.Lock()
    defer tm.mutex.Unlock()
    
    if tm.currentTask != nil && tm.currentTask.Status != "done" {
        return errors.New("task already running")
    }
    
    // 创建新任务
    task := &Task{
        URL:        url,
        SourceLang: sourceLang,
        Status:     "pending",
        CreatedAt:  time.Now(),
    }
    
    tm.currentTask = task
    go tm.processTask(task) // 异步处理
    
    return nil
}
```

#### Wails 前端绑定
```go
// app.go - 暴露给前端的方法
type App struct {
    ctx         context.Context
    taskManager *TaskManager
}

func (a *App) StartTranscription(url string, sourceLang string) map[string]interface{} {
    err := a.taskManager.StartTask(url, sourceLang)
    if err != nil {
        return map[string]interface{}{
            "success": false,
            "error":   err.Error(),
        }
    }
    return map[string]interface{}{
        "success": true,
    }
}

func (a *App) GetTaskStatus() TaskStatus {
    return a.taskManager.GetCurrentStatus()
}
```

### Vercel AI SDK 集成

#### Node.js 翻译脚本
```javascript
// scripts/translate.js
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

const translateSubtitle = async (text) => {
  const { text: translated } = await generateText({
    model: google('gemini-2.0-flash-exp'),
    temperature: 0.3,
    maxTokens: 4096,
    system: 'Translate English subtitle to Chinese. Keep it concise.',
    prompt: text
  });
  
  return translated;
};

// 从 stdin 读取，输出到 stdout
process.stdin.on('data', async (data) => {
  const result = await translateSubtitle(data.toString());
  process.stdout.write(result);
});
```

#### Go 调用 Node.js
```go
func (t *TranslateService) TranslateLine(text string) (string, error) {
    cmd := exec.Command("node", "scripts/translate.js")
    cmd.Stdin = strings.NewReader(text)
    
    output, err := cmd.Output()
    if err != nil {
        return "", fmt.Errorf("translation failed: %w", err)
    }
    
    return string(output), nil
}
```

## AI 模型集成

### 开发阶段配置
- **SDK**：Vercel AI SDK (@ai-sdk/google)
- **模型**：Google Gemini 2.0 Flash Experimental
- **参数**：
  - temperature: 0.3（低温度保证翻译一致性）
  - max_output_tokens: 4096
  - 上下文窗口：2M tokens（支持长视频）

### API Key 管理
- **存储**：Wails 本地存储（加密）
- **环境变量**：`GOOGLE_GENERATIVE_AI_API_KEY`（可选覆盖）
- **权限**：文件权限 0600（仅当前用户可读）

### 提示词模板

#### 翻译提示词
```
System: You are a professional subtitle translator. Translate English to Chinese.
Rules:
1. Keep translation concise (max 42 chars per line)
2. Maintain context and timing
3. Use natural spoken Chinese
```

#### 结构化摘要提示词
```
System: Generate a structured summary in English.
Output format:
- Key Points: 3-5 bullet points
- Main Topic: One sentence
- Conclusion: 1-2 sentences
- Tags: 3-5 relevant tags
```

#### 问答式摘要提示词
```
System: Generate Q&A style summary in English.
Format:
- Q1: What is the main topic?
- Q2: What are the key findings?
- Q3: What are the implications?
- Q4: What are the next steps?
```

## 错误处理与重试机制

### 错误分类与处理

#### 下载错误
- **403/410**：视频已删除或无权限 → 提示用户，不重试
- **地区限制**：检测 "not available in your country" → 提示用户使用 VPN
- **版权受限**：检测 "copyright" → 提示用户，不重试
- **网络超时**：指数退避重试（1s, 2s, 4s），最多 3 次

#### 转写错误
- **yap 失败**：回退到提示用户检查音频格式
- **语言不支持**：提示用户选择支持的语言

#### AI 服务错误
- **API 限额**：429 状态码 → 等待并重试
- **Token 超限**：分块处理
- **网络错误**：指数退避重试

### 重试策略
```go
type RetryConfig struct {
    MaxAttempts int
    InitialDelay time.Duration
    MaxDelay time.Duration
    Multiplier float64
}

func withRetry(fn func() error, config RetryConfig) error {
    delay := config.InitialDelay
    
    for i := 0; i < config.MaxAttempts; i++ {
        err := fn()
        if err == nil {
            return nil
        }
        
        if !isRetryable(err) {
            return err
        }
        
        if i < config.MaxAttempts-1 {
            time.Sleep(delay)
            delay = time.Duration(float64(delay) * config.Multiplier)
            if delay > config.MaxDelay {
                delay = config.MaxDelay
            }
        }
    }
    
    return fmt.Errorf("max retries exceeded")
}
```

## 决策与默认值汇总
- 单任务，无队列；新增任务静默拒绝。
- 官方字幕仅接受英文（含 en-auto）；其他语言忽略。
- 源语言选择：默认 `en`，提交时可改（en/zh/…）；
  - `en`：生成 `subs_en.srt`、`subs_zh.srt`、`subs_bilingual.srt`；摘要英文。
  - `zh`：生成 `subs_zh.srt`；无翻译/双语；摘要英文。
  - 其他：仅 `subs_{lang}.srt`；无翻译/双语；摘要英文。
- SRT 行宽 42，便于播放器显示。
- API Key 存储：Wails 本地存储；可选环境变量覆盖。
- 日志：默认无限期保留；设置页提供手动清理。

## 性能优化

### 内存管理
- **流式处理**：字幕逐条处理，避免全文加载
- **文件分块**：大音频文件分段转写
- **缓存策略**：阶段结果落盘，支持断点续传

### 并发控制
- **单任务限制**：全局 mutex 锁
- **子进程管理**：限制 CLI 工具并发数
- **API 调用**：批量请求，减少往返

### 存储优化
- **增量写入**：字幕实时写入，避免内存积压
- **压缩存储**：日志 gzip 压缩
- **定期清理**：提供手动清理工具

## 安全与隐私

### 数据安全
- **本地处理**：音频、字幕不离开本机（除 AI 翻译/摘要）
- **API Key 加密**：使用 Wails 安全存储
- **文件权限**：工作区文件 0644，配置文件 0600

### 网络安全
- **HTTPS Only**：所有网络请求强制 HTTPS
- **证书验证**：不跳过 SSL 验证
- **超时控制**：所有网络操作设置超时

### 用户隐私
- **无遥测**：不收集用户数据
- **无云端存储**：所有数据本地保存
- **明确提示**：AI 服务调用前告知用户

## 风险与对策
- 官方字幕缺失/质量不稳：`yap` 兜底，保留阶段中间件以便重试与调参。
- 在线模型可用性：失败时明确错误与重试；后续增加本地模型备用。
- 大文件性能：阶段化处理与中间结果落盘；必要时提示参数降级（更快模式）。
