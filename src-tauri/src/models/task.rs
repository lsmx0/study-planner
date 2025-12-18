// 任务数据模型
use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 任务状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Pending,
    Completed,
    Failed,
}

impl From<String> for TaskStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "completed" => TaskStatus::Completed,
            "failed" => TaskStatus::Failed,
            _ => TaskStatus::Pending,
        }
    }
}

impl std::fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaskStatus::Pending => write!(f, "pending"),
            TaskStatus::Completed => write!(f, "completed"),
            TaskStatus::Failed => write!(f, "failed"),
        }
    }
}

impl TaskStatus {
    /// 切换到下一个状态
    pub fn next(&self) -> Self {
        match self {
            TaskStatus::Pending => TaskStatus::Completed,
            TaskStatus::Completed => TaskStatus::Failed,
            TaskStatus::Failed => TaskStatus::Pending,
        }
    }
}

/// 任务模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id: i64,
    pub user_id: i64,
    pub subject_id: Option<i64>,
    pub task_date: NaiveDate,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
    pub content: String,
    #[sqlx(try_from = "String")]
    pub status: TaskStatus,
    pub alarm_enabled: bool,
    pub alarm_time: Option<NaiveTime>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 任务响应 (包含科目信息)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResponse {
    pub id: i64,
    pub subject_id: Option<i64>,
    pub subject_name: Option<String>,
    pub subject_color: Option<String>,
    pub task_date: NaiveDate,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
    pub content: String,
    pub status: String,
    pub alarm_enabled: bool,
    pub alarm_time: Option<NaiveTime>,
}

/// 创建任务输入
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTaskInput {
    pub subject_id: Option<i64>,
    pub task_date: NaiveDate,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
    pub content: String,
    pub alarm_enabled: Option<bool>,
    pub alarm_time: Option<NaiveTime>,
}

/// 更新任务输入
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateTaskInput {
    pub subject_id: Option<i64>,
    pub start_time: Option<NaiveTime>,
    pub end_time: Option<NaiveTime>,
    pub content: Option<String>,
    pub alarm_enabled: Option<bool>,
    pub alarm_time: Option<NaiveTime>,
}
