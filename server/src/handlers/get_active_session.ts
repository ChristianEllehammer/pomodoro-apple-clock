
import { type PomodoroSession } from '../schema';

export declare function getActiveSession(userId?: string): Promise<PomodoroSession | null>;
