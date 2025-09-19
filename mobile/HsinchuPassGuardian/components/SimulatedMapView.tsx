import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  Image,
  PanResponder,
  Animated,
  TouchableOpacity,
  Alert,
} from 'react-native';

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface SimulatedMapViewProps {
  region: Region;
  onRegionChange?: (region: Region) => void;
  onRegionChangeComplete?: (region: Region) => void;
  onMapReady?: () => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  followsUserLocation?: boolean;
  userLocationPriority?: string;
  userLocationUpdateInterval?: number;
  zoomEnabled?: boolean;
  scrollEnabled?: boolean;
  children?: React.ReactNode;
  style?: any;
  onPress?: (event: any) => void;
  onPanDrag?: (event: any) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 新竹市重要地標
const HSINCHU_LANDMARKS = [
  { name: '新竹火車站', lat: 24.8019, lng: 120.9718, icon: '🚉' },
  { name: '東門市場', lat: 24.8050, lng: 120.9733, icon: '🏪' },
  { name: '城隍廟', lat: 24.8047, lng: 120.9686, icon: '🏛️' },
  { name: '巨城購物中心', lat: 24.8130, lng: 120.9750, icon: '🛍️' },
  { name: '新竹馬偕醫院', lat: 24.8070, lng: 120.9828, icon: '🏥' },
  { name: '新竹國泰醫院', lat: 24.8003, lng: 120.9696, icon: '🏥' },
  { name: '護城河親水公園', lat: 24.8066, lng: 120.9686, icon: '🌳' },
  { name: '新竹科學園區', lat: 24.7950, lng: 121.0030, icon: '🏢' },
  { name: '新竹市政府', lat: 24.8074, lng: 120.9686, icon: '🏛️' },
  { name: '清大夜市', lat: 24.7970, lng: 120.9920, icon: '🍜' },
];

const SimulatedMapView: React.FC<SimulatedMapViewProps> = ({
  region,
  onRegionChange,
  onRegionChangeComplete,
  onMapReady,
  showsUserLocation,
  showsMyLocationButton,
  followsUserLocation,
  userLocationPriority,
  userLocationUpdateInterval,
  zoomEnabled = true,
  scrollEnabled = true,
  children,
  style,
  onPress,
  onPanDrag,
}) => {
  const [currentRegion, setCurrentRegion] = useState(region);
  const [mapScale, setMapScale] = useState(1);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (onMapReady) {
      setTimeout(onMapReady, 100);
    }
  }, []);

  useEffect(() => {
    setCurrentRegion(region);
  }, [region]);

  // 模擬用戶位置更新
  useEffect(() => {
    if (showsUserLocation) {
      const interval = setInterval(() => {
        // 模擬在新竹市區移動
        const lat = 24.8019 + (Math.random() - 0.5) * 0.02;
        const lng = 120.9718 + (Math.random() - 0.5) * 0.02;
        setUserLocation({ lat, lng });
      }, userLocationUpdateInterval || 5000);

      return () => clearInterval(interval);
    }
  }, [showsUserLocation, userLocationUpdateInterval]);

  // 處理手勢
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => scrollEnabled,
      onMoveShouldSetPanResponder: () => scrollEnabled,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value,
        });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        if (onPanDrag) {
          onPanDrag({ nativeEvent: {} });
        }
      },
    })
  ).current;

  const handleZoomIn = () => {
    if (!zoomEnabled) return;
    const newScale = Math.min(mapScale * 1.5, 5);
    setMapScale(newScale);
    Animated.timing(scale, {
      toValue: newScale,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleZoomOut = () => {
    if (!zoomEnabled) return;
    const newScale = Math.max(mapScale * 0.7, 0.5);
    setMapScale(newScale);
    Animated.timing(scale, {
      toValue: newScale,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleMyLocation = () => {
    Alert.alert('定位', '已移動至您的位置\n新竹火車站附近');
    pan.setValue({ x: 0, y: 0 });
  };

  const latLngToPixel = (lat: number, lng: number) => {
    const centerLat = currentRegion.latitude;
    const centerLng = currentRegion.longitude;
    const pixelsPerDegree = SCREEN_WIDTH / currentRegion.longitudeDelta;

    const x = SCREEN_WIDTH / 2 + (lng - centerLng) * pixelsPerDegree;
    const y = SCREEN_HEIGHT / 2 - (lat - centerLat) * pixelsPerDegree;

    return { x, y };
  };

  return (
    <View style={[styles.container, style]}>
      {/* 地圖背景 */}
      <View style={styles.mapBackground}>
        <Animated.View
          style={[
            styles.mapContent,
            {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { scale: scale },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* 網格背景 */}
          <View style={styles.grid}>
            {Array.from({ length: 20 }).map((_, i) => (
              <View key={`h-${i}`} style={[styles.gridLine, styles.horizontalLine, { top: i * 50 }]} />
            ))}
            {Array.from({ length: 20 }).map((_, i) => (
              <View key={`v-${i}`} style={[styles.gridLine, styles.verticalLine, { left: i * 50 }]} />
            ))}
          </View>

          {/* 街道名稱 */}
          <View style={styles.streetsContainer}>
            <Text style={[styles.streetLabel, { top: 100, left: 200 }]}>中正路</Text>
            <Text style={[styles.streetLabel, { top: 150, left: 100 }]}>東門街</Text>
            <Text style={[styles.streetLabel, { top: 200, left: 250 }]}>光復路</Text>
            <Text style={[styles.streetLabel, { top: 250, left: 150 }]}>民生路</Text>
            <Text style={[styles.streetLabel, { top: 300, left: 200 }]}>中央路</Text>
          </View>

          {/* 地標標記 */}
          {HSINCHU_LANDMARKS.map((landmark, index) => {
            const position = latLngToPixel(landmark.lat, landmark.lng);
            return (
              <TouchableOpacity
                key={index}
                style={[styles.landmark, { left: position.x - 15, top: position.y - 15 }]}
                onPress={() => Alert.alert(landmark.name, `緯度: ${landmark.lat}\n經度: ${landmark.lng}`)}
              >
                <Text style={styles.landmarkIcon}>{landmark.icon}</Text>
                <Text style={styles.landmarkName}>{landmark.name}</Text>
              </TouchableOpacity>
            );
          })}

          {/* 用戶位置 */}
          {showsUserLocation && userLocation && (
            <View
              style={[
                styles.userLocation,
                {
                  left: latLngToPixel(userLocation.lat, userLocation.lng).x - 10,
                  top: latLngToPixel(userLocation.lat, userLocation.lng).y - 10,
                },
              ]}
            >
              <View style={styles.userLocationDot} />
              <View style={styles.userLocationPulse} />
            </View>
          )}

          {/* 子元素（標記等） */}
          {children}
        </Animated.View>
      </View>

      {/* 縮放控制 */}
      {zoomEnabled && (
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
            <Text style={styles.zoomButtonText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
            <Text style={styles.zoomButtonText}>−</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 我的位置按鈕 */}
      {showsMyLocationButton && (
        <TouchableOpacity style={styles.myLocationButton} onPress={handleMyLocation}>
          <Text style={styles.myLocationIcon}>📍</Text>
        </TouchableOpacity>
      )}

      {/* 地圖標題 */}
      <View style={styles.mapTitle}>
        <Text style={styles.mapTitleText}>🗺️ 新竹市地圖（模擬）</Text>
        <Text style={styles.mapSubtitle}>Google Maps 離線模式</Text>
      </View>

      {/* 比例尺 */}
      <View style={styles.scaleBar}>
        <View style={styles.scaleLine} />
        <Text style={styles.scaleText}>500公尺</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F4F8',
  },
  mapBackground: {
    flex: 1,
    overflow: 'hidden',
  },
  mapContent: {
    width: SCREEN_WIDTH * 3,
    height: SCREEN_HEIGHT * 3,
    position: 'absolute',
    left: -SCREEN_WIDTH,
    top: -SCREEN_HEIGHT,
  },
  grid: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#D0D0D0',
    opacity: 0.3,
  },
  horizontalLine: {
    width: '100%',
    height: 1,
  },
  verticalLine: {
    height: '100%',
    width: 1,
  },
  streetsContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  streetLabel: {
    position: 'absolute',
    fontSize: 12,
    color: '#666',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 2,
    borderRadius: 3,
  },
  landmark: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
  },
  landmarkIcon: {
    fontSize: 24,
  },
  landmarkName: {
    fontSize: 10,
    color: '#333',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 2,
  },
  userLocation: {
    position: 'absolute',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  userLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4285F4',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  userLocationPulse: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(66, 133, 244, 0.3)',
  },
  zoomControls: {
    position: 'absolute',
    right: 15,
    bottom: 100,
    backgroundColor: '#FFF',
    borderRadius: 5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  zoomButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  zoomButtonText: {
    fontSize: 24,
    color: '#333',
  },
  myLocationButton: {
    position: 'absolute',
    right: 15,
    bottom: 160,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  myLocationIcon: {
    fontSize: 24,
  },
  mapTitle: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 10,
    borderRadius: 8,
    elevation: 3,
  },
  mapTitleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  mapSubtitle: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  scaleBar: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scaleLine: {
    width: 50,
    height: 2,
    backgroundColor: '#333',
  },
  scaleText: {
    marginLeft: 5,
    fontSize: 10,
    color: '#333',
  },
});

export default SimulatedMapView;