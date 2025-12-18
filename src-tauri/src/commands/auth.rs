// 认证命令
use crate::models::{LoginResponse, UserResponse};
use crate::services::auth_service;
use std::sync::Mutex;

/// 当前会话状态
pub struct SessionState {
    pub session_token: Mutex<Option<String>>,
}

impl Default for SessionState {
    fn default() -> Self {
        Self {
            session_token: Mutex::new(None),
        }
    }
}

/// 登录命令
#[tauri::command]
pub async fn login(username: String, password: String) -> Result<LoginResponse, String> {
    auth_service::login(&username, &password).await
}

/// 退出登录命令
#[tauri::command]
pub async fn logout(session_token: String) -> Result<(), String> {
    auth_service::logout(&session_token).await
}

/// 修改密码命令
#[tauri::command]
pub async fn change_password(
    session_token: String,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    // 验证会话
    let user = auth_service::validate_session(&session_token).await?;
    
    // 修改密码
    auth_service::change_password(user.id, &current_password, &new_password).await
}

/// 获取当前用户信息
#[tauri::command]
pub async fn get_current_user(session_token: String) -> Result<UserResponse, String> {
    let user = auth_service::validate_session(&session_token).await?;
    Ok(UserResponse::from(user))
}

/// 修改昵称命令
#[tauri::command]
pub async fn change_display_name(
    session_token: String,
    new_display_name: String,
) -> Result<UserResponse, String> {
    // 验证会话
    let user = auth_service::validate_session(&session_token).await?;
    
    // 修改昵称
    let updated_user = auth_service::change_display_name(user.id, &new_display_name).await?;
    Ok(UserResponse::from(updated_user))
}
