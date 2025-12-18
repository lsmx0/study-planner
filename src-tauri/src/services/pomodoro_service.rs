use crate::db::get_pool;
use crate::models::{PomodoroSession, PomodoroResponse, StartPomodoroInput, Subject};
// 番茄钟服务

/// 开始番茄钟
pub async fn start_pomodoro(user_id: i64, input: StartPomodoroInput) -> Result<PomodoroResponse, String> {
    let pool = get_pool();
    
    let result = sqlx::query(
        "INSERT INTO pomodoro_sessions (user_id, subject_id, task_id, start_time, status) 
         VALUES (?, ?, ?, NOW(), 'running')"
    )
    .bind(user_id)
    .bind(input.subject_id)
    .bind(input.task_id)
    .execute(pool)
    .await
    .map_err(|e| format!("创建番茄钟失败: {}", e))?;

    let pomodoro_id = result.last_insert_id() as i64;
    get_pomodoro_by_id(pomodoro_id).await
}

/// 根据 ID 获取番茄钟
async fn get_pomodoro_by_id(pomodoro_id: i64) -> Result<PomodoroResponse, String> {
    let pool = get_pool();
    
    let session: PomodoroSession = sqlx::query_as(
        "SELECT id, user_id, subject_id, task_id, start_time, end_time, duration_minutes, status 
         FROM pomodoro_sessions WHERE id = ?"
    )
    .bind(pomodoro_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("查询番茄钟失败: {}", e))?;

    let subject_name = if let Some(sid) = session.subject_id {
        sqlx::query_as::<_, Subject>(
            "SELECT id, user_id, name, color, is_default, created_at FROM subjects WHERE id = ?"
        )
        .bind(sid)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .map(|s| s.name)
    } else {
        None
    };

    Ok(PomodoroResponse {
        id: session.id,
        subject_id: session.subject_id,
        subject_name,
        task_id: session.task_id,
        start_time: session.start_time,
        end_time: session.end_time,
        duration_minutes: session.duration_minutes,
        status: session.status.to_string(),
    })
}

/// 完成番茄钟
pub async fn complete_pomodoro(user_id: i64, pomodoro_id: i64, duration_minutes: i32) -> Result<(), String> {
    let pool = get_pool();
    
    sqlx::query(
        "UPDATE pomodoro_sessions SET status = 'completed', end_time = NOW(), duration_minutes = ? 
         WHERE id = ? AND user_id = ?"
    )
    .bind(duration_minutes)
    .bind(pomodoro_id)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| format!("完成番茄钟失败: {}", e))?;

    Ok(())
}

/// 取消番茄钟
pub async fn cancel_pomodoro(user_id: i64, pomodoro_id: i64, duration_minutes: i32) -> Result<(), String> {
    let pool = get_pool();
    
    sqlx::query(
        "UPDATE pomodoro_sessions SET status = 'cancelled', end_time = NOW(), duration_minutes = ? 
         WHERE id = ? AND user_id = ?"
    )
    .bind(duration_minutes)
    .bind(pomodoro_id)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| format!("取消番茄钟失败: {}", e))?;

    Ok(())
}

/// 获取番茄钟历史
pub async fn get_pomodoro_history(user_id: i64, limit: i32) -> Result<Vec<PomodoroResponse>, String> {
    let pool = get_pool();
    
    let sessions: Vec<PomodoroSession> = sqlx::query_as(
        "SELECT id, user_id, subject_id, task_id, start_time, end_time, duration_minutes, status 
         FROM pomodoro_sessions WHERE user_id = ? ORDER BY start_time DESC LIMIT ?"
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("查询番茄钟历史失败: {}", e))?;

    let mut responses = Vec::new();
    for session in sessions {
        let subject_name = if let Some(sid) = session.subject_id {
            sqlx::query_as::<_, Subject>(
                "SELECT id, user_id, name, color, is_default, created_at FROM subjects WHERE id = ?"
            )
            .bind(sid)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
            .map(|s| s.name)
        } else {
            None
        };

        responses.push(PomodoroResponse {
            id: session.id,
            subject_id: session.subject_id,
            subject_name,
            task_id: session.task_id,
            start_time: session.start_time,
            end_time: session.end_time,
            duration_minutes: session.duration_minutes,
            status: session.status.to_string(),
        });
    }

    Ok(responses)
}
