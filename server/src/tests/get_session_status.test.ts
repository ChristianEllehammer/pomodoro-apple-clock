
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { getSessionStatus } from '../handlers/get_session_status';

describe('getSessionStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get session status for active session', async () => {
    // Create a test session
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now

    const [session] = await db.insert(pomodoroSessionsTable)
      .values({
        user_id: 'test-user-123',
        focus_duration: 25,
        rest_duration: 5,
        current_period_type: 'focus',
        current_period_start: now,
        current_period_end: periodEnd,
        is_active: true,
        is_paused: false,
        completed_focus_periods: 2
      })
      .returning()
      .execute();

    const result = await getSessionStatus(session.id);

    // Basic field validation
    expect(result.id).toEqual(session.id);
    expect(result.current_period_type).toEqual('focus');
    expect(result.is_active).toEqual(true);
    expect(result.is_paused).toEqual(false);
    expect(result.completed_focus_periods).toEqual(2);
    expect(result.focus_duration).toEqual(25);
    expect(result.rest_duration).toEqual(5);
    
    // Time remaining should be positive and reasonable (around 10 minutes = 600 seconds)
    expect(result.time_remaining).toBeGreaterThan(500);
    expect(result.time_remaining).toBeLessThanOrEqual(600);
  });

  it('should get session status for paused session', async () => {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now

    const [session] = await db.insert(pomodoroSessionsTable)
      .values({
        user_id: null, // Anonymous session
        focus_duration: 30,
        rest_duration: 10,
        current_period_type: 'rest',
        current_period_start: now,
        current_period_end: periodEnd,
        is_active: true,
        is_paused: true,
        completed_focus_periods: 1
      })
      .returning()
      .execute();

    const result = await getSessionStatus(session.id);

    expect(result.id).toEqual(session.id);
    expect(result.current_period_type).toEqual('rest');
    expect(result.is_active).toEqual(true);
    expect(result.is_paused).toEqual(true);
    expect(result.completed_focus_periods).toEqual(1);
    expect(result.focus_duration).toEqual(30);
    expect(result.rest_duration).toEqual(10);
    expect(result.time_remaining).toBeGreaterThan(800); // Around 15 minutes
  });

  it('should return zero time remaining for expired session', async () => {
    const now = new Date();
    const periodEnd = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago

    const [session] = await db.insert(pomodoroSessionsTable)
      .values({
        user_id: 'expired-user',
        focus_duration: 25,
        rest_duration: 5,
        current_period_type: 'focus',
        current_period_start: new Date(now.getTime() - 30 * 60 * 1000),
        current_period_end: periodEnd,
        is_active: false,
        is_paused: false,
        completed_focus_periods: 0
      })
      .returning()
      .execute();

    const result = await getSessionStatus(session.id);

    expect(result.id).toEqual(session.id);
    expect(result.time_remaining).toEqual(0);
    expect(result.is_active).toEqual(false);
  });

  it('should throw error for non-existent session', async () => {
    await expect(getSessionStatus(999)).rejects.toThrow(/session with id 999 not found/i);
  });

  it('should handle session with zero completed focus periods', async () => {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 25 * 60 * 1000);

    const [session] = await db.insert(pomodoroSessionsTable)
      .values({
        user_id: 'new-user',
        focus_duration: 25,
        rest_duration: 5,
        current_period_type: 'focus',
        current_period_start: now,
        current_period_end: periodEnd,
        is_active: true,
        is_paused: false,
        completed_focus_periods: 0
      })
      .returning()
      .execute();

    const result = await getSessionStatus(session.id);

    expect(result.completed_focus_periods).toEqual(0);
    expect(result.current_period_type).toEqual('focus');
    expect(typeof result.time_remaining).toEqual('number');
    expect(result.time_remaining).toBeGreaterThanOrEqual(0);
  });
});
