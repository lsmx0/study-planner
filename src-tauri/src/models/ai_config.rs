// AI 配置数据模型
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// AI 配置模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AIConfig {
    pub id: i64,
    pub user_id: i64,
    pub api_key: String,
    pub model_name: String,
    pub api_endpoint: String,
    pub updated_at: DateTime<Utc>,
}

/// AI 配置响应 (隐藏部分 API Key)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfigResponse {
    pub api_key_masked: String,
    pub model_name: String,
    pub api_endpoint: String,
    pub is_configured: bool,
}

impl From<Option<AIConfig>> for AIConfigResponse {
    fn from(config: Option<AIConfig>) -> Self {
        match config {
            Some(c) => {
                let masked = if c.api_key.len() > 8 {
                    format!("{}****{}", &c.api_key[..4], &c.api_key[c.api_key.len()-4..])
                } else {
                    "****".to_string()
                };
                AIConfigResponse {
                    api_key_masked: masked,
                    model_name: c.model_name,
                    api_endpoint: c.api_endpoint,
                    is_configured: true,
                }
            }
            None => AIConfigResponse {
                api_key_masked: String::new(),
                model_name: "Qwen/Qwen2.5-7B-Instruct".to_string(),
                api_endpoint: "https://api.siliconflow.cn/v1/chat/completions".to_string(),
                is_configured: false,
            }
        }
    }
}

/// 保存 AI 配置输入
#[derive(Debug, Clone, Deserialize)]
pub struct SaveAIConfigInput {
    pub api_key: String,
    pub model_name: Option<String>,
    pub api_endpoint: Option<String>,
}

/// AI 计划生成上下文
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIContext {
    pub exam_date: Option<String>,
    pub subjects: Vec<String>,
    pub incomplete_tasks: Vec<String>,
    pub review_content: Option<String>,
}

/// AI 生成的任务建议
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSuggestion {
    pub start_time: String,
    pub end_time: String,
    pub content: String,
    pub subject: String,
}

/// 聊天消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}
