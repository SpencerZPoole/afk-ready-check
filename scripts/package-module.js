const path = require('path');
const fs = require('fs-extra');
const archiver = require('archiver');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');
const distDir = path.join(root, 'dist');
const packageDir = path.join(root, 'package');
const moduleId = 'afk-ready-check';
const version = '1.2.1';
const zipFilename = 'afk-ready-check-v1.2.1.zip';

async function clean() {
	await fs.remove(distDir);
}

async function build() {
	await clean();
	await fs.copy(srcDir, distDir, {
		filter: (source) => !source.endsWith('.ts')
	});
}

async function packageModule() {
	await build();
	const manifestPath = path.join(distDir, 'module.json');
	const manifest = await fs.readJson(manifestPath);
	if ((manifest.id ?? manifest.name) !== moduleId) throw new Error(`module.json id must be ${moduleId}.`);
	if (manifest.version !== version) throw new Error(`module.json version must be ${version}.`);

	await fs.ensureDir(packageDir);
	await fs.remove(`package/${zipFilename}`);

	await new Promise((resolve, reject) => {
		const output = fs.createWriteStream(`package/${zipFilename}`);
		const archive = archiver('zip', { zlib: { level: 9 } });

		output.on('close', resolve);
		archive.on('error', reject);
		archive.pipe(output);
		archive.directory(distDir, moduleId);
		archive.finalize();
	});

	console.log(path.join(packageDir, zipFilename));
}

const command = process.argv[2] ?? 'build';

Promise.resolve()
	.then(() => {
		if (command === 'clean') return clean();
		if (command === 'build') return build();
		if (command === 'package') return packageModule();
		throw new Error(`Unknown command: ${command}`);
	})
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
