import { BleManager, Device, Subscription, State } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import ApiService from './api';

interface BeaconData {
  id: string;
  name: string;
  rssi: number;
  distance: number;
  timestamp: number;
  manufacturerData?: string;
}

class BLEService {
  private manager: BleManager;
  private scanSubscription: Subscription | null = null;
  private stateSubscription: Subscription | null = null;
  private discoveredDevices: Map<string, BeaconData> = new Map();
  private isScanning: boolean = false;
  private onDeviceDiscovered: ((device: BeaconData) => void) | null = null;
  private onStateChanged: ((state: State) => void) | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  // Initialize BLE and request permissions
  async initialize(): Promise<boolean> {
    try {
      // Request permissions for Android
      if (Platform.OS === 'android') {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ];

        // For Android 12+ (API level 31+)
        if (Platform.Version >= 31) {
          const granted = await PermissionsAndroid.requestMultiple(permissions);

          if (
            granted['android.permission.BLUETOOTH_SCAN'] !== PermissionsAndroid.RESULTS.GRANTED ||
            granted['android.permission.BLUETOOTH_CONNECT'] !== PermissionsAndroid.RESULTS.GRANTED ||
            granted['android.permission.ACCESS_FINE_LOCATION'] !== PermissionsAndroid.RESULTS.GRANTED
          ) {
            console.log('BLE permissions not granted');
            return false;
          }
        } else {
          // For older Android versions
          const locationPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );

          if (locationPermission !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('Location permission not granted');
            return false;
          }
        }
      }

      // Subscribe to BLE state changes
      this.stateSubscription = this.manager.onStateChange((state) => {
        console.log('BLE State changed to:', state);
        if (this.onStateChanged) {
          this.onStateChanged(state);
        }
      }, true);

      // Check if BLE is powered on
      const state = await this.manager.state();
      return state === State.PoweredOn;
    } catch (error) {
      console.error('BLE initialization error:', error);
      return false;
    }
  }

  // Start scanning for BLE devices
  async startScan(
    onDeviceFound?: (device: BeaconData) => void,
    scanDuration: number = 0,
    targetDeviceNames: string[] = ['HSC-GUARD', 'HsinchuGuard', 'Beacon']
  ): Promise<void> {
    if (this.isScanning) {
      console.log('Already scanning');
      return;
    }

    this.onDeviceDiscovered = onDeviceFound || null;
    this.discoveredDevices.clear();
    this.isScanning = true;

    try {
      // Scan with options for better beacon detection
      this.scanSubscription = this.manager.startDeviceScan(
        null, // Scan for all services
        {
          allowDuplicates: true, // Important for RSSI updates
          scanMode: 2, // SCAN_MODE_LOW_LATENCY for Android
          callbackType: 1, // CALLBACK_TYPE_ALL_MATCHES for Android
        },
        (error, device) => {
          if (error) {
            console.error('Scan error:', error);
            this.stopScan();
            return;
          }

          if (device) {
            this.processDiscoveredDevice(device, targetDeviceNames);
          }
        }
      );

      // Auto-stop scan after duration if specified
      if (scanDuration > 0) {
        setTimeout(() => {
          this.stopScan();
        }, scanDuration);
      }
    } catch (error) {
      console.error('Start scan error:', error);
      this.isScanning = false;
    }
  }

  // Process discovered BLE device
  private processDiscoveredDevice(device: Device, targetNames: string[]) {
    // Check if device name matches target patterns
    const deviceName = device.name || device.localName || '';
    const isTargetDevice = targetNames.some(target =>
      deviceName.toLowerCase().includes(target.toLowerCase())
    );

    // Also check for iBeacon format in manufacturer data
    const isBeacon = this.isIBeacon(device);

    if (isTargetDevice || isBeacon) {
      const distance = this.calculateDistance(device.rssi || -100);

      const beaconData: BeaconData = {
        id: device.id,
        name: deviceName || `Beacon_${device.id.substr(-4)}`,
        rssi: device.rssi || -100,
        distance: distance,
        timestamp: Date.now(),
        manufacturerData: device.manufacturerData,
      };

      // Update or add device to discovered list
      this.discoveredDevices.set(device.id, beaconData);

      // Notify callback
      if (this.onDeviceDiscovered) {
        this.onDeviceDiscovered(beaconData);
      }

      // Send location update to backend if close enough
      if (distance < 10) { // Within 10 meters
        this.reportBeaconDetection(beaconData);
      }
    }
  }

  // Check if device is an iBeacon
  private isIBeacon(device: Device): boolean {
    if (!device.manufacturerData) return false;

    // iBeacon typically has manufacturer data starting with Apple's company ID (0x004C)
    // and iBeacon prefix (0x0215)
    const data = device.manufacturerData;
    return data.includes('4C00') || data.includes('0215');
  }

  // Calculate approximate distance from RSSI
  private calculateDistance(rssi: number): number {
    // Using path-loss formula: Distance = 10^((Measured Power - RSSI) / (10 * N))
    // Measured Power (1m RSSI) = -59 (typical for beacons)
    // N = path loss exponent (2 for free space, 2.7 to 4.3 for indoors)
    const measuredPower = -59;
    const pathLossExponent = 2.5; // Average for indoor/outdoor

    const distance = Math.pow(10, (measuredPower - rssi) / (10 * pathLossExponent));
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  // Stop scanning
  stopScan() {
    if (this.scanSubscription) {
      this.scanSubscription.remove();
      this.scanSubscription = null;
    }
    this.manager.stopDeviceScan();
    this.isScanning = false;
    console.log('BLE scan stopped');
  }

  // Get all discovered devices
  getDiscoveredDevices(): BeaconData[] {
    return Array.from(this.discoveredDevices.values());
  }

  // Connect to a specific device
  async connectToDevice(deviceId: string): Promise<Device | null> {
    try {
      const device = await this.manager.connectToDevice(deviceId);
      await device.discoverAllServicesAndCharacteristics();
      console.log('Connected to device:', device.name || deviceId);
      return device;
    } catch (error) {
      console.error('Connection error:', error);
      return null;
    }
  }

  // Disconnect from a device
  async disconnectDevice(deviceId: string): Promise<void> {
    try {
      await this.manager.cancelDeviceConnection(deviceId);
      console.log('Disconnected from device:', deviceId);
    } catch (error) {
      console.error('Disconnection error:', error);
    }
  }

  // Report beacon detection to backend
  private async reportBeaconDetection(beacon: BeaconData) {
    try {
      // Get current location (you might want to use actual GPS coordinates)
      const location = {
        latitude: 24.8066, // Default to Hsinchu City Hall
        longitude: 120.9686,
      };

      // Send to backend
      await ApiService.updateLocation(
        beacon.id,
        location.latitude,
        location.longitude,
        'beacon'
      );

      console.log('Beacon detection reported:', beacon.name);
    } catch (error) {
      console.error('Failed to report beacon detection:', error);
    }
  }

  // Set callback for state changes
  onStateChange(callback: (state: State) => void) {
    this.onStateChanged = callback;
  }

  // Get current BLE state
  async getState(): Promise<State> {
    return await this.manager.state();
  }

  // Check if scanning is active
  isScanningActive(): boolean {
    return this.isScanning;
  }

  // Cleanup resources
  destroy() {
    this.stopScan();
    if (this.stateSubscription) {
      this.stateSubscription.remove();
      this.stateSubscription = null;
    }
    this.manager.destroy();
  }

  // Configure beacon parameters (for custom beacons)
  configureBeaconSettings(settings: {
    measuredPower?: number;
    pathLossExponent?: number;
    scanInterval?: number;
  }) {
    // Store settings for future use
    // This would be implemented based on specific beacon requirements
    console.log('Beacon settings configured:', settings);
  }

  // Filter devices by signal strength
  getDevicesInRange(maxDistance: number): BeaconData[] {
    return this.getDiscoveredDevices().filter(device => device.distance <= maxDistance);
  }

  // Get strongest signal device
  getClosestDevice(): BeaconData | null {
    const devices = this.getDiscoveredDevices();
    if (devices.length === 0) return null;

    return devices.reduce((closest, current) =>
      current.rssi > closest.rssi ? current : closest
    );
  }

  // Monitor a specific device
  async monitorDevice(
    deviceId: string,
    onUpdate: (device: BeaconData) => void,
    intervalMs: number = 1000
  ): Promise<() => void> {
    const intervalId = setInterval(() => {
      const device = this.discoveredDevices.get(deviceId);
      if (device) {
        onUpdate(device);
      }
    }, intervalMs);

    // Return cleanup function
    return () => clearInterval(intervalId);
  }
}

export default new BLEService();