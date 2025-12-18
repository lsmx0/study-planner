// 学习偏好命令
use crate::models::{StudyPreferenceResponse, SaveStudyPreferenceInput};
use crate::services::{auth_service, preference_service};

/// 获取学习偏好
#[tauri::command]
pub async fn get_study_preference(session_token: String) -> Result<StudyPreferenceResponse, String> {
    let user = auth_service::validate_session(&session_token).await?;
    preference_service::get_study_preference(user.id).await
}

/// 保存学习偏好
#[tauri::command]
pub async fn save_study_preference(
    session_token: String,
    input: SaveStudyPreferenceInput,
) -> Result<StudyPreferenceResponse, String> {
    let user = auth_service::validate_session(&session_token).await?;
    preference_service::save_study_preference(user.id, input).await
}
