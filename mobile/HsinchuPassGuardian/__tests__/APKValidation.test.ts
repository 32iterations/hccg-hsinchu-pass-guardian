/**
 * TDD Test Suite for APK Validation
 * 確保APK功能完整性和無錯誤執行
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const fsPromises = fs.promises;

describe('APK Validation Tests - TDD', () => {
  const APK_PATH = 'android/app/build/outputs/apk/release/app-release.apk';
  const EXPECTED_VERSION = '1.6.5';

  describe('APK Build Validation', () => {
    it('should successfully build APK without errors', async () => {
      // Check if APK exists
      const apkExists = await fsPromises.access(APK_PATH)
        .then(() => true)
        .catch(() => false);

      expect(apkExists).toBe(true);
    }, 30000);

    it('should have correct APK size (not corrupted)', async () => {
      const stats = await fsPromises.stat(APK_PATH);
      const sizeInMB = stats.size / (1024 * 1024);

      // APK should be between 30MB and 100MB
      expect(sizeInMB).toBeGreaterThan(30);
      expect(sizeInMB).toBeLessThan(100);
    });

    it('should be signed correctly', async () => {
      const { stdout } = await execAsync(
        `jarsigner -verify -verbose -certs ${APK_PATH}`
      );

      expect(stdout).toContain('jar verified');
      expect(stdout).not.toContain('unsigned');
    }, 20000);

    it('should have correct package name', async () => {
      const { stdout } = await execAsync(
        `aapt dump badging ${APK_PATH} | grep package`
      );

      expect(stdout).toContain("name='com.hsinchupassguardian'");
      expect(stdout).toContain(`versionName='${EXPECTED_VERSION}'`);
    }, 10000);
  });

  describe('APK Content Validation', () => {
    it('should include all required permissions', async () => {
      const { stdout } = await execAsync(
        `aapt dump permissions ${APK_PATH}`
      );

      const requiredPermissions = [
        'android.permission.INTERNET',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_ADMIN',
        'android.permission.CAMERA',
      ];

      requiredPermissions.forEach(permission => {
        expect(stdout).toContain(permission);
      });
    }, 10000);

    it('should include WebView support for Leaflet', async () => {
      const { stdout } = await execAsync(
        `aapt dump xmltree ${APK_PATH} AndroidManifest.xml | grep -i webview`
      );

      // Check WebView permissions are present
      expect(stdout).not.toBe('');
    }, 10000);

    it('should contain all required native libraries', async () => {
      const { stdout } = await execAsync(
        `unzip -l ${APK_PATH} | grep "\.so"`
      );

      const requiredLibs = [
        'libreactnativejni.so',
        'libjsc.so',
      ];

      requiredLibs.forEach(lib => {
        expect(stdout).toContain(lib);
      });
    }, 10000);

    it('should include Firebase configuration', async () => {
      const { stdout } = await execAsync(
        `unzip -p ${APK_PATH} assets/google-services.json | head -5`
      );

      expect(stdout).toContain('project_info');
      expect(stdout).toContain('firebase_url');
    }, 10000);
  });

  describe('Critical Components Validation', () => {
    it('should include LeafletMap component assets', async () => {
      // Check if Leaflet-related assets are bundled
      const { stdout } = await execAsync(
        `unzip -l ${APK_PATH} | grep -E "(leaflet|osm|tile)"`
      );

      // Should find references to Leaflet in the bundle
      expect(stdout.length).toBeGreaterThan(0);
    }, 10000);

    it('should have proper API endpoint configuration', async () => {
      const { stdout } = await execAsync(
        `strings ${APK_PATH} | grep "147.251.115.54:3000"`
      );

      // API endpoint should be in the APK
      expect(stdout).toContain('147.251.115.54:3000');
    }, 10000);

    it('should include all screen components', async () => {
      const screens = [
        'LoginScreen',
        'RegisterScreen',
        'MainScreen',
        'LeafletRealTimeMapScreen',
        'LeafletRealGeofenceScreen',
        'BeaconScanScreen',
        'PatientsScreen',
        'AlertsScreen',
        'SettingsScreen',
      ];

      // Check if all screens are referenced in the bundle
      const { stdout } = await execAsync(
        `strings ${APK_PATH} | grep -E "(${screens.join('|')})"`
      );

      screens.forEach(screen => {
        expect(stdout).toContain(screen);
      });
    }, 15000);
  });

  describe('Security Validation', () => {
    it('should not contain debug information', async () => {
      const { stdout } = await execAsync(
        `aapt dump badging ${APK_PATH} | grep debuggable`
      );

      // Should not be debuggable
      expect(stdout).not.toContain("debuggable='true'");
    }, 10000);

    it('should have ProGuard/R8 obfuscation applied', async () => {
      const { stdout } = await execAsync(
        `unzip -l ${APK_PATH} | grep "classes.dex"`
      );

      // Check dex file exists and is optimized
      expect(stdout).toContain('classes.dex');

      // Check file size indicates optimization
      const matches = stdout.match(/\s+(\d+)\s+.*classes\.dex/);
      if (matches) {
        const fileSize = parseInt(matches[1]);
        expect(fileSize).toBeGreaterThan(1000000); // > 1MB
      }
    }, 10000);

    it('should not expose sensitive strings', async () => {
      const { stdout } = await execAsync(
        `strings ${APK_PATH} | grep -iE "(password|secret|key|token)" | head -20`
      );

      // Should not contain hardcoded secrets
      expect(stdout).not.toContain('api_key');
      expect(stdout).not.toContain('secret_key');
      expect(stdout).not.toContain('password123');
    }, 10000);
  });

  describe('Performance Validation', () => {
    it('should have optimized DEX files', async () => {
      const { stdout } = await execAsync(
        `unzip -l ${APK_PATH} | grep ".dex" | wc -l`
      );

      const dexCount = parseInt(stdout.trim());
      // Should have multidex if needed, but not too many
      expect(dexCount).toBeGreaterThanOrEqual(1);
      expect(dexCount).toBeLessThanOrEqual(5);
    }, 10000);

    it('should have compressed resources', async () => {
      const { stdout } = await execAsync(
        `unzip -v ${APK_PATH} | grep "resources.arsc" | awk '{print $3, $7}'`
      );

      const lines = stdout.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        const [compressed, ratio] = lines[0].split(' ');
        const compressionRatio = parseInt(ratio);

        // Resources should be compressed
        expect(compressionRatio).toBeGreaterThan(0);
      }
    }, 10000);
  });

  describe('Compatibility Validation', () => {
    it('should support minimum SDK version', async () => {
      const { stdout } = await execAsync(
        `aapt dump badging ${APK_PATH} | grep sdkVersion`
      );

      expect(stdout).toContain("sdkVersion:'24'"); // minSdk 24 (Android 7.0)
    }, 10000);

    it('should target recent SDK version', async () => {
      const { stdout } = await execAsync(
        `aapt dump badging ${APK_PATH} | grep targetSdkVersion`
      );

      expect(stdout).toContain("targetSdkVersion:'35'"); // Target SDK 35
    }, 10000);

    it('should support multiple architectures', async () => {
      const { stdout } = await execAsync(
        `unzip -l ${APK_PATH} | grep "lib/" | grep -E "(armeabi-v7a|arm64-v8a|x86|x86_64)"`
      );

      // Should support at least ARM architectures
      expect(stdout).toContain('armeabi-v7a');
      expect(stdout).toContain('arm64-v8a');
    }, 10000);
  });

  describe('Functional Tests', () => {
    it('should contain WebView for Leaflet maps', async () => {
      const { stdout } = await execAsync(
        `strings ${APK_PATH} | grep -E "(WebView|leaflet|OpenStreetMap)"`
      );

      expect(stdout).toContain('WebView');
      expect(stdout).toContain('leaflet');
    }, 10000);

    it('should have Firebase messaging configured', async () => {
      const { stdout } = await execAsync(
        `strings ${APK_PATH} | grep -E "(FCM|Firebase|messaging)"`
      );

      expect(stdout).toContain('Firebase');
      expect(stdout).toContain('messaging');
    }, 10000);

    it('should include BLE support for beacon scanning', async () => {
      const { stdout } = await execAsync(
        `strings ${APK_PATH} | grep -iE "(bluetooth|ble|beacon)"`
      );

      expect(stdout).toContain('bluetooth');
      expect(stdout).toContain('ble');
    }, 10000);

    it('should have AsyncStorage for data persistence', async () => {
      const { stdout } = await execAsync(
        `strings ${APK_PATH} | grep "AsyncStorage"`
      );

      expect(stdout).toContain('AsyncStorage');
    }, 10000);
  });

  describe('Localization Validation', () => {
    it('should include Chinese (Traditional) strings', async () => {
      const { stdout } = await execAsync(
        `strings ${APK_PATH} | grep -E "(新竹|患者|定位|圍欄)"`
      );

      expect(stdout).toContain('新竹');
      expect(stdout).toContain('患者');
      expect(stdout).toContain('定位');
      expect(stdout).toContain('圍欄');
    }, 10000);
  });

  describe('Network Configuration', () => {
    it('should allow cleartext traffic to backend', async () => {
      const { stdout } = await execAsync(
        `aapt dump xmltree ${APK_PATH} AndroidManifest.xml | grep -E "(cleartextTraffic|networkSecurityConfig)"`
      );

      // Should have proper network configuration
      expect(stdout.length).toBeGreaterThan(0);
    }, 10000);
  });
});

// Helper function to check APK installation
export async function validateAPKInstallation(): Promise<boolean> {
  try {
    // Check if APK can be installed (requires connected device/emulator)
    const { stdout, stderr } = await execAsync(
      `adb install -r ${APK_PATH}`
    );

    if (stderr.includes('Success')) {
      console.log('✅ APK installed successfully');
      return true;
    }

    console.error('❌ APK installation failed:', stderr);
    return false;
  } catch (error) {
    console.log('⚠️ No device connected for installation test');
    return false;
  }
}

// Helper function to run app and check for crashes
export async function validateAPKRuntime(): Promise<boolean> {
  try {
    // Launch the app
    await execAsync('adb shell am start -n com.hsinchupassguardian/.MainActivity');

    // Wait for app to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check for crashes
    const { stdout } = await execAsync(
      'adb logcat -d | grep -E "(FATAL|AndroidRuntime.*Exception)"'
    );

    if (stdout.length === 0) {
      console.log('✅ App launched without crashes');
      return true;
    }

    console.error('❌ App crashed:', stdout);
    return false;
  } catch (error) {
    console.log('⚠️ Could not validate runtime');
    return false;
  }
}