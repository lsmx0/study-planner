// 管理员命令
use crate::models::{UserResponse, CreateUserInput, UserRole};
use crate::services::{auth_service, user_service};

/// 获取所有用户 (仅管理员)
#[tauri::command]
pub async fn get_all_users(session_token: String) -> Result<Vec<UserResponse>, String> {
    // 验证管理员权限
    let user = auth_service::validate_session(&session_token).await?;
    if user.role != UserRole::Admin {
        return Err("权限不足".to_string());
    }
    
    user_service::get_all_users().await
}

/// 创建用户 (仅管理员)
#[tauri::command]
pub async fn create_user(
    session_token: String,
    username: String,
    password: String,
    display_name: String,
    role: String,
) -> Result<UserResponse, String> {
    // 验证管理员权限
    let user = auth_service::validate_session(&session_token).await?;
    if user.role != UserRole::Admin {
        return Err("权限不足".to_string());
    }
    
    let input = CreateUserInput {
        username,
        password,
        display_name,
        role,
    };
    
    user_service::create_user(input).await
}

/// 删除用户 (仅管理员)
#[tauri::command]
pub async fn delete_user(session_token: String, user_id: i64) -> Result<(), String> {
    // 验证管理员权限
    let user = auth_service::validate_session(&session_token).await?;
    if user.role != UserRole::Admin {
        return Err("权限不足".to_string());
    }
    
    // 不能删除自己
    if user.id == user_id {
        return Err("不能删除自己".to_string());
    }
    
    user_service::delete_user(user_id).await
}

/// 重置用户密码 (仅管理员)
#[tauri::command]
pub async fn reset_user_password(
    session_token: String,
    user_id: i64,
    new_password: String,
) -> Result<(), String> {
    // 验证管理员权限
    let user = auth_service::validate_session(&session_token).await?;
    if user.role != UserRole::Admin {
        return Err("权限不足".to_string());
    }
    
    user_service::reset_user_password(user_id, &new_password).await
}
