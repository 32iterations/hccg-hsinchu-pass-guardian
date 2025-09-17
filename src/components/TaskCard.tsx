import React from 'react';
import { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onAccept?: () => void;
  onComplete?: () => void;
  canAccept?: boolean;
  canComplete?: boolean;
  showDetails?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onAccept,
  onComplete,
  canAccept = false,
  canComplete = false,
  showDetails = true
}) => {
  const getUrgencyClass = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'urgency-critical';
      case 'high': return 'urgency-high';
      case 'medium': return 'urgency-medium';
      case 'low': return 'urgency-low';
      default: return 'urgency-medium';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'assigned': return 'status-assigned';
      case 'in_progress': return 'status-in-progress';
      case 'completed': return 'status-completed';
      default: return 'status-pending';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`task-card ${getStatusClass(task.status)}`}>
      <div className="task-header">
        <div className="task-title-section">
          <h3 className="task-title">{task.title}</h3>
          <div className={`urgency-badge ${getUrgencyClass(task.urgency)}`}>
            {task.urgency === 'critical' && '緊急'}
            {task.urgency === 'high' && '重要'}
            {task.urgency === 'medium' && '一般'}
            {task.urgency === 'low' && '低'}
          </div>
        </div>

        <div className="task-points">
          <span className="points-value">{task.points}</span>
          <span className="points-label">積分</span>
        </div>
      </div>

      {showDetails && (
        <div className="task-content">
          <p className="task-description">{task.description}</p>

          <div className="task-location">
            <span className="icon-location" />
            <span className="location-text">{task.location.address}</span>
          </div>

          <div className="task-meta">
            <div className="meta-item">
              <span className="meta-label">建立時間：</span>
              <span className="meta-value">{formatDate(task.createdAt)}</span>
            </div>

            {task.dueTime && (
              <div className="meta-item">
                <span className="meta-label">期限：</span>
                <span className="meta-value">{formatDate(task.dueTime)}</span>
              </div>
            )}

            {task.assignedTo && (
              <div className="meta-item">
                <span className="meta-label">派遣給：</span>
                <span className="meta-value">志工 {task.assignedTo}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="task-actions">
        {canAccept && task.status === 'pending' && (
          <button
            className="btn btn-primary"
            onClick={onAccept}
          >
            接受任務
          </button>
        )}

        {canComplete && task.status === 'assigned' && (
          <button
            className="btn btn-success"
            onClick={onComplete}
          >
            完成任務
          </button>
        )}

        {task.status === 'completed' && (
          <div className="task-completed">
            <span className="icon-check" />
            <span>已完成</span>
          </div>
        )}

        {task.status === 'in_progress' && (
          <div className="task-in-progress">
            <span className="icon-clock" />
            <span>執行中</span>
          </div>
        )}

        <button className="btn btn-outline btn-sm">
          查看詳情
        </button>
      </div>
    </div>
  );
};