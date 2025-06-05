
import { z } from 'zod';

// Pomodoro session schema
export const pomodoroSessionSchema = z.object({
  id: z.number(),
  user_id: z.string().nullable(),
  focus_duration: z.number().int().positive(), // in minutes
  rest_duration: z.number().int().positive(), // in minutes
  current_period_type: z.enum(['focus', 'rest']),
  current_period_start: z.coerce.date(),
  current_period_end: z.coerce.date(),
  is_active: z.boolean(),
  is_paused: z.boolean(),
  completed_focus_periods: z.number().int().nonnegative(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type PomodoroSession = z.infer<typeof pomodoroSessionSchema>;

// Input schema for creating a new pomodoro session
export const createPomodoroSessionInputSchema = z.object({
  user_id: z.string().nullable().optional(),
  focus_duration: z.number().int().positive().default(25), // default 25 minutes
  rest_duration: z.number().int().positive().default(5) // default 5 minutes
});

export type CreatePomodoroSessionInput = z.infer<typeof createPomodoroSessionInputSchema>;

// Input schema for starting a session
export const startSessionInputSchema = z.object({
  session_id: z.number()
});

export type StartSessionInput = z.infer<typeof startSessionInputSchema>;

// Input schema for pausing/resuming a session
export const pauseResumeSessionInputSchema = z.object({
  session_id: z.number()
});

export type PauseResumeSessionInput = z.infer<typeof pauseResumeSessionInputSchema>;

// Input schema for stopping a session
export const stopSessionInputSchema = z.object({
  session_id: z.number()
});

export type StopSessionInput = z.infer<typeof stopSessionInputSchema>;

// Input schema for switching to next period (focus -> rest or rest -> focus)
export const switchPeriodInputSchema = z.object({
  session_id: z.number()
});

export type SwitchPeriodInput = z.infer<typeof switchPeriodInputSchema>;

// Session status response schema
export const sessionStatusSchema = z.object({
  id: z.number(),
  current_period_type: z.enum(['focus', 'rest']),
  time_remaining: z.number().int().nonnegative(), // in seconds
  is_active: z.boolean(),
  is_paused: z.boolean(),
  completed_focus_periods: z.number().int().nonnegative(),
  focus_duration: z.number().int().positive(),
  rest_duration: z.number().int().positive()
});

export type SessionStatus = z.infer<typeof sessionStatusSchema>;
