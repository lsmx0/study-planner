// 复盘服务
use crate::db::get_pool;
use crate::models::{DailyReview, SaveReviewInput};
use chrono::NaiveDate;

/// 获取指定日期的复盘
pub async fn get_review_by_date(user_id: i64, date: NaiveDate) -> Result<Option<DailyReview>, String> {
    let pool = get_pool();
    
    let review: Option<DailyReview> = sqlx::query_as(
        "SELECT id, user_id, review_date, feelings, difficulties, ai_suggestions, created_at 
         FROM daily_reviews WHERE user_id = ? AND review_date = ?"
    )
    .bind(user_id)
    .bind(date)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("查询复盘失败: {}", e))?;

    Ok(review)
}

/// 保存复盘 (创建或更新)
pub async fn save_review(user_id: i64, input: SaveReviewInput) -> Result<DailyReview, String> {
    let pool = get_pool();
    
    // 检查是否已存在
    let existing = get_review_by_date(user_id, input.review_date).await?;
    
    if let Some(review) = existing {
        // 更新
        sqlx::query(
            "UPDATE daily_reviews SET feelings = ?, difficulties = ? WHERE id = ?"
        )
        .bind(&input.feelings)
        .bind(&input.difficulties)
        .bind(review.id)
        .execute(pool)
        .await
        .map_err(|e| format!("更新复盘失败: {}", e))?;
        
        get_review_by_date(user_id, input.review_date).await?.ok_or("复盘不存在".to_string())
    } else {
        // 创建
        let result = sqlx::query(
            "INSERT INTO daily_reviews (user_id, review_date, feelings, difficulties) VALUES (?, ?, ?, ?)"
        )
        .bind(user_id)
        .bind(input.review_date)
        .bind(&input.feelings)
        .bind(&input.difficulties)
        .execute(pool)
        .await
        .map_err(|e| format!("创建复盘失败: {}", e))?;

        let review_id = result.last_insert_id() as i64;
        
        let review: DailyReview = sqlx::query_as(
            "SELECT id, user_id, review_date, feelings, difficulties, ai_suggestions, created_at 
             FROM daily_reviews WHERE id = ?"
        )
        .bind(review_id)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("查询复盘失败: {}", e))?;

        Ok(review)
    }
}

/// 获取复盘历史
pub async fn get_review_history(user_id: i64, limit: i32) -> Result<Vec<DailyReview>, String> {
    let pool = get_pool();
    
    let reviews: Vec<DailyReview> = sqlx::query_as(
        "SELECT id, user_id, review_date, feelings, difficulties, ai_suggestions, created_at 
         FROM daily_reviews WHERE user_id = ? ORDER BY review_date DESC LIMIT ?"
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("查询复盘历史失败: {}", e))?;

    Ok(reviews)
}
