import { useRouter } from 'expo-router';
import { useAppDependencies, useAppNavigation, useConfig } from '../../bootstrap/AppProviders';
import { MenuScreen } from '../../features/menu/presentation/MenuScreen';
export default function MenuRoute() {
  const { coordinator } = useAppDependencies();
  const navigation = useAppNavigation();
  const router = useRouter();
  const { features } = useConfig('config');
  return (
    <MenuScreen
      coordinator={coordinator}
      historyEnabled={features.examHistory}
      progressEnabled={features.progress}
      onOpen={(destination, target) => {
        if (destination === 'progress') navigation.require({ type: 'openProgress' }, target);
        else if (destination === 'profile') navigation.require({ type: 'openProfile' }, target);
        else if (destination === 'bookmarks') navigation.require({ type: 'openBookmarks' }, target);
        else if (destination === 'exam-history')
          navigation.require({ type: 'openHistory' }, target);
        else router.push(`/${destination}`);
      }}
    />
  );
}
