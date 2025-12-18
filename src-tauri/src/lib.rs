// 考研学习规划助手 - Tauri 后端

// 模块声明
pub mod db;
pub mod models;
pub mod services;
pub mod commands;
pub mod utils;

#[cfg(test)]
mod tests;

/// 测试数据库连接命令
#[tauri::command]
async fn test_db_connection() -> Result<String, String> {
    match db::test_connection().await {
        Ok(_) => Ok("数据库连接成功".to_string()),
        Err(e) => Err(format!("数据库连接失败: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // 初始化数据库连接池
            tauri::async_runtime::spawn(async {
                match db::init_pool().await {
                    Ok(_) => println!("数据库连接池初始化成功"),
                    Err(e) => eprintln!("数据库连接池初始化失败: {}", e),
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            test_db_connection,
            // 认证命令
            commands::auth::login,
            commands::auth::logout,
            commands::auth::change_password,
            commands::auth::get_current_user,
            commands::auth::change_display_name,
            // 用户管理命令
            commands::admin::get_all_users,
            commands::admin::create_user,
            commands::admin::delete_user,
            commands::admin::reset_user_password,
            // 科目命令
            commands::subject::get_subjects,
            commands::subject::create_subject,
            commands::subject::delete_subject,
            // 倒计时命令
            commands::countdown::get_countdowns,
            commands::countdown::create_countdown,
            commands::countdown::delete_countdown,
            // 任务命令
            commands::task::get_tasks_by_date,
            commands::task::create_task,
            commands::task::update_task,
            commands::task::delete_task,
            commands::task::toggle_task_status,
            commands::task::check_content,
            // 番茄钟命令
            commands::pomodoro::start_pomodoro,
            commands::pomodoro::complete_pomodoro,
            commands::pomodoro::cancel_pomodoro,
            commands::pomodoro::get_pomodoro_history,
            // 统计命令
            commands::stats::get_stats,
            // 复盘命令
            commands::review::get_review_by_date,
            commands::review::save_review,
            commands::review::get_review_history,
            // AI 命令
            commands::ai::get_ai_config,
            commands::ai::save_ai_config,
            commands::ai::test_ai_connection,
            commands::ai::generate_ai_plan,
            commands::ai::ai_chat,
            // 学习偏好命令
            commands::preference::get_study_preference,
            commands::preference::save_study_preference,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
