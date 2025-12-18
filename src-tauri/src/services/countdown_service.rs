// 倒计时服务
use crate::db::get_pool;
use crate::models::{Countdown, CountdownResponse, CreateCountdownInput};

/// 获取用户的所有倒计时
pub async fn get_countdowns(user_id: i64) -> Result<Vec<CountdownResponse>, String> {
    let pool = get_pool();
    
    let countdowns: Vec<Countdown> = sqlx::query_as(
        "SELECT id, user_id, name, target_time, notify_enabled, created_at 
         FROM countdowns WHERE user_id = ? ORDER BY target_time ASC"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("查询倒计时失败: {}", e))?;

    Ok(countdowns.into_iter().map(|c| c.to_response()).collect())
}

/// 创建倒计时
pub async fn create_countdown(user_id: i64, input: CreateCountdownInput) -> Result<CountdownResponse, String> {
    let pool = get_pool();
    let notify_enabled = input.notify_enabled.unwrap_or(true);
    
    let result = sqlx::query(
        "INSERT INTO countdowns (user_id, name, target_time, notify_enabled) VALUES (?, ?, ?, ?)"
    )
    .bind(user_id)
    .bind(&input.name)
    .bind(input.target_time)
    .bind(notify_enabled)
    .execute(pool)
    .await
    .map_err(|e| format!("创建倒计时失败: {}", e))?;

    let countdown_id = result.last_insert_id() as i64;

    let countdown: Countdown = sqlx::query_as(
        "SELECT id, user_id, name, target_time, notify_enabled, created_at FROM countdowns WHERE id = ?"
    )
    .bind(countdown_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("查询倒计时失败: {}", e))?;

    Ok(countdown.to_response())
}

/// 删除倒计时
pub async fn delete_countdown(user_id: i64, countdown_id: i64) -> Result<(), String> {
    let pool = get_pool();
    
    sqlx::query("DELETE FROM countdowns WHERE id = ? AND user_id = ?")
        .bind(countdown_id)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("删除倒计时失败: {}", e))?;

    Ok(())
}
