# 面板模板资料包

这个目录给视觉模型和人工整理面板模板用。

## 文件说明

- `prompt-for-vision-model.md`
  - 给视觉模型的标准提示词
- `known-models.md`
  - 已导入设备里已知型号清单
- `unknown-models-to-collect.md`
  - 还需要你补型号/后面板照片的设备清单
- `examples/`
  - 可直接参考的模板 JSON 样例

## 建议工作流

1. 先看 `unknown-models-to-collect.md`
2. 收集设备正反面照片、型号铭牌、端口特写
3. 把图片和 `prompt-for-vision-model.md` 一起喂给视觉模型
4. 让视觉模型按 `examples/` 的结构输出 JSON
5. 我再帮你把 JSON 转成项目里的 `PanelTemplate`

## 当前项目里的目标格式

项目当前模板模型核心字段：

- `name`
- `type`
- `portCount`
- `description`
- `width`
- `height`
- `layoutConfig`
- `portDefinitions`

其中最关键的是 `portDefinitions`。
