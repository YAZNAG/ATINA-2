import { Redirect } from 'expo-router';
import { usePickerAuth } from '../context/PickerAuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { token, loading } = usePickerAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1D9E75" />
      </View>
    );
  }

  return token
    ? <Redirect href="/main/(tabs)/dashboard" />
    : <Redirect href="/auth/login" />;
}
