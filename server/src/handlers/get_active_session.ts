
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { type PomodoroSession } from '../schema';
import { eq, and, isNull } from 'drizzle-orm';

export const getActiveSession = async (userId?: string | null): Promise<PomodoroSession | null> => {
  try {
    // Build query conditions
    const conditions = [eq(pomodoroSessionsTable.is_active, true)];
    
    // Handle user filtering - either match specific user_id or null for anonymous
    if (userId !== undefined) {
      if (userId === null) {
        conditions.push(isNull(pomodoroSessionsTable.user_id));
      } else {
        conditions.push(eq(pomodoroSessionsTable.user_id, userId));
      }
    }

    // Execute query with conditions
    const result = await db.select()
      .from(pomodoroSessionsTable)
      .where(and(...conditions))
      .limit(1)
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to get active session:', error);
    throw error;
  }
};
