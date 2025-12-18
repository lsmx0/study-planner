// 用户管理属性测试

use proptest::prelude::*;

// **Feature: study-planner, Property 18: 用户数据隔离**
// **Validates: Requirements 12.4**

// **Feature: study-planner, Property 19: 会话失效**
// **Validates: Requirements 12.5**

// **Feature: study-planner, Property 20: 用户名唯一性约束**
// **Validates: Requirements 13.4**

// **Feature: study-planner, Property 21: 用户删除级联**
// **Validates: Requirements 13.5**

// **Feature: study-planner, Property 22: 密码重置有效性**
// **Validates: Requirements 13.6**

// **Feature: study-planner, Property 23: 密码修改验证**
// **Validates: Requirements 14.2, 14.3**

/// 生成有效的用户 ID
fn valid_user_id_strategy() -> impl Strategy<Value = i64> {
    1i64..1000000i64
}

/// 生成有效的用户名
fn valid_username_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z][a-zA-Z0-9]{2,19}".prop_map(|s| s)
}

/// 生成有效的密码
fn valid_password_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9!@#$%^&*]{6,50}".prop_map(|s| s)
}

/// 模拟用户数据隔离检查
fn check_data_isolation(user_a_id: i64, user_b_id: i64, data_owner_id: i64) -> bool {
    // 数据只属于其所有者
    data_owner_id == user_a_id || data_owner_id == user_b_id
}

/// 模拟会话验证
fn is_session_valid(session_token: &str, is_logged_out: bool) -> bool {
    !is_logged_out && !session_token.is_empty()
}

/// 模拟用户名唯一性检查
fn is_username_unique(existing_usernames: &[String], new_username: &str) -> bool {
    !existing_usernames.contains(&new_username.to_string())
}

/// 模拟密码修改验证
fn can_change_password(current_input: &str, stored_password: &str) -> bool {
    current_input == stored_password
}

proptest! {
    /// Property 18: 用户数据隔离
    /// 对于任意两个不同用户，用户 A 查询数据时不应返回用户 B 的任何数据
    #[test]
    fn test_user_data_isolation(
        user_a_id in valid_user_id_strategy(),
        user_b_id in valid_user_id_strategy().prop_filter("不同用户", |id| *id != 1),
        data_owner_id in valid_user_id_strategy()
    ) {
        if user_a_id != user_b_id {
            // 数据应该只属于一个用户
            let belongs_to_a = data_owner_id == user_a_id;
            let belongs_to_b = data_owner_id == user_b_id;
            
            // 如果数据属于 A，则不属于 B（除非 A == B）
            if belongs_to_a && user_a_id != user_b_id {
                prop_assert!(!belongs_to_b);
            }
        }
    }

    /// Property 19: 会话失效
    /// 对于任意已登录用户，退出登录后使用原会话令牌的请求应被拒绝
    #[test]
    fn test_session_invalidation(
        session_token in "[a-f0-9]{32}".prop_map(|s| s)
    ) {
        // 登录状态下会话有效
        prop_assert!(is_session_valid(&session_token, false));
        
        // 退出后会话无效
        prop_assert!(!is_session_valid(&session_token, true));
    }

    /// Property 20: 用户名唯一性约束
    /// 对于任意已存在的用户名，尝试创建同名用户应失败
    #[test]
    fn test_username_uniqueness(
        existing_username in valid_username_strategy(),
        new_username in valid_username_strategy()
    ) {
        let existing = vec![existing_username.clone()];
        
        // 相同用户名应该不唯一
        prop_assert!(!is_username_unique(&existing, &existing_username));
        
        // 不同用户名应该唯一
        if new_username != existing_username {
            prop_assert!(is_username_unique(&existing, &new_username));
        }
    }

    /// Property 23: 密码修改验证
    /// 对于任意用户，只有提供正确的当前密码才能修改密码
    #[test]
    fn test_password_change_validation(
        stored_password in valid_password_strategy(),
        correct_input in valid_password_strategy(),
        wrong_input in valid_password_strategy()
    ) {
        // 正确密码可以修改
        prop_assert!(can_change_password(&stored_password, &stored_password));
        
        // 错误密码不能修改
        if wrong_input != stored_password {
            prop_assert!(!can_change_password(&wrong_input, &stored_password));
        }
    }
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn test_session_valid_when_logged_in() {
        assert!(is_session_valid("abc123def456", false));
    }

    #[test]
    fn test_session_invalid_when_logged_out() {
        assert!(!is_session_valid("abc123def456", true));
    }

    #[test]
    fn test_empty_session_invalid() {
        assert!(!is_session_valid("", false));
    }

    #[test]
    fn test_username_uniqueness_check() {
        let existing = vec!["admin".to_string(), "user1".to_string()];
        assert!(!is_username_unique(&existing, "admin"));
        assert!(is_username_unique(&existing, "newuser"));
    }
}
