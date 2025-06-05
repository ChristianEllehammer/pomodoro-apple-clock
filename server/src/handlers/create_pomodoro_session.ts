
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { type CreatePomodoroSessionInput, type PomodoroSession } from '../schema';

export const createPomodoroSession = async (input: CreatePomodoroSessionInput): Promise<PomodoroSession> => {
  try {
    // Calculate initial period times
    const now = new Date();
    const periodEnd = new Date(now.getTime() + input.focus_duration * 60 * 1000); // Convert minutes to milliseconds

    // Insert pomodoro session record
    const result = await db.insert(pomodoroSessionsTable)
      .values({
        user_id: input.user_id || null,
        focus_duration: input.focus_duration,
        rest_duration: input.rest_duration,
        current_period_type: 'focus', // Always start with focus period
        current_period_start: now,
        current_period_end: periodEnd,
        is_active: false, // Session is created but not started
        is_paused: false,
        completed_focus_periods: 0
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Pomodoro session creation failed:', error);
    throw error;
  }
};
