import { useState, useCallback } from 'react';
import { Binding, Task, Application } from '../types';

interface UseGuardianReturn {
  // Bindings
  bindings: Binding[] | null;
  selectedBinding: string | null;
  setSelectedBinding: (id: string | null) => void;
  fetchBindings: () => Promise<void>;

  // Tasks
  availableTasks: Task[];
  myTasks: Task[];
  fetchTasks: () => Promise<void>;
  acceptTask: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;

  // Applications
  myApplications: Application[];
  fetchApplications: () => Promise<void>;
  createApplication: (data: Partial<Application>) => Promise<void>;
  updateApplication: (id: string, data: Partial<Application>) => Promise<void>;

  // State
  isLoading: boolean;
  error: string | null;
}

export const useGuardian = (): UseGuardianReturn => {
  const [bindings, setBindings] = useState<Binding[] | null>(null);
  const [selectedBinding, setSelectedBinding] = useState<string | null>(null);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBindings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock implementation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock data for testing
      const mockBindings: Binding[] = [];
      setBindings(mockBindings);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入綁定資料失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock implementation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock data for testing
      const mockAvailableTasks: Task[] = [];
      const mockMyTasks: Task[] = [];

      setAvailableTasks(mockAvailableTasks);
      setMyTasks(mockMyTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入任務資料失敗');
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

      // Move task from available to myTasks
      const task = availableTasks.find(t => t.id === taskId);
      if (task) {
        setAvailableTasks(prev => prev.filter(t => t.id !== taskId));
        setMyTasks(prev => [...prev, { ...task, status: 'assigned' }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '接受任務失敗');
    } finally {
      setIsLoading(false);
    }
  }, [availableTasks]);

  const completeTask = useCallback(async (taskId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock implementation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update task status
      setMyTasks(prev => prev.map(task =>
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

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock implementation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock data for testing
      const mockApplications: Application[] = [];
      setMyApplications(mockApplications);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入申請資料失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createApplication = useCallback(async (data: Partial<Application>) => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock implementation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));

      const newApplication: Application = {
        id: `app_${Date.now()}`,
        userId: 'current_user',
        status: 'draft',
        ...data
      };

      setMyApplications(prev => [...prev, newApplication]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立申請失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateApplication = useCallback(async (id: string, data: Partial<Application>) => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock implementation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));

      setMyApplications(prev => prev.map(app =>
        app.id === id
          ? { ...app, ...data }
          : app
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新申請失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // Bindings
    bindings,
    selectedBinding,
    setSelectedBinding,
    fetchBindings,

    // Tasks
    availableTasks,
    myTasks,
    fetchTasks,
    acceptTask,
    completeTask,

    // Applications
    myApplications,
    fetchApplications,
    createApplication,
    updateApplication,

    // State
    isLoading,
    error
  };
};