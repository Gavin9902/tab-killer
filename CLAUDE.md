# Tab Killer 项目规则

## 图片识别

遇到需要识别的本地图片（截图、UI 截图等）时，使用本地 LM Studio (http://localhost:1234) 的视觉模型进行识别。

### 调用方式

```bash
python3 -c "
import base64, json, urllib.request
with open('<图片路径>', 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()
req = urllib.request.Request(
    'http://localhost:1234/v1/chat/completions',
    data=json.dumps({
        'model': 'deepseek-ocr-2',
        'messages': [{
            'role': 'user',
            'content': [
                {'type': 'text', 'text': '<识别提示词>'},
                {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{img_b64}'}}
            ]
        }],
        'max_tokens': 500
    }).encode(),
    headers={'Content-Type': 'application/json'}
)
resp = urllib.request.urlopen(req, timeout=60)
print(json.loads(resp.read())['choices'][0]['message']['content'])
"
```

### 可用模型

| 模型 | 用途 | 实测 |
|------|------|------|
| `deepseek-ocr-2` | OCR 文字提取，精准识别界面文字（首选） | ✅ 通过 |
| `qwen3.5-4b-mlx-vlm` | 通用视觉理解，结构化描述布局+文字 | ✅ 通过 |
| `qwen3.6-35b-a3b` | — | ❌ 不支持图片输入 |
| `zai-org/glm-4.6v-flash` | — | ❌ API 格式不兼容 |

### 模型选择指南

- **纯文字提取** → `deepseek-ocr-2`（速度快、文字准）
- **完整 UI 理解** → `qwen3.5-4b-mlx-vlm`（描述更结构化）
- 两个模型可并行调用，互相补充

### 使用场景

- 用户提供截图需要理解界面内容
- 需要从 UI 截图中提取文字信息
- 需要分析前端布局和设计

### 注意事项

- 图片需先 base64 编码后传入
- LM Studio 需在本地运行且模型已加载
- PNG/JPG/JPEG 格式均支持
- qwen3.6-35b-a3b 和 glm-4.6v-flash 不适用于图片识别
