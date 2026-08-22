import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requireAndroidEnv } from './android-env.mjs';

const { javaHome, sdkDir } = requireAndroidEnv();
const result = spawnSync('./gradlew', ['assembleDebug'], {
  cwd: fileURLToPath(new URL('../android', import.meta.url)),
  stdio: 'inherit',
  env: {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: sdkDir,
    ANDROID_SDK_ROOT: sdkDir,
  },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
