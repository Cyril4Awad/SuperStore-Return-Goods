import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { baseHeaderScreenOptions, portableScannerStackScreenOptions } from '../variables/NavigationOptions';

import SupplierReturnScreen from './../screens/SupplierReturnScreen';

const Stack = createNativeStackNavigator();

// One screen : the app opens on the supplier return, no login and no menu
const AppNavigator = () => {

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    ...baseHeaderScreenOptions,
                    ...portableScannerStackScreenOptions,
                }}>

                <Stack.Screen
                    name='SupplierReturn'
                    component={SupplierReturnScreen}
                    options={{ title: 'SuperStore Return Goods' }} />

            </Stack.Navigator>
        </NavigationContainer>
    );

};

export default AppNavigator;
