// 认证服务
use crate::db::get_pool;
use crate::models::{User, UserSession, LoginResponse, UserResponse};
use chrono::{Duration, Utc};
use uuid::Uuid;

/// 验证用户登录
pub async fn login(username: &str, password: &str) -> Result<LoginResponse, String> {
    let pool = get_pool();
    
    // 查询用户
    let user: Option<User> = sqlx::query_as(
        "SELECT id, username, password, display_name, role, created_at, updated_at 
         FROM users WHERE username = ?"
    )
    .bind(username)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("数据库查询失败: {}", e))?;

    let user = user.ok_or("用户名或密码错误")?;

    // 验证密码 (明文比对)
    if user.password != password {
        return Err("用户名或密码错误".to_string());
    }

    // 创建会话
    let session_token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + Duration::days(7);

    sqlx::query(
        "INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)"
    )
    .bind(user.id)
    .bind(&session_token)
    .bind(expires_at)
    .execute(pool)
    .await
    .map_err(|e| format!("创建会话失败: {}", e))?;

    Ok(LoginResponse {
        user: UserResponse::from(user),
        session_token,
    })
}

/// 验证会话令牌
pub async fn validate_session(session_token: &str) -> Result<User, String> {
    let pool = get_pool();
    
    // 查询会话
    let session: Option<UserSession> = sqlx::query_as(
        "SELECT id, user_id, session_token, expires_at, created_at 
         FROM user_sessions WHERE session_token = ? AND expires_at > NOW()"
    )
    .bind(session_token)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("数据库查询失败: {}", e))?;

    let session = session.ok_or("会话无效或已过期")?;

    // 查询用户
    let user: User = sqlx::query_as(
        "SELECT id, username, password, display_name, role, created_at, updated_at 
         FROM users WHERE id = ?"
    )
    .bind(session.user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("用户不存在: {}", e))?;

    Ok(user)
}

/// 退出登录
pub async fn logout(session_token: &str) -> Result<(), String> {
    let pool = get_pool();
    
    sqlx::query("DELETE FROM user_sessions WHERE session_token = ?")
        .bind(session_token)
        .execute(pool)
        .await
        .map_err(|e| format!("退出登录失败: {}", e))?;

    Ok(())
}

/// 修改密码
pub async fn change_password(user_id: i64, current_password: &str, new_password: &str) -> Result<(), String> {
    let pool = get_pool();
    
    // 验证当前密码
    let user: User = sqlx::query_as(
        "SELECT id, username, password, display_name, role, created_at, updated_at 
         FROM users WHERE id = ?"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("用户不存在: {}", e))?;

    if user.password != current_password {
        return Err("当前密码错误".to_string());
    }

    // 更新密码
    sqlx::query("UPDATE users SET password = ? WHERE id = ?")
        .bind(new_password)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("修改密码失败: {}", e))?;

    Ok(())
}

/// 修改昵称
pub async fn change_display_name(user_id: i64, new_display_name: &str) -> Result<User, String> {
    let pool = get_pool();
    
    // 验证昵称不为空
    let display_name = new_display_name.trim();
    if display_name.is_empty() {
        return Err("昵称不能为空".to_string());
    }
    
    if display_name.len() > 50 {
        return Err("昵称长度不能超过50个字符".to_string());
    }

    // 更新昵称
    sqlx::query("UPDATE users SET display_name = ? WHERE id = ?")
        .bind(display_name)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("修改昵称失败: {}", e))?;

    // 返回更新后的用户信息
    let user: User = sqlx::query_as(
        "SELECT id, username, password, display_name, role, created_at, updated_at 
         FROM users WHERE id = ?"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("获取用户信息失败: {}", e))?;

    Ok(user)
}
