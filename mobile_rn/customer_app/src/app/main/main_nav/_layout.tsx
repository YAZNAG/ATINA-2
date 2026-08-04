import { Tabs } from 'expo-router';
import BottomNavBar from '../../../components/ui/BottomNavBar';

export default function WithNavbarLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNavBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'shift',
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="categories" />
      <Tabs.Screen name="favorites" />
      <Tabs.Screen name="category-products" options={{ href: null }} />
      <Tabs.Screen name="product-list" options={{ href: null }} />
    </Tabs>
  );
}