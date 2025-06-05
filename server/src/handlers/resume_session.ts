
import { type PauseResumeSessionInput, type PomodoroSession } from '../schema';

export declare function resumeSession(input: PauseResumeSessionInput): Promise<PomodoroSession>;
