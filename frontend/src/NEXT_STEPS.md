# TransCube Frontend Next Steps

## 🎯 Phase 1: 补齐关键UI组件

### 1. 实时处理进度组件
```tsx
// components/TaskProgress.tsx
- 显示当前处理阶段 (downloading/transcribing/translating/summarizing)
- 实时进度百分比
- 预计剩余时间
- 当前步骤详情
- 可取消操作
```

### 2. 双语字幕对照组件
```tsx
// components/BilingualSubtitle.tsx
- 上下对照格式（上英文/下中文）
- 时间轴显示
- 点击跳转功能
- 复制单条/全部功能
- SRT导出
```

### 3. 处理错误展示组件
```tsx
// components/ErrorDisplay.tsx
- 错误类型分类（403/410/地区限制/版权）
- 错误详情
- 重试建议
- 重试按钮
```

### 4. 实时日志查看器
```tsx
// components/LogViewer.tsx
- 分阶段日志 (download/asr/translate/summarize)
- 实时滚动
- 日志级别筛选
- 导出ZIP功能
```

### 5. 工作区文件浏览器
```tsx
// components/WorkspaceBrowser.tsx
- 显示 ~/Downloads/TransCube 目录结构
- 文件预览
- 批量删除
- 空间统计
```

## 🎯 Phase 2: 页面功能完善

### HomePage改进
- [ ] 添加筛选器（按状态/语言/日期）
- [ ] 显示处理中任务的实时进度卡片
- [ ] 批量操作功能

### NewTranscriptionPage改进
- [ ] URL粘贴后自动解析视频信息
- [ ] 显示视频缩略图和元数据
- [ ] 实时依赖检测状态
- [ ] 高级选项（视频质量、字幕语言等）

### TaskPage改进
- [ ] 音频播放器（播放本地m4a文件）
- [ ] 字幕编辑功能
- [ ] 导出选项（SRT/VTT/TXT/PDF）
- [ ] 分享功能

## 🎯 Phase 3: 状态管理优化

### 全局状态管理
- [ ] 使用Context API或Zustand管理任务状态
- [ ] WebSocket连接准备（后端实时通信）
- [ ] 任务队列管理（虽然单任务，但要显示排队）

## 🎯 Phase 4: 后端集成准备

### API接口定义
```typescript
interface WailsAPI {
  // 任务管理
  StartTask(url: string, lang: string): Promise<Task>
  GetTaskStatus(id: string): Promise<TaskStatus>
  CancelTask(id: string): Promise<void>
  RetryTask(id: string): Promise<void>
  
  // 文件操作
  GetProcessedVideos(): Promise<ProcessedVideo[]>
  GetVideoDetails(id: string): Promise<VideoDetails>
  DeleteVideo(id: string): Promise<void>
  ExportSubtitle(id: string, format: string): Promise<Blob>
  
  // 系统
  CheckDependencies(): Promise<DependencyStatus>
  GetSettings(): Promise<Settings>
  UpdateSettings(settings: Settings): Promise<void>
  GetWorkspaceInfo(): Promise<WorkspaceInfo>
}
```

### Mock Service迁移计划
1. 保持MockService接口不变
2. 创建WailsService实现相同接口
3. 通过环境变量切换Mock/Real
4. 逐步替换实现

## 📅 优先级排序

### 立即需要（影响核心体验）
1. ⭐ 实时处理进度组件
2. ⭐ 双语字幕对照显示
3. ⭐ URL解析预览功能

### 重要但不紧急
4. 错误处理展示
5. 日志查看器
6. 工作区浏览

### 锦上添花
7. 音频播放器
8. 字幕编辑
9. 导出功能

## 🚀 立即行动项

1. **创建TaskProgress组件** - 展示实时处理进度
2. **改进Transcript Tab** - 实现双语对照格式
3. **增强NewTranscriptionPage** - 添加URL解析和预览

这样前端就能完整支持PRD的所有用户场景，为后端集成做好准备。