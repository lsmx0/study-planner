// 数据库连接模块
use sqlx::mysql::{MySqlPool, MySqlPoolOptions};
use std::sync::OnceLock;

// 全局数据库连接池
static DB_POOL: OnceLock<MySqlPool> = OnceLock::new();

// 数据库配置
const DB_HOST: &str = "47.86.24.6";
const DB_USER: &str = "root";
const DB_PASSWORD: &str = "lsmx050320";
const DB_NAME: &str = "study_planner";

/// 初始化数据库连接池
pub async fn init_pool() -> Result<(), sqlx::Error> {
    let database_url = format!(
        "mysql://{}:{}@{}/{}",
        DB_USER, DB_PASSWORD, DB_HOST, DB_NAME
    );

    let pool = MySqlPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    DB_POOL
        .set(pool)
        .map_err(|_| sqlx::Error::Configuration("数据库连接池已初始化".into()))?;

    Ok(())
}

/// 获取数据库连接池
pub fn get_pool() -> &'static MySqlPool {
    DB_POOL.get().expect("数据库连接池未初始化")
}

/// 测试数据库连接
pub async fn test_connection() -> Result<bool, sqlx::Error> {
    let pool = get_pool();
    sqlx::query("SELECT 1").execute(pool).await?;
    Ok(true)
}
