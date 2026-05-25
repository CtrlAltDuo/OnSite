import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import EnrolScreen from './screens/EnrolScreen';
import VerifyScreen from './screens/VerifyScreen';
import OnSiteScreen from './screens/OnSiteScreen';

type RootStackParamList = {
  OnSite: undefined;
  Enrol: undefined;
  Verify: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="OnSite"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#111111',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '700',
          },
          contentStyle: {
            backgroundColor: '#0A0A0A',
          },
        }}>
        <Stack.Screen
          name="OnSite"
          component={OnSiteScreen}
          options={{ title: 'OnSite — Verify' }}
        />
        <Stack.Screen
          name="Enrol"
          component={EnrolScreen}
          options={{ title: 'Enrol Worker' }}
        />
        <Stack.Screen
          name="Verify"
          component={VerifyScreen}
          options={{ title: 'Verify Identity' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
