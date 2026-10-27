import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import AppNavigator from './src/navigator/AppNavigator';
import MessageBox, { MessageBoxHost } from './src/components/MessageBox';
import { ProgressBoxHost } from './src/components/ProgressBox';

// alert('...') shows the message box of the app instead of the Android alert
global.alert = (message) => MessageBox.alert('Message', message);

// An unexpected error of the app is shown in the message box instead of closing the app
ErrorUtils.setGlobalHandler((error) => {
  MessageBox.alert('Unexpected Error', `${error?.message ?? error}\n\nIf it happens again, close the app and open it again.`);
});

const App = () => {

  return (

    <SafeAreaView style={styles.container}>

      <AppNavigator />

      <MessageBoxHost />
      <ProgressBoxHost />

    </SafeAreaView>

  );

};

const styles = StyleSheet.create({
  container: {
    height: '100%'
  },
});

export default App;
