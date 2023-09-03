#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const common = require('./common.js');
require('shelljs/global');

const generateVersionsH = require('./generate-versions-h-util.js');
const readPackageJson = require('./read-package-json.js');

config.fatal = true;
config.verbose = true;

const gitInfo = common.getGitInfo();
const package = readPackageJson();

generateVersionsH({ packageJson: package, gitInfo, useRealData: false });

const version = package.firmwareVersion;
const releaseName = `uhk-firmware-${version}`;
const releaseDir = `${__dirname}/${releaseName}`;
const agentDir = `${__dirname}/../lib/agent`;
var releaseFile = `${__dirname}/${releaseName}.tar.gz`;
var mkArgs = '';

if (gitInfo.tag !== `v${version}` && !process.argv.includes('--allowSha')) {
    console.error(`Git tag '${gitInfo.tag}' !~ 'v{version}'. Please run with '--allowSha' if this is intentional.`);
    process.exit(1);
}

if (gitInfo.tag !== `v${version}`) {
    releaseFile = `${__dirname}/${releaseName}-${gitInfo.tag}.tar.gz`;
}

const deviceSourceFirmwares = package.devices.map(device => `${__dirname}/../${device.source}`);
const moduleSourceFirmwares = package.modules.map(module => `${__dirname}/../${module.source}`);
rm('-rf', releaseDir, releaseFile, deviceSourceFirmwares, moduleSourceFirmwares);

const sourcePaths = [
    ...package.devices.map(device => device.source),
    ...package.modules.map(module => module.source),
];
for (const sourcePath of sourcePaths) {
    const buildDir = path.dirname(`${__dirname}/../${sourcePath}`);
    mkdir('-p', buildDir);
    exec(`cd ${buildDir}/..; make clean; make -j8 ${mkArgs}`);
}

const { devices, modules } = generateVersionsH({ packageJson: package, gitInfo, useRealData: true });
package.devices = devices;
package.modules = modules;

for (const sourcePath of sourcePaths) {
    const buildDir = path.dirname(`${__dirname}/../${sourcePath}`);
    exec(`cd ${buildDir}/..; make -j8 ${mkArgs}`);
}


exec(`npm ci; npm run build`, { cwd: agentDir });

for (const device of package.devices) {
    const deviceDir = `${releaseDir}/devices/${device.name}`;
    const deviceSource = `${__dirname}/../${device.source}`;
    const deviceMMap = `${__dirname}/../${device.mmap}`;
    mkdir('-p', deviceDir);
    chmod(644, deviceSource);
    cp(deviceSource, `${deviceDir}/firmware.hex`);
    cp(deviceMMap, `${deviceDir}/firmware.map`);
    exec(`npm run convert-user-config-to-bin -- ${deviceDir}/config.bin`, { cwd: agentDir });
}

for (const module of package.modules) {
    const moduleDir = `${releaseDir}/modules`;
    const moduleSource = `${__dirname}/../${module.source}`;
    const moduleMMap = `${__dirname}/../${module.mmap}`;
    mkdir('-p', moduleDir);
    chmod(644, moduleSource);
    cp(moduleSource, `${moduleDir}/${module.name}.bin`);
    cp(moduleMMap, `${moduleDir}/${module.name}.map`);
}

const updatedPackage = Object.assign({}, package, { gitInfo: gitInfo });
fs.writeFileSync(`${releaseDir}/package.json`, JSON.stringify(updatedPackage, null, 2));

cp('-RL', `${__dirname}/../doc/dist`, `${releaseDir}/doc`);
exec(`tar -czvf ${releaseFile} -C ${releaseDir} .`);
