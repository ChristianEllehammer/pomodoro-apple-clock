
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { type CreatePomodoroSessionInput, type StopSessionInput } from '../schema';
import { stopSession } from '../handlers/stop_session';
import { eq } from 'drizzle-orm';

const testCreateInput: CreatePomodoroSessionInput = {
  user_id: 'test-user-123',
  focus_duration: 25,
  rest_duration: 5
};

const createTestSession = async (isActive: boolean = true, isPaused: boolean = false) => {
  const now = new Date();
  const endTime = new Date(now.getTime() + 25 * 60 * 1000); // 25 minutes from now

  const result = await db.insert(pomodoroSessionsTable)
    .values({
      user_id: testCreateInput.user_id!,
      focus_duration: testCreateInput.focus_duration,
      rest_duration: testCreateInput.rest_duration,
      current_period_type: 'focus',
      current_period_start: now,
      current_period_end: endTime,
      is_active: isActive,
      is_paused: isPaused,
      completed_focus_periods: 0
    })
    .returning()
    .execute();

  return result[0];
};

describe('stopSession', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should stop an active session', async () => {
    const session = await createTestSession(true, false);
    const input: StopSessionInput = { session_id: session.id };

    const result = await stopSession(input);

    expect(result.id).toEqual(session.id);
    expect(result.is_active).toBe(false);
    expect(result.is_paused).toBe(false);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(session.updated_at!.getTime());
  });

  it('should stop a paused session', async () => {
    const session = await createTestSession(true, true);
    const input: StopSessionInput = { session_id: session.id };

    const result = await stopSession(input);

    expect(result.id).toEqual(session.id);
    expect(result.is_active).toBe(false);
    expect(result.is_paused).toBe(false);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update the session in the database', async () => {
    const session = await createTestSession(true, false);
    const input: StopSessionInput = { session_id: session.id };

    await stopSession(input);

    const updatedSession = await db.select()
      .from(pomodoroSessionsTable)
      .where(eq(pomodoroSessionsTable.id, session.id))
      .execute();

    expect(updatedSession).toHaveLength(1);
    expect(updatedSession[0].is_active).toBe(false);
    expect(updatedSession[0].is_paused).toBe(false);
    expect(updatedSession[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent session', async () => {
    const input: StopSessionInput = { session_id: 999 };

    await expect(stopSession(input)).rejects.toThrow(/Session with id 999 not found/i);
  });

  it('should preserve other session data when stopping', async () => {
    const session = await createTestSession(true, false);
    const input: StopSessionInput = { session_id: session.id };

    const result = await stopSession(input);

    expect(result.user_id).toEqual(session.user_id);
    expect(result.focus_duration).toEqual(session.focus_duration);
    expect(result.rest_duration).toEqual(session.rest_duration);
    expect(result.current_period_type).toEqual(session.current_period_type);
    expect(result.completed_focus_periods).toEqual(session.completed_focus_periods);
    expect(result.current_period_start).toEqual(session.current_period_start);
    expect(result.current_period_end).toEqual(session.current_period_end);
  });
});
