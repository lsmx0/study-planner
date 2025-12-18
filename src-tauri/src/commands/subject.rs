// 科目命令
use crate::models::{Subject, CreateSubjectInput};
use crate::services::{auth_service, subject_service};

/// 获取科目列表
#[tauri::command]
pub async fn get_subjects(session_token: String) -> Result<Vec<Subject>, String> {
    let user = auth_service::validate_session(&session_token).await?;
    subject_service::get_subjects(user.id).await
}

/// 创建科目
#[tauri::command]
pub async fn create_subject(
    session_token: String,
    name: String,
    color: Option<String>,
) -> Result<Subject, String> {
    let user = auth_service::validate_session(&session_token).await?;
    let input = CreateSubjectInput { name, color };
    subject_service::create_subject(user.id, input).await
}

/// 删除科目
#[tauri::command]
pub async fn delete_subject(session_token: String, subject_id: i64) -> Result<(), String> {
    let user = auth_service::validate_session(&session_token).await?;
    subject_service::delete_subject(user.id, subject_id).await
}
