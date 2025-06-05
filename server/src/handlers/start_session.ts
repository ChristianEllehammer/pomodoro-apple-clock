
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { type StartSessionInput, type PomodoroSession } from '../schema';
import { eq } from 'drizzle-orm';

export const startSession = async (input: StartSessionInput): Promise<PomodoroSession> => {
  try {
    // Get the current session to verify it exists
    const existingSessions = await db.select()
      .from(pomodoroSessionsTable)
      .where(eq(pomodoroSessionsTable.id, input.session_id))
      .execute();

    if (existingSessions.length === 0) {
      throw new Error('Session not found');
    }

    const session = existingSessions[0];

    // Calculate start and end times for the focus period
    const now = new Date();
    const focusEndTime = new Date(now.getTime() + session.focus_duration * 60 * 1000);

    // Update the session to start it
    const result = await db.update(pomodoroSessionsTable)
      .set({
        is_active: true,
        is_paused: false,
        current_period_type: 'focus',
        current_period_start: now,
        current_period_end: focusEndTime,
        updated_at: now
      })
      .where(eq(pomodoroSessionsTable.id, input.session_id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Session start failed:', error);
    throw error;
  }
};
