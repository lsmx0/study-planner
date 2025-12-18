// 学习偏好服务
use crate::db::get_pool;
use crate::models::{StudyPreference, StudyPreferenceResponse, SaveStudyPreferenceInput};
use chrono::NaiveTime;

/// 获取学习偏好
pub async fn get_study_preference(user_id: i64) -> Result<StudyPreferenceResponse, String> {
    let pool = get_pool();
    
    let pref: Option<StudyPreference> = sqlx::query_as(
        "SELECT * FROM study_preferences WHERE user_id = ?"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("查询学习偏好失败: {}", e))?;

    Ok(pref.map(StudyPreferenceResponse::from).unwrap_or_default())
}

/// 保存学习偏好
pub async fn save_study_preference(user_id: i64, input: SaveStudyPreferenceInput) -> Result<StudyPreferenceResponse, String> {
    let pool = get_pool();
    
    // 解析时间
    let start_time = NaiveTime::parse_from_str(&format!("{}:00", input.start_time), "%H:%M:%S")
        .map_err(|_| "开始时间格式错误")?;
    let end_time = NaiveTime::parse_from_str(&format!("{}:00", input.end_time), "%H:%M:%S")
        .map_err(|_| "结束时间格式错误")?;
    let lunch_start = NaiveTime::parse_from_str(&format!("{}:00", input.lunch_break_start), "%H:%M:%S")
        .map_err(|_| "午休开始时间格式错误")?;
    let lunch_end = NaiveTime::parse_from_str(&format!("{}:00", input.lunch_break_end), "%H:%M:%S")
        .map_err(|_| "午休结束时间格式错误")?;
    
    // 序列化科目列表
    let focus_json = serde_json::to_string(&input.focus_subjects).ok();
    let weak_json = serde_json::to_string(&input.weak_subjects).ok();
    
    // 解析考试日期
    let exam_date = input.exam_date.as_ref().and_then(|d| {
        chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()
    });
    
    // 检查是否已存在
    let existing: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM study_preferences WHERE user_id = ?"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("查询失败: {}", e))?;

    if existing.is_some() {
        // 更新
        sqlx::query(
            "UPDATE study_preferences SET 
             daily_hours = ?, start_time = ?, end_time = ?,
             lunch_break_start = ?, lunch_break_end = ?,
             study_phase = ?, focus_subjects = ?, weak_subjects = ?,
             exam_date = ?, notes = ?
             WHERE user_id = ?"
        )
        .bind(input.daily_hours)
        .bind(start_time)
        .bind(end_time)
        .bind(lunch_start)
        .bind(lunch_end)
        .bind(&input.study_phase)
        .bind(&focus_json)
        .bind(&weak_json)
        .bind(exam_date)
        .bind(&input.notes)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("更新学习偏好失败: {}", e))?;
    } else {
        // 创建
        sqlx::query(
            "INSERT INTO study_preferences 
             (user_id, daily_hours, start_time, end_time, lunch_break_start, lunch_break_end,
              study_phase, focus_subjects, weak_subjects, exam_date, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(user_id)
        .bind(input.daily_hours)
        .bind(start_time)
        .bind(end_time)
        .bind(lunch_start)
        .bind(lunch_end)
        .bind(&input.study_phase)
        .bind(&focus_json)
        .bind(&weak_json)
        .bind(exam_date)
        .bind(&input.notes)
        .execute(pool)
        .await
        .map_err(|e| format!("创建学习偏好失败: {}", e))?;
    }

    get_study_preference(user_id).await
}
