#!/usr/bin/env bun
/*!
	wow.export (https://github.com/Kruithne/wow.export)
	M2 to glTF Converter Script
	License: MIT
 */

const fs = require('fs');
const path = require('path');

// Global variable to store M2 directory context and context type
let currentM2Directory = null;
let currentFileContext = 'auto'; // 'auto', 'skin', 'texture'

// Mock listfile module BEFORE any other requires
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(...args) {
	const modulePath = args[0];
	
	// Mock mmap.node (native module)
	if (modulePath.includes('mmap.node') || modulePath === path.join(process.cwd(), 'mmap.node')) {
		return {
			MmapObject: class {
				mapFile() { return false; }
				get lastError() { return 'Mocked mmap - not available in CLI mode'; }
			}
		};
	}
	
	// Mock listfile module
	if (modulePath.includes('casc/listfile') || modulePath === '../casc/listfile' || modulePath === '../../casc/listfile') {
		return {
			getByID: (id) => undefined,
			getByIDOrUnknown: (id, ext = '') => {
				return `unknown_${id}${ext}`;
			},
			getByFilename: (filename) => undefined,
			getFilenamesByExtension: (ext) => [],
			getFilteredEntries: () => [],
			stripFileEntry: (entry) => entry,
			formatEntries: (entries) => entries,
			formatUnknownFile: (id, ext = '') => `unknown_${id}${ext}`,
			ingestIdentifiedFiles: () => {},
			isLoaded: () => true
		};
	}
	
	// Mock log module
	if (modulePath === '../log' || modulePath === '../../log' || modulePath.endsWith('/src/js/log')) {
		return {
			write: (...args) => {
				// Silently ignore log writes or optionally log to console
				// console.log('[LOG]', ...args);
			},
			error: (...args) => console.error('[ERROR]', ...args),
			success: (...args) => console.log('[SUCCESS]', ...args),
			warn: (...args) => console.warn('[WARN]', ...args),
			info: (...args) => console.log('[INFO]', ...args)
		};
	}
	
	// Mock generics module
	if (modulePath === '../generics' || modulePath === '../../generics' || modulePath.endsWith('/src/js/generics')) {
		return {
			createDirectory: async (dir) => {
				const fs = require('fs');
				await fs.promises.mkdir(dir, { recursive: true });
			},
			fileExists: async (filePath) => {
				const fs = require('fs');
				try {
					await fs.promises.access(filePath);
					return true;
				} catch {
					return false;
				}
			}
		};
	}
	
	// Mock core module
	if (modulePath === '../core' || modulePath === '../../core' || modulePath.endsWith('/src/js/core')) {
		const EventEmitter = require('events');
		const events = new EventEmitter();
		
		return {
			events,
			view: {
				config: {
					enableAbsoluteGLTFPaths: false,
					modelsExportAnimations: false,
					modelsExportWithBonePrefix: false
				},
				casc: {
					getFile: async (fileDataID) => {
						if (!currentM2Directory) {
							throw new Error('M2 directory not set');
						}
						
						const m2Basename = path.basename(currentM2Directory, '.m2');
						const m2Dir = path.dirname(currentM2Directory);
						const fileDataIDStr = fileDataID.toString();
						
						// First, try to find BLP files (textures)
						try {
							const blpFiles = fs.readdirSync(m2Dir).filter(f => f.endsWith('.blp'));
							if (blpFiles.length > 0) {
								// Try multiple matching strategies for BLP:
								// 1. Exact match: {fileDataID}.blp
								let matchedBlp = blpFiles.find(f => f === `${fileDataIDStr}.blp`);
								
								// 2. Starts with fileDataID: {fileDataID}_xxx.blp or {fileDataID}00.blp
								if (!matchedBlp) {
									matchedBlp = blpFiles.find(f => {
										const name = path.basename(f, '.blp');
										return name.startsWith(fileDataIDStr + '_') || 
										       name.startsWith(fileDataIDStr + '00') ||
										       name === fileDataIDStr;
									});
								}
								
								// 3. Contains fileDataID: xxx_{fileDataID}_xxx.blp or {fileDataID1}_{fileDataID2}.blp
								if (!matchedBlp) {
									matchedBlp = blpFiles.find(f => {
										const baseName = path.basename(f, '.blp');
										const parts = baseName.split('_');
										return parts.some(part => part === fileDataIDStr);
									});
								}
								
								if (matchedBlp) {
									console.log(`  Found BLP texture: ${matchedBlp} (for fileDataID ${fileDataIDStr})`);
									const BufferWrapper = require('../src/js/buffer');
									const fileData = await fs.promises.readFile(path.join(m2Dir, matchedBlp));
									return BufferWrapper.from(fileData);
								}
							}
						} catch (e) {
							// Ignore errors when searching for BLP files
						}
						
						// Then try to find skin files (only if context is 'skin' or 'auto')
						// Skip skin lookup if explicitly looking for textures
						if (currentFileContext === 'skin' || (currentFileContext === 'auto' && fileDataID < 100000000)) {
							const BufferWrapper = require('../src/js/buffer');
							const m2BasenameNum = parseInt(m2Basename);
							const isLikelySkinRequest = (
								fileDataID === m2BasenameNum ||
								fileDataID === m2BasenameNum * 100 ||
								fileDataID.toString().startsWith(m2Basename) ||
								(fileDataID > 1000000 && fileDataID < 100000000)
							);
							
							if (isLikelySkinRequest) {
								const possibleSkinPaths = [
									path.join(m2Dir, `${fileDataIDStr}.skin`),
									path.join(m2Dir, `${fileDataIDStr}_00.skin`),      // With underscore: 5408474_00.skin
									path.join(m2Dir, `${fileDataIDStr}00.skin`),       // Without underscore: 540847400.skin
									path.join(m2Dir, `${m2Basename}_${fileDataIDStr}.skin`),
									path.join(m2Dir, `${m2Basename}.skin`),
									path.join(m2Dir, `${m2Basename}_00.skin`),
									path.join(m2Dir, `${m2Basename}00.skin`),         // Without underscore variant
									path.join(m2Dir, `${m2Basename}_lod01.skin`),
									path.join(m2Dir, `${m2Basename}_lod02.skin`),
									path.join(m2Dir, `${m2Basename}_lod03.skin`)
								];
								
								for (const possiblePath of possibleSkinPaths) {
									if (fs.existsSync(possiblePath)) {
										console.log(`  Found file: ${path.basename(possiblePath)}`);
										const fileData = await fs.promises.readFile(possiblePath);
										return BufferWrapper.from(fileData);
									}
								}
								
								// Fallback: try any available skin file
								const skinFiles = fs.readdirSync(m2Dir).filter(f => f.endsWith('.skin'));
								if (skinFiles.length > 0) {
									console.log(`  ⚠️  Warning: File ${fileDataIDStr} not found, using fallback: ${skinFiles[0]}`);
									const fallbackPath = path.join(m2Dir, skinFiles[0]);
									const fileData = await fs.promises.readFile(fallbackPath);
									return BufferWrapper.from(fileData);
								}
							}
						}
						
						// If we get here, file not found
						throw new Error(
							`File ${fileDataID} not found in ${m2Dir}.\n` +
							`Please ensure the required files exist in the same directory as the M2 file.`
						);
					}
				}
			}
		};
	}
	
	return originalRequire.apply(this, args);
};

const BufferWrapper = require('../src/js/buffer');
const M2Loader = require('../src/js/3D/loaders/M2Loader');
const GLTFWriter = require('../src/js/3D/writers/GLTFWriter');
const BLPFile = require('../src/js/casc/blp');

// Mock NW.js environment for CLI usage
if (typeof global.nw === 'undefined') {
	global.nw = {
		App: {
			manifest: {
				version: '0.2.4',
				flavour: 'cli',
				guid: 'm2-to-gltf-script'
			}
		}
	};
}


/**
 * Export textures from M2 model
 * @param {M2Loader} m2Loader - Loaded M2 model
 * @param {string} outDir - Output directory
 * @param {boolean} glbMode - Whether exporting in GLB mode
 * @param {object} options - Export options
 */
async function exportTextures(m2Loader, outDir, glbMode = false, options = {}) {
	const validTextures = new Map();
	const texture_buffers = new Map();
	const useAlpha = options.exportAlpha !== false;
	
	let textureIndex = 0;
	
	for (const texture of m2Loader.textures) {
		const textureType = m2Loader.textureTypes[textureIndex];
		let texFileDataID = texture.fileDataID;
		
		// Handle variant textures
		if (textureType > 0 && options.variantTextures) {
			if (textureType >= 11 && textureType < 14) {
				texFileDataID = options.variantTextures[textureType - 11];
			} else if (textureType > 1 && textureType < 5) {
				texFileDataID = options.variantTextures[textureType - 2];
			}
		}
		
		if (!Number.isNaN(texFileDataID) && texFileDataID > 0) {
			try {
				let texFile = `${texFileDataID}.png`;
				let texPath = path.join(outDir, texFile);
				
				// Try to load texture file
				let textureData;
				try {
					// Use the casc.getFile from the mocked core module
					const core = require('../src/js/core');
					textureData = await core.view.casc.getFile(texFileDataID);
				} catch (e) {
					console.log(`  ⚠️  Warning: Texture ${texFileDataID} not found, skipping`);
					textureIndex++;
					continue;
				}
				
				// Check if it's a BLP file
				textureData.seek(0);
				const magic = textureData.readUInt32LE();
				textureData.seek(0);
				
				if (magic === 0x32504c42) { // BLP magic "BLP2"
					const blp = new BLPFile(textureData);
					
					if (glbMode) {
						// Convert to PNG buffer for GLB embedding
						const png_buffer = blp.toPNG(useAlpha ? 0b1111 : 0b0111);
						texture_buffers.set(texFileDataID, png_buffer);
						console.log(`  Buffered texture ${texFileDataID} for GLB embedding`);
					} else {
						// Save as PNG file
						if (options.overwrite !== false || !fs.existsSync(texPath)) {
							await blp.saveToPNG(texPath, useAlpha ? 0b1111 : 0b0111);
							console.log(`  Exported texture ${texFileDataID} -> ${texFile}`);
						} else {
							console.log(`  Texture ${texFile} already exists, skipping`);
						}
					}
					
					const matName = `mat_${texFileDataID}`;
					validTextures.set(texFileDataID, {
						matName: matName,
						matPathRelative: texFile,
						matPath: texPath
					});
				} else {
					console.log(`  ⚠️  Warning: File ${texFileDataID} is not a BLP texture, skipping`);
				}
			} catch (e) {
				console.log(`  ⚠️  Failed to export texture ${texFileDataID}: ${e.message}`);
			}
		}
		
		textureIndex++;
	}
	
	return { validTextures, texture_buffers };
}

/**
 * Convert M2 file to glTF/GLB format
 * @param {string} inputPath - Path to input M2 file
 * @param {string} outputPath - Path to output glTF/GLB file
 * @param {string} format - Output format: 'gltf' or 'glb' (default: 'gltf')
 * @param {object} options - Conversion options
 */
async function convertM2ToGLTF(inputPath, outputPath, format = 'gltf', options = {}) {
	console.log(`Converting M2 file: ${inputPath}`);
	console.log(`Output format: ${format.toUpperCase()}`);
	console.log(`Output path: ${outputPath}`);

	// Check if input file exists
	if (!fs.existsSync(inputPath)) {
		throw new Error(`Input file not found: ${inputPath}`);
	}

	// Set M2 directory and context for CASC mock
	currentM2Directory = inputPath;
	currentFileContext = 'skin'; // Set context to 'skin' when loading skin files

	// Read M2 file
	const m2Data = await fs.promises.readFile(inputPath);
	const buffer = BufferWrapper.from(m2Data);

	// Load M2 model
	console.log('Loading M2 model...');
	const m2Loader = new M2Loader(buffer);
	await m2Loader.load();

	console.log(`Model loaded: ${m2Loader.name || 'Unknown'}`);
		console.log(`Vertices: ${m2Loader.vertices.length / 3}`);
		console.log(`Bones: ${m2Loader.bones.length}`);
		console.log(`Textures: ${m2Loader.textures.length}`);
		console.log(`Animations: ${m2Loader.animations.length}`);
		console.log(`Available skins: ${m2Loader.getSkinList().length}`);

	// Load skin (with option to select which skin/index)
	const skinIndex = options.skinIndex !== undefined ? options.skinIndex : 0;
	console.log(`Loading skin data (index ${skinIndex})...`);
	let skin;
	try {
		const skinList = m2Loader.getSkinList();
		if (skinIndex >= skinList.length) {
			console.log(`  ⚠️  Warning: Skin index ${skinIndex} not available, using index 0`);
			skin = await m2Loader.getSkin(0);
		} else {
			skin = await m2Loader.getSkin(skinIndex);
		}
		console.log(`Submeshes: ${skin.subMeshes.length}`);
		console.log(`Texture units: ${skin.textureUnits.length}`);
	} catch (e) {
		console.error('Failed to load skin:', e);
		throw e;
	}

	console.log('Preparing output...');
	// Prepare output directory
	const outputDir = path.dirname(outputPath);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	console.log('Creating GLTFWriter...');
	// Setup glTF writer
	const modelName = options.modelName || path.basename(inputPath, '.m2');
	const gltf = new GLTFWriter(outputPath, modelName);
	console.log('GLTFWriter created');

	// Set model data
	gltf.setVerticesArray(m2Loader.vertices);
	gltf.setNormalArray(m2Loader.normals);
	gltf.addUVArray(m2Loader.uv);
	
	if (options.exportUV2 !== false) {
		gltf.addUVArray(m2Loader.uv2);
	}

	// Set bone data
	if (m2Loader.bones.length > 0) {
		gltf.setBonesArray(m2Loader.bones);
		gltf.setBoneWeightArray(m2Loader.boneWeights);
		gltf.setBoneIndexArray(m2Loader.boneIndices);
	}

	// Export textures if enabled
	let textureMap = new Map();
	let textureBuffers = new Map();
	
	if (options.exportTextures !== false && m2Loader.textures.length > 0) {
		console.log('Exporting textures...');
		currentFileContext = 'texture'; // Set context to 'texture' when exporting textures
		const textureResult = await exportTextures(m2Loader, outputDir, format === 'glb', options);
		textureMap = textureResult.validTextures;
		textureBuffers = textureResult.texture_buffers;
		gltf.setTextureMap(textureMap);
		if (format === 'glb' && textureBuffers.size > 0) {
			gltf.setTextureBuffers(textureBuffers);
		}
		currentFileContext = 'skin'; // Reset context back to 'skin' after texture export
	}

	// Set animations (if requested)
	if (options.exportAnimations && m2Loader.animations.length > 0) {
		console.log('Including animations...');
		global.core.view.config.modelsExportAnimations = true;
		gltf.setAnimations(m2Loader.animations);
	}

	// Apply bone prefix option
	if (options.bonePrefix !== undefined) {
		global.core.view.config.modelsExportWithBonePrefix = options.bonePrefix;
	}

	// Export meshes
	console.log('Processing meshes...');
	let exportedMeshCount = 0;
	let skippedMeshCount = 0;
	
	for (let mI = 0, mC = skin.subMeshes.length; mI < mC; mI++) {
		const mesh = skin.subMeshes[mI];
		
		// Skip empty meshes
		if (mesh.triangleCount === 0) {
			console.log(`  Mesh ${mI}: Skipping (empty mesh)`);
			skippedMeshCount++;
			continue;
		}
		
		const indices = new Array(mesh.triangleCount);
		
		for (let vI = 0; vI < mesh.triangleCount; vI++) {
			indices[vI] = skin.indices[skin.triangles[mesh.triangleStart + vI]];
		}

		// Get texture for this mesh (if any)
		// A mesh can have multiple texture units, find all of them
		const texUnits = skin.textureUnits.filter(tex => tex.skinSectionIndex === mI);
		let texture = null;
		let matName = undefined;
		let materialInfo = null;
		
		if (texUnits.length > 0 && m2Loader.textureCombos) {
			// Use the first texture unit found
			const texUnit = texUnits[0];
			const textureIndex = m2Loader.textureCombos[texUnit.textureComboIndex];
			texture = m2Loader.textures[textureIndex];
			
			if (texture && texture.fileDataID) {
				if (textureMap.has(texture.fileDataID)) {
					matName = textureMap.get(texture.fileDataID).matName;
					console.log(`  Mesh ${mI} (submeshID: ${mesh.submeshID}): Using texture ${texture.fileDataID}`);
					
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
				} else {
					console.log(`  ⚠️  Mesh ${mI} (submeshID: ${mesh.submeshID}): Texture ${texture.fileDataID} not in texture map`);
				}
			} else {
				console.log(`  Mesh ${mI} (submeshID: ${mesh.submeshID}): No texture fileDataID found`);
			}
		} else {
			console.log(`  Mesh ${mI} (submeshID: ${mesh.submeshID}): No texture units found`);
		}

		// Generate mesh name
		const meshName = options.meshPrefix 
			? `${options.meshPrefix}_${mI}_${mesh.submeshID}`
			: `Geoset_${mI}_${mesh.submeshID}`;
			
		// Add mesh to glTF (even if no texture, so geometry is preserved)
		gltf.addMesh(meshName, indices, matName);
		exportedMeshCount++;
	}
	
	console.log(`Exported ${exportedMeshCount} meshes, skipped ${skippedMeshCount} empty meshes`);

	// Write output file
	console.log(`Writing ${format.toUpperCase()} file...`);
	await gltf.write(options.overwrite !== false, format);

		console.log('Conversion completed successfully!');
	return {
		outputPath,
		format,
		vertexCount: m2Loader.vertices.length / 3,
		meshCount: exportedMeshCount,
		boneCount: m2Loader.bones.length,
		textureCount: textureMap.size,
		animationCount: m2Loader.animations.length,
		availableSkins: m2Loader.getSkinList().length
	};
}

/**
 * Main CLI function
 */
async function main() {
	const args = process.argv.slice(2);

	if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
		console.log(`
M2 to glTF Converter
Usage: bun scripts/m2-to-gltf.js <input.m2> [options]

Options:
  -o, --output <path>     Output file path (default: same as input with .gltf extension)
  -f, --format <format>   Output format: 'gltf' or 'glb' (default: 'gltf')
  -n, --name <name>       Model name (default: input filename)
  --no-uv2                Don't export second UV channel
  --animations            Export animations (experimental)
  --no-textures           Don't export textures
  --no-alpha              Don't export alpha channel in textures
  --no-overwrite          Don't overwrite existing files
  -h, --help              Show this help message

Examples:
  bun scripts/m2-to-gltf.js model.m2
  bun scripts/m2-to-gltf.js model.m2 -o output/model.gltf
  bun scripts/m2-to-gltf.js model.m2 --format glb
  bun scripts/m2-to-gltf.js model.m2 --animations
		`);
		process.exit(0);
	}

	const inputPath = args[0];
	let outputPath = null;
	let format = 'gltf';
	const options = {
		exportUV2: true,
		exportAnimations: false,
		exportTextures: true,
		exportAlpha: true,
		overwrite: true,
		modelName: null,
		meshPrefix: null
	};

	// Parse arguments
	for (let i = 1; i < args.length; i++) {
		const arg = args[i];
		
		switch (arg) {
			case '-o':
			case '--output':
				outputPath = args[++i];
				break;
			case '-f':
			case '--format':
				format = args[++i].toLowerCase();
				if (format !== 'gltf' && format !== 'glb') {
					console.error('Error: Format must be "gltf" or "glb"');
					process.exit(1);
				}
				break;
			case '-n':
			case '--name':
				options.modelName = args[++i];
				break;
			case '--no-uv2':
				options.exportUV2 = false;
				break;
			case '--animations':
				options.exportAnimations = true;
				break;
			case '--no-overwrite':
				options.overwrite = false;
				break;
			case '--no-textures':
				options.exportTextures = false;
				break;
			case '--no-alpha':
				options.exportAlpha = false;
				break;
		}
	}

	// Determine output path if not specified
	if (!outputPath) {
		const ext = format === 'glb' ? '.glb' : '.gltf';
		outputPath = inputPath.replace(/\.m2$/i, ext);
		
		// If input doesn't have .m2 extension, just append
		if (outputPath === inputPath) {
			outputPath = inputPath + ext;
		}
	}

	try {
		const result = await convertM2ToGLTF(inputPath, outputPath, format, options);
		console.log('\n--- Conversion Summary ---');
		console.log(`Output: ${result.outputPath}`);
		console.log(`Format: ${result.format.toUpperCase()}`);
			console.log(`Vertices: ${result.vertexCount}`);
		console.log(`Meshes: ${result.meshCount}`);
		console.log(`Bones: ${result.boneCount}`);
		if (options.exportTextures && result.textureCount) {
			console.log(`Textures: ${result.textureCount}`);
		}
		if (options.exportAnimations) {
			console.log(`Animations: ${result.animationCount}`);
		}
		if (result.availableSkins > 1) {
			console.log(`\n💡 Tip: Model has ${result.availableSkins} skins. Use --skin-index <n> to export different skin.`);
		}
	} catch (error) {
		console.error('Error during conversion:', error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

// Run if called directly
if (require.main === module) {
	main().catch(error => {
		console.error('Fatal error:', error);
		process.exit(1);
	});
}

module.exports = { convertM2ToGLTF };

