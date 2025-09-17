import React, { useState, useEffect } from 'react';
import { UserRole, User } from '../../types';
import { EmptyState } from '../EmptyState';
import { InfoCard } from '../InfoCard';
import { useNavigation } from '../../hooks/useNavigation';
import { useApplication } from '../../hooks/useApplication';

interface ApplyTabProps {
  role: UserRole;
  user: User | null;
}

export const ApplyTab: React.FC<ApplyTabProps> = ({ role, user }) => {
  const { navigate } = useNavigation();
  const { application, isLoading, fetchApplication } = useApplication();
  const [showInfo, setShowInfo] = useState(true);

  useEffect(() => {
    if ((role === UserRole.VERIFIED || role === UserRole.ADMIN) && user?.id) {
      fetchApplication(user.id);
    }
  }, [role, user?.id]);

  if (role === UserRole.MEMBER && !application) {
    return (
      <div className="apply-tab">
        <EmptyState
          icon="form-locked"
          title="線上申辦服務"
          description="申辦安心守護服務需要完成實名驗證，以確保申請資料的真實性與安全性"
          infoCards={[
            {
              title: '申辦資格',
              items: [
                '設籍新竹市民',
                '65歲以上失智症患者家屬',
                '或經醫師診斷需要之個案'
              ]
            },
            {
              title: '準備文件',
              items: [
                '身分證明文件',
                '醫師診斷證明',
                '家屬同意書'
              ]
            }
          ]}
          primaryAction={{
            text: '前往實名驗證',
            onClick: () => navigate('/account/verification')
          }}
          downloadSection={{
            title: '相關文件下載',
            files: [
              { name: '申請書範本', format: 'PDF', size: '245KB' },
              { name: '同意書範本', format: 'PDF', size: '180KB' }
            ]
          }}
        />
      </div>
    );
  }

  if (role === UserRole.VERIFIED && !application) {
    return (
      <div className="apply-tab">
        <EmptyState
          icon="form-ready"
          title="開始申辦"
          description="您已完成實名驗證，現在可以開始線上申辦程序"
          processSteps={[
            { number: 1, title: '填寫申請表', time: '約10分鐘' },
            { number: 2, title: '上傳文件', time: '約5分鐘' },
            { number: 3, title: 'MyData授權', time: '約2分鐘' },
            { number: 4, title: '送出申請', time: '立即' }
          ]}
          estimatedTime="預計辦理時間：7個工作天"
          primaryAction={{
            text: '立即申辦',
            onClick: () => navigate('/guardian/apply/form')
          }}
          saveDraft={{
            text: '可隨時儲存，稍後繼續'
          }}
        />
      </div>
    );
  }

  if (application && application.status === 'submitted') {
    return (
      <div className="apply-tab">
        <EmptyState
          icon="application-submitted"
          title="申請已送出"
          description={`您的申請已成功送出\n申請編號：${application.id}`}
          statusTimeline={[
            {
              date: application.submittedAt,
              time: new Date(application.submittedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
              status: '已送出',
              current: true
            },
            {
              date: '預計 ' + new Date(Date.now() + 86400000).toLocaleDateString('zh-TW'),
              status: '承辦審核中',
              current: false
            },
            {
              date: '預計 ' + new Date(Date.now() + 604800000).toLocaleDateString('zh-TW'),
              status: '核准/駁回',
              current: false
            }
          ]}
          secondaryAction={{
            text: '查看申請詳情',
            onClick: () => navigate(`/guardian/apply/detail/${application.id}`)
          }}
          notification={{
            text: '已開啟進度通知，狀態更新時會立即通知您',
            icon: 'notification-on'
          }}
        />
      </div>
    );
  }

  return (
    <div className="apply-tab">
      <div className="service-info">
        <h2>安心守護服務說明</h2>
        <div className="info-sections">
          <InfoCard
            title="服務對象"
            icon="users"
            items={[
              '65歲以上失智症患者',
              '經醫師評估有走失風險者',
              '認知功能障礙者'
            ]}
          />
          <InfoCard
            title="服務內容"
            icon="services"
            items={[
              '24小時定位追蹤服務',
              '智慧電子圍籬警報',
              '緊急協尋通報系統',
              '志工快速支援網絡'
            ]}
          />
          <InfoCard
            title="申辦流程"
            icon="process"
            items={[
              '線上填寫申請表',
              '上傳相關證明文件',
              'MyData資料授權',
              '等待審核（7工作天）',
              '領取設備並啟用'
            ]}
          />
        </div>
      </div>

      <div className="documents-section">
        <h3>文件下載區</h3>
        <div className="document-list">
          <a href="#" className="document-link" download>
            <span className="icon-pdf" />
            <div className="document-info">
              <span className="document-name">安心守護服務申請書</span>
              <span className="document-size">PDF, 245KB</span>
            </div>
            <span className="icon-download" />
          </a>
          <a href="#" className="document-link" download>
            <span className="icon-pdf" />
            <div className="document-info">
              <span className="document-name">個資使用同意書</span>
              <span className="document-size">PDF, 180KB</span>
            </div>
            <span className="icon-download" />
          </a>
          <a href="#" className="document-link" download>
            <span className="icon-pdf" />
            <div className="document-info">
              <span className="document-name">服務使用說明手冊</span>
              <span className="document-size">PDF, 1.2MB</span>
            </div>
            <span className="icon-download" />
          </a>
        </div>
      </div>

      {role === UserRole.ADMIN && (
        <div className="admin-section">
          <h3>管理功能</h3>
          <div className="admin-actions">
            <button
              className="admin-btn"
              onClick={() => navigate('/guardian/admin/applications')}
            >
              審核案件
            </button>
            <button
              className="admin-btn"
              onClick={() => navigate('/guardian/admin/statistics')}
            >
              申辦統計
            </button>
          </div>
        </div>
      )}

      {(role === UserRole.VERIFIED || role === UserRole.ADMIN) && (
        <div className="action-section">
          <button
            className="primary-btn"
            onClick={() => navigate('/guardian/apply/form')}
          >
            開始申辦
          </button>
        </div>
      )}
    </div>
  );
};