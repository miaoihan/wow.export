#!/usr/bin/env node
// Minimal script to export a local .m2 file to glTF/GLB using the repo exporter.
// Place this in the repo root and run: node scripts/export-m2-glb.js --input path/to/file.m2 --out out/model.glb
// NOTE: This is a pragmatic shim. The real app provides many globals; this script implements
// a minimal subset required for M2 -> glTF export. You may need to adapt paths depending on your environment.

const fs = require('fs');
const path = require('path');

// Simple arg parsing
const argv = require('minimist')(process.argv.slice(2));
if (!argv.input || !argv.out) {
	console.error('Usage: node scripts/export-m2-glb.js --input path/to/file.m2 --out out/model.glb');
	process.exit(2);
}
const inputPath = path.resolve(argv.input);
const outPath = path.resolve(argv.out);
const outDir = path.dirname(outPath);

// Ensure running from repo root where src/ exists
const repoSrc = path.join(__dirname, '..', 'src', 'js');

// Require project modules
const BufferWrapper = require(path.join(repoSrc, '..', 'buffer')); // ../../buffer in repo modules
const M2Exporter = require(path.join(repoSrc, '3D', 'exporters', 'M2Exporter'));
const ExportHelper = require(path.join(repoSrc, 'casc', 'export-helper'));

// Minimal stubs / shims for core/view/casc/listfile used by exporters.
// This is intentionally minimal; some exports may need more fields.
global.core = {};
core.view = {};
core.view.config = {
	overwriteFiles: true,
	modelsExportTextures: true,
	modelsExportAlpha: true,
	modelsExportUV2: false,
	modelsExportAnimations: true,
	exportM2Meta: true,
	modelsExportBones: false,
	enableSharedChildren: false,
	removePathSpaces: false,
	pathFormat: 'posix'
};
core.view.isBusy = 0;
core.view.exportCancelled = false;

// Simple logger used by export modules
core.log = {
	write: (...args) => console.log('[LOG]', ...args)
};

// Minimal listfile: map fileDataID -> filename (not used here, but exporters reference it)
global.listfile = {
	getByID: (id) => undefined,
	formatUnknownFile: (id, ext = '') => `${id}${ext}`,
	getByIDOrUnknown: (id, ext) => listfile.getByID(id) ?? listfile.formatUnknownFile(id, ext),
	stripFileEntry: (s) => s
};

// Implement a minimal casc that can return files by fileDataID or a BufferWrapper from local file.
// For M2 export we only need to provide the M2 file as a BufferWrapper when constructing M2Exporter.
core.view.casc = {
	// If code calls getFile(fileDataID), this will try to read from a path mapped by fileDataID (not used here).
	getFile: async (id) => {
		throw new Error('getFile by id not implemented in this shim');
	},
	// Helper to return a BufferWrapper for an already-read Buffer
	fromBuffer: (buf) => BufferWrapper.fromBuffer(buf)
};

// A trivial export helper used by exporters to report progress. It provides isCancelled() and simple logging.
class SimpleHelper extends ExportHelper {
	constructor(count = 1, unit = 'item') {
		super(count, unit);
	}
	// override methods if necessary
}
const helper = new SimpleHelper(1, 'm2');

// Read M2 file and wrap in BufferWrapper
(async () => {
	try {
		if (!fs.existsSync(inputPath)) {
			console.error('Input file not found:', inputPath);
			process.exit(1);
		}
		await fs.promises.mkdir(outDir, { recursive: true });

		// Read raw file into BufferWrapper compatible object used by repo (BufferWrapper.fromBuffer)
		const dataBuf = await fs.promises.readFile(inputPath);
		const bufWrapper = BufferWrapper.fromBuffer ? BufferWrapper.fromBuffer(dataBuf) : BufferWrapper.from(dataBuf);

		// Construct exporter. M2Exporter constructor signature: (data, variantTextures, fileDataID)
		// We pass `undefined` for variantTextures and 0 as fileDataID (not strictly necessary for basic export).
		const exporter = new M2Exporter(bufWrapper, undefined, 0);

		// Export to GLB (binary glTF). The repo method is exportAsGLTF(out, helper, format)
		// format = 'glb' or 'gltf'
		console.log('Starting export, this may take a while...');
		await exporter.exportAsGLTF(outPath, helper, 'glb');

		console.log('Export finished:', outPath);
	} catch (err) {
		console.error('Export failed:', err);
		process.exit(1);
	}
})();