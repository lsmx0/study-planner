// 科目数据模型
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 科目模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Subject {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub color: String,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
}

/// 创建科目输入
#[derive(Debug, Clone, Deserialize)]
pub struct CreateSubjectInput {
    pub name: String,
    pub color: Option<String>,
}
