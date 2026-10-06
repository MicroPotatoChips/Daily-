import { Easing, ReduceMotion } from 'react-native-reanimated';

/** UI-thread feedback with a consistent ease-out and system motion preferences. */
export const motion = {
  progress: {
    duration: 320,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
    reduceMotion: ReduceMotion.System,
  },
  enter: {
    duration: 240,
    easing: Easing.out(Easing.cubic),
    reduceMotion: ReduceMotion.System,
  },
  press: {
    duration: 100,
    easing: Easing.out(Easing.quad),
    reduceMotion: ReduceMotion.System,
  },
  release: {
    damping: 22,
    stiffness: 260,
    mass: 0.7,
    overshootClamping: true,
    reduceMotion: ReduceMotion.System,
  },
};
