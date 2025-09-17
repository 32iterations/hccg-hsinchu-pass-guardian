import React, { useState, useEffect } from 'react';
import { UserRole, User } from '../../types';
import { EmptyState } from '../EmptyState';
import { TaskCard } from '../TaskCard';
import { useNavigation } from '../../hooks/useNavigation';
import { useVolunteer } from '../../hooks/useVolunteer';

interface VolunteerTabProps {
  role: UserRole;
  user: User | null;
}

export const VolunteerTab: React.FC<VolunteerTabProps> = ({ role, user }) => {
  const { navigate } = useNavigation();
  const { tasks, isRegistered, isLoading, fetchTasks, registerVolunteer } = useVolunteer();
  const [filter, setFilter] = useState<'all' | 'available' | 'assigned'>('available');

  useEffect(() => {
    if (role === UserRole.VERIFIED || role === UserRole.ADMIN) {
      fetchTasks();
    }
  }, [role]);

  if (role === UserRole.MEMBER) {
    return (
      <EmptyState
        icon="volunteer-badge"
        title="加入志工行列"
        description="成為安心守護志工，一起守護社區長者。完成實名驗證即可開始接受任務"
        benefits={[
          '獲得志工時數認證',
          '參與社區服務',
          '累積愛心積分'
        ]}
        primaryAction={{
          text: '完成實名驗證',
          onClick: () => navigate('/account/verification')
        }}
      />
    );
  }

  if (role === UserRole.VERIFIED && !isRegistered) {
    return (
      <EmptyState
        icon="welcome-volunteer"
        title="歡迎加入志工團隊！"
        description="您已成功註冊為安心守護志工，讓我們一起為社區盡一份心力"
        onboardingSteps={[
          { title: '設定服務區域', description: '選擇您方便服務的區域', completed: false },
          { title: '設定服務時段', description: '告訴我們您可服務的時間', completed: false },
          { title: '完成教育訓練', description: '觀看5分鐘教學影片', completed: false }
        ]}
        primaryAction={{
          text: '開始設定',
          onClick: () => registerVolunteer()
        }}
      />
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon="task-completed"
        title="目前沒有新任務"
        description="感謝您的熱心參與！有新任務時我們會立即通知您"
        settingsHint="可在設定中調整接收任務的時段與區域"
        secondaryAction={{
          text: '查看歷史任務',
          onClick: () => navigate('/guardian/volunteer/history')
        }}
        notificationStatus={{
          enabled: true,
          text: '任務通知已開啟'
        }}
      />
    );
  }

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'available') return task.status === 'pending';
    if (filter === 'assigned') return task.assignedTo === user?.id;
    return true;
  });

  return (
    <div className="volunteer-tab">
      <div className="volunteer-stats">
        <div className="stat-card">
          <span className="stat-value">12</span>
          <span className="stat-label">完成任務</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">48</span>
          <span className="stat-label">服務時數</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">320</span>
          <span className="stat-label">愛心積分</span>
        </div>
      </div>

      <div className="task-filter">
        <button
          className={`filter-btn ${filter === 'available' ? 'active' : ''}`}
          onClick={() => setFilter('available')}
        >
          可接任務
        </button>
        <button
          className={`filter-btn ${filter === 'assigned' ? 'active' : ''}`}
          onClick={() => setFilter('assigned')}
        >
          我的任務
        </button>
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          全部
        </button>
      </div>

      <div className="tasks-list">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onAccept={() => {}}
            onComplete={() => {}}
            canAccept={task.status === 'pending' && role === UserRole.VERIFIED}
          />
        ))}
      </div>

      {role === UserRole.ADMIN && (
        <div className="admin-section">
          <h3>管理功能</h3>
          <div className="admin-actions">
            <button
              className="admin-btn"
              onClick={() => navigate('/guardian/admin/volunteers')}
            >
              志工管理
            </button>
            <button
              className="admin-btn"
              onClick={() => navigate('/guardian/admin/tasks/create')}
            >
              發布任務
            </button>
            <button
              className="admin-btn"
              onClick={() => navigate('/guardian/admin/schedule')}
            >
              排班管理
            </button>
          </div>
        </div>
      )}

      <div className="quick-actions">
        <button
          className="fab"
          onClick={() => navigate('/guardian/volunteer/schedule')}
          aria-label="查看排班"
        >
          <span className="icon-calendar" />
        </button>
      </div>
    </div>
  );
};