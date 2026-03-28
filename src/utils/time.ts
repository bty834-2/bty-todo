export function formatReminderTime(isoTime: string | null): string {
  if (!isoTime) return '';

  const reminder = new Date(isoTime);
  const now = new Date();
  const diffMs = reminder.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    return '已过期';
  }

  if (diffMins < 60) {
    if (diffMins < 1) return '即将到期';
    return `${diffMins}分钟后`;
  }

  if (diffHours < 24) {
    if (diffHours === 1) return '1小时后';
    return `${diffHours}小时后`;
  }

  if (diffDays === 0) {
    return `今天 ${reminder.getHours().toString().padStart(2, '0')}:${reminder.getMinutes().toString().padStart(2, '0')}`;
  }

  if (diffDays === 1) {
    return `明天 ${reminder.getHours().toString().padStart(2, '0')}:${reminder.getMinutes().toString().padStart(2, '0')}`;
  }

  if (diffDays < 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dayName = weekdays[reminder.getDay()];
    return `${dayName} ${reminder.getHours().toString().padStart(2, '0')}:${reminder.getMinutes().toString().padStart(2, '0')}`;
  }

  return `${reminder.getMonth() + 1}/${reminder.getDate()} ${reminder.getHours().toString().padStart(2, '0')}:${reminder.getMinutes().toString().padStart(2, '0')}`;
}

export function formatDateTime(isoTime: string): string {
  const date = new Date(isoTime);
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}
