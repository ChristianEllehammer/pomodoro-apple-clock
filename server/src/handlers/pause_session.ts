
import { type PauseResumeSessionInput, type PomodoroSession } from '../schema';

export declare function pauseSession(input: PauseResumeSessionInput): Promise<PomodoroSession>;
