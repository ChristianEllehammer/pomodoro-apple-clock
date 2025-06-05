
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { type StartSessionInput } from '../schema';
import { startSession } from '../handlers/start_session';
import { eq } from 'drizzle-orm';

describe('startSession', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test session directly in the database
  const createTestSession = async (focusDuration = 25, restDuration = 5, userId: string | null = 'test-user') => {
    const now = new Date();
    const result = await db.insert(pomodoroSessionsTable)
      .values({
        user_id: userId,
        focus_duration: focusDuration,
        rest_duration: restDuration,
        current_period_type: 'focus',
        current_period_start: now,
        current_period_end: new Date(now.getTime() + focusDuration * 60 * 1000),
        is_active: false,
        is_paused: false,
        completed_focus_periods: 0
      })
      .returning()
      .execute();

    return result[0];
  };

  it('should start a session successfully', async () => {
    // Create a test session
    const createdSession = await createTestSession(25, 5, 'test-user');

    const startInput: StartSessionInput = {
      session_id: createdSession.id
    };

    const result = await startSession(startInput);

    // Verify session properties
    expect(result.id).toEqual(createdSession.id);
    expect(result.is_active).toBe(true);
    expect(result.is_paused).toBe(false);
    expect(result.current_period_type).toEqual('focus');
    expect(result.current_period_start).toBeInstanceOf(Date);
    expect(result.current_period_end).toBeInstanceOf(Date);
    expect(result.focus_duration).toEqual(25);
    expect(result.rest_duration).toEqual(5);
    expect(result.completed_focus_periods).toEqual(0);

    // Verify the focus period duration is correct (25 minutes)
    const expectedDuration = 25 * 60 * 1000; // 25 minutes in milliseconds
    const actualDuration = result.current_period_end.getTime() - result.current_period_start.getTime();
    expect(Math.abs(actualDuration - expectedDuration)).toBeLessThan(1000); // Allow 1 second tolerance
  });

  it('should update session in database', async () => {
    // Create a test session
    const createdSession = await createTestSession(30, 10, null);

    const startInput: StartSessionInput = {
      session_id: createdSession.id
    };

    await startSession(startInput);

    // Query database to verify changes
    const sessions = await db.select()
      .from(pomodoroSessionsTable)
      .where(eq(pomodoroSessionsTable.id, createdSession.id))
      .execute();

    expect(sessions).toHaveLength(1);
    const dbSession = sessions[0];
    expect(dbSession.is_active).toBe(true);
    expect(dbSession.is_paused).toBe(false);
    expect(dbSession.current_period_type).toEqual('focus');
    expect(dbSession.current_period_start).toBeInstanceOf(Date);
    expect(dbSession.current_period_end).toBeInstanceOf(Date);
    expect(dbSession.updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent session', async () => {
    const startInput: StartSessionInput = {
      session_id: 99999
    };

    await expect(startSession(startInput)).rejects.toThrow(/session not found/i);
  });

  it('should handle starting session with default durations', async () => {
    // Create session with default durations
    const createdSession = await createTestSession(25, 5, null);

    const startInput: StartSessionInput = {
      session_id: createdSession.id
    };

    const result = await startSession(startInput);

    // Verify default durations are used
    expect(result.focus_duration).toEqual(25); // default focus duration
    expect(result.rest_duration).toEqual(5); // default rest duration

    // Verify focus period timing with default duration
    const expectedDuration = 25 * 60 * 1000; // 25 minutes in milliseconds
    const actualDuration = result.current_period_end.getTime() - result.current_period_start.getTime();
    expect(Math.abs(actualDuration - expectedDuration)).toBeLessThan(1000);
  });

  it('should reset pause state when starting', async () => {
    // Create a paused session
    const now = new Date();
    const result = await db.insert(pomodoroSessionsTable)
      .values({
        user_id: 'test-user',
        focus_duration: 25,
        rest_duration: 5,
        current_period_type: 'focus',
        current_period_start: now,
        current_period_end: new Date(now.getTime() + 25 * 60 * 1000),
        is_active: false,
        is_paused: true, // Start as paused
        completed_focus_periods: 2
      })
      .returning()
      .execute();

    const createdSession = result[0];

    const startInput: StartSessionInput = {
      session_id: createdSession.id
    };

    const startedSession = await startSession(startInput);

    // Verify pause state is reset
    expect(startedSession.is_active).toBe(true);
    expect(startedSession.is_paused).toBe(false);
    expect(startedSession.current_period_type).toEqual('focus');
    expect(startedSession.completed_focus_periods).toEqual(2); // Should preserve existing count
  });
});
