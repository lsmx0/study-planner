// 统计服务
use crate::db::get_pool;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use rust_decimal::Decimal;

/// 科目学习时长
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubjectStudyTime {
    pub subject_id: i64,
    pub subject_name: String,
    pub subject_color: String,
    pub total_minutes: i64,
}

/// 每日完成率
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyCompletion {
    pub date: NaiveDate,
    pub total_tasks: i64,
    pub completed_tasks: i64,
    pub completion_rate: f64,
}

/// 统计数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Statistics {
    pub total_study_minutes: i64,
    pub total_tasks: i64,
    pub completed_tasks: i64,
    pub completion_rate: f64,
    pub subject_distribution: Vec<SubjectStudyTime>,
    pub daily_trend: Vec<DailyCompletion>,
}

/// 获取统计数据
pub async fn get_stats(user_id: i64, start_date: NaiveDate, end_date: NaiveDate) -> Result<Statistics, String> {
    let pool = get_pool();
    
    // 获取总学习时长 - 使用 CAST 转换为 SIGNED
    let total_minutes_row = sqlx::query(
        "SELECT CAST(COALESCE(SUM(duration_minutes), 0) AS SIGNED) as total FROM pomodoro_sessions 
         WHERE user_id = ? AND status = 'completed' AND DATE(start_time) BETWEEN ? AND ?"
    )
    .bind(user_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("查询学习时长失败: {}", e))?;
    
    let total_study_minutes: i64 = total_minutes_row.get("total");

    // 获取任务统计 - 使用 CAST 转换
    let task_stats_row = sqlx::query(
        "SELECT CAST(COUNT(*) AS SIGNED) as total, 
                CAST(COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS SIGNED) as completed
         FROM tasks WHERE user_id = ? AND task_date BETWEEN ? AND ?"
    )
    .bind(user_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("查询任务统计失败: {}", e))?;

    let total_tasks: i64 = task_stats_row.get("total");
    let completed_tasks: i64 = task_stats_row.get("completed");
    let completion_rate = if total_tasks > 0 {
        (completed_tasks as f64 / total_tasks as f64) * 100.0
    } else {
        0.0
    };

    // 获取科目分布 - 手动映射
    let subject_rows = sqlx::query(
        "SELECT s.id as subject_id, s.name as subject_name, s.color as subject_color, 
                CAST(COALESCE(SUM(p.duration_minutes), 0) AS SIGNED) as total_minutes
         FROM subjects s
         LEFT JOIN pomodoro_sessions p ON s.id = p.subject_id 
            AND p.status = 'completed' AND DATE(p.start_time) BETWEEN ? AND ?
         WHERE s.user_id = ?
         GROUP BY s.id, s.name, s.color
         HAVING total_minutes > 0
         ORDER BY total_minutes DESC"
    )
    .bind(start_date)
    .bind(end_date)
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("查询科目分布失败: {}", e))?;

    let subject_distribution: Vec<SubjectStudyTime> = subject_rows
        .iter()
        .map(|row| SubjectStudyTime {
            subject_id: row.get("subject_id"),
            subject_name: row.get("subject_name"),
            subject_color: row.get("subject_color"),
            total_minutes: row.get("total_minutes"),
        })
        .collect();

    // 获取每日趋势 - 手动映射，处理 DECIMAL 类型
    let daily_rows = sqlx::query(
        "SELECT task_date as date, 
                CAST(COUNT(*) AS SIGNED) as total_tasks, 
                CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS SIGNED) as completed_tasks,
                (SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as completion_rate
         FROM tasks WHERE user_id = ? AND task_date BETWEEN ? AND ?
         GROUP BY task_date ORDER BY task_date"
    )
    .bind(user_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("查询每日趋势失败: {}", e))?;

    let daily_trend: Vec<DailyCompletion> = daily_rows
        .iter()
        .map(|row| {
            let rate: Decimal = row.get("completion_rate");
            DailyCompletion {
                date: row.get("date"),
                total_tasks: row.get("total_tasks"),
                completed_tasks: row.get("completed_tasks"),
                completion_rate: rate.to_string().parse::<f64>().unwrap_or(0.0),
            }
        })
        .collect();

    Ok(Statistics {
        total_study_minutes,
        total_tasks,
        completed_tasks,
        completion_rate,
        subject_distribution,
        daily_trend,
    })
}
