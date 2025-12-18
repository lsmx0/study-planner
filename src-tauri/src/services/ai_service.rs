// AI 服务
use crate::db::get_pool;
use crate::models::{AIConfig, AIConfigResponse, SaveAIConfigInput, AIContext, TaskSuggestion, StudyPreference};
use reqwest::Client;
use serde::Deserialize;

/// 获取 AI 配置
pub async fn get_ai_config(user_id: i64) -> Result<AIConfigResponse, String> {
    let pool = get_pool();
    
    let config: Option<AIConfig> = sqlx::query_as(
        "SELECT id, user_id, api_key, model_name, api_endpoint, updated_at 
         FROM ai_configs WHERE user_id = ?"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("查询 AI 配置失败: {}", e))?;

    Ok(AIConfigResponse::from(config))
}

/// 保存 AI 配置
pub async fn save_ai_config(user_id: i64, input: SaveAIConfigInput) -> Result<AIConfigResponse, String> {
    let pool = get_pool();
    
    let model_name = input.model_name.unwrap_or_else(|| "Qwen/Qwen2.5-7B-Instruct".to_string());
    let api_endpoint = input.api_endpoint.unwrap_or_else(|| "https://api.siliconflow.cn/v1/chat/completions".to_string());
    
    // 检查是否已存在
    let existing: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM ai_configs WHERE user_id = ?"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("查询失败: {}", e))?;

    if existing.is_some() {
        // 更新
        sqlx::query(
            "UPDATE ai_configs SET api_key = ?, model_name = ?, api_endpoint = ? WHERE user_id = ?"
        )
        .bind(&input.api_key)
        .bind(&model_name)
        .bind(&api_endpoint)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("更新 AI 配置失败: {}", e))?;
    } else {
        // 创建
        sqlx::query(
            "INSERT INTO ai_configs (user_id, api_key, model_name, api_endpoint) VALUES (?, ?, ?, ?)"
        )
        .bind(user_id)
        .bind(&input.api_key)
        .bind(&model_name)
        .bind(&api_endpoint)
        .execute(pool)
        .await
        .map_err(|e| format!("创建 AI 配置失败: {}", e))?;
    }

    get_ai_config(user_id).await
}

/// 测试 AI 连接
pub async fn test_ai_connection(user_id: i64) -> Result<bool, String> {
    let pool = get_pool();
    
    let config: AIConfig = sqlx::query_as(
        "SELECT id, user_id, api_key, model_name, api_endpoint, updated_at 
         FROM ai_configs WHERE user_id = ?"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|_| "请先配置 AI API".to_string())?;

    let client = Client::new();
    
    let request_body = serde_json::json!({
        "model": config.model_name,
        "messages": [{"role": "user", "content": "你好"}],
        "max_tokens": 10
    });

    let response = client
        .post(&config.api_endpoint)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if response.status().is_success() {
        Ok(true)
    } else {
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("API 返回错误: {}", error_text))
    }
}

/// AI 响应结构
#[derive(Debug, Deserialize)]
struct AIResponse {
    choices: Vec<AIChoice>,
}

#[derive(Debug, Deserialize)]
struct AIChoice {
    message: AIMessage,
}

#[derive(Debug, Deserialize)]
struct AIMessage {
    content: String,
}

/// 获取最近的复盘内容
async fn get_recent_reviews(user_id: i64, days: i32) -> Vec<String> {
    let pool = get_pool();
    
    let reviews: Vec<(String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT DATE_FORMAT(review_date, '%Y-%m-%d'), feelings, difficulties 
         FROM daily_reviews WHERE user_id = ? 
         ORDER BY review_date DESC LIMIT ?"
    )
    .bind(user_id)
    .bind(days)
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    
    reviews.into_iter().map(|(date, feelings, difficulties)| {
        let mut s = format!("{}:", date);
        if let Some(f) = feelings {
            s.push_str(&format!(" 感受-{}", f));
        }
        if let Some(d) = difficulties {
            s.push_str(&format!(" 困难-{}", d));
        }
        s
    }).collect()
}

/// 获取最近完成的任务
async fn get_recent_completed_tasks(user_id: i64, days: i32) -> Vec<String> {
    let pool = get_pool();
    
    let tasks: Vec<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT DATE_FORMAT(task_date, '%Y-%m-%d'), content, 
         (SELECT name FROM subjects WHERE id = tasks.subject_id) as subject_name
         FROM tasks WHERE user_id = ? AND status = 'completed'
         AND task_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         ORDER BY task_date DESC LIMIT 20"
    )
    .bind(user_id)
    .bind(days)
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    
    tasks.into_iter().map(|(date, content, subject)| {
        format!("{}: [{}] {}", date, subject.unwrap_or_default(), content)
    }).collect()
}

/// 生成 AI 计划
pub async fn generate_ai_plan(user_id: i64, context: AIContext) -> Result<Vec<TaskSuggestion>, String> {
    let pool = get_pool();
    
    let config: AIConfig = sqlx::query_as(
        "SELECT id, user_id, api_key, model_name, api_endpoint, updated_at 
         FROM ai_configs WHERE user_id = ?"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|_| "请先配置 AI API".to_string())?;

    // 获取学习偏好
    let preference: Option<StudyPreference> = sqlx::query_as(
        "SELECT * FROM study_preferences WHERE user_id = ?"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    
    // 获取最近的复盘和完成任务
    let recent_reviews = get_recent_reviews(user_id, 3).await;
    let recent_tasks = get_recent_completed_tasks(user_id, 7).await;

    // 构建更智能的提示词
    let mut prompt = String::from(r#"你是一个专业的考研学习规划助手。请根据用户的学习偏好、历史学习情况和复盘反馈，生成一份科学合理、个性化的全天学习计划。

## 考研复习阶段说明：
- 基础阶段(3-6月)：重点打牢基础，系统学习各科目知识点，数学重视概念理解和基础题型
- 强化阶段(7-10月)：强化训练，大量做题，总结题型和方法，英语重点阅读和写作
- 冲刺阶段(11-12月)：查漏补缺，模拟考试，政治背诵，真题演练

## 规划原则：
1. 根据用户设定的学习时间安排任务
2. 不同科目交替学习，避免长时间学习同一科目导致疲劳
3. 上午安排需要高度集中注意力的科目（如数学、专业课）
4. 下午可安排英语阅读、政治等
5. 晚上适合复习巩固和做题
6. 每个学习时段1-2小时，中间安排10-15分钟休息
7. 重点科目和薄弱科目要多安排时间
8. 参考用户最近的学习进度和复盘反馈调整计划
9. 任务内容要具体，如"复习高数第X章极限与连续"、"背诵英语单词200个"、"做政治选择题50道"

## 用户学习偏好：
"#);
    
    // 添加学习偏好信息
    if let Some(ref pref) = preference {
        prompt.push_str(&format!("每日学习时长: {}小时\n", pref.daily_hours));
        prompt.push_str(&format!("学习时间: {} - {}\n", pref.start_time.format("%H:%M"), pref.end_time.format("%H:%M")));
        prompt.push_str(&format!("午休时间: {} - {}\n", pref.lunch_break_start.format("%H:%M"), pref.lunch_break_end.format("%H:%M")));
        
        let phase_desc = match pref.study_phase.as_str() {
            "strengthen" => "强化阶段 - 重点做题和总结方法",
            "sprint" => "冲刺阶段 - 查漏补缺和模拟考试",
            _ => "基础阶段 - 重点打牢基础知识",
        };
        prompt.push_str(&format!("当前阶段: {}\n", phase_desc));
        
        if let Some(ref focus) = pref.focus_subjects {
            if let Ok(subjects) = serde_json::from_str::<Vec<String>>(focus) {
                if !subjects.is_empty() {
                    prompt.push_str(&format!("重点科目(多安排时间): {}\n", subjects.join(", ")));
                }
            }
        }
        
        if let Some(ref weak) = pref.weak_subjects {
            if let Ok(subjects) = serde_json::from_str::<Vec<String>>(weak) {
                if !subjects.is_empty() {
                    prompt.push_str(&format!("薄弱科目(需要加强): {}\n", subjects.join(", ")));
                }
            }
        }
        
        if let Some(exam_date) = pref.exam_date {
            let today = chrono::Local::now().date_naive();
            let days_left = (exam_date - today).num_days();
            prompt.push_str(&format!("距离考试: {}天 ({})\n", days_left, exam_date.format("%Y-%m-%d")));
        }
        
        if let Some(ref notes) = pref.notes {
            prompt.push_str(&format!("用户备注: {}\n", notes));
        }
    } else {
        prompt.push_str("学习时间: 07:00 - 22:00\n");
        prompt.push_str("午休时间: 12:00 - 14:00\n");
    }
    
    if let Some(exam_date) = &context.exam_date {
        prompt.push_str(&format!("考试日期: {}\n", exam_date));
    }
    
    if !context.subjects.is_empty() {
        prompt.push_str(&format!("\n学习科目: {}\n", context.subjects.join(", ")));
        prompt.push_str("（请确保每个科目都有安排，科目之间交替进行）\n");
    }
    
    if !context.incomplete_tasks.is_empty() {
        prompt.push_str(&format!("\n昨日未完成任务（优先安排）:\n{}\n", context.incomplete_tasks.join("\n")));
    }
    
    // 添加最近复盘
    if !recent_reviews.is_empty() {
        prompt.push_str(&format!("\n最近复盘反馈（参考调整计划）:\n{}\n", recent_reviews.join("\n")));
    }
    
    // 添加最近完成的任务
    if !recent_tasks.is_empty() {
        prompt.push_str(&format!("\n最近完成的任务（参考学习进度）:\n{}\n", recent_tasks.join("\n")));
    }
    
    if let Some(review) = &context.review_content {
        prompt.push_str(&format!("\n用户额外说明: {}\n", review));
    }
    
    prompt.push_str(r#"
## 输出要求：
根据用户的学习时间和偏好，生成8-15个学习任务，覆盖全天有效学习时间，科目交替安排。
严格按照以下JSON数组格式返回，不要包含任何其他文字：
[{"start_time": "07:00", "end_time": "08:30", "content": "具体任务内容", "subject": "科目名"}]

注意：
1. subject字段必须是用户提供的科目之一
2. 时间安排要符合用户设定的学习时间和午休时间
3. 重点科目和薄弱科目要多安排时间
4. 任务内容要具体、可执行
"#);

    let client = Client::new();
    
    let request_body = serde_json::json!({
        "model": config.model_name,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1000,
        "temperature": 0.7
    });

    let response = client
        .post(&config.api_endpoint)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("API 返回错误: {}", error_text));
    }

    let ai_response: AIResponse = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let content = ai_response.choices.first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    // 尝试解析 JSON
    let suggestions: Vec<TaskSuggestion> = serde_json::from_str(&content)
        .map_err(|e| format!("解析计划失败: {}，原始内容: {}", e, content))?;

    Ok(suggestions)
}


/// AI 聊天答疑
pub async fn ai_chat(user_id: i64, message: String, history: Vec<crate::models::ChatMessage>) -> Result<String, String> {
    let pool = get_pool();
    
    let config: AIConfig = sqlx::query_as(
        "SELECT id, user_id, api_key, model_name, api_endpoint, updated_at 
         FROM ai_configs WHERE user_id = ?"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|_| "请先配置 AI API".to_string())?;

    // 构建系统提示词
    let system_prompt = r#"你是一个专业的考研学习助手，专门帮助考研学生解答学习问题。你的特点：

1. 专业知识：精通考研各科目（政治、英语、数学、专业课）的知识点和考试技巧
2. 学习方法：熟悉各种高效学习方法、记忆技巧、时间管理方法
3. 心理辅导：能够帮助学生缓解考研压力，调整心态
4. 经验分享：了解考研流程、院校选择、复试准备等

回答要求：
- 回答要简洁明了，重点突出
- 给出具体可操作的建议
- 适当使用emoji让回答更生动
- 如果是学科问题，要给出详细的解题思路
- 鼓励学生，保持积极正面的态度"#;

    // 构建消息列表
    let mut messages = vec![
        serde_json::json!({"role": "system", "content": system_prompt})
    ];
    
    // 添加历史消息
    for msg in history.iter().take(10) {
        messages.push(serde_json::json!({
            "role": msg.role,
            "content": msg.content
        }));
    }
    
    // 添加当前消息
    messages.push(serde_json::json!({"role": "user", "content": message}));

    let client = Client::new();
    
    let request_body = serde_json::json!({
        "model": config.model_name,
        "messages": messages,
        "max_tokens": 1000,
        "temperature": 0.7
    });

    let response = client
        .post(&config.api_endpoint)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("API 返回错误: {}", error_text));
    }

    let ai_response: AIResponse = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let content = ai_response.choices.first()
        .map(|c| c.message.content.clone())
        .unwrap_or_else(|| "抱歉，我暂时无法回答这个问题。".to_string());

    Ok(content)
}
