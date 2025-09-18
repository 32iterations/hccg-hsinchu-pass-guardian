import React, { useState, useEffect } from 'react';
import { UserRole, User } from '../../types';
import { EmptyState } from '../EmptyState';
import { FeatureCard } from '../FeatureCard';
import { useNavigation } from '../../hooks/useNavigation';
import { useGuardian } from '../../hooks/useGuardian';

interface FamilyTabProps {
  role: UserRole;
  user: User | null;
}

export const FamilyTab: React.FC<FamilyTabProps> = ({ role, user }) => {
  const { navigate } = useNavigation();
  const { bindings, isLoading, fetchBindings } = useGuardian();
  const [selectedBinding, setSelectedBinding] = useState<string | null>(null);

  useEffect(() => {
    if (role === UserRole.VERIFIED || role === UserRole.ADMIN) {
      fetchBindings();
    }
  }, [role]);

  if (role === UserRole.MEMBER) {
    return (
      <EmptyState
        icon="verified-user"
        title="需要實名驗證"
        description="為確保服務安全性，使用定位追蹤、電子圍籬等功能需要先完成實名驗證"
        primaryAction={{
          text: '前往實名驗證',
          onClick: () => navigate('/account/verification')
        }}
        secondaryAction={{
          text: '了解更多',
          onClick: () => {}
        }}
      />
    );
  }

  if (role === UserRole.VERIFIED && (!bindings || bindings.length === 0)) {
    return (
      <EmptyState
        icon="family-add"
        title="尚未綁定受照護者"
        description="開始使用安心守護服務，為您的家人提供24小時的守護"
        steps={[
          '點擊下方按鈕開始綁定',
          '輸入受照護者資訊',
          '完成同意書簽署'
        ]}
        primaryAction={{
          text: '綁定受照護者',
          onClick: () => navigate('/guardian/family/bind')
        }}
        helperText="最多可綁定3位受照護者"
      />
    );
  }

  // For VERIFIED users with bindings or ADMIN users, show the features grid
  if (role === UserRole.VERIFIED && bindings && bindings.length > 0) {
    // Show features grid
  }

  const features = [
    {
      id: 'location_tracking',
      name: '定位追蹤',
      icon: 'location',
      enabled: role === UserRole.VERIFIED || role === UserRole.ADMIN,
      onClick: () => navigate('/guardian/family/tracking')
    },
    {
      id: 'geofencing',
      name: '電子圍籬',
      icon: 'fence',
      enabled: role === UserRole.VERIFIED || role === UserRole.ADMIN,
      onClick: () => navigate('/guardian/family/geofencing')
    },
    {
      id: 'emergency_alert',
      name: '緊急通報',
      icon: 'alert',
      enabled: role === UserRole.VERIFIED || role === UserRole.ADMIN,
      onClick: () => navigate('/guardian/family/emergency')
    },
    {
      id: 'history',
      name: '歷史軌跡',
      icon: 'history',
      enabled: role === UserRole.VERIFIED || role === UserRole.ADMIN,
      onClick: () => navigate('/guardian/family/history')
    }
  ];

  // Show the features for users with bindings or admin
  const shouldShowFeatures = (role === UserRole.VERIFIED && bindings && bindings.length > 0) || role === UserRole.ADMIN;

  return (
    <div className="family-tab">
      {shouldShowFeatures && (
        <>
          {bindings && bindings.length > 0 && (
            <div className="bindings-selector">
              <label htmlFor="binding-select">選擇受照護者：</label>
              <select
                id="binding-select"
                value={selectedBinding || ''}
                onChange={(e) => setSelectedBinding(e.target.value)}
                className="binding-dropdown"
              >
                {bindings.map((binding) => (
                  <option key={binding.id} value={binding.id}>
                    {binding.name} ({binding.relationship})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="features-grid">
            {features.map((feature) => (
              <FeatureCard
                key={feature.id}
                {...feature}
                disabled={!feature.enabled}
              />
            ))}
          </div>
        </>
      )}

      {role === UserRole.ADMIN && (
        <div className="admin-section">
          <h3>管理功能</h3>
          <div className="admin-features">
            <FeatureCard
              id="global_monitoring"
              name="全域監控"
              icon="monitor"
              enabled={true}
              onClick={() => navigate('/guardian/admin/monitoring')}
            />
            <FeatureCard
              id="emergency_dispatch"
              name="緊急派遣"
              icon="dispatch"
              enabled={true}
              onClick={() => navigate('/guardian/admin/dispatch')}
            />
          </div>
        </div>
      )}

      {selectedBinding && (
        <div className="current-status">
          <h3>目前狀態</h3>
          <div className="status-card">
            <div className="status-item">
              <span className="status-label">最後更新：</span>
              <span className="status-value">2分鐘前</span>
            </div>
            <div className="status-item">
              <span className="status-label">電量：</span>
              <span className="status-value">85%</span>
            </div>
            <div className="status-item">
              <span className="status-label">連線狀態：</span>
              <span className="status-value online">線上</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};