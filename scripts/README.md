# M2 to glTF Converter

这个脚本可以将魔兽世界的 M2 模型文件转换为 glTF 或 GLB 格式。

## 功能特性

- ✅ 支持 M2 模型转换为 glTF 2.0 格式
- ✅ 支持 GLB（二进制 glTF）格式输出
- ✅ 保留顶点、法线、UV 坐标
- ✅ 导出骨骼和蒙皮权重
- ✅ 支持多个网格（Submeshes）
- ✅ 可选的动画数据导出
- ✅ 可选的第二套 UV 坐标

## 环境要求

- Bun 1.2 或更高版本
- wow.export 项目依赖（自动包含）

## 使用方法

### 基本用法

将 M2 文件转换为 glTF 格式：

```bash
bun scripts/m2-to-gltf.js input.m2
```

### 指定输出路径

```bash
bun scripts/m2-to-gltf.js input.m2 -o output/model.gltf
```

### 转换为 GLB 格式

```bash
bun scripts/m2-to-gltf.js input.m2 --format glb
```

或简写：

```bash
bun scripts/m2-to-gltf.js input.m2 -f glb
```

### 导出动画数据

```bash
bun scripts/m2-to-gltf.js input.m2 --animations
```

### 自定义模型名称

```bash
bun scripts/m2-to-gltf.js input.m2 --name "MyCharacter"
```

## 命令行选项

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--output <path>` | `-o` | 输出文件路径 | 与输入文件同名，扩展名改为 .gltf |
| `--format <format>` | `-f` | 输出格式：'gltf' 或 'glb' | gltf |
| `--name <name>` | `-n` | 模型名称 | 输入文件名 |
| `--no-uv2` | | 不导出第二套UV坐标 | 导出 |
| `--animations` | | 导出动画数据（实验性） | 不导出 |
| `--no-overwrite` | | 不覆盖已存在的文件 | 覆盖 |
| `--help` | `-h` | 显示帮助信息 | |

## 输出格式

### glTF 格式 (.gltf)
- 生成 JSON 格式的 .gltf 文件
- 生成二进制 .bin 文件存储几何数据
- 如果有动画，会生成额外的 _anim*.bin 文件

### GLB 格式 (.glb)
- 生成单个二进制 .glb 文件
- 所有数据（几何、纹理、动画）打包在一个文件中
- 更适合分发和传输

## 使用示例

### 示例 1：基础转换
```bash
bun scripts/m2-to-gltf.js character.m2
# 输出：character.gltf + character.bin
```

### 示例 2：转换为 GLB 并指定输出目录
```bash
bun scripts/m2-to-gltf.js models/character.m2 -o exports/character.glb -f glb
# 输出：exports/character.glb
```

### 示例 3：完整转换（包含动画）
```bash
bun scripts/m2-to-gltf.js character.m2 --animations -f glb -n "HeroCharacter"
# 输出：character.glb（包含动画数据）
```

### 示例 4：批量转换
```bash
#!/bin/bash
for file in *.m2; do
    bun scripts/m2-to-gltf.js "$file" -f glb -o "output/${file%.m2}.glb"
done
```

## 输出信息

脚本会显示以下信息：
- 模型名称
- 顶点数量
- 网格数量
- 骨骼数量
- 动画数量（如果启用）

示例输出：
```
Converting M2 file: character.m2
Output format: GLTF
Output path: character.gltf
Loading M2 model...
Model loaded: Character\Human\Male\HumanMale
Vertices: 3456
Bones: 89
Textures: 5
Animations: 142
Loading skin data...
Submeshes: 12
Processing meshes...
Writing GLTF file...
Conversion completed successfully!

--- Conversion Summary ---
Output: character.gltf
Format: GLTF
Vertices: 3456
Meshes: 12
Bones: 89
```

## 注意事项

1. **纹理**：此脚本只转换几何数据和骨骼。纹理需要单独处理或使用 wow.export 主应用导出。

2. **动画**：动画导出是实验性功能，可能不适用于所有 M2 文件。

3. **依赖项**：脚本依赖 wow.export 项目的内部模块，请确保在项目根目录运行。

4. **文件路径**：支持相对路径和绝对路径。

5. **错误处理**：如果转换失败，脚本会显示错误信息并返回非零退出码。

## 已知限制

- 不自动导出纹理文件（需要通过 wow.export 主程序导出）
- 不支持粒子效果和特效
- 某些复杂动画可能不完全兼容
- 需要在项目目录内运行

## 技术细节

脚本使用 wow.export 项目的以下模块：
- `M2Loader`: 加载和解析 M2 文件格式
- `GLTFWriter`: 生成 glTF 2.0 兼容文件
- `BufferWrapper`: 处理二进制数据

输出的 glTF 文件符合 glTF 2.0 规范，可以被以下软件打开：
- Blender（使用内置 glTF 导入器）
- Three.js
- Babylon.js
- Unity（需要 glTF 导入插件）
- Unreal Engine（需要插件）
- 各种 3D 查看器

## 故障排除

### 错误：Input file not found
- 检查文件路径是否正确
- 确保文件扩展名为 .m2

### 错误：Invalid M2 magic
- 文件可能已损坏或不是有效的 M2 文件
- 确保使用的是 WoW 客户端的 M2 文件

### 导出的模型在其他软件中显示异常
- 尝试使用 GLB 格式（更兼容）
- 检查目标软件是否支持 glTF 2.0
- 某些软件需要翻转 Y 轴或调整坐标系

## 许可证

MIT License - 与 wow.export 项目相同

## 相关链接

- [wow.export 主项目](https://github.com/Kruithne/wow.export)
- [glTF 2.0 规范](https://www.khronos.org/gltf/)
- [Bun 运行时](https://bun.sh/)

