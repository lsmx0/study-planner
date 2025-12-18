// 学习偏好模型
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 学习阶段
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum StudyPhase {
    Foundation,  // 基础阶段
    Strengthen,  // 强化阶段
    Sprint,      // 冲刺阶段
}

impl Default for StudyPhase {
    fn default() -> Self {
        StudyPhase::Foundation
    }
}

impl From<String> for StudyPhase {
    fn from(s: String) -> Self {
        match s.as_str() {
            "strengthen" => StudyPhase::Strengthen,
            "sprint" => StudyPhase::Sprint,
            _ => StudyPhase::Foundation,
        }
    }
}

impl ToString for StudyPhase {
    fn to_string(&self) -> String {
        match self {
            StudyPhase::Foundation => "foundation".to_string(),
            StudyPhase::Strengthen => "strengthen".to_string(),
            StudyPhase::Sprint => "sprint".to_string(),
        }
    }
}

/// 学习偏好数据库模型
#[derive(Debug, Clone, FromRow)]
pub struct StudyPreference {
    pub id: i64,
    pub user_id: i64,
    pub daily_hours: i32,
    pub start_time: chrono::NaiveTime,
    pub end_time: chrono::NaiveTime,
    pub lunch_break_start: chrono::NaiveTime,
    pub lunch_break_end: chrono::NaiveTime,
    pub study_phase: String,
    pub focus_subjects: Option<String>,
    pub weak_subjects: Option<String>,
    pub exam_date: Option<chrono::NaiveDate>,
    pub notes: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

/// 学习偏好响应
#[derive(Debug, Clone, Serialize)]
pub struct StudyPreferenceResponse {
    pub id: i64,
    pub daily_hours: i32,
    pub start_time: String,
    pub end_time: String,
    pub lunch_break_start: String,
    pub lunch_break_end: String,
    pub study_phase: String,
    pub study_phase_label: String,
    pub focus_subjects: Vec<String>,
    pub weak_subjects: Vec<String>,
    pub exam_date: Option<String>,
    pub days_until_exam: Option<i64>,
    pub notes: Option<String>,
}

impl From<StudyPreference> for StudyPreferenceResponse {
    fn from(p: StudyPreference) -> Self {
        let phase_label = match p.study_phase.as_str() {
            "strengthen" => "强化阶段",
            "sprint" => "冲刺阶段",
            _ => "基础阶段",
        };
        
        let focus: Vec<String> = p.focus_subjects
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        
        let weak: Vec<String> = p.weak_subjects
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        
        let days_until = p.exam_date.map(|d| {
            let today = chrono::Local::now().date_naive();
            (d - today).num_days()
        });
        
        StudyPreferenceResponse {
            id: p.id,
            daily_hours: p.daily_hours,
            start_time: p.start_time.format("%H:%M").to_string(),
            end_time: p.end_time.format("%H:%M").to_string(),
            lunch_break_start: p.lunch_break_start.format("%H:%M").to_string(),
            lunch_break_end: p.lunch_break_end.format("%H:%M").to_string(),
            study_phase: p.study_phase,
            study_phase_label: phase_label.to_string(),
            focus_subjects: focus,
            weak_subjects: weak,
            exam_date: p.exam_date.map(|d| d.format("%Y-%m-%d").to_string()),
            days_until_exam: days_until,
            notes: p.notes,
        }
    }
}

/// 保存学习偏好输入
#[derive(Debug, Clone, Deserialize)]
pub struct SaveStudyPreferenceInput {
    pub daily_hours: i32,
    pub start_time: String,
    pub end_time: String,
    pub lunch_break_start: String,
    pub lunch_break_end: String,
    pub study_phase: String,
    pub focus_subjects: Vec<String>,
    pub weak_subjects: Vec<String>,
    pub exam_date: Option<String>,
    pub notes: Option<String>,
}

/// 默认学习偏好响应
impl Default for StudyPreferenceResponse {
    fn default() -> Self {
        StudyPreferenceResponse {
            id: 0,
            daily_hours: 8,
            start_time: "07:00".to_string(),
            end_time: "22:00".to_string(),
            lunch_break_start: "12:00".to_string(),
            lunch_break_end: "14:00".to_string(),
            study_phase: "foundation".to_string(),
            study_phase_label: "基础阶段".to_string(),
            focus_subjects: vec![],
            weak_subjects: vec![],
            exam_date: None,
            days_until_exam: None,
            notes: None,
        }
    }
}
