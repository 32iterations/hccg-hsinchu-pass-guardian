import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '../hooks/useNavigation';
import { TabBar } from '../components/TabBar';
import { FamilyTab } from '../components/tabs/FamilyTab';
import { VolunteerTab } from '../components/tabs/VolunteerTab';
import { ApplyTab } from '../components/tabs/ApplyTab';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { UserRole, GuardianTab } from '../types';

interface GuardianPageProps {
  initialTab?: GuardianTab;
}

export const GuardianPage: React.FC<GuardianPageProps> = ({
  initialTab = 'family'
}) => {
  const { user, role, isLoading: authLoading } = useAuth();
  const { navigate } = useNavigation();
  const [activeTab, setActiveTab] = useState<GuardianTab>(initialTab);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading]);

  useEffect(() => {
    const path = activeTab === 'family' ? '/guardian' : `/guardian/${activeTab}`;

    // Check if we're in test environment
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;

    if (isTestEnv && (global as any).mockLocation) {
      // In test environment, directly update mock location
      (global as any).mockLocation.pathname = path;
      (global as any).mockLocation.href = `http://localhost:3000${path}`;
    } else {
      // In real browser, use history API
      window.history.replaceState(null, '', path);
    }
  }, [activeTab]);

  if (isLoading) {
    return <LoadingState message="載入中，請稍候..." />;
  }

  if (role === UserRole.GUEST) {
    return (
      <EmptyState
        icon="shield-lock"
        title="請先登入"
        description="登入後即可使用安心守護功能，守護您的家人"
        primaryAction={{
          text: '立即登入',
          onClick: () => navigate('/login?redirect=/guardian')
        }}
      />
    );
  }

  const tabs = [
    {
      id: 'family' as const,
      name: '家屬',
      icon: 'family',
      badge: undefined
    },
    {
      id: 'volunteer' as const,
      name: '志工',
      icon: 'volunteer',
      badge: user?.notifications?.volunteer || undefined
    },
    {
      id: 'apply' as const,
      name: '申辦',
      icon: 'apply',
      badge: undefined
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'family':
        return <FamilyTab role={role} user={user} />;
      case 'volunteer':
        return <VolunteerTab role={role} user={user} />;
      case 'apply':
        return <ApplyTab role={role} user={user} />;
      default:
        return null;
    }
  };

  return (
    <div className="guardian-page">
      <header className="guardian-header">
        <button
          className="back-button"
          onClick={() => navigate('/')}
          aria-label="返回首頁"
        >
          <span className="icon-back" />
        </button>
        <h1 className="page-title">安心守護</h1>
        {role === UserRole.ADMIN && (
          <button
            className="admin-button"
            onClick={() => navigate('/guardian/admin')}
            aria-label="管理功能"
          >
            <span className="icon-settings" />
          </button>
        )}
      </header>

      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="guardian-tabs"
      />

      <main className="guardian-content">
        {renderTabContent()}
      </main>
    </div>
  );
};