import { existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const home = homedir();

const javaCandidates = [
  `${home}/.local/jdk-21`,
  `${home}/.local/jdk-21/Contents/Home`,
  '/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home',
  '/Library/Java/JavaVirtualMachines/zulu-21.jdk/Contents/Home',
  '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
  `${home}/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home`,
];

const sdkCandidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  `${home}/Library/Android/sdk`,
  `${home}/Android/Sdk`,
  '/opt/homebrew/share/android-commandlinetools',
].filter(Boolean);

export function resolveJavaHome() {
  if (process.env.JAVA_HOME && isJava21(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }

  try {
    const fromTool = execFileSync('/usr/libexec/java_home', ['-v', '21'], {
      encoding: 'utf8',
    }).trim();
    if (fromTool && existsSync(join(fromTool, 'bin/java'))) return fromTool;
  } catch {
    // Fall through to known install paths.
  }

  return javaCandidates.find(path => existsSync(join(path, 'bin/java')));
}

export function resolveAndroidSdk() {
  return sdkCandidates.find(path => existsSync(path));
}

function isJava21(javaHome) {
  const result = spawnSync(join(javaHome, 'bin/java'), ['-version'], { encoding: 'utf8' });
  const message = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return /version "21[.\s]/.test(message);
}

export function writeLocalProperties(sdkDir) {
  const file = join(process.cwd(), 'android/local.properties');
  writeFileSync(file, `sdk.dir=${sdkDir.replaceAll('\\', '/')}\n`);
}

export function requireAndroidEnv() {
  const javaHome = resolveJavaHome();
  if (!javaHome) {
    throw new Error(
      'Android builds need JDK 21. This machine has JDK 26, which Gradle 8.14 cannot run (class file major version 70).\nInstall Temurin 21: brew install --cask temurin@21',
    );
  }

  const sdkDir = resolveAndroidSdk();
  if (!sdkDir) {
    throw new Error(
      'Android SDK not found. Install Android Studio or: brew install --cask android-commandlinetools',
    );
  }

  writeLocalProperties(sdkDir);
  return { javaHome, sdkDir };
}
