const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const buildDir = path.join(projectRoot, 'build');
const srcZipFilename = 'lambda-src.zip';
const nodeModulesZipFilename = 'lambda-node-modules.zip';
const srcZipPath = path.join(buildDir, srcZipFilename);
const nodeModulesZipPath = path.join(buildDir, nodeModulesZipFilename);
const metadataPath = path.join(buildDir, 'layer-metadata.json');
const lastRunPath = path.join(buildDir, 'last-run.json');

async function getLastRunInfo() {
  try {
    const data = await fs.readFile(lastRunPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function saveLastRunInfo(info) {
  await fs.writeFile(lastRunPath, JSON.stringify(info), 'utf8');
}

async function hasPackageLockChanged() {
  const packageLockPath = path.join(projectRoot, 'package-lock.json');
  const lastRun = await getLastRunInfo();
  if (!lastRun) {
    return true;
  }
  const stats = await fs.stat(packageLockPath);
  return stats.mtime.getTime() > lastRun.lastRun;
}

async function ensureDirectories() {
  await fs.ensureDir(buildDir);
  const tempDir = path.join(buildDir, 'temp');
  await fs.ensureDir(tempDir);
  return tempDir;
}

async function copyPackageFiles(tempDir) {
  await fs.copy(path.join(projectRoot, 'package.json'), path.join(tempDir, 'package.json'));
  const lockFile = path.join(projectRoot, 'package-lock.json');
  if (await fs.pathExists(lockFile)) {
    await fs.copy(lockFile, path.join(tempDir, 'package-lock.json'));
  }
}

async function installDependencies(tempDir) {
  try {
    await execAsync('npm ci --omit=dev', { cwd: tempDir });
  } catch (error) {
    throw new Error(`Failed to install dependencies: ${error.message}`);
  }
}

function createArchive(outputPath) {
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(output);
  return archive;
}

async function addFilesToArchive(archive, sourceDir, targetDir = '') {
  archive.directory(sourceDir, targetDir);
  await archive.finalize();
}

async function calculateSHA256Base64(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('error', reject);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      const binaryDigest = hash.digest();
      const base64Digest = binaryDigest.toString('base64');
      resolve(base64Digest);
    });
  });
}

async function saveMetadata(metadata, filePath) {
  const flattenedMetadata = {
    src_path: metadata.src?.path,
    src_hash: metadata.src?.sha256,
    node_modules_path: metadata.nodeModules?.path,
    node_modules_hash: metadata.nodeModules?.sha256,
  };
  const jsonString = JSON.stringify(flattenedMetadata, null, 2);
  await fs.writeFile(filePath, jsonString, 'utf8');
  console.log(`Metadata saved to ${filePath}`);
}

async function buildLayer() {
  let tempDir;
  let metadata = {};

  try {
    tempDir = await ensureDirectories();

    // Always create src zip
    console.log('Creating src zip...');
    const srcArchive = createArchive(srcZipPath);
    await addFilesToArchive(srcArchive, srcDir);
    const srcSha256 = await calculateSHA256Base64(srcZipPath);
    metadata.src = {
      path: srcZipPath,
      sha256: srcSha256,
    };
    console.log('Src zip created successfully.');

    // Check if node_modules need to be rebuilt
    if (await hasPackageLockChanged()) {
      console.log('package-lock.json has changed. Rebuilding node_modules...');
      await copyPackageFiles(tempDir);
      await installDependencies(tempDir);

      // Create node_modules zip
      console.log('Creating node_modules zip...');
      const nodeModulesArchive = createArchive(nodeModulesZipPath);
      await addFilesToArchive(nodeModulesArchive, tempDir, 'nodejs');
      console.log('Node modules zip created successfully.');
    } else {
      console.log('package-lock.json has not changed. Skipping node_modules rebuild.');
      const nodeModulesSha256 = await calculateSHA256Base64(nodeModulesZipPath);
      metadata.nodeModules = {
        path: nodeModulesZipPath,
        sha256: nodeModulesSha256,
      };
    }

    await saveMetadata(metadata, metadataPath);
    await saveLastRunInfo({
      lastRun: Date.now(),
    });
    console.log('Build process completed successfully.');
  } catch (error) {
    console.error('Error during build process:', error);
    process.exit(1);
  } finally {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  }
}

buildLayer();

module.exports = {
  buildLayer,
  ensureDirectories,
  copyPackageFiles,
  installDependencies,
  createArchive,
  addFilesToArchive,
  calculateSHA256Base64,
  saveMetadata,
  hasPackageLockChanged,
  getLastRunInfo,
  saveLastRunInfo,
};
