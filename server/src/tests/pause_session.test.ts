
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { type PauseResumeSessionInput } from '../schema';
import { pauseSession } from '../handlers/pause_session';
import { eq } from 'drizzle-orm';

// Helper to create a test session
const createTestSession = async () => {
  const result = await db.insert(pomodoroSessionsTable)
    .values({
      user_id: 'test-user',
      focus_duration: 25,
      rest_duration: 5,
      current_period_type: 'focus',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 25 * 60 * 1000), // 25 minutes from now
      is_active: true,
      is_paused: false,
      completed_focus_periods: 0
    })
    .returning()
    .execute();
  
  return result[0];
};

describe('pauseSession', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should pause an active session', async () => {
    const session = await createTestSession();
    const input: PauseResumeSessionInput = {
      session_id: session.id
    };

    const result = await pauseSession(input);

    expect(result.id).toEqual(session.id);
    expect(result.is_paused).toBe(true);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(session.updated_at!.getTime());
  });

  it('should update session in database', async () => {
    const session = await createTestSession();
    const input: PauseResumeSessionInput = {
      session_id: session.id
    };

    await pauseSession(input);

    const updatedSession = await db.select()
      .from(pomodoroSessionsTable)
      .where(eq(pomodoroSessionsTable.id, session.id))
      .execute();

    expect(updatedSession).toHaveLength(1);
    expect(updatedSession[0].is_paused).toBe(true);
    expect(updatedSession[0].updated_at).toBeInstanceOf(Date);
  });

  it('should pause an already paused session', async () => {
    const session = await createTestSession();
    
    // First pause
    await pauseSession({ session_id: session.id });
    
    // Second pause - should still work
    const result = await pauseSession({ session_id: session.id });

    expect(result.is_paused).toBe(true);
    expect(result.id).toEqual(session.id);
  });

  it('should throw error for non-existent session', async () => {
    const input: PauseResumeSessionInput = {
      session_id: 99999
    };

    expect(pauseSession(input)).rejects.toThrow(/not found/i);
  });

  it('should preserve other session fields when pausing', async () => {
    const session = await createTestSession();
    const input: PauseResumeSessionInput = {
      session_id: session.id
    };

    const result = await pauseSession(input);

    expect(result.user_id).toEqual(session.user_id);
    expect(result.focus_duration).toEqual(session.focus_duration);
    expect(result.rest_duration).toEqual(session.rest_duration);
    expect(result.current_period_type).toEqual(session.current_period_type);
    expect(result.is_active).toEqual(session.is_active);
    expect(result.completed_focus_periods).toEqual(session.completed_focus_periods);
  });
});
