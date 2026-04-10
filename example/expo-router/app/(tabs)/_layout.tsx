import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ label }: { label: string }): React.ReactElement {
  return <Text>{label}</Text>;
}

export default function TabLayout(): React.ReactElement {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarTestID: 'tab-home',
          tabBarIcon: () => <TabIcon label="H" />,
        }}
      />
      <Tabs.Screen
        name="demos"
        options={{
          title: 'Demos',
          tabBarTestID: 'tab-demos',
          tabBarIcon: () => <TabIcon label="D" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarTestID: 'tab-settings',
          tabBarIcon: () => <TabIcon label="S" />,
        }}
      />
    </Tabs>
  );
}
