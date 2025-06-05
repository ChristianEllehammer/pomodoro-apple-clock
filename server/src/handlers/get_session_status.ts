
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { type SessionStatus } from '../schema';
import { eq } from 'drizzle-orm';

export const getSessionStatus = async (sessionId: number): Promise<SessionStatus> => {
  try {
    // Query the session by ID
    const sessions = await db.select()
      .from(pomodoroSessionsTable)
      .where(eq(pomodoroSessionsTable.id, sessionId))
      .execute();

    if (sessions.length === 0) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    const session = sessions[0];
    
    // Calculate time remaining in seconds
    const now = new Date();
    const periodEnd = new Date(session.current_period_end);
    const timeRemainingMs = periodEnd.getTime() - now.getTime();
    const timeRemaining = Math.max(0, Math.floor(timeRemainingMs / 1000));

    return {
      id: session.id,
      current_period_type: session.current_period_type,
      time_remaining: timeRemaining,
      is_active: session.is_active,
      is_paused: session.is_paused,
      completed_focus_periods: session.completed_focus_periods,
      focus_duration: session.focus_duration,
      rest_duration: session.rest_duration
    };
  } catch (error) {
    console.error('Get session status failed:', error);
    throw error;
  }
};
