#!/usr/bin/env bun
/*!
	M2 to glTF Converter - Usage Example
	This example demonstrates how to use the m2-to-gltf converter programmatically
 */

const { convertM2ToGLTF } = require('./m2-to-gltf');

async function runExamples() {
	console.log('=== M2 to glTF Converter Examples ===\n');

	// Example 1: Basic conversion
	console.log('Example 1: Basic conversion to glTF');
	console.log('Command: bun scripts/m2-to-gltf.js input.m2\n');

	// Example 2: Convert to GLB format
	console.log('Example 2: Convert to GLB (binary glTF)');
	console.log('Command: bun scripts/m2-to-gltf.js input.m2 -f glb\n');

	// Example 3: Specify output path
	console.log('Example 3: Specify custom output path');
	console.log('Command: bun scripts/m2-to-gltf.js input.m2 -o output/model.gltf\n');

	// Example 4: Include animations
	console.log('Example 4: Export with animations');
	console.log('Command: bun scripts/m2-to-gltf.js input.m2 --animations\n');

	// Example 5: Programmatic usage
	console.log('Example 5: Use in your own script:\n');
	console.log(`
const { convertM2ToGLTF } = require('./scripts/m2-to-gltf');

async function convertModel() {
	try {
		const result = await convertM2ToGLTF(
			'path/to/model.m2',      // Input path
			'output/model.gltf',     // Output path
			'gltf',                  // Format: 'gltf' or 'glb'
			{
				exportUV2: true,         // Export second UV channel
				exportAnimations: false, // Export animations
				overwrite: true,         // Overwrite existing files
				modelName: 'MyModel',    // Custom model name
				bonePrefix: false        // Add bone prefix nodes
			}
		);

		console.log('Conversion completed:', result);
	} catch (error) {
		console.error('Conversion failed:', error);
	}
}

convertModel();
	`);

	// Batch conversion example
	console.log('Example 6: Batch convert multiple files:\n');
	console.log(`
const { convertM2ToGLTF } = require('./scripts/m2-to-gltf');
const fs = require('fs');
const path = require('path');

async function batchConvert(inputDir, outputDir) {
	const files = fs.readdirSync(inputDir)
		.filter(file => file.endsWith('.m2'));

	for (const file of files) {
		const inputPath = path.join(inputDir, file);
		const outputPath = path.join(outputDir, file.replace('.m2', '.glb'));
		
		console.log(\`Converting: \${file}\`);
		try {
			await convertM2ToGLTF(inputPath, outputPath, 'glb');
		} catch (error) {
			console.error(\`Failed to convert \${file}:\`, error.message);
		}
	}
}

batchConvert('./m2files', './output');
	`);
}

// Run examples
runExamples().catch(console.error);

