// 科目服务
use crate::db::get_pool;
use crate::models::{Subject, CreateSubjectInput};

/// 获取用户的所有科目
pub async fn get_subjects(user_id: i64) -> Result<Vec<Subject>, String> {
    let pool = get_pool();
    
    let subjects: Vec<Subject> = sqlx::query_as(
        "SELECT id, user_id, name, color, is_default, created_at 
         FROM subjects WHERE user_id = ? ORDER BY is_default DESC, name ASC"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("查询科目失败: {}", e))?;

    Ok(subjects)
}

/// 创建科目
pub async fn create_subject(user_id: i64, input: CreateSubjectInput) -> Result<Subject, String> {
    let pool = get_pool();
    let color = input.color.unwrap_or_else(|| "#3B82F6".to_string());
    
    let result = sqlx::query(
        "INSERT INTO subjects (user_id, name, color, is_default) VALUES (?, ?, ?, FALSE)"
    )
    .bind(user_id)
    .bind(&input.name)
    .bind(&color)
    .execute(pool)
    .await
    .map_err(|e| format!("创建科目失败: {}", e))?;

    let subject_id = result.last_insert_id() as i64;

    let subject: Subject = sqlx::query_as(
        "SELECT id, user_id, name, color, is_default, created_at FROM subjects WHERE id = ?"
    )
    .bind(subject_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("查询科目失败: {}", e))?;

    Ok(subject)
}

/// 删除科目
pub async fn delete_subject(user_id: i64, subject_id: i64) -> Result<(), String> {
    let pool = get_pool();
    
    sqlx::query("DELETE FROM subjects WHERE id = ? AND user_id = ? AND is_default = FALSE")
        .bind(subject_id)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("删除科目失败: {}", e))?;

    Ok(())
}
