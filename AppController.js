import React, {Component} from 'react';
import {Alert, AppState, Platform} from 'react-native';
import KeepAwake from 'react-native-keep-awake';
import {PERMISSIONS, RESULTS, request} from 'react-native-permissions';
import {
  SessionState,
  healthMonitorManager,
  SessionTypes,
  Gender,
} from 'binah-react-native-sdk';

const BinahAILicenseKey = '07C1C7-BDA3DB-4BDF94-371667-FC5E07-DA80AB';

export class AppController extends Component {
  manager;
  session;
  managerOnError;
  vitalSignsListener;
  vitalSignsResultsListener;
  stateChangeListener;
  sessionError;
  sessionWarning;
  backHandlerListener;
  timer;
  vitals;

  constructor(props) {
    super(props);
    this.state = {
      isInitialized: false,
      healthManagerActive: false,
      isStopped: false,
      hasPermission: false,
      sessionState: SessionState.TERMINATED,
      vitals: {},
    };

    this.manager = React.createRef();
    this.session = React.createRef();
    this.managerOnError = React.createRef();
    this.vitalSignsListener = React.createRef();
    this.vitalSignsResultsListener = React.createRef();
    this.stateChangeListener = React.createRef();
    this.sessionError = React.createRef();
    this.sessionWarning = React.createRef();
    this.backHandlerListener = React.createRef();

    this.appStateListeners = this.appStateListeners.bind(this);
  }

  async componentDidMount() {
    this.setState({
      isInitialized: false,
      healthManagerActive: false,
      isStopped: false,
      hasPermission: false,
    });
    this.removeBinahListener();
    KeepAwake.activate();
    await this.getPermission();
    AppState.addEventListener('change', this.appStateListeners);
  }

  removeBinahListener() {
    if (this.managerOnError.current) this.managerOnError.current.remove();
    if (this.vitalSignsListener.current)
      this.vitalSignsListener.current.remove();
    if (this.vitalSignsResultsListener.current)
      this.vitalSignsResultsListener.current.remove();
    if (this.stateChangeListener.current)
      this.stateChangeListener.current.remove();
    if (this.sessionError.current) this.sessionError.current.remove();
    if (this.sessionWarning.current) this.sessionWarning.current.remove();
  }

  resetStats() {
    this.setState({
      healthManagerActive: false,
      isInitialized: false,
      binahResultResponse: {},
      vitals: {},
      vitalsResult: {
        results: {},
        type: [],
      },
      showCamera: false,
      sessionState: SessionState.TERMINATED,
    });
  }

  async terminateSession(options = {resetReport: true}) {
    if (this.session.current) {
      await this.session.current.terminate();
      this.session.current = null;
      if (options.resetReport) {
        this.resetStats();
      }
    }
  }

  async appStateListeners(event) {
    if (event !== 'active') {
      await this.terminateSession();
    } else if (!this.state.isInitialized || this.state.healthManagerActive) {
      const scanType = this.props.navigation.getParam('scanType');
      if (scanType) await this.createNewSession(scanType);
      else await this.createNewSession(SessionTypes.FACE);
    }
  }

  async getPermission() {
    try {
      let result;
      if (Platform.OS === 'ios') {
        result = await request(PERMISSIONS.IOS.CAMERA, {
          title: 'Camera Permission',
          message: 'Please allow access to your camera',
          buttonPositive: 'Allow',
          buttonNegative: 'Cancel',
        });
      } else {
        result = await request(PERMISSIONS.ANDROID.CAMERA, {
          title: 'Camera Permission',
          message: 'Please allow access to your camera',
          buttonPositive: 'Allow',
          buttonNegative: 'Cancel',
        });
      }
      switch (result) {
        case RESULTS.DENIED:
          await this.getPermission();
          break;
        case RESULTS.GRANTED:
          this.setState({
            hasPermission: true,
          });
          await this.startBinah();
          break;
        case RESULTS.BLOCKED:
          Alert.alert('Warning', 'Camera Permission is reqired', [
            {
              text: 'Cancel',
              onPress: () => this.goBack(),
            },
            {
              text: 'Open Settings',
              onPress: () => {
                this.getPermission();
              },
            },
          ]);
          break;
      }
    } catch (_error) {
      Alert.alert('Error');
    }
  }

  async startBinah() {
    try {
      if (this.session.current) {
        await this.terminateSession();
      }
      this.manager.current = await healthMonitorManager.init(BinahAILicenseKey);
      this.managerOnError.current = this.manager.current.onError(code => {
        console.log('Manager error:', code);
      });
      await this.manager.current.getActivationId();
      await this.createNewSession(SessionTypes.FACE);
    } catch (error) {
      this.resetStats();
      console.log('Error', error);
    }
  }

  async createNewSession(scanType) {
    if (this.state.sessionState === SessionState.MEASURING) {
      await this.stopMeasurement();
    }
    if (
      this.state.sessionState === SessionState.ACTIVE ||
      this.state.sessionState === SessionState.MEASURING
    ) {
      await this.terminateSession();
    }
    try {
      this.setState({
        isInitialized: false,
        healthManagerActive: true,
      });
      if (this.manager.current && this.state.healthManagerActive) {
        this.session.current = await this.manager.current.createSession(
          scanType,
          {
            processingTime: 60,
            detectionAlwaysOn: false,
            subjectDemographic: {age: 24, weight: 75, gender: Gender.MALE},
          },
        );
        this.setState({
          isInitialized: true,
        });
        this.sessionError.current = this.session.current.onErrorAlert(error => {
          console.log('Session error: ' + error);
        });

        this.vitalSignsListener.current = this.session.current.onVitalSign(
          vitalSigns => {
            console.log('VitalSigns', vitalSigns);
            this.vitals = {...this.vitals, ...vitalSigns};
            this.setState({
              vitals: this.vitals,
            });
          },
        );

        this.stateChangeListener.current = this.session.current.onStateChange(
          state => {
            this.setState({
              sessionState: state,
            });
          },
        );

        this.vitalSignsResultsListener.current = this.session.current.onFinalResults(
          vitals => {
            console.log('Final Results', vitals);
          },
        );
      } else throw new Error('No manager available');
    } catch (error) {
      throw error;
    }
  }

  async stopMeasurement() {
    try {
      if (!this.session.current) {
        throw new Error('Session is not initiallized, please create a session');
      }
      await this.session.current.stop();
    } catch (error) {
      console.log('Error stopping', error);
    }
  }

  async startScan() {
    try {
      if (!this.session.current) {
        throw new Error('Session is not initiallized, please create a session');
      }
      await this.session.current.start();
    } catch (error) {
      console.log('Start Error', error);
      this.resetStats();
    }
  }

  async componentWillUnmount() {
    await this.terminateSession();
    this.removeBinahListener();
    KeepAwake.deactivate();
    AppState.removeEventListener('change', this.appStateListeners);
  }
}

export default AppController;
