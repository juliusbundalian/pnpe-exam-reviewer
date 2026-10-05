import { Alert } from 'react-native';
import { HomeScreen } from '../features/home/presentation/HomeScreen';

function unavailable(destination: string) {
  Alert.alert(
    `${destination} — development availability`,
    'This destination is not available in this foundation build yet.',
  );
}
export default function HomeRoute() {
  return (
    <HomeScreen
      onExplore={() => unavailable('Reviewer coverage')}
      onMockExam={() => unavailable('Mock Exam')}
      onProgress={() => unavailable('Progress')}
      onBookmarks={() => unavailable('Saved Questions')}
    />
  );
}
