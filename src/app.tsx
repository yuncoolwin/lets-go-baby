import { PropsWithChildren } from 'react';
import { useDidShow } from '@tarojs/taro';
import { LucideTaroProvider } from 'lucide-react-taro';
import '@/app.css';
import { Toaster } from '@/components/ui/toast';
import { useAppStore } from '@/store/app';
import { refreshUnreadBadge } from '@/utils/unread-badge';
import { Preset } from './presets';

const App = ({ children }: PropsWithChildren) => {
  const currentRole = useAppStore((s) => s.currentRole);

  useDidShow(() => {
    if (currentRole?.id) refreshUnreadBadge(currentRole.id);
  });

  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      <Preset>{children}</Preset>
      <Toaster />
    </LucideTaroProvider>
  );
};

export default App;