
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { type PauseResumeSessionInput, type CreatePomodoroSessionInput } from '../schema';
import { resumeSession } from '../handlers/resume_session';
import { eq } from 'drizzle-orm';

// Helper to create a test session
const createTestSession = async () => {
  const sessionInput = {
    user_id: 'test-user-123',
    focus_duration: 25,
    rest_duration: 5,
    current_period_type: 'focus' as const,
    current_period_start: new Date(),
    current_period_end: new Date(Date.now() + 25 * 60 * 1000), // 25 minutes from now
    is_active: true,
    is_paused: true, // Create in paused state
    completed_focus_periods: 0
  };

  const result = await db.insert(pomodoroSessionsTable)
    .values(sessionInput)
    .returning()
    .execute();

  return result[0];
};

describe('resumeSession', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should resume a paused session', async () => {
    const session = await createTestSession();
    const originalEndTime = session.current_period_end;

    // Wait a small amount to simulate pause time
    await new Promise(resolve => setTimeout(resolve, 10));

    const input: PauseResumeSessionInput = {
      session_id: session.id
    };

    const result = await resumeSession(input);

    // Should no longer be paused
    expect(result.is_paused).toBe(false);
    expect(result.is_active).toBe(true);
    
    // End time should be extended due to pause time
    expect(result.current_period_end.getTime()).toBeGreaterThan(originalEndTime.getTime());
    
    // Other properties should remain the same
    expect(result.id).toEqual(session.id);
    expect(result.current_period_type).toEqual(session.current_period_type);
    expect(result.completed_focus_periods).toEqual(session.completed_focus_periods);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update session in database', async () => {
    const session = await createTestSession();

    const input: PauseResumeSessionInput = {
      session_id: session.id
    };

    await resumeSession(input);

    // Verify database was updated
    const updatedSessions = await db.select()
      .from(pomodoroSessionsTable)
      .where(eq(pomodoroSessionsTable.id, session.id))
      .execute();

    expect(updatedSessions).toHaveLength(1);
    expect(updatedSessions[0].is_paused).toBe(false);
    expect(updatedSessions[0].is_active).toBe(true);
  });

  it('should throw error if session does not exist', async () => {
    const input: PauseResumeSessionInput = {
      session_id: 999999 // Non-existent session
    };

    await expect(resumeSession(input)).rejects.toThrow(/session not found/i);
  });

  it('should throw error if session is not paused', async () => {
    // Create session that is not paused
    const sessionInput = {
      user_id: 'test-user-123',
      focus_duration: 25,
      rest_duration: 5,
      current_period_type: 'focus' as const,
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 25 * 60 * 1000),
      is_active: true,
      is_paused: false, // Not paused
      completed_focus_periods: 0
    };

    const result = await db.insert(pomodoroSessionsTable)
      .values(sessionInput)
      .returning()
      .execute();

    const input: PauseResumeSessionInput = {
      session_id: result[0].id
    };

    await expect(resumeSession(input)).rejects.toThrow(/session is not paused/i);
  });

  it('should throw error if session is not active', async () => {
    // Create session that is paused but not active
    const sessionInput = {
      user_id: 'test-user-123',
      focus_duration: 25,
      rest_duration: 5,
      current_period_type: 'focus' as const,
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 25 * 60 * 1000),
      is_active: false, // Not active
      is_paused: true,
      completed_focus_periods: 0
    };

    const result = await db.insert(pomodoroSessionsTable)
      .values(sessionInput)
      .returning()
      .execute();

    const input: PauseResumeSessionInput = {
      session_id: result[0].id
    };

    await expect(resumeSession(input)).rejects.toThrow(/session is not active/i);
  });

  it('should extend end time based on pause duration', async () => {
    const session = await createTestSession();
    const originalEndTime = session.current_period_end;
    
    // Wait a measurable amount of time
    await new Promise(resolve => setTimeout(resolve, 100));

    const input: PauseResumeSessionInput = {
      session_id: session.id
    };

    const result = await resumeSession(input);

    // The new end time should be at least 100ms later than original
    const timeDifference = result.current_period_end.getTime() - originalEndTime.getTime();
    expect(timeDifference).toBeGreaterThanOrEqual(90); // Allow some tolerance
  });
});
