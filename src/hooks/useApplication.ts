import { useState, useCallback } from 'react';
import { Application } from '../types';

interface UseApplicationReturn {
  application: Application | null;
  applications: Application[];
  isLoading: boolean;
  error: string | null;
  fetchApplication: (userId: string) => Promise<void>;
  fetchApplications: () => Promise<void>;
  createApplication: (data: Partial<Application>) => Promise<void>;
  updateApplication: (id: string, data: Partial<Application>) => Promise<void>;
  submitApplication: (id: string) => Promise<void>;
}

export const useApplication = (): UseApplicationReturn => {
  const [application, setApplication] = useState<Application | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApplication = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock implementation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock data for testing - return null to trigger "no application" state
      setApplication(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入申請資料失敗');
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

      const mockApplications: Application[] = [];
      setApplications(mockApplications);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入申請列表失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createApplication = useCallback(async (data: Partial<Application>) => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock implementation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newApplication: Application = {
        id: `app_${Date.now()}`,
        userId: 'current_user',
        status: 'draft',
        ...data
      };

      setApplication(newApplication);
      setApplications(prev => [...prev, newApplication]);
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

      const updatedApplication = { ...application, ...data };
      setApplication(updatedApplication as Application);

      setApplications(prev => prev.map(app =>
        app.id === id ? { ...app, ...data } : app
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新申請失敗');
    } finally {
      setIsLoading(false);
    }
  }, [application]);

  const submitApplication = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock implementation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const submittedData = {
        status: 'submitted' as const,
        submittedAt: new Date().toISOString()
      };

      setApplication(prev => prev ? { ...prev, ...submittedData } : null);

      setApplications(prev => prev.map(app =>
        app.id === id ? { ...app, ...submittedData } : app
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交申請失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    application,
    applications,
    isLoading,
    error,
    fetchApplication,
    fetchApplications,
    createApplication,
    updateApplication,
    submitApplication
  };
};