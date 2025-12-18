// 复盘命令
use crate::models::{DailyReview, SaveReviewInput};
use crate::services::{auth_service, review_service};
use chrono::NaiveDate;

/// 获取指定日期的复盘
#[tauri::command]
pub async fn get_review_by_date(
    session_token: String,
    date: NaiveDate,
) -> Result<Option<DailyReview>, String> {
    let user = auth_service::validate_session(&session_token).await?;
    review_service::get_review_by_date(user.id, date).await
}

/// 保存复盘
#[tauri::command]
pub async fn save_review(
    session_token: String,
    review_date: NaiveDate,
    feelings: Option<String>,
    difficulties: Option<String>,
) -> Result<DailyReview, String> {
    let user = auth_service::validate_session(&session_token).await?;
    let input = SaveReviewInput {
        review_date,
        feelings,
        difficulties,
    };
    review_service::save_review(user.id, input).await
}

/// 获取复盘历史
#[tauri::command]
pub async fn get_review_history(
    session_token: String,
    limit: Option<i32>,
) -> Result<Vec<DailyReview>, String> {
    let user = auth_service::validate_session(&session_token).await?;
    review_service::get_review_history(user.id, limit.unwrap_or(30)).await
}
