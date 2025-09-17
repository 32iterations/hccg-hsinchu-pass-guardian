import React from 'react';
import { LoadingStateConfig } from '../types';

interface LoadingStateProps extends LoadingStateConfig {
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = '載入中...',
  type = 'spinner',
  showItems = 3,
  animation = 'pulse',
  stages,
  className = ''
}) => {
  if (type === 'skeleton') {
    return (
      <div className={`loading-state skeleton ${className}`}>
        <div className="skeleton-container">
          {Array.from({ length: showItems }).map((_, index) => (
            <div key={index} className={`skeleton-item ${animation}`}>
              <div className="skeleton-avatar" />
              <div className="skeleton-content">
                <div className="skeleton-line skeleton-line-title" />
                <div className="skeleton-line skeleton-line-text" />
                <div className="skeleton-line skeleton-line-text short" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'progress' && stages) {
    return (
      <div className={`loading-state progress ${className}`}>
        <div className="progress-container">
          <div className="progress-header">
            <h3 className="progress-title">{message}</h3>
          </div>

          <div className="progress-stages">
            {stages.map((stage, index) => (
              <div key={index} className="progress-stage">
                <div className="stage-info">
                  <span className="stage-text">{stage.text}</span>
                  <span className="stage-percentage">{stage.progress}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${stage.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Default spinner type
  return (
    <div className={`loading-state spinner ${className}`}>
      <div className="spinner-container">
        <div className="spinner-element">
          <div className="spinner-circle" />
          <div className="spinner-circle" />
          <div className="spinner-circle" />
        </div>
        <p className="spinner-message">{message}</p>
      </div>
    </div>
  );
};