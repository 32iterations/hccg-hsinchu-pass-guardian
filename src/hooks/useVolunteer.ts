import { useState, useCallback } from 'react';
import { Task } from '../types';

interface UseVolunteerReturn {
  tasks: Task[];
  isRegistered: boolean;
  isLoading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  registerVolunteer: () => Promise<void>;
  acceptTask: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
}

export const useVolunteer = (): UseVolunteerReturn => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isRegistered, setIsRegistered] = useState(true); // Mock as registered for testing
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock implementation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock data for testing - empty array to trigger "no tasks" state
      const mockTasks: Task[] = [];
      setTasks(mockTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入任務失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const registerVolunteer = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock implementation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setIsRegistered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '志工註冊失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const acceptTask = useCallback(async (taskId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock implementation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));

      setTasks(prev => prev.map(task =>
        task.id === taskId
          ? { ...task, status: 'assigned' }
          : task
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : '接受任務失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const completeTask = useCallback(async (taskId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock implementation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));

      setTasks(prev => prev.map(task =>
        task.id === taskId
          ? { ...task, status: 'completed' }
          : task
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : '完成任務失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    tasks,
    isRegistered,
    isLoading,
    error,
    fetchTasks,
    registerVolunteer,
    acceptTask,
    completeTask
  };
};