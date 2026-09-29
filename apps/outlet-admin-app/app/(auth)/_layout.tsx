import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#090d16',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        contentStyle: {
          backgroundColor: '#090d16',
        },
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: 'Outlet Admin Login',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
