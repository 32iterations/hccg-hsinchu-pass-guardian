import { test, expect, describe, beforeEach } from '@jest/globals';
import { render, fireEvent, waitFor } from '@testing-library/react';
import * as React from 'react';
import { GuardianPage } from '../src/pages/GuardianPage.tsx';
import { UserRole } from '../src/types';
import { AuthProvider } from '../src/contexts/AuthContext';
import { NavigationProvider } from '../src/contexts/NavigationContext';

const renderWithProviders = (component: React.ReactElement, mockUser: any = null) => {
  return render(
    React.createElement(AuthProvider, { value: { user: mockUser, isLoading: false } },
      React.createElement(NavigationProvider, {},
        component
      )
    )
  );
};

describe('安心守護頁面權限測試', () => {

  describe('未登入用戶', () => {
    test('顯示請先登入提示', () => {
      const { getByText, getByRole } = renderWithProviders(
        React.createElement(GuardianPage),
        { role: UserRole.GUEST }
      );

      expect(getByText('請先登入')).toBeInTheDocument();
      expect(getByText('登入後即可使用安心守護功能，守護您的家人')).toBeInTheDocument();

      const loginButton = getByRole('button', { name: '立即登入' });
      expect(loginButton).toBeInTheDocument();
    });

    test('點擊登入按鈕導向登入頁面', () => {
      const { getByRole } = renderWithProviders(
        React.createElement(GuardianPage),
        { role: UserRole.GUEST }
      );

      const loginButton = getByRole('button', { name: '立即登入' });
      fireEvent.click(loginButton);

      expect(window.location.pathname).toBe('/login');
      expect(window.location.search).toContain('redirect=/guardian');
    });
  });

  describe('一般會員', () => {
    const mockMember = {
      id: '1',
      email: 'user@example.com',
      role: UserRole.MEMBER
    };

    test('可以看到三個分頁', () => {
      const { getByText } = renderWithProviders(
        React.createElement(GuardianPage),
        mockMember
      );

      expect(getByText('家屬')).toBeInTheDocument();
      expect(getByText('志工')).toBeInTheDocument();
      expect(getByText('申辦')).toBeInTheDocument();
    });

    test('家屬分頁顯示需要實名驗證', async () => {
      const { getByText } = renderWithProviders(
        React.createElement(GuardianPage),
        mockMember
      );

      await waitFor(() => {
        expect(getByText('需要實名驗證')).toBeInTheDocument();
        expect(getByText(/使用定位追蹤、電子圍籬/)).toBeInTheDocument();
      });
    });

    test('志工分頁顯示需要實名驗證', async () => {
      const { getByText } = renderWithProviders(
        React.createElement(GuardianPage),
        mockMember
      );

      fireEvent.click(getByText('志工'));

      await waitFor(() => {
        expect(getByText('加入志工行列')).toBeInTheDocument();
        expect(getByText(/成為安心守護志工/)).toBeInTheDocument();
      });
    });

    test('申辦分頁可查看但不能申辦', async () => {
      const { getByText } = renderWithProviders(
        React.createElement(GuardianPage),
        mockMember
      );

      fireEvent.click(getByText('申辦'));

      await waitFor(() => {
        expect(getByText('線上申辦服務')).toBeInTheDocument();
        expect(getByText(/申辦安心守護服務需要完成實名驗證/)).toBeInTheDocument();
        expect(getByText('前往實名驗證')).toBeInTheDocument();
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
      const { getByText, queryByText } = renderWithProviders(
        React.createElement(GuardianPage),
        mockVerified
      );

      await waitFor(() => {
        expect(queryByText('需要實名驗證')).not.toBeInTheDocument();
        expect(getByText('定位追蹤')).toBeInTheDocument();
        expect(getByText('電子圍籬')).toBeInTheDocument();
        expect(getByText('緊急通報')).toBeInTheDocument();
        expect(getByText('歷史軌跡')).toBeInTheDocument();
      });
    });

    test('無綁定時顯示綁定提示', async () => {
      const { getByText } = renderWithProviders(
        React.createElement(GuardianPage),
        mockVerified
      );

      await waitFor(() => {
        expect(getByText('尚未綁定受照護者')).toBeInTheDocument();
        expect(getByText('綁定受照護者')).toBeInTheDocument();
        expect(getByText('最多可綁定3位受照護者')).toBeInTheDocument();
      });
    });

    test('志工分頁可接受任務', async () => {
      const { getByText } = renderWithProviders(
        React.createElement(GuardianPage),
        mockVerified
      );

      fireEvent.click(getByText('志工'));

      await waitFor(() => {
        expect(getByText(/任務列表|目前沒有新任務/)).toBeInTheDocument();
      });
    });

    test('申辦分頁可提交申請', async () => {
      const { getByText } = renderWithProviders(
        React.createElement(GuardianPage),
        mockVerified
      );

      fireEvent.click(getByText('申辦'));

      await waitFor(() => {
        expect(getByText('開始申辦')).toBeInTheDocument();
        expect(getByText('立即申辦')).toBeInTheDocument();
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
      const { getByLabelText } = renderWithProviders(
        React.createElement(GuardianPage),
        mockAdmin
      );

      expect(getByLabelText('管理功能')).toBeInTheDocument();
    });

    test('家屬分頁顯示額外管理功能', async () => {
      const { getByText } = renderWithProviders(
        React.createElement(GuardianPage),
        mockAdmin
      );

      await waitFor(() => {
        expect(getByText('全域監控')).toBeInTheDocument();
        expect(getByText('緊急派遣')).toBeInTheDocument();
      });
    });

    test('志工分頁顯示管理選項', async () => {
      const { getByText } = renderWithProviders(
        React.createElement(GuardianPage),
        mockAdmin
      );

      fireEvent.click(getByText('志工'));

      await waitFor(() => {
        expect(getByText('志工管理')).toBeInTheDocument();
        expect(getByText('發布任務')).toBeInTheDocument();
        expect(getByText('排班管理')).toBeInTheDocument();
      });
    });

    test('申辦分頁顯示審核功能', async () => {
      const { getByText } = renderWithProviders(
        React.createElement(GuardianPage),
        mockAdmin
      );

      fireEvent.click(getByText('申辦'));

      await waitFor(() => {
        expect(getByText('審核案件')).toBeInTheDocument();
        expect(getByText('申辦統計')).toBeInTheDocument();
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

  test('預設顯示家屬分頁', () => {
    const { container } = renderWithProviders(
      React.createElement(GuardianPage),
      mockUser
    );

    const familyTab = container.querySelector('[aria-selected="true"]');
    expect(familyTab?.textContent).toBe('家屬');
  });

  test('點擊分頁切換內容', async () => {
    const { getByText, container } = renderWithProviders(
      React.createElement(GuardianPage),
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
    const { getByText } = renderWithProviders(
      React.createElement(GuardianPage),
      mockUser
    );

    fireEvent.click(getByText('志工'));
    expect(window.location.pathname).toBe('/guardian/volunteer');

    fireEvent.click(getByText('申辦'));
    expect(window.location.pathname).toBe('/guardian/apply');

    fireEvent.click(getByText('家屬'));
    expect(window.location.pathname).toBe('/guardian');
  });

  test('返回按鈕導向首頁', () => {
    const { getByLabelText } = renderWithProviders(
      React.createElement(GuardianPage),
      mockUser
    );

    const backButton = getByLabelText('返回首頁');
    fireEvent.click(backButton);

    expect(window.location.pathname).toBe('/');
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

    const { getByText } = renderWithProviders(
      React.createElement(GuardianPage),
      mockUser
    );

    const badge = getByText('3');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('[data-badge]')).toHaveAttribute('data-badge', '3');
  });
});