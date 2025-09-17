import React from 'react';

interface FeatureCardProps {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  onClick?: () => void;
  disabled?: boolean;
  description?: string;
  badge?: string | number;
  status?: 'active' | 'inactive' | 'warning' | 'error';
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  id,
  name,
  icon,
  enabled,
  onClick,
  disabled = false,
  description,
  badge,
  status
}) => {
  const handleClick = () => {
    if (!disabled && enabled && onClick) {
      onClick();
    }
  };

  const cardClassName = [
    'feature-card',
    enabled ? 'enabled' : 'disabled',
    disabled ? 'card-disabled' : '',
    status ? `status-${status}` : '',
    onClick ? 'clickable' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClassName}
      onClick={handleClick}
      role={onClick ? 'button' : 'div'}
      tabIndex={onClick && !disabled ? 0 : -1}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick && !disabled) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="feature-card-header">
        <div className="feature-icon-container">
          <span className={`feature-icon icon-${icon}`} />
          {status && (
            <div className={`status-indicator status-${status}`} />
          )}
        </div>

        {badge && (
          <div className="feature-badge">
            {typeof badge === 'number' && badge > 99 ? '99+' : badge}
          </div>
        )}
      </div>

      <div className="feature-card-content">
        <h3 className="feature-name">{name}</h3>
        {description && (
          <p className="feature-description">{description}</p>
        )}
      </div>

      {!enabled && (
        <div className="feature-overlay">
          <span className="overlay-text">需要權限</span>
        </div>
      )}

      {onClick && enabled && !disabled && (
        <div className="feature-arrow">
          <span className="icon-chevron-right" />
        </div>
      )}
    </div>
  );
};