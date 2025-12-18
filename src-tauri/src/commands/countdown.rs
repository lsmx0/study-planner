// 倒计时命令
use crate::models::{CountdownResponse, CreateCountdownInput};
use crate::services::{auth_service, countdown_service};
use chrono::{DateTime, Utc};

/// 获取倒计时列表
#[tauri::command]
pub async fn get_countdowns(session_token: String) -> Result<Vec<CountdownResponse>, String> {
    let user = auth_service::validate_session(&session_token).await?;
    countdown_service::get_countdowns(user.id).await
}

/// 创建倒计时
#[tauri::command]
pub async fn create_countdown(
    session_token: String,
    name: String,
    target_time: DateTime<Utc>,
    notify_enabled: Option<bool>,
) -> Result<CountdownResponse, String> {
    let user = auth_service::validate_session(&session_token).await?;
    let input = CreateCountdownInput {
        name,
        target_time,
        notify_enabled,
    };
    countdown_service::create_countdown(user.id, input).await
}

/// 删除倒计时
#[tauri::command]
pub async fn delete_countdown(session_token: String, countdown_id: i64) -> Result<(), String> {
    let user = auth_service::validate_session(&session_token).await?;
    countdown_service::delete_countdown(user.id, countdown_id).await
}
