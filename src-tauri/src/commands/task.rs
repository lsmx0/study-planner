// 任务命令
use crate::models::{TaskResponse, CreateTaskInput, UpdateTaskInput};
use crate::services::{auth_service, task_service};
use chrono::{NaiveDate, NaiveTime};

/// 获取指定日期的任务
#[tauri::command]
pub async fn get_tasks_by_date(session_token: String, date: NaiveDate) -> Result<Vec<TaskResponse>, String> {
    let user = auth_service::validate_session(&session_token).await?;
    task_service::get_tasks_by_date(user.id, date).await
}

/// 创建任务
#[tauri::command]
pub async fn create_task(
    session_token: String,
    subject_id: Option<i64>,
    task_date: NaiveDate,
    start_time: NaiveTime,
    end_time: NaiveTime,
    content: String,
    alarm_enabled: Option<bool>,
    alarm_time: Option<NaiveTime>,
) -> Result<TaskResponse, String> {
    let user = auth_service::validate_session(&session_token).await?;
    let input = CreateTaskInput {
        subject_id,
        task_date,
        start_time,
        end_time,
        content,
        alarm_enabled,
        alarm_time,
    };
    task_service::create_task(user.id, input).await
}

/// 更新任务
#[tauri::command]
pub async fn update_task(
    session_token: String,
    task_id: i64,
    subject_id: Option<i64>,
    start_time: Option<NaiveTime>,
    end_time: Option<NaiveTime>,
    content: Option<String>,
    alarm_enabled: Option<bool>,
    alarm_time: Option<NaiveTime>,
) -> Result<TaskResponse, String> {
    let user = auth_service::validate_session(&session_token).await?;
    let input = UpdateTaskInput {
        subject_id,
        start_time,
        end_time,
        content,
        alarm_enabled,
        alarm_time,
    };
    task_service::update_task(user.id, task_id, input).await
}

/// 删除任务
#[tauri::command]
pub async fn delete_task(session_token: String, task_id: i64) -> Result<(), String> {
    let user = auth_service::validate_session(&session_token).await?;
    task_service::delete_task(user.id, task_id).await
}

/// 切换任务状态
#[tauri::command]
pub async fn toggle_task_status(session_token: String, task_id: i64) -> Result<TaskResponse, String> {
    let user = auth_service::validate_session(&session_token).await?;
    task_service::toggle_task_status(user.id, task_id).await
}

/// 内容检查 - 模糊匹配
#[tauri::command]
pub async fn check_content(
    session_token: String,
    date: NaiveDate,
    content: String,
) -> Result<Vec<TaskResponse>, String> {
    let user = auth_service::validate_session(&session_token).await?;
    task_service::check_content(user.id, date, &content).await
}
