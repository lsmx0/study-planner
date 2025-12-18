// 倒计时数据模型
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 倒计时模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Countdown {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub target_time: DateTime<Utc>,
    pub notify_enabled: bool,
    pub created_at: DateTime<Utc>,
}

/// 倒计时响应 (包含剩余时间)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CountdownResponse {
    pub id: i64,
    pub name: String,
    pub target_time: DateTime<Utc>,
    pub notify_enabled: bool,
    pub remaining_days: i64,
    pub remaining_hours: i64,
    pub remaining_minutes: i64,
    pub is_expired: bool,
}

impl Countdown {
    /// 转换为响应，计算剩余时间
    pub fn to_response(&self) -> CountdownResponse {
        let now = Utc::now();
        let duration = self.target_time.signed_duration_since(now);
        
        let is_expired = duration.num_seconds() < 0;
        let total_seconds = duration.num_seconds().abs();
        
        let remaining_days = total_seconds / 86400;
        let remaining_hours = (total_seconds % 86400) / 3600;
        let remaining_minutes = (total_seconds % 3600) / 60;

        CountdownResponse {
            id: self.id,
            name: self.name.clone(),
            target_time: self.target_time,
            notify_enabled: self.notify_enabled,
            remaining_days,
            remaining_hours,
            remaining_minutes,
            is_expired,
        }
    }
}

/// 创建倒计时输入
#[derive(Debug, Clone, Deserialize)]
pub struct CreateCountdownInput {
    pub name: String,
    pub target_time: DateTime<Utc>,
    pub notify_enabled: Option<bool>,
}
