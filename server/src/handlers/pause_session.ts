
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { type PauseResumeSessionInput, type PomodoroSession } from '../schema';
import { eq } from 'drizzle-orm';

export const pauseSession = async (input: PauseResumeSessionInput): Promise<PomodoroSession> => {
  try {
    // Update the session to set is_paused to true and updated_at to current time
    const result = await db.update(pomodoroSessionsTable)
      .set({
        is_paused: true,
        updated_at: new Date()
      })
      .where(eq(pomodoroSessionsTable.id, input.session_id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Session with id ${input.session_id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Session pause failed:', error);
    throw error;
  }
};
