import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from './DashboardScreen/DashboardScreen';
import { AddMetricScreen } from './AddMetricScreen/AddMetricScreen';

export type RootStackParamList = {
  Dashboard: undefined;
  AddMetric: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="Dashboard"
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="AddMetric" component={AddMetricScreen} />
    </Stack.Navigator>
  );
}
