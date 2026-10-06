import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getLocalDateKey } from '@/utils/date';

export function useLocalDay() {
  const [day, setDay] = useState(getLocalDateKey);
  useEffect(() => {
    const update = () => setDay(getLocalDateKey());
    const interval = setInterval(update, 30_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);
  return day;
}
