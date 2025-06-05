
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { getActiveSession } from '../handlers/get_active_session';

describe('getActiveSession', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when no active sessions exist', async () => {
    const result = await getActiveSession();
    expect(result).toBeNull();
  });

  it('should return active session for specific user', async () => {
    // Create inactive session for user1
    await db.insert(pomodoroSessionsTable).values({
      user_id: 'user1',
      focus_duration: 25,
      rest_duration: 5,
      current_period_type: 'focus',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 25 * 60 * 1000),
      is_active: false,
      is_paused: false,
      completed_focus_periods: 0
    });

    // Create active session for user1
    await db.insert(pomodoroSessionsTable).values({
      user_id: 'user1',
      focus_duration: 30,
      rest_duration: 10,
      current_period_type: 'rest',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 10 * 60 * 1000),
      is_active: true,
      is_paused: false,
      completed_focus_periods: 2
    });

    const result = await getActiveSession('user1');
    
    expect(result).not.toBeNull();
    expect(result!.user_id).toBe('user1');
    expect(result!.is_active).toBe(true);
    expect(result!.focus_duration).toBe(30);
    expect(result!.current_period_type).toBe('rest');
    expect(result!.completed_focus_periods).toBe(2);
  });

  it('should return null when user has no active sessions', async () => {
    // Create inactive session for user1
    await db.insert(pomodoroSessionsTable).values({
      user_id: 'user1',
      focus_duration: 25,
      rest_duration: 5,
      current_period_type: 'focus',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 25 * 60 * 1000),
      is_active: false,
      is_paused: false,
      completed_focus_periods: 0
    });

    const result = await getActiveSession('user1');
    expect(result).toBeNull();
  });

  it('should return active anonymous session when user_id is null', async () => {
    // Create active anonymous session
    await db.insert(pomodoroSessionsTable).values({
      user_id: null,
      focus_duration: 25,
      rest_duration: 5,
      current_period_type: 'focus',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 25 * 60 * 1000),
      is_active: true,
      is_paused: true,
      completed_focus_periods: 1
    });

    const result = await getActiveSession(null);
    
    expect(result).not.toBeNull();
    expect(result!.user_id).toBeNull();
    expect(result!.is_active).toBe(true);
    expect(result!.is_paused).toBe(true);
    expect(result!.completed_focus_periods).toBe(1);
  });

  it('should not return sessions for different users', async () => {
    // Create active session for user1
    await db.insert(pomodoroSessionsTable).values({
      user_id: 'user1',
      focus_duration: 25,
      rest_duration: 5,
      current_period_type: 'focus',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 25 * 60 * 1000),
      is_active: true,
      is_paused: false,
      completed_focus_periods: 0
    });

    // Query for different user
    const result = await getActiveSession('user2');
    expect(result).toBeNull();
  });

  it('should return any active session when no userId filter provided', async () => {
    // Create active session for user1
    await db.insert(pomodoroSessionsTable).values({
      user_id: 'user1',
      focus_duration: 25,
      rest_duration: 5,
      current_period_type: 'focus',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 25 * 60 * 1000),
      is_active: true,
      is_paused: false,
      completed_focus_periods: 0
    });

    // Create active anonymous session
    await db.insert(pomodoroSessionsTable).values({
      user_id: null,
      focus_duration: 30,
      rest_duration: 10,
      current_period_type: 'rest',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 10 * 60 * 1000),
      is_active: true,
      is_paused: false,
      completed_focus_periods: 3
    });

    // Query without user filter should return one active session
    const result = await getActiveSession();
    
    expect(result).not.toBeNull();
    expect(result!.is_active).toBe(true);
    // Should return one of the active sessions (exact one depends on database ordering)
    expect(['user1', null]).toContain(result!.user_id);
  });
});
