# M2 转 glTF 转换器

一个用于将魔兽世界 M2 模型文件转换为 glTF/GLB 格式的命令行工具。

## 快速开始

```bash
# 基础转换
bun scripts/m2-to-gltf.js model.m2

# 转换为 GLB 格式
bun scripts/m2-to-gltf.js model.m2 -f glb

# 指定输出路径
bun scripts/m2-to-gltf.js model.m2 -o output/model.gltf

# 包含动画
bun scripts/m2-to-gltf.js model.m2 --animations
```

## 功能特性

- ✅ 转换 M2 模型到 glTF 2.0
- ✅ 支持 GLB 二进制格式
- ✅ 保留顶点、法线、UV 数据
- ✅ 导出骨骼和权重
- ✅ 支持多个子网格
- ✅ 可选动画导出
- ✅ 支持双 UV 通道

## 命令行参数

```
用法: bun scripts/m2-to-gltf.js <input.m2> [选项]

选项:
  -o, --output <路径>     输出文件路径（默认：与输入同名但扩展名为 .gltf）
  -f, --format <格式>     输出格式：'gltf' 或 'glb'（默认：'gltf'）
  -n, --name <名称>       模型名称（默认：输入文件名）
  --no-uv2                不导出第二套 UV 坐标
  --animations            导出动画（实验性功能）
  --no-overwrite          不覆盖已存在的文件
  -h, --help              显示帮助信息
```

## 使用示例

### 示例 1：基础转换

```bash
bun scripts/m2-to-gltf.js character.m2
```

输出：
- `character.gltf` - glTF JSON 文件
- `character.bin` - 二进制数据文件

### 示例 2：转换为 GLB

```bash
bun scripts/m2-to-gltf.js character.m2 -f glb
```

输出：
- `character.glb` - 单个二进制文件（推荐）

### 示例 3：批量转换

创建一个批处理脚本 `batch-convert.sh`：

```bash
#!/bin/bash
mkdir -p output

for file in models/*.m2; do
    filename=$(basename "$file" .m2)
    echo "Converting $filename..."
    bun scripts/m2-to-gltf.js "$file" -o "output/${filename}.glb" -f glb
done

echo "All conversions complete!"
```

运行：
```bash
chmod +x batch-convert.sh
./batch-convert.sh
```

### 示例 4：在代码中使用

```javascript
const { convertM2ToGLTF } = require('./scripts/m2-to-gltf');

async function convert() {
    const result = await convertM2ToGLTF(
        'model.m2',
        'output.glb',
        'glb',
        {
            exportAnimations: true,
            modelName: 'MyCharacter'
        }
    );
    
    console.log('转换完成！', result);
}

convert();
```

## 输出格式对比

### glTF (.gltf + .bin)
**优点：**
- 可读的 JSON 格式
- 易于调试和修改
- 可以单独替换二进制数据

**缺点：**
- 多个文件，不便分发
- 文件较大

**适用场景：**
- 开发和调试
- 需要手动修改模型数据
- 与其他工具集成

### GLB (.glb)
**优点：**
- 单个文件，易于分发
- 文件较小
- 加载速度快

**缺点：**
- 二进制格式，不易调试
- 不能直接编辑

**适用场景：**
- 生产环境
- 网络传输
- 移动设备
- 游戏引擎

## 转换信息

运行脚本后会显示详细的转换信息：

```
Converting M2 file: character.m2
Output format: GLB
Output path: character.glb
Loading M2 model...
Model loaded: Character\Human\Male\HumanMale
Vertices: 3456
Bones: 89
Textures: 5
Animations: 142
Loading skin data...
Submeshes: 12
Processing meshes...
Writing GLB file...
Conversion completed successfully!

--- Conversion Summary ---
Output: character.glb
Format: GLB
Vertices: 3456
Meshes: 12
Bones: 89
```

## 兼容性

生成的 glTF 文件可以导入到：

| 软件/引擎 | 兼容性 | 说明 |
|----------|--------|------|
| Blender | ✅ 完全支持 | 使用内置导入器 |
| Unity | ✅ 支持 | 需要 glTF 插件 |
| Unreal Engine | ✅ 支持 | 需要插件 |
| Three.js | ✅ 完全支持 | Web 3D |
| Babylon.js | ✅ 完全支持 | Web 3D |
| Sketchfab | ✅ 支持 | 在线查看器 |
| Modo | ✅ 支持 | 3D 建模软件 |
| Maya | ⚠️ 部分支持 | 可能需要调整 |
| 3ds Max | ⚠️ 部分支持 | 可能需要插件 |

## 常见问题

### Q: 转换后的模型没有纹理？
A: 此脚本只转换几何数据。纹理需要单独导出，或使用 wow.export 主程序。

### Q: 动画无法正常播放？
A: 动画导出是实验性功能。某些复杂动画可能不完全兼容。尝试在不同软件中测试。

### Q: 模型在 Blender 中方向错误？
A: WoW 使用不同的坐标系统。导入后可能需要旋转 90 度。

### Q: 如何批量转换？
A: 参考上面的批量转换示例，或编写自己的脚本。

### Q: 支持哪些 M2 版本？
A: 支持现代 WoW 客户端的 M2 格式（MD20/MD21）。

### Q: GLB 文件很大怎么办？
A: GLB 包含所有几何数据。如果太大，可以：
- 使用 glTF 格式（文件会分开）
- 不导出动画（`--no-animations`）
- 不导出第二套 UV（`--no-uv2`）

## 技术细节

### 坐标系统转换
WoW 使用右手坐标系（Y-up），转换时会自动调整：
- X → X
- Y → Z
- Z → -Y

### 骨骼层次
骨骼保持原始的父子关系，支持：
- 平移动画
- 旋转动画
- 缩放动画

### UV 坐标
UV 坐标会自动翻转 V 轴以匹配 glTF 标准：
- U → U
- V → 1 - V

## 性能优化建议

1. **大文件**：使用 GLB 格式以减少文件大小
2. **批量转换**：使用脚本自动化处理
3. **无需动画**：禁用动画导出可显著减小文件
4. **简化模型**：在 Blender 中进一步优化

## 错误排查

### 错误：Input file not found
```bash
# 检查文件路径
ls -l model.m2

# 使用绝对路径
bun scripts/m2-to-gltf.js /absolute/path/to/model.m2
```

### 错误：Invalid M2 magic
文件可能不是有效的 M2 格式，或已损坏。

### 内存不足
对于大型模型，增加 Node.js 内存限制：
```bash
NODE_OPTIONS="--max-old-space-size=4096" bun scripts/m2-to-gltf.js model.m2
```

## 贡献

欢迎提交问题和改进建议到 [wow.export](https://github.com/Kruithne/wow.export) 项目。

## 许可证

MIT License - 与 wow.export 项目相同

## 相关资源

- [wow.export 项目](https://github.com/Kruithne/wow.export)
- [glTF 2.0 规范](https://www.khronos.org/gltf/)
- [WoW 文件格式文档](https://wowdev.wiki/)
- [Blender glTF 教程](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)

