# M2 转 glTF 快速入门

## 5 分钟上手

### 1. 最简单的方式

```bash
# 直接运行脚本
bun scripts/m2-to-gltf.js your-model.m2

# 或使用 npm 脚本
bun run m2-to-gltf your-model.m2
```

这会生成：
- `your-model.gltf` (JSON 文件)
- `your-model.bin` (二进制数据)

### 2. 推荐方式（单文件输出）

```bash
bun scripts/m2-to-gltf.js your-model.m2 -f glb
```

这会生成单个文件：
- `your-model.glb` ✅ 推荐！

### 3. 查看帮助

```bash
bun run m2-to-gltf:help
```

## 常用命令

```bash
# 基础转换（生成 .gltf + .bin）
bun scripts/m2-to-gltf.js model.m2

# 转换为 GLB（单文件，推荐）
bun scripts/m2-to-gltf.js model.m2 -f glb

# 指定输出路径
bun scripts/m2-to-gltf.js model.m2 -o output/result.glb

# 包含动画（实验性）
bun scripts/m2-to-gltf.js model.m2 --animations -f glb

# 自定义模型名称
bun scripts/m2-to-gltf.js model.m2 -n "MyCharacter" -f glb
```

## 批量转换脚本

创建 `convert-all.sh`：

```bash
#!/bin/bash
# 批量转换所有 M2 文件

INPUT_DIR="./m2files"
OUTPUT_DIR="./output"

mkdir -p "$OUTPUT_DIR"

for file in "$INPUT_DIR"/*.m2; do
    if [ -f "$file" ]; then
        filename=$(basename "$file" .m2)
        echo "Converting: $filename"
        bun scripts/m2-to-gltf.js "$file" -o "$OUTPUT_DIR/$filename.glb" -f glb
    fi
done

echo "Done! All files converted to $OUTPUT_DIR"
```

运行：
```bash
chmod +x convert-all.sh
./convert-all.sh
```

## 在代码中使用

创建 `my-converter.js`：

```javascript
const { convertM2ToGLTF } = require('./scripts/m2-to-gltf');

async function main() {
    // 单个文件转换
    await convertM2ToGLTF('model.m2', 'output.glb', 'glb');

    // 带选项的转换
    await convertM2ToGLTF('model.m2', 'output.glb', 'glb', {
        modelName: 'MyModel',
        exportAnimations: true,
        exportUV2: true
    });

    // 批量转换
    const fs = require('fs');
    const files = fs.readdirSync('./models').filter(f => f.endsWith('.m2'));
    
    for (const file of files) {
        await convertM2ToGLTF(
            `./models/${file}`,
            `./output/${file.replace('.m2', '.glb')}`,
            'glb'
        );
    }
}

main();
```

运行：
```bash
bun my-converter.js
```

## 导入到 Blender

1. 打开 Blender
2. File → Import → glTF 2.0 (.glb/.gltf)
3. 选择生成的文件
4. Import！

**提示**：如果模型方向不对，旋转 90 度。

## 常见问题快速解决

### ❌ 找不到文件
```bash
# 使用绝对路径
bun scripts/m2-to-gltf.js /完整/路径/to/model.m2

# 或切换到文件所在目录
cd /path/to/m2files
bun /path/to/wow.export/scripts/m2-to-gltf.js model.m2
```

### ❌ 没有纹理
纹理需要单独导出。这个脚本只转换几何数据。

### ❌ 内存不足
```bash
NODE_OPTIONS="--max-old-space-size=4096" bun scripts/m2-to-gltf.js large-model.m2
```

## 格式选择建议

| 场景 | 推荐格式 | 原因 |
|------|---------|------|
| 分发给别人 | GLB | 单文件，方便 |
| 导入到游戏引擎 | GLB | 加载快 |
| 网页显示 | GLB | 文件小 |
| 开发调试 | glTF | 可读JSON |
| 需要修改 | glTF | 易于编辑 |

## 性能对比

| 文件 | glTF | GLB | 节省 |
|------|------|-----|------|
| 简单模型 | 2 个文件 | 1 个文件 | 50% |
| 复杂模型 | 多个文件 | 1 个文件 | 更多 |

**结论**：优先使用 GLB 格式！

## 下一步

- 阅读完整文档：[README_CN.md](./README_CN.md)
- 查看示例代码：[example.js](./example.js)
- 学习更多选项：`bun run m2-to-gltf:help`

## 需要帮助？

1. 查看详细文档：`README_CN.md`
2. 检查 [wow.export 项目](https://github.com/Kruithne/wow.export)
3. 提交 Issue

---

**提示**：建议使用 GLB 格式，这是单个文件，更方便！

```bash
bun scripts/m2-to-gltf.js your-model.m2 -f glb
```

就这么简单！🎉

