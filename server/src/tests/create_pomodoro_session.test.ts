
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pomodoroSessionsTable } from '../db/schema';
import { type CreatePomodoroSessionInput } from '../schema';
import { createPomodoroSession } from '../handlers/create_pomodoro_session';
import { eq } from 'drizzle-orm';

// Test input with all fields
const testInput: CreatePomodoroSessionInput = {
  user_id: 'test-user-123',
  focus_duration: 25,
  rest_duration: 5
};

// Test input with defaults - include all required fields for handler
const testInputWithDefaults: CreatePomodoroSessionInput = {
  user_id: 'test-user-456',
  focus_duration: 25, // Default value
  rest_duration: 5 // Default value
};

describe('createPomodoroSession', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a pomodoro session with specified values', async () => {
    const result = await createPomodoroSession(testInput);

    // Basic field validation
    expect(result.user_id).toEqual('test-user-123');
    expect(result.focus_duration).toEqual(25);
    expect(result.rest_duration).toEqual(5);
    expect(result.current_period_type).toEqual('focus');
    expect(result.is_active).toEqual(false);
    expect(result.is_paused).toEqual(false);
    expect(result.completed_focus_periods).toEqual(0);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.current_period_start).toBeInstanceOf(Date);
    expect(result.current_period_end).toBeInstanceOf(Date);
  });

  it('should create session with all fields specified', async () => {
    const result = await createPomodoroSession(testInputWithDefaults);

    expect(result.focus_duration).toEqual(25);
    expect(result.rest_duration).toEqual(5);
    expect(result.user_id).toEqual('test-user-456');
  });

  it('should create anonymous session when user_id is null', async () => {
    const anonymousInput: CreatePomodoroSessionInput = {
      user_id: null,
      focus_duration: 30,
      rest_duration: 10
    };

    const result = await createPomodoroSession(anonymousInput);

    expect(result.user_id).toBeNull();
    expect(result.focus_duration).toEqual(30);
    expect(result.rest_duration).toEqual(10);
  });

  it('should save session to database', async () => {
    const result = await createPomodoroSession(testInput);

    const sessions = await db.select()
      .from(pomodoroSessionsTable)
      .where(eq(pomodoroSessionsTable.id, result.id))
      .execute();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].user_id).toEqual('test-user-123');
    expect(sessions[0].focus_duration).toEqual(25);
    expect(sessions[0].rest_duration).toEqual(5);
    expect(sessions[0].current_period_type).toEqual('focus');
    expect(sessions[0].is_active).toEqual(false);
    expect(sessions[0].is_paused).toEqual(false);
    expect(sessions[0].completed_focus_periods).toEqual(0);
  });

  it('should set correct initial period times', async () => {
    const beforeCreate = new Date();
    const result = await createPomodoroSession(testInput);
    const afterCreate = new Date();

    // Period start should be close to creation time
    expect(result.current_period_start.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(result.current_period_start.getTime()).toBeLessThanOrEqual(afterCreate.getTime());

    // Period end should be focus_duration minutes after start
    const expectedDuration = testInput.focus_duration * 60 * 1000; // Convert to milliseconds
    const actualDuration = result.current_period_end.getTime() - result.current_period_start.getTime();
    
    expect(actualDuration).toEqual(expectedDuration);
  });

  it('should always start with focus period', async () => {
    const result = await createPomodoroSession(testInput);

    expect(result.current_period_type).toEqual('focus');
  });
});
