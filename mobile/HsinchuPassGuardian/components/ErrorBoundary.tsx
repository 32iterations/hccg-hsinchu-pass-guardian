import React, { Component, ReactNode, ErrorInfo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    try {
      const errorData = {
        message: error?.message || 'Unknown error',
        stack: error?.stack || 'No stack trace',
        componentStack: errorInfo?.componentStack || 'No component stack',
        timestamp: new Date().toISOString(),
      };
      console.log('Error logged:', JSON.stringify(errorData));
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <Text style={styles.title}>⚠️ 發生錯誤</Text>
            <Text style={styles.subtitle}>應用程式遇到了問題</Text>

            <View style={styles.errorBox}>
              <Text style={styles.errorMessage}>
                {this.state.error?.message || '未知錯誤'}
              </Text>
            </View>

            <View style={styles.actionContainer}>
              <TouchableOpacity
                style={styles.button}
                onPress={this.resetError}
              >
                <Text style={styles.buttonText}>重試</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => {
                  Alert.alert(
                    '錯誤詳情',
                    this.state.error?.stack || '無堆疊資訊',
                    [{ text: '確定' }]
                  );
                }}
              >
                <Text style={styles.buttonText}>查看詳情</Text>
              </TouchableOpacity>
            </View>

            {__DEV__ && this.state.errorInfo && (
              <View style={styles.debugInfo}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>
                  {this.state.errorInfo.componentStack}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 30,
    width: '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  errorMessage: {
    fontSize: 14,
    color: '#d32f2f',
    textAlign: 'center',
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 15,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  secondaryButton: {
    backgroundColor: '#757575',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugInfo: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f57c00',
    marginBottom: 10,
  },
  debugText: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
  },
});

export default ErrorBoundary;