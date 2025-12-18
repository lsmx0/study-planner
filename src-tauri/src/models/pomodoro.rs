// 番茄钟数据模型
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 番茄钟状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PomodoroStatus {
    Running,
    Completed,
    Cancelled,
}

impl From<String> for PomodoroStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "completed" => PomodoroStatus::Completed,
            "cancelled" => PomodoroStatus::Cancelled,
            _ => PomodoroStatus::Running,
        }
    }
}

impl std::fmt::Display for PomodoroStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PomodoroStatus::Running => write!(f, "running"),
            PomodoroStatus::Completed => write!(f, "completed"),
            PomodoroStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

/// 番茄钟会话模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PomodoroSession {
    pub id: i64,
    pub user_id: i64,
    pub subject_id: Option<i64>,
    pub task_id: Option<i64>,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub duration_minutes: i32,
    #[sqlx(try_from = "String")]
    pub status: PomodoroStatus,
}

/// 番茄钟响应 (包含科目信息)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroResponse {
    pub id: i64,
    pub subject_id: Option<i64>,
    pub subject_name: Option<String>,
    pub task_id: Option<i64>,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub duration_minutes: i32,
    pub status: String,
}

/// 开始番茄钟输入
#[derive(Debug, Clone, Deserialize)]
pub struct StartPomodoroInput {
    pub subject_id: Option<i64>,
    pub task_id: Option<i64>,
}
