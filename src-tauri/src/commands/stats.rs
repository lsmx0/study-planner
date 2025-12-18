// 统计命令
use crate::services::{auth_service, stats_service};
use crate::services::stats_service::Statistics;
use chrono::NaiveDate;

/// 获取统计数据
#[tauri::command]
pub async fn get_stats(
    session_token: String,
    start_date: NaiveDate,
    end_date: NaiveDate,
) -> Result<Statistics, String> {
    let user = auth_service::validate_session(&session_token).await?;
    stats_service::get_stats(user.id, start_date, end_date).await
}
