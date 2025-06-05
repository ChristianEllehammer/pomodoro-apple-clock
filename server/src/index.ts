
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { 
  createPomodoroSessionInputSchema,
  startSessionInputSchema,
  pauseResumeSessionInputSchema,
  stopSessionInputSchema,
  switchPeriodInputSchema
} from './schema';
import { createPomodoroSession } from './handlers/create_pomodoro_session';
import { startSession } from './handlers/start_session';
import { pauseSession } from './handlers/pause_session';
import { resumeSession } from './handlers/resume_session';
import { stopSession } from './handlers/stop_session';
import { switchPeriod } from './handlers/switch_period';
import { getSessionStatus } from './handlers/get_session_status';
import { getActiveSession } from './handlers/get_active_session';
import { z } from 'zod';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),
  
  // Create a new pomodoro session
  createPomodoroSession: publicProcedure
    .input(createPomodoroSessionInputSchema)
    .mutation(({ input }) => createPomodoroSession(input)),
  
  // Start a session (begin the first focus period)
  startSession: publicProcedure
    .input(startSessionInputSchema)
    .mutation(({ input }) => startSession(input)),
  
  // Pause an active session
  pauseSession: publicProcedure
    .input(pauseResumeSessionInputSchema)
    .mutation(({ input }) => pauseSession(input)),
  
  // Resume a paused session
  resumeSession: publicProcedure
    .input(pauseResumeSessionInputSchema)
    .mutation(({ input }) => resumeSession(input)),
  
  // Stop a session completely
  stopSession: publicProcedure
    .input(stopSessionInputSchema)
    .mutation(({ input }) => stopSession(input)),
  
  // Switch to next period (focus -> rest or rest -> focus)
  switchPeriod: publicProcedure
    .input(switchPeriodInputSchema)
    .mutation(({ input }) => switchPeriod(input)),
  
  // Get current session status with countdown info
  getSessionStatus: publicProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(({ input }) => getSessionStatus(input.sessionId)),
  
  // Get active session for a user (or anonymous)
  getActiveSession: publicProcedure
    .input(z.object({ userId: z.string().optional() }))
    .query(({ input }) => getActiveSession(input.userId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();
