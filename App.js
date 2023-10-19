import React from 'react';
import {Button, SafeAreaView, StyleSheet, Text, View} from 'react-native';
import AppController from './AppController';
import {HealthMonitor, SessionState} from 'binah-react-native-sdk';

export class App extends AppController {
  constructor(props) {
    super(props);
  }
  render() {
    const {hasPermission, isInitialized, sessionState, vitals} = this.state;
    return (
      <SafeAreaView style={styles.container}>
        <HealthMonitor
          style={styles.monitor}
          faceRectStroke={3}
          faceRectColor="#FF4455"
          hideFaceRect={false}
        />
        {hasPermission && isInitialized && (
          <View
            style={{
              margin: 16,
              flexDirection: 'row',
              alignItems: 'center',
              width: '100%',
              justifyContent: 'space-evenly',
            }}>
            <Button
              title="Start Scan"
              onPress={() => {
                this.startScan();
              }}
              disabled={sessionState !== SessionState.ACTIVE}
            />
            <Text>{vitals?.heartRate?.value ?? '-'} bpm</Text>
            <Button
              title="Stop Scan"
              onPress={() => {
                this.stopMeasurement();
              }}
              disabled={sessionState !== SessionState.MEASURING}
            />
          </View>
        )}
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  monitor: {
    flex: 1,
  },
});

export default App;
