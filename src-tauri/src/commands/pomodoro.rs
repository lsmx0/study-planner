// 番茄钟命令
use crate::models::{PomodoroResponse, StartPomodoroInput};
use crate::services::{auth_service, pomodoro_service};

/// 开始番茄钟
#[tauri::command]
pub async fn start_pomodoro(
    session_token: String,
    subject_id: Option<i64>,
    task_id: Option<i64>,
) -> Result<PomodoroResponse, String> {
    let user = auth_service::validate_session(&session_token).await?;
    let input = StartPomodoroInput { subject_id, task_id };
    pomodoro_service::start_pomodoro(user.id, input).await
}

/// 完成番茄钟
#[tauri::command]
pub async fn complete_pomodoro(
    session_token: String,
    pomodoro_id: i64,
    duration_minutes: i32,
) -> Result<(), String> {
    let user = auth_service::validate_session(&session_token).await?;
    pomodoro_service::complete_pomodoro(user.id, pomodoro_id, duration_minutes).await
}

/// 取消番茄钟
#[tauri::command]
pub async fn cancel_pomodoro(
    session_token: String,
    pomodoro_id: i64,
    duration_minutes: i32,
) -> Result<(), String> {
    let user = auth_service::validate_session(&session_token).await?;
    pomodoro_service::cancel_pomodoro(user.id, pomodoro_id, duration_minutes).await
}

/// 获取番茄钟历史
#[tauri::command]
pub async fn get_pomodoro_history(
    session_token: String,
    limit: Option<i32>,
) -> Result<Vec<PomodoroResponse>, String> {
    let user = auth_service::validate_session(&session_token).await?;
    pomodoro_service::get_pomodoro_history(user.id, limit.unwrap_or(50)).await
}
