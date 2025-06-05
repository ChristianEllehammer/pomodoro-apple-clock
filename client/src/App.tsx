import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CircularProgress } from '@/components/CircularProgress';
import { AudioNotifications } from '@/components/AudioNotifications';
import { trpc } from '@/utils/trpc';
import type { PomodoroSession, SessionStatus, CreatePomodoroSessionInput } from '../../server/src/schema';

function App() {
  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [focusDuration, setFocusDuration] = useState(25);
  const [restDuration, setRestDuration] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [screenSize, setScreenSize] = useState<'sm' | 'md' | 'lg'>('lg');
  
  // Audio and previous period tracking
  const audioNotifications = useRef<AudioNotifications | null>(null);
  const previousPeriodTypeRef = useRef<string | null>(null);

  // Initialize audio and notification permissions
  useEffect(() => {
    // Request notification permission (only in secure contexts)
    if ('Notification' in window && window.isSecureContext) {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
      }).catch(() => {
        console.log('Notification permission request failed');
        setNotificationPermission('denied');
      });
    } else {
      setNotificationPermission('denied');
    }

    // Initialize audio notifications
    audioNotifications.current = new AudioNotifications();

    // Handle screen size changes
    const handleResize = () => {
      
      if (window.innerWidth < 480) {
        setScreenSize('sm');
      } else if (window.innerWidth < 640) {
        setScreenSize('md');
      } else {
        setScreenSize('lg');
      }
    };

    handleResize(); // Set initial size
    window.addEventListener('resize', handleResize);

    return () => {
      audioNotifications.current = null;
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Audio notification helper
  const playNotificationSound = useCallback(async (type: 'focus-end' | 'rest-end' | 'stop') => {
    if (!audioNotifications.current) return;
    
    try {
      switch (type) {
        case 'focus-end':
          await audioNotifications.current.playFocusEndSound();
          break;
        case 'rest-end':
          await audioNotifications.current.playRestEndSound();
          break;
        case 'stop':
          await audioNotifications.current.playStopSound();
          break;
      }
    } catch (error) {
      console.log('Audio notification failed:', error);
    }
  }, []);

  // Desktop notification helper  
  const showDesktopNotification = useCallback((title: string, message: string) => {
    if (notificationPermission === 'granted' && 'Notification' in window && window.isSecureContext) {
      try {
        const notification = new Notification(title, {
          body: message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          requireInteraction: true
        });

        // Auto-close after 10 seconds
        setTimeout(() => notification.close(), 10000);

        // Focus window when notification is clicked
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.log('Desktop notification failed:', error);
      }
    } else {
      // Fallback to console log for non-secure contexts
      console.log(`🔔 ${title}: ${message}`);
    }
  }, [notificationPermission]);

  // Window focus helper
  const requestWindowAttention = useCallback(() => {
    try {
      // Focus the window
      window.focus();
      
      // Flash the title for attention
      const originalTitle = document.title;
      let flashCount = 0;
      const flashInterval = setInterval(() => {
        document.title = flashCount % 2 === 0 ? '🍅 BREAK TIME!' : originalTitle;
        flashCount++;
        if (flashCount >= 10) {
          clearInterval(flashInterval);
          document.title = originalTitle;
        }
      }, 500);
    } catch (error) {
      console.log('Window attention request failed:', error);
    }
  }, []);

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
        previousPeriodTypeRef.current = status.current_period_type;
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
      
      // Check for period transitions
      if (previousPeriodTypeRef.current && 
          previousPeriodTypeRef.current !== status.current_period_type) {
        
        if (status.current_period_type === 'rest') {
          // Focus period ended, starting rest
          await playNotificationSound('focus-end');
          showDesktopNotification(
            '🍅 Focus Complete!',
            'Great work! Time for a well-deserved break.'
          );
          requestWindowAttention();
        } else if (status.current_period_type === 'focus') {
          // Rest period ended, starting focus
          await playNotificationSound('rest-end');
          showDesktopNotification(
            '⚡ Break Over!',
            'Ready to focus? Let\'s get back to work!'
          );
        }
      }
      
      previousPeriodTypeRef.current = status.current_period_type;
      setSessionStatus(status);
      
      // If time is up, automatically switch periods
      if (status.time_remaining === 0) {
        await trpc.switchPeriod.mutate({ session_id: session.id });
        // Reload status after switching
        setTimeout(async () => {
          const newStatus = await trpc.getSessionStatus.query({ sessionId: session.id });
          setSessionStatus(newStatus);
          previousPeriodTypeRef.current = newStatus.current_period_type;
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to update session status:', error);
    }
  }, [session, sessionStatus?.is_active, playNotificationSound, showDesktopNotification, requestWindowAttention]);

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
      previousPeriodTypeRef.current = null;
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
      previousPeriodTypeRef.current = status.current_period_type;
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
      
      // Play stop sound when stopping
      await playNotificationSound('stop');
      
      setSession(null);
      setSessionStatus(null);
      previousPeriodTypeRef.current = null;
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
      previousPeriodTypeRef.current = status.current_period_type;
    } catch (error) {
      console.error('Failed to skip period:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get dynamic styles based on session state
  const getCardStyles = () => {
    if (!sessionStatus) return '';
    
    if (sessionStatus.is_paused) {
      return 'ring-2 ring-yellow-200 shadow-yellow-100/50';
    } else if (sessionStatus.is_active) {
      return sessionStatus.current_period_type === 'focus'
        ? 'ring-2 ring-blue-200 shadow-blue-100/50 shadow-2xl'
        : 'ring-2 ring-green-200 shadow-green-100/50 shadow-2xl';
    }
    return '';
  };

  const getProgressColor = () => {
    if (!sessionStatus) return '#3b82f6';
    
    if (sessionStatus.is_paused) return '#eab308';
    return sessionStatus.current_period_type === 'focus' ? '#3b82f6' : '#10b981';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-light tracking-tight text-slate-900">🍅 Focus</h1>
          <p className="text-slate-600 text-sm">Stay focused, stay productive</p>
        </div>

        {/* Main Timer Card */}
        <Card className={`p-8 bg-white/90 backdrop-blur-sm border-0 shadow-xl transition-all duration-300 ease-out hover:scale-[1.01] ${getCardStyles()}`}>
          {sessionStatus ? (
            <div className="space-y-8">
              {/* Period Type Badge */}
              <div className="flex justify-center">
                <Badge 
                  variant={sessionStatus.current_period_type === 'focus' ? 'default' : 'secondary'}
                  className={`px-6 py-3 text-base font-medium transition-all duration-200 ${
                    sessionStatus.current_period_type === 'focus' 
                      ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-200' 
                      : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-200'
                  } ${sessionStatus.is_paused ? 'opacity-60' : ''}`}
                >
                  {sessionStatus.is_paused 
                    ? '⏸️ Paused' 
                    : sessionStatus.current_period_type === 'focus' 
                      ? '🎯 Focus Time' 
                      : '☕ Break Time'
                  }
                </Badge>
              </div>

              {/* Circular Timer Display */}
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <CircularProgress 
                    progress={getProgress()}
                    size={screenSize === 'sm' ? 200 : screenSize === 'md' ? 240 : 280}
                    strokeWidth={screenSize === 'sm' ? 8 : screenSize === 'md' ? 10 : 12}
                    color={getProgressColor()}
                    backgroundColor="#f1f5f9"
                    className="drop-shadow-lg circular-progress-responsive"
                  />
                  
                  {/* Timer in center of circle */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center px-4">
                      <div className={`text-4xl sm:text-5xl lg:text-6xl font-light tracking-tighter tabular-nums transition-colors duration-300 ${
                        sessionStatus.is_paused ? 'text-yellow-600' : 'text-slate-900'
                      }`}>
                        {formatTime(sessionStatus.time_remaining)}
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-slate-500 mt-1 sm:mt-2">
                        {sessionStatus.is_paused ? 'Paused' : 'Remaining'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Session Stats */}
                <div className="flex justify-center space-x-4 sm:space-x-8 text-sm text-slate-600">
                  <div className="text-center">
                    <div className="font-bold text-xl sm:text-2xl text-slate-900">
                      {sessionStatus.completed_focus_periods}
                    </div>
                    <div className="text-xs uppercase tracking-wide">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-xl sm:text-2xl text-blue-600">
                      {sessionStatus.focus_duration}m
                    </div>
                    <div className="text-xs uppercase tracking-wide">Focus</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-xl sm:text-2xl text-green-600">
                      {sessionStatus.rest_duration}m
                    </div>
                    <div className="text-xs uppercase tracking-wide">Break</div>
                  </div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex justify-center space-x-2 sm:space-x-4 mobile-button-spacing">
                <Button
                  onClick={handlePauseResume}
                  disabled={isLoading}
                  variant={sessionStatus.is_paused ? 'default' : 'outline'}
                  size="lg"
                  className="px-4 sm:px-8 py-2 sm:py-3 text-sm sm:text-base transition-all duration-200 hover:scale-105 hover:shadow-lg enhanced-button"
                >
                  <span className="hidden sm:inline">{sessionStatus.is_paused ? '▶️ Resume' : '⏸️ Pause'}</span>
                  <span className="sm:hidden">{sessionStatus.is_paused ? '▶️' : '⏸️'}</span>
                </Button>
                <Button
                  onClick={handleSkipPeriod}
                  disabled={isLoading}
                  variant="outline"
                  size="lg"
                  className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base transition-all duration-200 hover:scale-105 hover:shadow-lg hover:border-slate-300 enhanced-button"
                >
                  <span className="hidden sm:inline">⏭️ Skip</span>
                  <span className="sm:hidden">⏭️</span>
                </Button>
                <Button
                  onClick={handleStopSession}
                  disabled={isLoading}
                  variant="outline"
                  size="lg"
                  className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 transition-all duration-200 hover:scale-105 hover:shadow-lg enhanced-button"
                >
                  <span className="hidden sm:inline">⏹️ Stop</span>
                  <span className="sm:hidden">⏹️</span>
                </Button>
              </div>
            </div>
          ) : session ? (
            <div className="text-center space-y-8">
              <div className="space-y-3">
                <h2 className="text-2xl font-medium text-slate-900">Ready to Focus?</h2>
                <p className="text-slate-600 text-lg">
                  {session.focus_duration} min focus • {session.rest_duration} min break
                </p>
              </div>
              <Button
                onClick={handleStartSession}
                disabled={isLoading}
                size="lg"
                className="px-12 py-4 text-xl bg-blue-500 hover:bg-blue-600 transition-all duration-200 hover:scale-105 hover:shadow-xl shadow-blue-200"
              >
                {isLoading ? 'Starting...' : '🚀 Start Session'}
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="text-center space-y-3">
                <h2 className="text-2xl font-medium text-slate-900">Create New Session</h2>
                <p className="text-slate-600">Customize your focus and break durations</p>
              </div>

              {/* Duration Settings */}
              <div className="space-y-6">
                <div className="space-y-3">
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
                    className="text-center text-xl py-4 transition-all duration-200 focus:scale-105 focus:shadow-lg enhanced-input"
                  />
                </div>

                <div className="space-y-3">
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
                    className="text-center text-xl py-4 transition-all duration-200 focus:scale-105 focus:shadow-lg enhanced-input"
                  />
                </div>
              </div>

              <Button
                onClick={handleCreateSession}
                disabled={isLoading}
                size="lg"
                className="w-full py-4 text-xl bg-blue-500 hover:bg-blue-600 transition-all duration-200 hover:scale-105 hover:shadow-xl shadow-blue-200"
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