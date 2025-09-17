import { test, expect, describe, beforeEach, jest } from '@jest/globals';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as React from 'react';
import { GuardianPage } from '../src/pages/GuardianPage';
import { UserRole } from '../src/types';

// Mock modules
jest.mock('../src/hooks/useAuth');
jest.mock('../src/hooks/useNavigation');
jest.mock('../src/hooks/useGuardian');
jest.mock('../src/hooks/useVolunteer');
jest.mock('../src/hooks/useApplication');

// Mock complex components to avoid import issues while preserving text content
jest.mock('../src/components/EmptyState', () => ({
  EmptyState: ({ title, description, primaryAction, secondaryAction, steps, benefits, infoCards, processSteps, helperText, onboardingSteps, settingsHint, notificationStatus, downloadSection, statusTimeline, notification, estimatedTime, saveDraft }: any) => {
    return React.createElement('div', { 'data-testid': 'empty-state' },
      React.createElement('h2', null, title),
      React.createElement('p', null, description),
      helperText && React.createElement('p', { 'data-testid': 'helper-text' }, helperText),
      steps && steps.map((step: string, index: number) =>
        React.createElement('div', { key: index, 'data-testid': 'step' }, step)
      ),
      benefits && benefits.map((benefit: string, index: number) =>
        React.createElement('div', { key: index, 'data-testid': 'benefit' }, benefit)
      ),
      infoCards && infoCards.map((card: any, index: number) =>
        React.createElement('div', { key: index, 'data-testid': 'info-card' },
          React.createElement('h3', null, card.title),
          card.items.map((item: string, itemIndex: number) =>
            React.createElement('p', { key: itemIndex }, item)
          )
        )
      ),
      processSteps && processSteps.map((step: any, index: number) =>
        React.createElement('div', { key: index, 'data-testid': 'process-step' },
          React.createElement('span', null, `${step.number}. ${step.title}`),
          React.createElement('span', null, step.time)
        )
      ),
      onboardingSteps && onboardingSteps.map((step: any, index: number) =>
        React.createElement('div', { key: index, 'data-testid': 'onboarding-step' },
          React.createElement('span', null, step.title),
          React.createElement('span', null, step.description)
        )
      ),
      primaryAction && React.createElement('button', {
        onClick: primaryAction.onClick,
        'data-testid': 'primary-action'
      }, primaryAction.text),
      secondaryAction && React.createElement('button', {
        onClick: secondaryAction.onClick,
        'data-testid': 'secondary-action'
      }, secondaryAction.text),
      estimatedTime && React.createElement('p', { 'data-testid': 'estimated-time' }, estimatedTime),
      downloadSection && React.createElement('div', { 'data-testid': 'download-section' },
        React.createElement('h3', null, downloadSection.title),
        downloadSection.files.map((file: any, index: number) =>
          React.createElement('div', { key: index, 'data-testid': 'download-file' }, `${file.name} (${file.format}, ${file.size})`)
        )
      ),
      statusTimeline && statusTimeline.map((status: any, index: number) =>
        React.createElement('div', { key: index, 'data-testid': 'status-timeline' },
          React.createElement('span', null, status.date),
          React.createElement('span', null, status.status)
        )
      ),
      notification && React.createElement('div', { 'data-testid': 'notification' }, notification.text),
      settingsHint && React.createElement('p', { 'data-testid': 'settings-hint' }, settingsHint),
      notificationStatus && React.createElement('div', { 'data-testid': 'notification-status' }, notificationStatus.text)
    );
  }
}));

jest.mock('../src/components/FeatureCard', () => ({
  FeatureCard: ({ name, onClick, disabled }: any) => {
    return React.createElement('button', {
      onClick: disabled ? undefined : onClick,
      disabled,
      'data-testid': 'feature-card'
    }, name);
  }
}));

jest.mock('../src/components/TaskCard', () => ({
  TaskCard: ({ task }: any) => {
    return React.createElement('div', { 'data-testid': 'task-card' }, task.title || '目前沒有新任務');
  }
}));

jest.mock('../src/components/InfoCard', () => ({
  InfoCard: ({ title, items }: any) => {
    return React.createElement('div', { 'data-testid': 'info-card' },
      React.createElement('h3', null, title),
      items.map((item: string, index: number) =>
        React.createElement('p', { key: index }, item)
      )
    );
  }
}));

jest.mock('../src/components/TabBar', () => ({
  TabBar: ({ tabs, activeTab, onTabChange }: any) => {
    return React.createElement('div', { role: 'tablist' },
      tabs.map((tab: any) =>
        React.createElement('div', {
          key: tab.id,
          role: 'tab',
          'aria-selected': activeTab === tab.id ? 'true' : 'false',
          onClick: () => onTabChange(tab.id),
          'data-testid': `tab-${tab.id}`
        },
        tab.name,
        tab.badge && React.createElement('span', { 'data-badge': tab.badge }, tab.badge.toString())
        )
      )
    );
  }
}));

jest.mock('../src/components/LoadingState', () => ({
  LoadingState: ({ message }: any) => {
    return React.createElement('div', { 'data-testid': 'loading-state' }, message);
  }
}));

const renderWithMockedHooks = (mockUser: any = null) => {
  const { useAuth } = require('../src/hooks/useAuth');
  const { useNavigation } = require('../src/hooks/useNavigation');
  const { useGuardian } = require('../src/hooks/useGuardian');
  const { useVolunteer } = require('../src/hooks/useVolunteer');
  const { useApplication } = require('../src/hooks/useApplication');

  // Setup global mock location if not exists
  if (!(global as any).mockLocation) {
    (global as any).mockLocation = {
      pathname: '/',
      search: '',
      href: 'http://localhost:3000'
    };
  }

  // Mock hook implementations
  useAuth.mockReturnValue({
    user: mockUser,
    role: mockUser?.role || UserRole.GUEST,
    isLoading: false
  });

  useNavigation.mockReturnValue({
    navigate: jest.fn((path: string) => {
      if ((global as any).mockLocation) {
        (global as any).mockLocation.pathname = path;
        const queryStart = path.indexOf('?');
        if (queryStart > -1) {
          (global as any).mockLocation.pathname = path.substring(0, queryStart);
          (global as any).mockLocation.search = path.substring(queryStart);
        } else {
          (global as any).mockLocation.search = '';
        }
      }
    })
  });

  useGuardian.mockReturnValue({
    bindings: mockUser?.bindings || [],
    isLoading: false,
    fetchBindings: jest.fn()
  });

  useVolunteer.mockReturnValue({
    tasks: mockUser?.volunteerTasks || [],
    isRegistered: mockUser?.isVolunteerRegistered || false,
    isLoading: false,
    fetchTasks: jest.fn(),
    registerVolunteer: jest.fn()
  });

  useApplication.mockReturnValue({
    application: mockUser?.application || null,
    isLoading: false,
    fetchApplication: jest.fn()
  });

  return render(React.createElement(GuardianPage));
};

describe('安心守護頁面權限測試', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup global mock location
    (global as any).mockLocation = {
      pathname: '/',
      search: '',
      href: 'http://localhost:3000'
    };
  });

  describe('未登入用戶', () => {
    test('顯示請先登入提示', () => {
      const { getByText, getByRole } = renderWithMockedHooks(
        { role: UserRole.GUEST }
      );

      expect(getByText('請先登入')).toBeTruthy();
      expect(getByText('登入後即可使用安心守護功能，守護您的家人')).toBeTruthy();

      const loginButton = getByRole('button', { name: '立即登入' });
      expect(loginButton).toBeTruthy();
    });

    test('點擊登入按鈕導向登入頁面', () => {
      const { getByRole } = renderWithMockedHooks(
        { role: UserRole.GUEST }
      );

      const loginButton = getByRole('button', { name: '立即登入' });
      fireEvent.click(loginButton);

      // Use global mock location for test verification
      const mockLocation = (global as any).mockLocation;
      expect(mockLocation.pathname).toBe('/login');
      expect(mockLocation.search).toContain('redirect=/guardian');
    });
  });

  describe('一般會員', () => {
    const mockMember = {
      id: '1',
      email: 'user@example.com',
      role: UserRole.MEMBER
    };

    test('可以看到三個分頁', () => {
      const { getByText } = renderWithMockedHooks(
        mockMember
      );

      expect(getByText('家屬')).toBeTruthy();
      expect(getByText('志工')).toBeTruthy();
      expect(getByText('申辦')).toBeTruthy();
    });

    test('家屬分頁顯示需要實名驗證', async () => {
      const { getByText } = renderWithMockedHooks(
        mockMember
      );

      await waitFor(() => {
        expect(getByText('需要實名驗證')).toBeTruthy();
        expect(getByText(/使用定位追蹤、電子圍籬/)).toBeTruthy();
      });
    });

    test('志工分頁顯示需要實名驗證', async () => {
      const { getByText } = renderWithMockedHooks(
        mockMember
      );

      fireEvent.click(getByText('志工'));

      await waitFor(() => {
        expect(getByText('加入志工行列')).toBeTruthy();
        expect(getByText(/成為安心守護志工/)).toBeTruthy();
      });
    });

    test('申辦分頁可查看但不能申辦', async () => {
      const { getByText } = renderWithMockedHooks(
        mockMember
      );

      fireEvent.click(getByText('申辦'));

      await waitFor(() => {
        expect(getByText('線上申辦服務')).toBeTruthy();
        expect(getByText(/申辦安心守護服務需要完成實名驗證/)).toBeTruthy();
        expect(getByText('前往實名驗證')).toBeTruthy();
      });
    });
  });

  describe('實名會員', () => {
    const mockVerified = {
      id: '2',
      email: 'verified@example.com',
      role: UserRole.VERIFIED,
      verificationStatus: {
        isVerified: true,
        verifiedAt: '2024-03-01',
        method: 'mobile-id'
      }
    };

    test('家屬分頁顯示完整功能', async () => {
      const mockVerifiedWithBindings = {
        ...mockVerified,
        bindings: [{ id: '1', name: '李奶奶', relationship: '祖母' }]
      };

      const { getByText, queryByText } = renderWithMockedHooks(
        mockVerifiedWithBindings
      );

      await waitFor(() => {
        expect(queryByText('需要實名驗證')).toBeNull();
        expect(getByText('定位追蹤')).toBeTruthy();
        expect(getByText('電子圍籬')).toBeTruthy();
        expect(getByText('緊急通報')).toBeTruthy();
        expect(getByText('歷史軌跡')).toBeTruthy();
      });
    });

    test('無綁定時顯示綁定提示', async () => {
      const { getByText } = renderWithMockedHooks(
        mockVerified
      );

      await waitFor(() => {
        expect(getByText('尚未綁定受照護者')).toBeTruthy();
        expect(getByText('綁定受照護者')).toBeTruthy();
        expect(getByText('最多可綁定3位受照護者')).toBeTruthy();
      });
    });

    test('志工分頁可接受任務', async () => {
      const mockVerifiedVolunteer = {
        ...mockVerified,
        isVolunteerRegistered: true,
        volunteerTasks: []
      };

      const { getByText } = renderWithMockedHooks(
        mockVerifiedVolunteer
      );

      fireEvent.click(getByText('志工'));

      await waitFor(() => {
        expect(getByText('目前沒有新任務')).toBeTruthy();
      });
    });

    test('申辦分頁可提交申請', async () => {
      const { getByText } = renderWithMockedHooks(
        mockVerified
      );

      fireEvent.click(getByText('申辦'));

      await waitFor(() => {
        expect(getByText('開始申辦')).toBeTruthy();
        expect(getByText('立即申辦')).toBeTruthy();
      });
    });
  });

  describe('承辦人員', () => {
    const mockAdmin = {
      id: '3',
      email: 'admin@hccg.gov.tw',
      role: UserRole.ADMIN
    };

    test('顯示管理功能按鈕', () => {
      const { getByLabelText } = renderWithMockedHooks(
        mockAdmin
      );

      expect(getByLabelText('管理功能')).toBeTruthy();
    });

    test('家屬分頁顯示額外管理功能', async () => {
      const { getByText } = renderWithMockedHooks(
        mockAdmin
      );

      await waitFor(() => {
        expect(getByText('全域監控')).toBeTruthy();
        expect(getByText('緊急派遣')).toBeTruthy();
      });
    });

    test('志工分頁顯示管理選項', async () => {
      const mockAdminVolunteer = {
        ...mockAdmin,
        isVolunteerRegistered: true,
        volunteerTasks: [
          { id: '1', title: '協助走失長者', status: 'pending', assignedTo: null }
        ]
      };

      const { getByText } = renderWithMockedHooks(
        mockAdminVolunteer
      );

      fireEvent.click(getByText('志工'));

      await waitFor(() => {
        expect(getByText('志工管理')).toBeTruthy();
        expect(getByText('發布任務')).toBeTruthy();
        expect(getByText('排班管理')).toBeTruthy();
      });
    });

    test('申辦分頁顯示審核功能', async () => {
      const { getByText } = renderWithMockedHooks(
        mockAdmin
      );

      fireEvent.click(getByText('申辦'));

      await waitFor(() => {
        expect(getByText('審核案件')).toBeTruthy();
        expect(getByText('申辦統計')).toBeTruthy();
      });
    });
  });
});

describe('導航功能測試', () => {
  const mockUser = {
    id: '1',
    email: 'user@example.com',
    role: UserRole.VERIFIED
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock location before each test
    (global as any).mockLocation = {
      pathname: '/',
      search: '',
      href: 'http://localhost:3000'
    };
  });

  test('預設顯示家屬分頁', () => {
    const { container } = renderWithMockedHooks(
      mockUser
    );

    const familyTab = container.querySelector('[aria-selected="true"]');
    expect(familyTab?.textContent).toBe('家屬');
  });

  test('點擊分頁切換內容', async () => {
    const { getByText, container } = renderWithMockedHooks(
      mockUser
    );

    fireEvent.click(getByText('志工'));

    await waitFor(() => {
      const volunteerTab = container.querySelector('[aria-selected="true"]');
      expect(volunteerTab?.textContent).toBe('志工');
    });

    fireEvent.click(getByText('申辦'));

    await waitFor(() => {
      const applyTab = container.querySelector('[aria-selected="true"]');
      expect(applyTab?.textContent).toBe('申辦');
    });
  });

  test('URL更新為對應分頁路徑', () => {
    const { getByText } = renderWithMockedHooks(
      mockUser
    );

    const mockLocation = (global as any).mockLocation;

    fireEvent.click(getByText('志工'));
    expect(mockLocation.pathname).toBe('/guardian/volunteer');

    fireEvent.click(getByText('申辦'));
    expect(mockLocation.pathname).toBe('/guardian/apply');

    fireEvent.click(getByText('家屬'));
    expect(mockLocation.pathname).toBe('/guardian');
  });

  test('返回按鈕導向首頁', () => {
    const { getByLabelText } = renderWithMockedHooks(
      mockUser
    );

    const backButton = getByLabelText('返回首頁');
    fireEvent.click(backButton);

    const mockLocation = (global as any).mockLocation;
    expect(mockLocation.pathname).toBe('/');
  });
});

describe('通知徽章測試', () => {
  test('志工分頁顯示通知數字', () => {
    const mockUser = {
      id: '1',
      email: 'user@example.com',
      role: UserRole.VERIFIED,
      notifications: {
        volunteer: 3
      }
    };

    const { getByText } = renderWithMockedHooks(
      mockUser
    );

    const badge = getByText('3');
    expect(badge).toBeTruthy();
    expect(badge.closest('[data-badge]')?.getAttribute('data-badge')).toBe('3');
  });
});