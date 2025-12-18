// AI 命令
use crate::models::{AIConfigResponse, SaveAIConfigInput, AIContext, TaskSuggestion};
use crate::services::{auth_service, ai_service};

/// 获取 AI 配置
#[tauri::command]
pub async fn get_ai_config(session_token: String) -> Result<AIConfigResponse, String> {
    let user = auth_service::validate_session(&session_token).await?;
    ai_service::get_ai_config(user.id).await
}

/// 保存 AI 配置
#[tauri::command]
pub async fn save_ai_config(
    session_token: String,
    api_key: String,
    model_name: Option<String>,
    api_endpoint: Option<String>,
) -> Result<AIConfigResponse, String> {
    let user = auth_service::validate_session(&session_token).await?;
    let input = SaveAIConfigInput {
        api_key,
        model_name,
        api_endpoint,
    };
    ai_service::save_ai_config(user.id, input).await
}

/// 测试 AI 连接
#[tauri::command]
pub async fn test_ai_connection(session_token: String) -> Result<bool, String> {
    let user = auth_service::validate_session(&session_token).await?;
    ai_service::test_ai_connection(user.id).await
}

/// 生成 AI 计划
#[tauri::command]
pub async fn generate_ai_plan(
    session_token: String,
    context: AIContext,
) -> Result<Vec<TaskSuggestion>, String> {
    let user = auth_service::validate_session(&session_token).await?;
    ai_service::generate_ai_plan(user.id, context).await
}

/// AI 聊天答疑
#[tauri::command]
pub async fn ai_chat(
    session_token: String,
    message: String,
    history: Vec<crate::models::ChatMessage>,
) -> Result<String, String> {
    let user = auth_service::validate_session(&session_token).await?;
    ai_service::ai_chat(user.id, message, history).await
}
