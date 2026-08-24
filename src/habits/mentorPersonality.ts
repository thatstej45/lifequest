import type { MentorPersonality } from '../types';

/** Map legacy persisted values to the current mentor tone union. */
export const normalizeMentorPersonality = (
  value?: string | null,
): MentorPersonality => {
  if (value === 'Sarcastic') return 'Snarky';
  if (value === 'Supportive' || value === 'Snarky' || value === 'Stoic') return value;
  return 'Snarky';
};

export const MENTOR_PERSONALITIES: MentorPersonality[] = ['Supportive', 'Snarky', 'Stoic'];
