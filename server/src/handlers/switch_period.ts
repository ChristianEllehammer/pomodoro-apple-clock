
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { type SwitchPeriodInput, type PomodoroSession } from '../schema';
import { eq } from 'drizzle-orm';

export const switchPeriod = async (input: SwitchPeriodInput): Promise<PomodoroSession> => {
  try {
    // First, get the current session
    const sessions = await db.select()
      .from(pomodoroSessionsTable)
      .where(eq(pomodoroSessionsTable.id, input.session_id))
      .execute();

    if (sessions.length === 0) {
      throw new Error(`Session with id ${input.session_id} not found`);
    }

    const session = sessions[0];

    // Can only switch periods for active sessions
    if (!session.is_active) {
      throw new Error('Cannot switch periods for inactive session');
    }

    const now = new Date();
    
    // Determine the new period type
    const newPeriodType = session.current_period_type === 'focus' ? 'rest' : 'focus';
    
    // Calculate the new period end time based on the period type
    const durationMinutes = newPeriodType === 'focus' ? session.focus_duration : session.rest_duration;
    const newPeriodEnd = new Date(now.getTime() + durationMinutes * 60 * 1000);
    
    // If switching from focus to rest, increment completed focus periods
    const newCompletedFocusPeriods = session.current_period_type === 'focus' 
      ? session.completed_focus_periods + 1 
      : session.completed_focus_periods;

    // Update the session with new period information
    const updatedSessions = await db.update(pomodoroSessionsTable)
      .set({
        current_period_type: newPeriodType,
        current_period_start: now,
        current_period_end: newPeriodEnd,
        completed_focus_periods: newCompletedFocusPeriods,
        is_paused: false, // Reset pause state when switching periods
        updated_at: now
      })
      .where(eq(pomodoroSessionsTable.id, input.session_id))
      .returning()
      .execute();

    return updatedSessions[0];
  } catch (error) {
    console.error('Period switch failed:', error);
    throw error;
  }
};
