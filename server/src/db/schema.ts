
import { serial, text, pgTable, timestamp, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';

// Define enum for period types
export const periodTypeEnum = pgEnum('period_type', ['focus', 'rest']);

export const pomodoroSessionsTable = pgTable('pomodoro_sessions', {
  id: serial('id').primaryKey(),
  user_id: text('user_id'), // Nullable for anonymous sessions
  focus_duration: integer('focus_duration').notNull(), // in minutes
  rest_duration: integer('rest_duration').notNull(), // in minutes
  current_period_type: periodTypeEnum('current_period_type').notNull(),
  current_period_start: timestamp('current_period_start').notNull(),
  current_period_end: timestamp('current_period_end').notNull(),
  is_active: boolean('is_active').notNull().default(false),
  is_paused: boolean('is_paused').notNull().default(false),
  completed_focus_periods: integer('completed_focus_periods').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// TypeScript types for the table schema
export type PomodoroSession = typeof pomodoroSessionsTable.$inferSelect;
export type NewPomodoroSession = typeof pomodoroSessionsTable.$inferInsert;

// Export all tables for proper query building
export const tables = { pomodoroSessions: pomodoroSessionsTable };
