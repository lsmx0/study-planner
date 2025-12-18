// 用户管理服务
use crate::db::get_pool;
use crate::models::{User, UserResponse, CreateUserInput};

/// 获取所有用户
pub async fn get_all_users() -> Result<Vec<UserResponse>, String> {
    let pool = get_pool();
    
    let users: Vec<User> = sqlx::query_as(
        "SELECT id, username, password, display_name, role, created_at, updated_at 
         FROM users ORDER BY created_at DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("查询用户失败: {}", e))?;

    Ok(users.into_iter().map(UserResponse::from).collect())
}

/// 创建用户
pub async fn create_user(input: CreateUserInput) -> Result<UserResponse, String> {
    let pool = get_pool();
    
    // 检查用户名是否已存在
    let exists: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM users WHERE username = ?"
    )
    .bind(&input.username)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("查询失败: {}", e))?;

    if exists.is_some() {
        return Err("用户名已存在".to_string());
    }

    // 创建用户
    let result = sqlx::query(
        "INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)"
    )
    .bind(&input.username)
    .bind(&input.password)
    .bind(&input.display_name)
    .bind(&input.role)
    .execute(pool)
    .await
    .map_err(|e| format!("创建用户失败: {}", e))?;

    let user_id = result.last_insert_id() as i64;

    // 查询新创建的用户
    let user: User = sqlx::query_as(
        "SELECT id, username, password, display_name, role, created_at, updated_at 
         FROM users WHERE id = ?"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("查询用户失败: {}", e))?;

    Ok(UserResponse::from(user))
}

/// 删除用户
pub async fn delete_user(user_id: i64) -> Result<(), String> {
    let pool = get_pool();
    
    // 不允许删除自己
    sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("删除用户失败: {}", e))?;

    Ok(())
}

/// 重置用户密码
pub async fn reset_user_password(user_id: i64, new_password: &str) -> Result<(), String> {
    let pool = get_pool();
    
    sqlx::query("UPDATE users SET password = ? WHERE id = ?")
        .bind(new_password)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("重置密码失败: {}", e))?;

    Ok(())
}
