import React from 'react';
import { EmptyStateConfig } from '../types';

interface EmptyStateProps extends EmptyStateConfig {
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  steps,
  benefits,
  helperText,
  infoCards,
  processSteps,
  estimatedTime,
  saveDraft,
  downloadSection,
  statusTimeline,
  notification,
  notificationStatus,
  settingsHint,
  onboardingSteps,
  className = ''
}) => {
  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-state-content">
        <div className="empty-state-icon">
          <span className={`icon-${icon}`} />
        </div>

        <h2 className="empty-state-title">{title}</h2>
        <p className="empty-state-description">{description}</p>

        {steps && (
          <div className="empty-state-steps">
            <h3>開始步驟：</h3>
            <ol className="step-list">
              {steps.map((step, index) => (
                <li key={index} className="step-item">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {benefits && (
          <div className="empty-state-benefits">
            <h3>服務優勢：</h3>
            <ul className="benefit-list">
              {benefits.map((benefit, index) => (
                <li key={index} className="benefit-item">
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        )}

        {infoCards && (
          <div className="empty-state-info-cards">
            {infoCards.map((card, index) => (
              <div key={index} className="info-card">
                <h4 className="info-card-title">{card.title}</h4>
                <ul className="info-card-items">
                  {card.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {processSteps && (
          <div className="empty-state-process">
            <h3>辦理流程：</h3>
            <div className="process-steps">
              {processSteps.map((step) => (
                <div key={step.number} className="process-step">
                  <div className="step-number">{step.number}</div>
                  <div className="step-content">
                    <h4>{step.title}</h4>
                    <span className="step-time">{step.time}</span>
                  </div>
                </div>
              ))}
            </div>
            {estimatedTime && (
              <p className="estimated-time">預計總時間：{estimatedTime}</p>
            )}
          </div>
        )}

        {statusTimeline && (
          <div className="empty-state-timeline">
            <h3>申辦進度：</h3>
            <div className="status-timeline">
              {statusTimeline.map((status, index) => (
                <div
                  key={index}
                  className={`timeline-item ${status.current ? 'current' : ''}`}
                >
                  <div className="timeline-date">
                    {status.date}
                    {status.time && <span className="timeline-time">{status.time}</span>}
                  </div>
                  <div className="timeline-status">{status.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {notification && (
          <div className="empty-state-notification">
            <span className={`notification-icon icon-${notification.icon}`} />
            <p>{notification.text}</p>
          </div>
        )}

        {notificationStatus && (
          <div className="empty-state-notification-status">
            <div className="notification-toggle">
              <input
                type="checkbox"
                checked={notificationStatus.enabled}
                readOnly
              />
              <span>{notificationStatus.text}</span>
            </div>
          </div>
        )}

        {onboardingSteps && (
          <div className="empty-state-onboarding">
            <h3>完成設定：</h3>
            <div className="onboarding-steps">
              {onboardingSteps.map((step, index) => (
                <div
                  key={index}
                  className={`onboarding-step ${step.completed ? 'completed' : ''}`}
                >
                  <div className="step-indicator">
                    {step.completed ? '✓' : index + 1}
                  </div>
                  <div className="step-content">
                    <h4>{step.title}</h4>
                    <p>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="empty-state-actions">
          {primaryAction && (
            <button
              className="btn btn-primary"
              onClick={primaryAction.onClick}
            >
              {primaryAction.text}
            </button>
          )}
          {secondaryAction && (
            <button
              className="btn btn-secondary"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.text}
            </button>
          )}
          {saveDraft && (
            <button className="btn btn-outline">
              {saveDraft.text}
            </button>
          )}
        </div>

        {downloadSection && (
          <div className="empty-state-downloads">
            <h3>{downloadSection.title}</h3>
            <div className="download-files">
              {downloadSection.files.map((file, index) => (
                <div key={index} className="download-file">
                  <span className="file-name">{file.name}</span>
                  <span className="file-format">{file.format}</span>
                  <span className="file-size">{file.size}</span>
                  <button className="btn btn-sm">下載</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {helperText && (
          <p className="empty-state-helper">{helperText}</p>
        )}

        {settingsHint && (
          <p className="empty-state-settings-hint">{settingsHint}</p>
        )}
      </div>
    </div>
  );
};