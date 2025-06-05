
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import type { PomodoroSession, SessionStatus, CreatePomodoroSessionInput } from '../../server/src/schema';

function App() {
  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [focusDuration, setFocusDuration] = useState(25);
  const [restDuration, setRestDuration] = useState(5);
  const [isLoading, setIsLoading] = useState(false);

  // Format time from seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const getProgress = (): number => {
    if (!sessionStatus) return 0;
    const totalDuration = sessionStatus.current_period_type === 'focus' 
      ? sessionStatus.focus_duration * 60 
      : sessionStatus.rest_duration * 60;
    const elapsed = totalDuration - sessionStatus.time_remaining;
    return (elapsed / totalDuration) * 100;
  };

  // Load active session on mount
  const loadActiveSession = useCallback(async () => {
    try {
      const activeSession = await trpc.getActiveSession.query({ userId: undefined });
      setSession(activeSession);
      
      if (activeSession) {
        const status = await trpc.getSessionStatus.query({ sessionId: activeSession.id });
        setSessionStatus(status);
      }
    } catch (error) {
      console.error('Failed to load active session:', error);
    }
  }, []);

  // Update session status periodically when active
  const updateSessionStatus = useCallback(async () => {
    if (!session || !sessionStatus?.is_active) return;
    
    try {
      const status = await trpc.getSessionStatus.query({ sessionId: session.id });
      setSessionStatus(status);
      
      // If time is up, automatically switch periods
      if (status.time_remaining === 0) {
        await trpc.switchPeriod.mutate({ session_id: session.id });
        // Reload status after switching
        setTimeout(async () => {
          const newStatus = await trpc.getSessionStatus.query({ sessionId: session.id });
          setSessionStatus(newStatus);
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to update session status:', error);
    }
  }, [session, sessionStatus?.is_active]);

  useEffect(() => {
    loadActiveSession();
  }, [loadActiveSession]);

  useEffect(() => {
    if (session && sessionStatus?.is_active && !sessionStatus.is_paused) {
      const interval = setInterval(updateSessionStatus, 1000);
      return () => clearInterval(interval);
    }
  }, [updateSessionStatus, session, sessionStatus?.is_active, sessionStatus?.is_paused]);

  const handleCreateSession = async () => {
    setIsLoading(true);
    try {
      const input: CreatePomodoroSessionInput = {
        focus_duration: focusDuration,
        rest_duration: restDuration,
        user_id: undefined
      };
      
      const newSession = await trpc.createPomodoroSession.mutate(input);
      setSession(newSession);
      setSessionStatus(null);
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSession = async () => {
    if (!session) return;
    
    setIsLoading(true);
    try {
      await trpc.startSession.mutate({ session_id: session.id });
      const status = await trpc.getSessionStatus.query({ sessionId: session.id });
      setSessionStatus(status);
    } catch (error) {
      console.error('Failed to start session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseResume = async () => {
    if (!session || !sessionStatus) return;
    
    setIsLoading(true);
    try {
      if (sessionStatus.is_paused) {
        await trpc.resumeSession.mutate({ session_id: session.id });
      } else {
        await trpc.pauseSession.mutate({ session_id: session.id });
      }
      
      const status = await trpc.getSessionStatus.query({ sessionId: session.id });
      setSessionStatus(status);
    } catch (error) {
      console.error('Failed to pause/resume session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopSession = async () => {
    if (!session) return;
    
    setIsLoading(true);
    try {
      await trpc.stopSession.mutate({ session_id: session.id });
      setSession(null);
      setSessionStatus(null);
    } catch (error) {
      console.error('Failed to stop session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipPeriod = async () => {
    if (!session) return;
    
    setIsLoading(true);
    try {
      await trpc.switchPeriod.mutate({ session_id: session.id });
      const status = await trpc.getSessionStatus.query({ sessionId: session.id });
      setSessionStatus(status);
    } catch (error) {
      console.error('Failed to skip period:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-light tracking-tight text-slate-900">🍅 Focus</h1>
          <p className="text-slate-600 text-sm">Stay focused, stay productive</p>
        </div>

        {/* Main Timer Card */}
        <Card className="p-8 bg-white/80 backdrop-blur-sm border-0 shadow-xl shadow-slate-200/50">
          {sessionStatus ? (
            <div className="space-y-6">
              {/* Period Type Badge */}
              <div className="flex justify-center">
                <Badge 
                  variant={sessionStatus.current_period_type === 'focus' ? 'default' : 'secondary'}
                  className={`px-4 py-2 text-sm font-medium ${
                    sessionStatus.current_period_type === 'focus' 
                      ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {sessionStatus.current_period_type === 'focus' ? '🎯 Focus Time' : '☕ Break Time'}
                </Badge>
              </div>

              {/* Timer Display */}
              <div className="text-center space-y-4">
                <div className="text-6xl font-light tracking-tighter text-slate-900 tabular-nums">
                  {formatTime(sessionStatus.time_remaining)}
                </div>
                
                {/* Progress Ring */}
                <div className="relative w-32 h-32 mx-auto">
                  <Progress 
                    value={getProgress()} 
                    className="w-full h-2 bg-slate-200"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-medium text-slate-600">
                      {Math.round(getProgress())}%
                    </span>
                  </div>
                </div>

                {/* Session Stats */}
                <div className="flex justify-center space-x-6 text-sm text-slate-600">
                  <div className="text-center">
                    <div className="font-semibold text-slate-900">
                      {sessionStatus.completed_focus_periods}
                    </div>
                    <div>Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-900">
                      {sessionStatus.focus_duration}m
                    </div>
                    <div>Focus</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-900">
                      {sessionStatus.rest_duration}m
                    </div>
                    <div>Break</div>
                  </div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex justify-center space-x-3">
                <Button
                  onClick={handlePauseResume}
                  disabled={isLoading}
                  variant={sessionStatus.is_paused ? 'default' : 'outline'}
                  size="lg"
                  className="px-8"
                >
                  {sessionStatus.is_paused ? '▶️ Resume' : '⏸️ Pause'}
                </Button>
                <Button
                  onClick={handleSkipPeriod}
                  disabled={isLoading}
                  variant="outline"
                  size="lg"
                >
                  ⏭️ Skip
                </Button>
                <Button
                  onClick={handleStopSession}
                  disabled={isLoading}
                  variant="outline"
                  size="lg"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  ⏹️ Stop
                </Button>
              </div>
            </div>
          ) : session ? (
            <div className="text-center space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-medium text-slate-900">Ready to Focus?</h2>
                <p className="text-slate-600">
                  {session.focus_duration} min focus • {session.rest_duration} min break
                </p>
              </div>
              <Button
                onClick={handleStartSession}
                disabled={isLoading}
                size="lg"
                className="px-12 py-3 text-lg bg-blue-500 hover:bg-blue-600"
              >
                {isLoading ? 'Starting...' : '🚀 Start Session'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-medium text-slate-900">Create New Session</h2>
                <p className="text-slate-600">Customize your focus and break durations</p>
              </div>

              {/* Duration Settings */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="focus-duration" className="text-sm font-medium text-slate-700">
                    Focus Duration (minutes)
                  </Label>
                  <Input
                    id="focus-duration"
                    type="number"
                    min="1"
                    max="120"
                    value={focusDuration}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      setFocusDuration(parseInt(e.target.value) || 25)
                    }
                    className="text-center text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rest-duration" className="text-sm font-medium text-slate-700">
                    Break Duration (minutes)
                  </Label>
                  <Input
                    id="rest-duration"
                    type="number"
                    min="1"
                    max="30"
                    value={restDuration}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      setRestDuration(parseInt(e.target.value) || 5)
                    }
                    className="text-center text-lg"
                  />
                </div>
              </div>

              <Button
                onClick={handleCreateSession}
                disabled={isLoading}
                size="lg"
                className="w-full py-3 text-lg bg-blue-500 hover:bg-blue-600"
              >
                {isLoading ? 'Creating...' : '✨ Create Session'}
              </Button>
            </div>
          )}
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500">
          Built with focus and simplicity in mind
        </div>
      </div>
    </div>
  );
}

export default App;
