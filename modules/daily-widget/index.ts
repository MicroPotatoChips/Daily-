import { requireOptionalNativeModule } from 'expo-modules-core';

export interface DailyWidgetNativeModule {
  getDatabaseDirectory(): Promise<string | null>;
  setSnapshot(snapshot: string, databaseDirectory: string): Promise<void>;
}

export default requireOptionalNativeModule<DailyWidgetNativeModule>('DailyWidget');
