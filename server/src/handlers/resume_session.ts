
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { type PauseResumeSessionInput, type PomodoroSession } from '../schema';
import { eq } from 'drizzle-orm';

export const resumeSession = async (input: PauseResumeSessionInput): Promise<PomodoroSession> => {
  try {
    // First, get the current session to check if it exists and is paused
    const existingSessions = await db.select()
      .from(pomodoroSessionsTable)
      .where(eq(pomodoroSessionsTable.id, input.session_id))
      .execute();

    if (existingSessions.length === 0) {
      throw new Error('Session not found');
    }

    const session = existingSessions[0];

    if (!session.is_paused) {
      throw new Error('Session is not paused');
    }

    if (!session.is_active) {
      throw new Error('Session is not active');
    }

    // Calculate how much time has passed since the session was paused
    const now = new Date();
    const pausedAt = session.updated_at;
    const timePaused = now.getTime() - pausedAt.getTime(); // in milliseconds

    // Calculate new end time by adding the paused time
    const newEndTime = new Date(session.current_period_end.getTime() + timePaused);

    // Update the session to resume it
    const result = await db.update(pomodoroSessionsTable)
      .set({
        is_paused: false,
        current_period_end: newEndTime,
        updated_at: now
      })
      .where(eq(pomodoroSessionsTable.id, input.session_id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Session resume failed:', error);
    throw error;
  }
};
