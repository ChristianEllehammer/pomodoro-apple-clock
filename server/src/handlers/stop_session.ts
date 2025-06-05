
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { type StopSessionInput, type PomodoroSession } from '../schema';
import { eq } from 'drizzle-orm';

export const stopSession = async (input: StopSessionInput): Promise<PomodoroSession> => {
  try {
    // Update the session to mark it as inactive and not paused
    const result = await db.update(pomodoroSessionsTable)
      .set({
        is_active: false,
        is_paused: false,
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
    console.error('Session stop failed:', error);
    throw error;
  }
};
