// 任务服务
use crate::db::get_pool;
use crate::models::{Task, TaskResponse, CreateTaskInput, UpdateTaskInput, Subject};
use crate::utils::fuzzy_match_default;
use chrono::NaiveDate;

/// 获取指定日期的任务
pub async fn get_tasks_by_date(user_id: i64, date: NaiveDate) -> Result<Vec<TaskResponse>, String> {
    let pool = get_pool();
    
    let tasks: Vec<Task> = sqlx::query_as(
        "SELECT t.id, t.user_id, t.subject_id, t.task_date, t.start_time, t.end_time, 
                t.content, t.status, t.alarm_enabled, t.alarm_time, t.created_at, t.updated_at
         FROM tasks t WHERE t.user_id = ? AND t.task_date = ? 
         ORDER BY t.start_time ASC"
    )
    .bind(user_id)
    .bind(date)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("查询任务失败: {}", e))?;

    let mut responses = Vec::new();
    for task in tasks {
        let subject = if let Some(sid) = task.subject_id {
            sqlx::query_as::<_, Subject>(
                "SELECT id, user_id, name, color, is_default, created_at FROM subjects WHERE id = ?"
            )
            .bind(sid)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
        } else {
            None
        };

        responses.push(TaskResponse {
            id: task.id,
            subject_id: task.subject_id,
            subject_name: subject.as_ref().map(|s| s.name.clone()),
            subject_color: subject.as_ref().map(|s| s.color.clone()),
            task_date: task.task_date,
            start_time: task.start_time,
            end_time: task.end_time,
            content: task.content,
            status: task.status.to_string(),
            alarm_enabled: task.alarm_enabled,
            alarm_time: task.alarm_time,
        });
    }

    Ok(responses)
}

/// 创建任务
pub async fn create_task(user_id: i64, input: CreateTaskInput) -> Result<TaskResponse, String> {
    let pool = get_pool();
    
    let result = sqlx::query(
        "INSERT INTO tasks (user_id, subject_id, task_date, start_time, end_time, content, alarm_enabled, alarm_time) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(user_id)
    .bind(input.subject_id)
    .bind(input.task_date)
    .bind(input.start_time)
    .bind(input.end_time)
    .bind(&input.content)
    .bind(input.alarm_enabled.unwrap_or(false))
    .bind(input.alarm_time)
    .execute(pool)
    .await
    .map_err(|e| format!("创建任务失败: {}", e))?;

    let task_id = result.last_insert_id() as i64;
    get_task_by_id(task_id).await
}

/// 根据 ID 获取任务
async fn get_task_by_id(task_id: i64) -> Result<TaskResponse, String> {
    let pool = get_pool();
    
    let task: Task = sqlx::query_as(
        "SELECT id, user_id, subject_id, task_date, start_time, end_time, 
                content, status, alarm_enabled, alarm_time, created_at, updated_at
         FROM tasks WHERE id = ?"
    )
    .bind(task_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("查询任务失败: {}", e))?;

    let subject = if let Some(sid) = task.subject_id {
        sqlx::query_as::<_, Subject>(
            "SELECT id, user_id, name, color, is_default, created_at FROM subjects WHERE id = ?"
        )
        .bind(sid)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
    } else {
        None
    };

    Ok(TaskResponse {
        id: task.id,
        subject_id: task.subject_id,
        subject_name: subject.as_ref().map(|s| s.name.clone()),
        subject_color: subject.as_ref().map(|s| s.color.clone()),
        task_date: task.task_date,
        start_time: task.start_time,
        end_time: task.end_time,
        content: task.content,
        status: task.status.to_string(),
        alarm_enabled: task.alarm_enabled,
        alarm_time: task.alarm_time,
    })
}

/// 更新任务
pub async fn update_task(user_id: i64, task_id: i64, input: UpdateTaskInput) -> Result<TaskResponse, String> {
    let pool = get_pool();
    
    // 构建动态更新语句
    let mut updates = Vec::new();
    if input.subject_id.is_some() {
        updates.push("subject_id = ?");
    }
    if input.start_time.is_some() {
        updates.push("start_time = ?");
    }
    if input.end_time.is_some() {
        updates.push("end_time = ?");
    }
    if input.content.is_some() {
        updates.push("content = ?");
    }
    if input.alarm_enabled.is_some() {
        updates.push("alarm_enabled = ?");
    }
    if input.alarm_time.is_some() {
        updates.push("alarm_time = ?");
    }

    if updates.is_empty() {
        return get_task_by_id(task_id).await;
    }

    let sql = format!(
        "UPDATE tasks SET {} WHERE id = ? AND user_id = ?",
        updates.join(", ")
    );

    let mut query = sqlx::query(&sql);
    
    if let Some(v) = input.subject_id {
        query = query.bind(v);
    }
    if let Some(v) = input.start_time {
        query = query.bind(v);
    }
    if let Some(v) = input.end_time {
        query = query.bind(v);
    }
    if let Some(v) = &input.content {
        query = query.bind(v);
    }
    if let Some(v) = input.alarm_enabled {
        query = query.bind(v);
    }
    if let Some(v) = input.alarm_time {
        query = query.bind(v);
    }
    
    query = query.bind(task_id).bind(user_id);
    
    query.execute(pool).await.map_err(|e| format!("更新任务失败: {}", e))?;

    get_task_by_id(task_id).await
}

/// 删除任务
pub async fn delete_task(user_id: i64, task_id: i64) -> Result<(), String> {
    let pool = get_pool();
    
    sqlx::query("DELETE FROM tasks WHERE id = ? AND user_id = ?")
        .bind(task_id)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("删除任务失败: {}", e))?;

    Ok(())
}

/// 切换任务状态
pub async fn toggle_task_status(user_id: i64, task_id: i64) -> Result<TaskResponse, String> {
    let pool = get_pool();
    
    // 获取当前状态
    let task: Task = sqlx::query_as(
        "SELECT id, user_id, subject_id, task_date, start_time, end_time, 
                content, status, alarm_enabled, alarm_time, created_at, updated_at
         FROM tasks WHERE id = ? AND user_id = ?"
    )
    .bind(task_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("查询任务失败: {}", e))?;

    // 切换状态
    let new_status = task.status.next();
    
    sqlx::query("UPDATE tasks SET status = ? WHERE id = ?")
        .bind(new_status.to_string())
        .bind(task_id)
        .execute(pool)
        .await
        .map_err(|e| format!("更新状态失败: {}", e))?;

    get_task_by_id(task_id).await
}

/// 内容检查 - 模糊匹配
pub async fn check_content(user_id: i64, date: NaiveDate, content: &str) -> Result<Vec<TaskResponse>, String> {
    let tasks = get_tasks_by_date(user_id, date).await?;
    let pool = get_pool();
    
    let mut matched_tasks = Vec::new();
    
    for task in tasks {
        if task.status == "pending" && fuzzy_match_default(content, &task.content) {
            // 自动标记为完成
            sqlx::query("UPDATE tasks SET status = 'completed' WHERE id = ?")
                .bind(task.id)
                .execute(pool)
                .await
                .map_err(|e| format!("更新状态失败: {}", e))?;
            
            let mut updated_task = task;
            updated_task.status = "completed".to_string();
            matched_tasks.push(updated_task);
        }
    }
    
    Ok(matched_tasks)
}
