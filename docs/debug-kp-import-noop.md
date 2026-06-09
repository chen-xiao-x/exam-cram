# Debug: 考点导入无反应

## Session ID
`kp-import-noop`

## 现象
- 用户在"添加内容"抽屉 → "重点/考点" Tab
- 上传 Excel / 粘贴文本 → AI 智能解析出 keypoints
- 列表显示正常
- 点击底部"导入考点（N）到课程"按钮
- **无任何反应**：没有 alert、没有控制台报错、UI 也不变化、课程里看不到新增的 keypoints

## 假设（5 条，可证伪）

| # | 假设 | 验证点 |
|---|------|--------|
| H1 | `onImport` prop 在 KeypointTab 中没绑上，调用即 TypeError | 在 KeypointTab 入口打日志，输出 `typeof props.onImport` / `typeof onImport` |
| H2 | `hasActiveCourse` 是 false，函数在 line 2885-2893 提前 return，但 alert 被吞掉 | 打 `hasActiveCourse` / `currentCourse` / 走哪条分支 |
| H3 | `handleImport` 走 keypoint 分支后，某处抛异常被吞（try/catch 之外） | 在 `handleImport` 入口 + keypoint 分支结束各打点，看是否到达 `return` |
| H4 | `coursesSave` 写了但 `__appForceRefresh` 没触发，UI 看到的是旧 `coursesData` | 打 `__appForceRefresh` 是否被调用、`coursesData.activeCourseId` 是否一致 |
| H5 | 按钮被 `disabled` 卡住（keypoints 长度>0 但 React state 滞后） | 打 `keypoints.length` 与按钮的 `disabled` 计算值 |

## 步骤
1. [done] 在 KeypointTab 渲染 + 按钮 onClick + handleImport 入口插桩
   - kp2: KeypointTab 渲染时打印 kpCount/hasOnImport/hasActiveCourse
   - kp3: 按钮 onClick 时打印 kpCount + onImport 类型
   - kp4: handleImportKeypoints 入口 + 各分支
   - kp4a: 早期 return (空 keypoints)
   - kp4b: 无 active course 分支
   - kp4c: 即将调 onImport
   - kp4d: onImport 成功返回
   - kp4e: onImport 抛异常
   - kp5: handleImport 入口
   - kp6: handleImport 走完 keypoint 分支
2. [pending] 用户复现（强刷 → 选课程 → 粘贴文本 → 添加为考点 → 点导入）
3. [pending] 读日志，定位哪条假设成立
4. [pending] 最小修复
5. [pending] post-fix 验证

## debug server
- URL: http://127.0.0.1:7777/event
- 当前日志数: 0（等待用户复现）

## 复现步骤（给用户）
1. Ctrl+Shift+R 强刷浏览器
2. 课程总览里确保有选中课程
3. 进课程 → + 添加内容 → 重点/考点 Tab
4. 粘贴 `数据产权 | 了解 | 基本概念` → 点 `添加为考点`
5. 点底部 `导入考点（1）到课程`
6. 同时打开 DevTools (F12) → Console，看有没有红色报错
7. 告诉我「已复现」+ 控制台报错截图（如果有）
