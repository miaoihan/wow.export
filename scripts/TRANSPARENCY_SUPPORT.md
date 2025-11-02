# M2 到 glTF 转换器 - 透明材质支持文档

## 概述

本文档记录了在 M2 到 glTF/GLB 转换器中添加透明材质（Alpha Blending）支持的工作。该功能解决了透明物体（如蜘蛛网）在导出后显示为灰色实心块的问题。

## 问题描述

### 问题现象
- 透明模型（如蜘蛛网）在导出为 glTF/GLB 后显示为灰色实心块
- 模型失去了原有的透明效果，无法正确显示

### 根本原因
1. **glTF 材质缺少透明度设置**：原始 `GLTFWriter` 在创建材质时未设置 `alphaMode` 属性
2. **材质信息未传递**：M2 文件中的 `blendingMode` 信息没有被传递到 glTF 材质中
3. **查看器渲染问题**：Three.js 查看器未正确配置透明材质的渲染设置

## 技术背景

### M2 材质系统

M2 文件格式使用 `blendingMode` 来定义材质的混合模式：

| blendingMode | 说明 | glTF alphaMode |
|-------------|------|----------------|
| 0 | 不透明 | OPAQUE |
| 1 | Alpha 裁切 | MASK |
| 2 | 透明混合 | BLEND |
| 3 | 未使用 | OPAQUE |
| 4 | 透明混合（变体） | BLEND |
| 5 | Alpha 裁切（变体） | MASK |

### glTF 材质规范

glTF 2.0 标准支持的 `alphaMode` 值：
- `OPAQUE`: 完全不透明，忽略 alpha 通道
- `MASK`: Alpha 测试，alpha 值低于 `alphaCutoff` 的像素被丢弃
- `BLEND`: Alpha 混合，使用 alpha 通道进行透明度混合

## 解决方案

### 1. GLTFWriter 修改

#### 1.1 添加材质元数据存储

**文件**: `src/js/3D/writers/GLTFWriter.js`

在构造函数中添加 `materialMetadata` Map：

```javascript
constructor(out, name) {
    // ... 其他属性
    this.materialMetadata = new Map(); // Map<matName, {blendingMode, flags}>
}
```

#### 1.2 添加材质元数据设置方法

```javascript
/**
 * Set material metadata (blendingMode, flags) for a material.
 * @param {string} matName Material name
 * @param {Object} metadata Material metadata with blendingMode and flags
 */
setMaterialMetadata(matName, metadata) {
    this.materialMetadata.set(matName, metadata);
}
```

#### 1.3 修改材质创建逻辑

在 `write()` 方法中，创建材质时应用元数据：

```javascript
// Create material with default properties
const material = {
    name: path.basename(texFile.matName, path.extname(texFile.matName)),
    emissiveFactor: [0, 0, 0],
    pbrMetallicRoughness: {
        baseColorTexture: {
            index: textureIndex
        },
        metallicFactor: 0
    }
};

// Apply material metadata if available (for transparency/alpha blending)
const metadata = this.materialMetadata.get(texFile.matName);
if (metadata && metadata.blendingMode !== undefined) {
    // Blending mode mapping based on Blender importer:
    // 2, 4 -> BLEND (transparent blending)
    // 1, 5 -> MASK (alpha cutoff)
    // others -> OPAQUE
    if (metadata.blendingMode === 2 || metadata.blendingMode === 4) {
        material.alphaMode = 'BLEND';
        material.doubleSided = true; // Transparent materials often need double-sided rendering
    } else if (metadata.blendingMode === 1 || metadata.blendingMode === 5) {
        material.alphaMode = 'MASK';
        material.alphaCutoff = 0.5; // Default alpha cutoff
        material.doubleSided = true;
    } else {
        material.alphaMode = 'OPAQUE';
    }
}
```

### 2. m2-to-gltf.js 修改

#### 2.1 获取材质信息

在处理每个 mesh 时，从 `textureUnits` 和 `materials` 获取材质信息：

```javascript
// Get texture for this mesh (if any)
const texUnits = skin.textureUnits.filter(tex => tex.skinSectionIndex === mI);
if (texUnits.length > 0 && m2Loader.textureCombos) {
    const texUnit = texUnits[0];
    const textureIndex = m2Loader.textureCombos[texUnit.textureComboIndex];
    texture = m2Loader.textures[textureIndex];
    
    if (texture && texture.fileDataID && textureMap.has(texture.fileDataID)) {
        matName = textureMap.get(texture.fileDataID).matName;
        
        // Get material info for transparency support
        if (texUnit.materialIndex !== undefined && m2Loader.materials && m2Loader.materials.length > 0) {
            const materialIndex = texUnit.materialIndex;
            if (materialIndex >= 0 && materialIndex < m2Loader.materials.length) {
                materialInfo = m2Loader.materials[materialIndex];
                // Set material metadata for transparency
                gltf.setMaterialMetadata(matName, {
                    blendingMode: materialInfo.blendingMode,
                    flags: materialInfo.flags
                });
                
                // Log transparency info
                if (materialInfo.blendingMode === 2 || materialInfo.blendingMode === 4) {
                    console.log(`    → Material has BLEND transparency (blendingMode: ${materialInfo.blendingMode})`);
                } else if (materialInfo.blendingMode === 1 || materialInfo.blendingMode === 5) {
                    console.log(`    → Material has MASK transparency (blendingMode: ${materialInfo.blendingMode})`);
                }
            }
        }
    }
}
```

### 3. 查看器改进

#### 3.1 启用渲染器 Alpha 支持

**文件**: `scripts/glb-viewer.html`

```javascript
// 创建渲染器（启用 alpha 通道支持透明材质）
renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// 启用透明对象的正确排序
renderer.sortObjects = true;
```

#### 3.2 确保材质透明度正确设置

在模型加载后，遍历所有 mesh 确保透明材质正确配置：

```javascript
// 确保透明材质正确渲染
currentModel.traverse(function(child) {
    if (child.isMesh && child.material) {
        // 确保材质透明度设置正确
        if (child.material.transparent !== undefined) {
            // GLTFLoader 应该已经设置了透明属性，但确保它正确
            if (child.material.alphaMode === 'BLEND' || child.material.alphaMode === 'MASK') {
                child.material.transparent = true;
                child.material.needsUpdate = true;
            }
        }
        // 确保双面渲染（对于透明材质很重要）
        if (child.material.side === undefined && child.material.alphaMode === 'BLEND') {
            child.material.side = THREE.DoubleSide;
        }
    }
});
```

## 数据流程

```
M2 文件
  ├── materials[] (包含 blendingMode)
  │   └── blendingMode: 0-5
  │
  └── Skin 文件
      └── textureUnits[]
          ├── materialIndex → 指向 materials[]
          └── textureComboIndex → 指向 textures[]
              │
              └── textures[]
                  └── fileDataID → 纹理文件

转换流程:
1. 加载 M2 和 Skin 文件
2. 对于每个 mesh:
   a. 从 textureUnits 获取 materialIndex
   b. 从 materials[materialIndex] 获取 blendingMode
   c. 调用 gltf.setMaterialMetadata(matName, {blendingMode, flags})
3. GLTFWriter.write() 时:
   a. 根据 blendingMode 设置 alphaMode
   b. 设置 doubleSided（如果透明）
   c. 设置 alphaCutoff（如果是 MASK 模式）
```

## 使用示例

### 基本转换

```bash
bun scripts/m2-to-gltf.js resources/M2/5408474.m2 -f glb
```

### 转换输出示例

```
Loading M2 model...
Model loaded: Bookshelf
Vertices: 818
Bones: 1
Textures: 2
Animations: 0
Available skins: 1

Loading skin data (index 0)...
Submeshes: 2
Texture units: 2

Exporting textures...
  Found BLP texture: 5408474_5408779.blp (for fileDataID 5408779)
  Buffered texture 5408779 for GLB embedding
  Found BLP texture: 5408474_5408780.blp (for fileDataID 5408780)
  Buffered texture 5408780 for GLB embedding

Processing meshes...
  Mesh 0 (submeshID: 0): Using texture 5408779
  Mesh 1 (submeshID: 0): Using texture 5408780
    → Material has BLEND transparency (blendingMode: 2)

Exported 2 meshes, skipped 0 empty meshes
Writing GLB file...
Conversion completed successfully!
```

### 验证透明材质

生成的 GLB 文件中的材质示例：

```json
{
  "materials": [
    {
      "name": "mat_5408779",
      "emissiveFactor": [0, 0, 0],
      "pbrMetallicRoughness": {
        "baseColorTexture": {
          "index": 0
        },
        "metallicFactor": 0
      },
      "alphaMode": "OPAQUE"
    },
    {
      "name": "mat_5408780",
      "emissiveFactor": [0, 0, 0],
      "pbrMetallicRoughness": {
        "baseColorTexture": {
          "index": 1
        },
        "metallicFactor": 0
      },
      "alphaMode": "BLEND",
      "doubleSided": true
    }
  ]
}
```

## 测试验证

### 测试用例

1. **透明材质测试**：
   - 输入：包含 `blendingMode: 2` 或 `4` 的 M2 文件
   - 期望：生成的 glTF 中材质 `alphaMode` 为 `BLEND`

2. **Alpha 裁切测试**：
   - 输入：包含 `blendingMode: 1` 或 `5` 的 M2 文件
   - 期望：生成的 glTF 中材质 `alphaMode` 为 `MASK`，`alphaCutoff` 为 `0.5`

3. **不透明材质测试**：
   - 输入：包含 `blendingMode: 0` 的 M2 文件
   - 期望：生成的 glTF 中材质 `alphaMode` 为 `OPAQUE`

4. **查看器渲染测试**：
   - 使用 `glb-viewer.html` 加载包含透明材质的 GLB
   - 期望：透明部分正确显示，不是灰色实心块

### 已知问题

1. **Alpha 通道导出**：
   - 确保纹理的 alpha 通道正确导出（默认启用 `--exportAlpha`）
   - 如果纹理本身没有 alpha 通道，透明效果不会生效

2. **查看器兼容性**：
   - 不同查看器对 `alphaMode` 的支持可能不同
   - Three.js 会自动将 `alphaMode` 转换为 `transparent` 属性

3. **性能考虑**：
   - `BLEND` 模式需要正确的渲染顺序，可能影响性能
   - 大量透明对象时应考虑使用 `MASK` 模式

## 技术细节

### blendingMode 映射逻辑

```javascript
if (blendingMode === 2 || blendingMode === 4) {
    // 透明混合模式
    alphaMode = 'BLEND';
    doubleSided = true;
} else if (blendingMode === 1 || blendingMode === 5) {
    // Alpha 裁切模式
    alphaMode = 'MASK';
    alphaCutoff = 0.5;
    doubleSided = true;
} else {
    // 不透明模式
    alphaMode = 'OPAQUE';
}
```

### 为什么需要 doubleSided？

透明材质通常需要双面渲染，因为：
1. 透明对象可以从前后两个方向看到
2. 某些模型（如蜘蛛网）没有明确的"正面"和"背面"
3. glTF 规范建议透明材质使用双面渲染

### 渲染顺序重要性

透明对象必须按深度排序后渲染，否则会出现视觉错误：
- 远处的透明对象可能错误地遮挡近处的对象
- Three.js 的 `renderer.sortObjects = true` 会自动处理这个问题

## 相关文件

- `src/js/3D/writers/GLTFWriter.js` - glTF 写入器，包含材质创建逻辑
- `src/js/3D/loaders/M2Loader.js` - M2 文件加载器，解析材质信息
- `src/js/3D/Skin.js` - Skin 文件加载器，包含 textureUnits 信息
- `scripts/m2-to-gltf.js` - M2 到 glTF 转换脚本
- `scripts/glb-viewer.html` - Three.js 查看器

## 参考资源

- [glTF 2.0 材质规范](https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials)
- [Three.js 材质文档](https://threejs.org/docs/#api/en/materials/Material)
- [M2 文件格式文档](https://wowdev.wiki/M2)

## 更新日志

### 2024-12-XX
- 添加透明材质支持
- 实现 blendingMode 到 alphaMode 的映射
- 改进查看器透明材质渲染
- 添加材质元数据系统

## 后续改进建议

1. **自定义 alphaCutoff**：
   - 允许用户通过命令行参数自定义 `alphaCutoff` 值

2. **材质标志支持**：
   - 实现更多材质标志的处理（如 `two_sided`、`unlit` 等）

3. **性能优化**：
   - 对于大量透明对象，考虑自动切换为 `MASK` 模式

4. **可视化调试**：
   - 在查看器中添加材质信息显示面板
   - 允许实时切换 alphaMode 进行调试

---

**作者**: AI Assistant  
**最后更新**: 2024-12-XX  
**版本**: 1.0.0

