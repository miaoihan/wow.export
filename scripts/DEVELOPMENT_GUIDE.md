# M2 到 glTF 转换器 - 完整开发文档

> 从零开始构建一个功能完整的 M2 到 glTF/GLB 转换工具

## 目录

1. [项目概述](#项目概述)
2. [架构设计](#架构设计)
3. [核心功能](#核心功能)
4. [依赖关系](#依赖关系)
5. [安装与配置](#安装与配置)
6. [使用指南](#使用指南)
7. [技术实现](#技术实现)
8. [问题解决](#问题解决)
9. [测试与验证](#测试与验证)
10. [性能优化](#性能优化)
11. [未来改进](#未来改进)

---

## 项目概述

### 项目简介

M2 到 glTF 转换器是一个命令行工具，用于将《魔兽世界》游戏中的 M2 模型文件转换为标准的 glTF/GLB 格式。该工具支持：

- ✅ M2 模型解析与转换
- ✅ Skin 文件加载与处理
- ✅ BLP 纹理导出（PNG）
- ✅ 透明材质支持（Alpha Blending）
- ✅ 骨骼动画导出（实验性）
- ✅ GLB 格式（嵌入式纹理）
- ✅ glTF 格式（外部纹理文件）

### 项目背景

《魔兽世界》使用 M2 格式存储 3D 模型，这是一种专有格式。为了在标准 3D 软件和 Web 环境中使用这些模型，需要将其转换为 glTF 格式（3D 内容的 JPEG）。

### 技术栈

- **运行时**: Bun（JavaScript/TypeScript 运行时）
- **语言**: JavaScript（Node.js 兼容）
- **格式**: M2, Skin, BLP → glTF 2.0 / GLB
- **依赖**: wow.export 项目核心模块

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    CLI 接口层                            │
│              (m2-to-gltf.js main)                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   转换逻辑层                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ convertM2    │  │ exportTextures│  │ Mock System  │  │
│  │ ToGLTF()    │  │              │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   核心模块层                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  M2Loader    │  │  GLTFWriter  │  │     Skin     │  │
│  │              │  │              │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │   BLPFile    │  │ BufferWrapper│                    │
│  │              │  │              │                    │
│  └──────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   文件系统层                             │
│              M2 / Skin / BLP 文件                        │
└─────────────────────────────────────────────────────────┘
```

### 数据流程

```
输入文件
├── model.m2          (主模型文件)
├── model.skin        (几何数据)
├── texture1.blp      (纹理文件)
└── texture2.blp      (纹理文件)
         │
         ▼
    解析阶段
├── M2Loader.parse()  → 顶点、骨骼、动画
├── Skin.load()       → 网格、索引、纹理单元
└── BLPFile.load()    → 纹理数据
         │
         ▼
    转换阶段
├── 顶点数据处理      → glTF accessors
├── 网格构建          → glTF meshes
├── 材质创建          → glTF materials (含透明度)
└── 纹理导出          → PNG 文件或 GLB buffer
         │
         ▼
    输出阶段
└── GLTFWriter.write() → .gltf / .glb 文件
```

---

## 核心功能

### 1. M2 文件解析

**功能**: 解析 M2 模型文件，提取几何和动画数据

**实现**: `M2Loader` 类

**提取的数据**:
- 顶点坐标（vertices）
- 法线（normals）
- UV 坐标（uv, uv2）
- 骨骼权重（boneWeights）
- 骨骼索引（boneIndices）
- 骨骼结构（bones）
- 动画数据（animations）
- 材质信息（materials）
- 纹理引用（textures）

**关键代码**:
```javascript
const m2Loader = new M2Loader(buffer);
await m2Loader.load();
```

### 2. Skin 文件加载

**功能**: 加载 Skin 文件，包含网格和纹理单元信息

**实现**: `Skin` 类

**提取的数据**:
- 索引数组（indices）
- 三角形索引（triangles）
- 子网格（subMeshes）
- 纹理单元（textureUnits）

**关键代码**:
```javascript
const skin = await m2Loader.getSkin(0);
```

### 3. 纹理导出

**功能**: 将 BLP 纹理文件转换为 PNG 格式

**实现**: `exportTextures()` 函数

**支持的特性**:
- BLP 到 PNG 转换
- Alpha 通道支持
- GLB 模式：嵌入到二进制缓冲区
- glTF 模式：导出为外部 PNG 文件
- 多种文件命名格式支持

**文件命名支持**:
- `{fileDataID}.blp`
- `{m2Basename}_{fileDataID}.blp`
- `{fileDataID1}_{fileDataID2}.blp`

**关键代码**:
```javascript
const textureResult = await exportTextures(m2Loader, outputDir, format === 'glb', options);
```

### 4. 透明材质支持

**功能**: 根据 M2 材质的 `blendingMode` 设置 glTF 的 `alphaMode`

**实现**: `GLTFWriter.setMaterialMetadata()` + 材质创建逻辑

**映射规则**:
```
blendingMode: 2 或 4 → alphaMode: "BLEND" (透明混合)
blendingMode: 1 或 5 → alphaMode: "MASK"  (Alpha 裁切)
其他                → alphaMode: "OPAQUE" (不透明)
```

**关键代码**:
```javascript
gltf.setMaterialMetadata(matName, {
    blendingMode: materialInfo.blendingMode,
    flags: materialInfo.flags
});
```

### 5. glTF/GLB 导出

**功能**: 将解析的数据写入 glTF 2.0 格式

**实现**: `GLTFWriter` 类

**输出格式**:
- **glTF**: JSON + 二进制文件 + 外部纹理
- **GLB**: 单文件二进制格式（所有资源嵌入）

**包含的数据**:
- 场景图（scenes）
- 节点（nodes）
- 网格（meshes）
- 材质（materials）
- 纹理（textures）
- 动画（animations，可选）
- 骨骼（skeletons）

**关键代码**:
```javascript
await gltf.write(options.overwrite !== false, format);
```

### 6. 命令行接口

**功能**: 提供友好的 CLI 接口

**实现的选项**:
- `-o, --output`: 指定输出路径
- `-f, --format`: 选择格式（gltf/glb）
- `-n, --name`: 设置模型名称
- `--no-uv2`: 禁用第二 UV 通道
- `--animations`: 导出动画
- `--no-textures`: 不导出纹理
- `--no-alpha`: 不导出 Alpha 通道
- `--no-overwrite`: 不覆盖现有文件

---

## 依赖关系

### 核心依赖

#### 1. wow.export 核心模块

**路径**: `src/js/`

**使用的模块**:
- `3D/loaders/M2Loader.js` - M2 文件加载器
- `3D/writers/GLTFWriter.js` - glTF 写入器
- `3D/Skin.js` - Skin 文件加载器
- `casc/blp.js` - BLP 纹理处理
- `buffer.js` - 缓冲区包装器

#### 2. Node.js 标准库

- `fs` - 文件系统操作
- `path` - 路径处理
- `module` - 模块系统（用于 Mock）

### Mock 系统

由于 wow.export 设计为在 NW.js 环境中运行，需要在 CLI 模式下模拟某些依赖：

#### Mock 的模块

1. **mmap.node** (原生模块)
   ```javascript
   // Mock 实现，避免编译原生模块
   ```

2. **listfile** (CASC 文件列表)
   ```javascript
   // Mock 实现，提供基本的文件 ID 转换
   ```

3. **log** (日志系统)
   ```javascript
   // 重定向到 console.log/error/warn
   ```

4. **generics** (工具函数)
   ```javascript
   // 实现文件系统操作的 Promise 版本
   ```

5. **core.view.casc** (CASC 文件系统)
   ```javascript
   // 实现本地文件查找逻辑
   // 支持多种文件命名格式
   ```

---

## 安装与配置

### 环境要求

- **Bun**: >= 1.0.0
- **操作系统**: macOS, Linux, Windows
- **磁盘空间**: 至少 100MB（用于临时文件）

### 安装 Bun

**macOS**:
```bash
curl -fsSL https://bun.sh/install | bash
```

**Linux**:
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows**:
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

### 项目结构

```
wow.export/
├── scripts/
│   ├── m2-to-gltf.js          # 主转换脚本
│   ├── glb-viewer.html         # Web 查看器
│   └── example.js              # 示例代码
├── src/js/
│   ├── 3D/
│   │   ├── loaders/
│   │   │   └── M2Loader.js    # M2 加载器
│   │   ├── writers/
│   │   │   └── GLTFWriter.js  # glTF 写入器
│   │   └── Skin.js            # Skin 加载器
│   ├── casc/
│   │   └── blp.js             # BLP 处理
│   └── buffer.js              # 缓冲区包装
└── package.json
```

### 验证安装

```bash
cd /path/to/wow.export
bun scripts/m2-to-gltf.js --help
```

---

## 使用指南

### 基本用法

#### 1. 最简单的转换

```bash
bun scripts/m2-to-gltf.js model.m2
```

这将：
- 读取 `model.m2`
- 在同目录生成 `model.gltf`
- 导出所有纹理为 PNG
- 使用默认设置

#### 2. 转换为 GLB 格式

```bash
bun scripts/m2-to-gltf.js model.m2 -f glb
```

输出: `model.glb`（单文件，所有资源嵌入）

#### 3. 指定输出路径

```bash
bun scripts/m2-to-gltf.js model.m2 -o output/converted.gltf
```

#### 4. 完整示例

```bash
bun scripts/m2-to-gltf.js resources/M2/5408474.m2 \
  -f glb \
  -o output/bookshelf.glb \
  --animations
```

### 文件组织

**推荐的文件结构**:

```
resources/M2/
├── 5408474.m2              # M2 主文件
├── 540847400.skin          # Skin 文件（必需）
├── 5408474_5408779.blp     # 纹理 1
└── 5408474_5408780.blp     # 纹理 2
```

**文件命名规则**:

工具会自动查找以下命名格式：

**Skin 文件**:
- `{fileDataID}.skin`
- `{fileDataID}_00.skin`
- `{fileDataID}00.skin`（无下划线）
- `{m2Basename}.skin`
- `{m2Basename}_lod01.skin`（LOD 文件）

**BLP 纹理**:
- `{fileDataID}.blp`
- `{m2Basename}_{fileDataID}.blp`
- `{fileDataID1}_{fileDataID2}.blp`

### 命令行选项详解

| 选项 | 说明 | 示例 |
|------|------|------|
| `-o, --output <path>` | 输出文件路径 | `-o output/model.gltf` |
| `-f, --format <format>` | 输出格式（gltf/glb） | `-f glb` |
| `-n, --name <name>` | 模型名称 | `-n "MyModel"` |
| `--no-uv2` | 禁用第二 UV 通道 | `--no-uv2` |
| `--animations` | 导出动画（实验性） | `--animations` |
| `--no-textures` | 不导出纹理 | `--no-textures` |
| `--no-alpha` | 不导出 Alpha 通道 | `--no-alpha` |
| `--no-overwrite` | 不覆盖现有文件 | `--no-overwrite` |
| `-h, --help` | 显示帮助信息 | `--help` |

### 输出说明

#### glTF 格式输出

```
output/
├── model.gltf          # JSON 场景文件
├── model.bin          # 二进制数据
├── 5408779.png        # 纹理 1
└── 5408780.png        # 纹理 2
```

#### GLB 格式输出

```
output/
└── model.glb          # 单文件（所有资源嵌入）
```

### 使用 Web 查看器

1. 打开 `scripts/glb-viewer.html`
2. 点击"选择文件"，选择生成的 GLB/glTF 文件
3. 使用鼠标拖拽旋转、缩放模型

---

## 技术实现

### 1. Mock 系统实现

#### 为什么需要 Mock？

wow.export 设计为在 NW.js 环境中运行，依赖：
- CASC 文件系统（游戏文件系统）
- 原生模块（mmap.node）
- NW.js 特定 API

在 CLI 模式下，需要模拟这些依赖。

#### Mock 实现原理

```javascript
// 拦截 require() 调用
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(...args) {
    const modulePath = args[0];
    
    // 检查是否需要 Mock
    if (需要Mock的模块) {
        return mockImplementation;
    }
    
    // 否则使用原始 require
    return originalRequire.apply(this, args);
};
```

#### core.view.casc.getFile Mock

这是最复杂的 Mock，需要实现智能文件查找：

```javascript
getFile: async (fileDataID) => {
    const m2Dir = path.dirname(currentM2Directory);
    const fileDataIDStr = fileDataID.toString();
    
    // 1. 尝试查找 BLP 文件
    const blpFiles = fs.readdirSync(m2Dir).filter(f => f.endsWith('.blp'));
    
    // 多种匹配策略：
    // - 精确匹配: {fileDataID}.blp
    // - 前缀匹配: {fileDataID}_xxx.blp
    // - 包含匹配: xxx_{fileDataID}_xxx.blp
    
    // 2. 尝试查找 Skin 文件
    const skinFiles = fs.readdirSync(m2Dir).filter(f => f.endsWith('.skin'));
    
    // 返回找到的文件 Buffer
    return BufferWrapper.from(fileData);
}
```

### 2. M2 文件解析

#### M2 文件结构

```
M2 文件
├── 头部 (Header)
│   ├── Magic (4 bytes)
│   ├── Version (4 bytes)
│   └── Chunk offsets
│
├── Chunks
│   ├── MD21 (模型数据)
│   │   ├── Vertices
│   │   ├── Normals
│   │   ├── UVs
│   │   ├── Bones
│   │   ├── Materials
│   │   └── Textures
│   ├── AFID (动画文件 ID)
│   └── ...
│
└── Skin 文件引用
    └── fileDataID[]
```

#### 解析流程

```javascript
// 1. 读取文件头
const magic = buffer.readUInt32LE();
const version = buffer.readUInt32LE();

// 2. 解析各个 Chunk
parseChunk_MD21_vertices(ofs);
parseChunk_MD21_normals(ofs);
parseChunk_MD21_uv(ofs);
parseChunk_MD21_bones(ofs);
parseChunk_MD21_materials(ofs);
parseChunk_MD21_textures(ofs);

// 3. 加载 Skin 文件
const skin = await m2Loader.getSkin(0);
```

### 3. 纹理导出

#### BLP 格式处理

BLP (Blizzard Texture Format) 是魔兽世界的纹理格式：

```
BLP 文件
├── 头部
│   ├── Magic ("BLP2")
│   ├── 格式 (DXT1/DXT3/DXT5)
│   └── Alpha 深度
│
└── Mipmap 数据
    └── Mipmap 0 (最高分辨率)
    └── Mipmap 1
    └── ...
```

#### 转换流程

```javascript
// 1. 读取 BLP 文件
const blp = new BLPFile(textureData);

// 2. 转换为 PNG
const pngBuffer = blp.toPNG(useAlpha ? 0b1111 : 0b0111);

// 3. GLB 模式：存储到 buffer
if (glbMode) {
    texture_buffers.set(fileDataID, pngBuffer);
}
// glTF 模式：保存为文件
else {
    await blp.saveToPNG(texPath, mask);
}
```

**Alpha 通道掩码**:
- `0b1111` = RGBA（包含 Alpha）
- `0b0111` = RGB（不包含 Alpha）

### 4. glTF 生成

#### glTF 2.0 结构

```json
{
  "asset": { "version": "2.0" },
  "scene": 0,
  "scenes": [{ "nodes": [0] }],
  "nodes": [{ "mesh": 0 }],
  "meshes": [{
    "primitives": [{
      "attributes": {
        "POSITION": 0,
        "NORMAL": 1,
        "TEXCOORD_0": 2
      },
      "indices": 3,
      "material": 0
    }]
  }],
  "materials": [{
    "pbrMetallicRoughness": {
      "baseColorTexture": { "index": 0 }
    },
    "alphaMode": "BLEND"
  }],
  "textures": [{ "source": 0 }],
  "images": [{ "uri": "texture.png" }],
  "accessors": [...],
  "bufferViews": [...],
  "buffers": [...]
}
```

#### 写入流程

```javascript
// 1. 创建 GLTFWriter
const gltf = new GLTFWriter(outputPath, modelName);

// 2. 设置数据
gltf.setVerticesArray(m2Loader.vertices);
gltf.setNormalArray(m2Loader.normals);
gltf.addUVArray(m2Loader.uv);
gltf.setBonesArray(m2Loader.bones);
gltf.setTextureMap(textureMap);
gltf.setMaterialMetadata(matName, { blendingMode, flags });

// 3. 添加网格
for (const mesh of skin.subMeshes) {
    gltf.addMesh(meshName, indices, matName);
}

// 4. 写入文件
await gltf.write(overwrite, format);
```

### 5. 透明材质处理

#### 材质信息传递

```javascript
// 1. 获取材质索引
const texUnit = skin.textureUnits[mI];
const materialIndex = texUnit.materialIndex;

// 2. 读取材质信息
const materialInfo = m2Loader.materials[materialIndex];
// materialInfo = { flags: UInt16, blendingMode: UInt16 }

// 3. 设置材质元数据
gltf.setMaterialMetadata(matName, {
    blendingMode: materialInfo.blendingMode,
    flags: materialInfo.flags
});
```

#### GLTFWriter 中的处理

```javascript
// 创建材质时应用元数据
const metadata = this.materialMetadata.get(texFile.matName);
if (metadata && metadata.blendingMode !== undefined) {
    if (metadata.blendingMode === 2 || metadata.blendingMode === 4) {
        material.alphaMode = 'BLEND';
        material.doubleSided = true;
    } else if (metadata.blendingMode === 1 || metadata.blendingMode === 5) {
        material.alphaMode = 'MASK';
        material.alphaCutoff = 0.5;
        material.doubleSided = true;
    }
}
```

---

## 问题解决

### 常见问题

#### 1. 找不到文件

**问题**: `File X not found`

**原因**: 
- Skin 文件或纹理文件不在同一目录
- 文件命名不匹配

**解决方案**:
1. 确保所有文件在同一目录
2. 检查文件命名是否符合支持的格式
3. 查看工具输出的查找日志

#### 2. 纹理显示为灰色

**问题**: 透明材质显示为灰色实心块

**原因**: 
- 缺少 `alphaMode` 设置
- 查看器未正确配置透明渲染

**解决方案**:
1. 确保使用最新版本的转换器（支持透明材质）
2. 检查转换日志中是否有 "Material has BLEND transparency"
3. 使用更新的 `glb-viewer.html`（支持透明渲染）

#### 3. Bun 命令未找到

**问题**: `zsh: command not found: bun`

**解决方案**:
```bash
# 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 重新加载 shell
source ~/.zshrc  # 或 source ~/.bashrc
```

#### 4. 原生模块错误

**问题**: `Cannot find module 'mmap.node'`

**原因**: wow.export 依赖原生模块

**解决方案**:
- 工具已内置 Mock 系统，无需编译原生模块
- 如果仍有问题，检查 Mock 系统是否正确加载

### 调试技巧

#### 1. 启用详细日志

修改 `m2-to-gltf.js`，添加更多 `console.log`:

```javascript
console.log('M2 materials:', m2Loader.materials);
console.log('Skin textureUnits:', skin.textureUnits);
```

#### 2. 检查文件查找

工具会在控制台输出文件查找过程：

```
Found BLP texture: 5408474_5408779.blp (for fileDataID 5408779)
Found file: 540847400.skin
```

#### 3. 验证 glTF 输出

使用在线工具验证 glTF 文件：
- [glTF Viewer](https://gltf-viewer.donmccurdy.com/)
- [Babylon.js Sandbox](https://sandbox.babylonjs.com/)

---

## 测试与验证

### 单元测试示例

```javascript
// test-conversion.js
const { convertM2ToGLTF } = require('./scripts/m2-to-gltf.js');

async function testConversion() {
    try {
        const result = await convertM2ToGLTF(
            'test/model.m2',
            'test/output.glb',
            'glb',
            { exportTextures: true }
        );
        
        console.log('转换成功:', result);
        console.assert(result.meshCount > 0, '应该有网格');
        console.assert(result.textureCount > 0, '应该有纹理');
    } catch (error) {
        console.error('测试失败:', error);
    }
}

testConversion();
```

### 验证清单

- [ ] M2 文件成功解析
- [ ] Skin 文件成功加载
- [ ] 所有纹理成功导出
- [ ] glTF 文件格式正确
- [ ] GLB 文件可以打开
- [ ] 透明材质正确显示
- [ ] 动画数据正确（如果启用）

### 测试用例

#### 测试用例 1: 基本转换

```bash
bun scripts/m2-to-gltf.js resources/M2/5408474.m2 -f gltf
```

**预期结果**:
- 生成 `5408474.gltf` 和 `5408474.bin`
- 导出所有纹理为 PNG
- 所有网格正确显示

#### 测试用例 2: GLB 转换

```bash
bun scripts/m2-to-gltf.js resources/M2/5408474.m2 -f glb
```

**预期结果**:
- 生成单个 `5408474.glb` 文件
- 纹理嵌入到 GLB 中
- 文件可以在查看器中打开

#### 测试用例 3: 透明材质

```bash
bun scripts/m2-to-gltf.js resources/M2/5408474.m2 -f glb
```

**预期结果**:
- 日志显示 "Material has BLEND transparency"
- GLB 文件中的材质包含 `alphaMode: "BLEND"`
- 在查看器中透明部分正确显示

---

## 性能优化

### 当前性能

- **小型模型** (< 1000 顶点): < 1 秒
- **中型模型** (1000-10000 顶点): 1-5 秒
- **大型模型** (> 10000 顶点): 5-15 秒

### 优化建议

#### 1. 批量处理

```bash
# 使用 shell 脚本批量转换
for file in *.m2; do
    bun scripts/m2-to-gltf.js "$file" -f glb
done
```

#### 2. 并行处理

```javascript
// 使用 Promise.all 并行处理多个文件
const promises = files.map(file => 
    convertM2ToGLTF(file, output, 'glb')
);
await Promise.all(promises);
```

#### 3. 内存优化

- 使用流式处理大文件
- 及时释放不需要的 Buffer
- 避免同时加载多个大模型

---

## 未来改进

### 计划功能

1. **改进的动画支持**
   - 完整的骨骼动画导出
   - 动画预览功能
   - 动画编辑工具

2. **材质系统增强**
   - 更多材质属性支持
   - 材质预设
   - 材质编辑器

3. **批量处理**
   - 批量转换工具
   - 进度显示
   - 错误报告

4. **性能优化**
   - 多线程处理
   - 增量更新
   - 缓存系统

5. **Web 界面**
   - 浏览器中的转换工具
   - 拖放上传
   - 实时预览

### 已知限制

1. **动画支持**: 当前为实验性功能，可能不完整
2. **大型模型**: 非常大的模型可能需要较长处理时间
3. **复杂材质**: 某些高级材质效果可能无法完全还原

---

## API 参考

### convertM2ToGLTF()

主转换函数。

**签名**:
```javascript
async function convertM2ToGLTF(
    inputPath: string,
    outputPath: string,
    format: 'gltf' | 'glb',
    options?: {
        exportUV2?: boolean;
        exportAnimations?: boolean;
        exportTextures?: boolean;
        exportAlpha?: boolean;
        overwrite?: boolean;
        modelName?: string;
        meshPrefix?: string;
        skinIndex?: number;
    }
): Promise<{
    outputPath: string;
    format: string;
    vertexCount: number;
    meshCount: number;
    boneCount: number;
    textureCount: number;
    animationCount: number;
    availableSkins: number;
}>
```

**示例**:
```javascript
const result = await convertM2ToGLTF(
    'model.m2',
    'output.glb',
    'glb',
    {
        exportTextures: true,
        exportAlpha: true,
        exportAnimations: false
    }
);
```

### exportTextures()

导出纹理函数。

**签名**:
```javascript
async function exportTextures(
    m2Loader: M2Loader,
    outDir: string,
    glbMode: boolean,
    options?: {
        exportAlpha?: boolean;
        overwrite?: boolean;
    }
): Promise<{
    validTextures: Map<number, TextureInfo>;
    texture_buffers: Map<number, Buffer>;
}>
```

---

## 贡献指南

### 代码风格

- 使用 JavaScript（ES6+）
- 遵循项目现有的代码风格
- 添加必要的注释

### 提交规范

- 清晰的提交信息
- 包含测试用例
- 更新相关文档

### 报告问题

在提交 Issue 时，请包含：
- 问题描述
- 复现步骤
- 错误信息
- 环境信息（OS, Bun 版本等）

---

## 许可证

本项目基于 MIT 许可证。

---

## 参考资料

- [glTF 2.0 规范](https://www.khronos.org/gltf/)
- [M2 文件格式文档](https://wowdev.wiki/M2)
- [Bun 文档](https://bun.sh/docs)
- [Three.js 文档](https://threejs.org/docs/)

---

## 更新日志

### v1.0.0 (2024-12-XX)

- ✨ 初始版本发布
- ✅ M2 文件解析
- ✅ Skin 文件加载
- ✅ BLP 纹理导出
- ✅ glTF/GLB 格式支持
- ✅ 透明材质支持
- ✅ 命令行接口
- ✅ Web 查看器

---

**文档版本**: 1.0.0  
**最后更新**: 2024-12-XX  
**维护者**: wow.export 项目团队

---

## 附录

### A. 文件格式参考

#### M2 文件格式
- Magic: `0x4D443231` ("MD21")
- 版本: 多个版本支持
- Chunk 结构: 基于偏移量的 Chunk 系统

#### Skin 文件格式
- Magic: `0x4E494B53` ("SKIN")
- 包含: 索引、三角形、子网格、纹理单元

#### BLP 文件格式
- Magic: `0x32504C42` ("BLP2")
- 格式: DXT1/DXT3/DXT5
- Mipmap: 支持多级 Mipmap

### B. 命令行示例集合

```bash
# 基本转换
bun scripts/m2-to-gltf.js model.m2

# GLB 格式
bun scripts/m2-to-gltf.js model.m2 -f glb

# 指定输出
bun scripts/m2-to-gltf.js model.m2 -o output.glb -f glb

# 不导出纹理
bun scripts/m2-to-gltf.js model.m2 --no-textures

# 导出动画
bun scripts/m2-to-gltf.js model.m2 --animations

# 不覆盖现有文件
bun scripts/m2-to-gltf.js model.m2 --no-overwrite
```

### C. 故障排除速查表

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| 找不到文件 | 文件不在同一目录 | 检查文件位置 |
| 纹理灰色 | 缺少透明设置 | 更新转换器版本 |
| Bun 未找到 | 未安装 Bun | 安装 Bun |
| 原生模块错误 | Mock 系统问题 | 检查 Mock 实现 |

---

**文档完成！** 🎉

如有问题或建议，请提交 Issue 或 Pull Request。

