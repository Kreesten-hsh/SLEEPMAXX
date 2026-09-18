import type { QuizQuestion } from '../types';

export const QUESTIONS: readonly [
  QuizQuestion<'sleepDurationHours'>,
  QuizQuestion<'weekendShiftHours'>,
  QuizQuestion<'hoursSinceLastCaffeineBeforeBed'>,
  QuizQuestion<'screenMinutesInBed'>,
  QuizQuestion<'morningLightFrequency'>
] = [
  {
    id: 'duration',
    stepNumber: 1,
    answerKey: 'sleepDurationHours',
    title: 'How many hours of sleep do you average per night?',
    description: 'Average nocturnal sleep duration on standard weeknights.',
    options: [
      {
        id: 'dur_under_5',
        label: '< 5 hours',
        normalizedValue: 4.5,
      },
      {
        id: 'dur_5_to_6',
        label: '5 – 5.9 hours',
        normalizedValue: 5.5,
      },
      {
        id: 'dur_6_to_7',
        label: '6 – 6.9 hours',
        normalizedValue: 6.5,
      },
      {
        id: 'dur_7_to_9',
        label: '7 – 8.9 hours',
        sublabel: 'Highest score bracket',
        normalizedValue: 8.0,
      },
      {
        id: 'dur_9_to_10',
        label: '9 – 9.9 hours',
        normalizedValue: 9.5,
      },
      {
        id: 'dur_10_plus',
        label: '10+ hours',
        normalizedValue: 10.5,
      },
    ],
  },
  {
    id: 'consistency',
    stepNumber: 2,
    answerKey: 'weekendShiftHours',
    title: 'How much does your bedtime shift on weekends?',
    description: 'Difference between weekday bedtime and weekend bedtime.',
    options: [
      {
        id: 'shift_0',
        label: 'No shift (Same bedtime)',
        sublabel: 'Highest consistency',
        normalizedValue: 0.0,
      },
      {
        id: 'shift_under_1',
        label: 'Under 1 hour',
        normalizedValue: 0.5,
      },
      {
        id: 'shift_1_to_2',
        label: '1 – 1.9 hours',
        normalizedValue: 1.5,
      },
      {
        id: 'shift_2_to_3',
        label: '2 – 2.9 hours',
        normalizedValue: 2.5,
      },
      {
        id: 'shift_3_plus',
        label: '3+ hours',
        normalizedValue: 3.5,
      },
    ],
  },
  {
    id: 'caffeine',
    stepNumber: 3,
    answerKey: 'hoursSinceLastCaffeineBeforeBed',
    title: 'How many hours before bed is your last caffeine intake?',
    description: 'Coffee, energy drinks, pre-workout, matcha, or soda.',
    options: [
      {
        id: 'caffeine_none',
        label: "I don't drink caffeine",
        sublabel: 'No caffeine selected',
        normalizedValue: null,
      },
      {
        id: 'caffeine_8_plus',
        label: '8+ hours before bed',
        sublabel: 'Longest pre-bed buffer',
        normalizedValue: 9.0,
      },
      {
        id: 'caffeine_6_to_8',
        label: '6 – 7.9 hours',
        normalizedValue: 7.0,
      },
      {
        id: 'caffeine_4_to_6',
        label: '4 – 5.9 hours',
        normalizedValue: 5.0,
      },
      {
        id: 'caffeine_2_to_4',
        label: '2 – 3.9 hours',
        normalizedValue: 3.0,
      },
      {
        id: 'caffeine_under_2',
        label: '< 2 hours before bed',
        normalizedValue: 1.0,
      },
    ],
  },
  {
    id: 'screen',
    stepNumber: 4,
    answerKey: 'screenMinutesInBed',
    title: 'How long are you on your phone in bed before trying to sleep?',
    description: 'Scrolling, texting, watching videos, or gaming in bed.',
    options: [
      {
        id: 'screen_0',
        label: '0 minutes (No screens in bed)',
        sublabel: 'Zero screen habit',
        normalizedValue: 0,
      },
      {
        id: 'screen_1_to_14',
        label: '1 – 14 minutes',
        normalizedValue: 10,
      },
      {
        id: 'screen_15_to_29',
        label: '15 – 29 minutes',
        normalizedValue: 20,
      },
      {
        id: 'screen_30_to_59',
        label: '30 – 59 minutes',
        normalizedValue: 45,
      },
      {
        id: 'screen_60_plus',
        label: '60+ minutes',
        normalizedValue: 75,
      },
    ],
  },
  {
    id: 'morning_light',
    stepNumber: 5,
    answerKey: 'morningLightFrequency',
    title: 'Do you get outdoor natural sunlight within an hour of waking?',
    description: 'Direct outdoor daylight exposure shortly after getting up.',
    options: [
      {
        id: 'light_almost_always',
        label: 'Almost Always',
        sublabel: 'Daily morning light habit',
        normalizedValue: 'almost_always',
      },
      {
        id: 'light_often',
        label: 'Often',
        normalizedValue: 'often',
      },
      {
        id: 'light_rarely',
        label: 'Rarely',
        normalizedValue: 'rarely',
      },
      {
        id: 'light_never',
        label: 'Never',
        normalizedValue: 'never',
      },
    ],
  },
] as const;

export const TOTAL_QUESTIONS = QUESTIONS.length;
