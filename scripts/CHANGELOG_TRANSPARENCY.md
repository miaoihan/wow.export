# 开发日志：透明材质支持

## 问题

透明模型（如蜘蛛网）导出后显示为灰色实心块，缺少透明效果。

## 解决方案

### 1. GLTFWriter 添加材质元数据支持

**文件**: `src/js/3D/writers/GLTFWriter.js`

- 添加 `materialMetadata` Map 存储材质信息
- 添加 `setMaterialMetadata()` 方法
- 在 `write()` 中根据 `blendingMode` 设置 `alphaMode`：
  - `blendingMode: 2 或 4` → `alphaMode: 'BLEND'`
  - `blendingMode: 1 或 5` → `alphaMode: 'MASK'`
  - 其他 → `alphaMode: 'OPAQUE'`

### 2. m2-to-gltf.js 传递材质信息

**文件**: `scripts/m2-to-gltf.js`

- 在处理 mesh 时获取 `textureUnits` 的 `materialIndex`
- 从 `m2Loader.materials` 读取 `blendingMode`
- 调用 `gltf.setMaterialMetadata()` 传递材质信息
- 添加日志输出显示透明材质信息

### 3. 查看器改进

**文件**: `scripts/glb-viewer.html`

- 启用 `renderer.alpha = true`
- 启用 `renderer.sortObjects = true`
- 添加材质遍历代码确保透明属性正确设置

## 代码变更

### GLTFWriter.js

```javascript
// 构造函数中添加
this.materialMetadata = new Map();

// 新增方法
setMaterialMetadata(matName, metadata) {
    this.materialMetadata.set(matName, metadata);
}

// 材质创建时应用
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

### m2-to-gltf.js

```javascript
// 获取材质信息
if (texUnit.materialIndex !== undefined && m2Loader.materials) {
    const materialIndex = texUnit.materialIndex;
    const materialInfo = m2Loader.materials[materialIndex];
    gltf.setMaterialMetadata(matName, {
        blendingMode: materialInfo.blendingMode,
        flags: materialInfo.flags
    });
}
```

## 测试

```bash
# 转换包含透明材质的模型
bun scripts/m2-to-gltf.js resources/M2/5408474.m2 -f glb

# 查看输出日志，应该看到：
# → Material has BLEND transparency (blendingMode: 2)
```

## 验证

生成的 GLB 文件中的材质应包含：
- `alphaMode: "BLEND"` 或 `"MASK"` 或 `"OPAQUE"`
- `doubleSided: true`（如果是透明材质）

## 相关文件

- `src/js/3D/writers/GLTFWriter.js`
- `scripts/m2-to-gltf.js`
- `scripts/glb-viewer.html`

## 日期

2024-12-XX

