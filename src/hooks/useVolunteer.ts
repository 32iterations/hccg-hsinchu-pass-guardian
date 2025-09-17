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

      // Mock data for testing - return some tasks for admin tests
      const mockTasks: Task[] = [
        {
          id: 'task-1',
          title: '協助走失老人',
          description: '新竹市東區有位老人走失，需要志工協助搜尋',
          location: {
            address: '新竹市東區',
            lat: 24.8,
            lng: 120.9
          },
          urgency: 'high',
          status: 'pending',
          createdAt: '2024-01-01T00:00:00Z',
          points: 10
        }
      ];
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