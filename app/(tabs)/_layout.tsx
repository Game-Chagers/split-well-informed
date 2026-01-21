import { Tabs } from 'expo-router';
import React from 'react';

// @ts-ignore
import { HapticTab } from '@/components/haptic-tab';
// @ts-ignore
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Users Test',
          tabBarIcon: ({ color } : { color: string }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: "Groups Test",
          tabBarIcon: ({ color } : { color: string }) => <IconSymbol size={28} name="person.3.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
