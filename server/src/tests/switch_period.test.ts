
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { type SwitchPeriodInput } from '../schema';
import { switchPeriod } from '../handlers/switch_period';
import { eq } from 'drizzle-orm';

describe('switchPeriod', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should switch from focus to rest period', async () => {
    // Create an active focus session
    const now = new Date();
    const focusEnd = new Date(now.getTime() + 25 * 60 * 1000); // 25 minutes from now
    
    const sessions = await db.insert(pomodoroSessionsTable)
      .values({
        user_id: 'test-user',
        focus_duration: 25,
        rest_duration: 5,
        current_period_type: 'focus',
        current_period_start: now,
        current_period_end: focusEnd,
        is_active: true,
        is_paused: false,
        completed_focus_periods: 0
      })
      .returning()
      .execute();

    const sessionId = sessions[0].id;
    const input: SwitchPeriodInput = { session_id: sessionId };

    const result = await switchPeriod(input);

    // Should switch to rest period
    expect(result.current_period_type).toEqual('rest');
    expect(result.is_active).toBe(true);
    expect(result.is_paused).toBe(false);
    expect(result.completed_focus_periods).toEqual(1); // Should increment when switching from focus
    expect(result.current_period_start).toBeInstanceOf(Date);
    expect(result.current_period_end).toBeInstanceOf(Date);
    
    // Period end should be 5 minutes (rest_duration) from start
    const expectedDuration = result.current_period_end.getTime() - result.current_period_start.getTime();
    expect(expectedDuration).toEqual(5 * 60 * 1000); // 5 minutes in milliseconds
  });

  it('should switch from rest to focus period', async () => {
    // Create an active rest session
    const now = new Date();
    const restEnd = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
    
    const sessions = await db.insert(pomodoroSessionsTable)
      .values({
        user_id: 'test-user',
        focus_duration: 25,
        rest_duration: 5,
        current_period_type: 'rest',
        current_period_start: now,
        current_period_end: restEnd,
        is_active: true,
        is_paused: false,
        completed_focus_periods: 2
      })
      .returning()
      .execute();

    const sessionId = sessions[0].id;
    const input: SwitchPeriodInput = { session_id: sessionId };

    const result = await switchPeriod(input);

    // Should switch to focus period
    expect(result.current_period_type).toEqual('focus');
    expect(result.is_active).toBe(true);
    expect(result.is_paused).toBe(false);
    expect(result.completed_focus_periods).toEqual(2); // Should NOT increment when switching from rest
    expect(result.current_period_start).toBeInstanceOf(Date);
    expect(result.current_period_end).toBeInstanceOf(Date);
    
    // Period end should be 25 minutes (focus_duration) from start
    const expectedDuration = result.current_period_end.getTime() - result.current_period_start.getTime();
    expect(expectedDuration).toEqual(25 * 60 * 1000); // 25 minutes in milliseconds
  });

  it('should reset pause state when switching periods', async () => {
    // Create a paused active session
    const now = new Date();
    const focusEnd = new Date(now.getTime() + 25 * 60 * 1000);
    
    const sessions = await db.insert(pomodoroSessionsTable)
      .values({
        user_id: 'test-user',
        focus_duration: 25,
        rest_duration: 5,
        current_period_type: 'focus',
        current_period_start: now,
        current_period_end: focusEnd,
        is_active: true,
        is_paused: true, // Session is paused
        completed_focus_periods: 0
      })
      .returning()
      .execute();

    const sessionId = sessions[0].id;
    const input: SwitchPeriodInput = { session_id: sessionId };

    const result = await switchPeriod(input);

    // Should reset pause state
    expect(result.is_paused).toBe(false);
    expect(result.current_period_type).toEqual('rest');
  });

  it('should update session in database', async () => {
    // Create an active focus session
    const now = new Date();
    const focusEnd = new Date(now.getTime() + 25 * 60 * 1000);
    
    const sessions = await db.insert(pomodoroSessionsTable)
      .values({
        user_id: 'test-user',
        focus_duration: 25,
        rest_duration: 5,
        current_period_type: 'focus',
        current_period_start: now,
        current_period_end: focusEnd,
        is_active: true,
        is_paused: false,
        completed_focus_periods: 0
      })
      .returning()
      .execute();

    const sessionId = sessions[0].id;
    const input: SwitchPeriodInput = { session_id: sessionId };

    await switchPeriod(input);

    // Verify changes were saved to database
    const updatedSessions = await db.select()
      .from(pomodoroSessionsTable)
      .where(eq(pomodoroSessionsTable.id, sessionId))
      .execute();

    const updatedSession = updatedSessions[0];
    expect(updatedSession.current_period_type).toEqual('rest');
    expect(updatedSession.completed_focus_periods).toEqual(1);
    expect(updatedSession.is_paused).toBe(false);
    expect(updatedSession.updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent session', async () => {
    const input: SwitchPeriodInput = { session_id: 999 };

    await expect(switchPeriod(input)).rejects.toThrow(/session.*not found/i);
  });

  it('should throw error for inactive session', async () => {
    // Create an inactive session
    const now = new Date();
    const focusEnd = new Date(now.getTime() + 25 * 60 * 1000);
    
    const sessions = await db.insert(pomodoroSessionsTable)
      .values({
        user_id: 'test-user',
        focus_duration: 25,
        rest_duration: 5,
        current_period_type: 'focus',
        current_period_start: now,
        current_period_end: focusEnd,
        is_active: false, // Session is not active
        is_paused: false,
        completed_focus_periods: 0
      })
      .returning()
      .execute();

    const sessionId = sessions[0].id;
    const input: SwitchPeriodInput = { session_id: sessionId };

    await expect(switchPeriod(input)).rejects.toThrow(/cannot switch periods.*inactive/i);
  });
});
