// 每日复盘数据模型
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 每日复盘模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DailyReview {
    pub id: i64,
    pub user_id: i64,
    pub review_date: NaiveDate,
    pub feelings: Option<String>,
    pub difficulties: Option<String>,
    pub ai_suggestions: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// 保存复盘输入
#[derive(Debug, Clone, Deserialize)]
pub struct SaveReviewInput {
    pub review_date: NaiveDate,
    pub feelings: Option<String>,
    pub difficulties: Option<String>,
}
